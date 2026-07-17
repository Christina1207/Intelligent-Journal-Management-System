from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.submissions.models import Submission
from apps.workflow.models import ReviewerAssignment
from apps.accounts.models import Role, User
from apps.reviews.services import ReviewService
from apps.reviews.serializers import (
    EditorDecisionSerializer,
    EditorReviewWorkspaceSerializer,
    ReviewerAssignmentCreateSerializer,
    ReviewerAssignmentResponseSerializer,
    ReviewerAssignmentSerializer,
    ReviewSubmitSerializer,
    ReviewSerializer,
    SubmissionVersionDecisionSerializer,
    ReviewerCandidateSearchQuerySerializer,
    ReviewerCandidateSerializer,
    ReviewerAssignmentCancelSerializer,
    ReviewerAssignmentReplaceSerializer,
)

from apps.reviews.selectors import (
    assigned_editor_reviewer_assignment_or_404,
    assigned_editor_submission_or_404,
    reviewer_assignment_or_404,
    reviewer_candidates_for,
)
from config.constants import (
    REQUIRED_REVIEWS_COUNT,
    REVIEWER_RECOMMENDATION_COUNT,
)
from apps.core.recommendations import RecommendationService
from apps.core.storage import StorageService

# ------------------------------------------------------------------ #
#  EDITOR — ASSIGN REVIEWER                                           #
# ------------------------------------------------------------------ #

class AssignReviewerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, submission_id):
        submission = assigned_editor_submission_or_404(
            editor=request.user,
            submission_id=submission_id,
        )

        serializer = ReviewerAssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reviewer = get_object_or_404(
            User,
            pk=serializer.validated_data['reviewer_id'],
        )

        assignment = ReviewService.assign_reviewer(
            editor=request.user,
            reviewer=reviewer,
            submission=submission,
            response_deadline=serializer.validated_data['response_deadline'],
            review_deadline=serializer.validated_data['review_deadline'],
        )

        return Response(
            ReviewerAssignmentSerializer(
                assignment,
                context={'is_editor': True, 'request': request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


# ------------------------------------------------------------------ #
#  EDITOR — VIEW REVIEWS FOR SUBMISSION                               #
# ------------------------------------------------------------------ #

class SubmissionReviewsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id):
        submission = assigned_editor_submission_or_404(
            editor=request.user,
            submission_id=submission_id,
        )

        current_version = (
            submission.versions
            .order_by("-version_number")
            .first()
        )

        if current_version is None:
            payload = {
                "submission_id": submission.id,
                "submission_status": submission.status,
                "current_version": None,
                "required_reviews": REQUIRED_REVIEWS_COUNT,
                "progress": {
                    "total_invitations": 0,
                    "pending": 0,
                    "accepted": 0,
                    "declined": 0,
                    "expired": 0,
                    "cancelled": 0,
                    "submitted": 0,
                    "overdue": 0,
                },
                "assignments": [],
                "reviews_available": False,
                "reviews_unavailable_reason": (
                    "This submission has no manuscript version."
                ),
                "reviews": [],
                "can_make_decision": False,
            }

            return Response(
                EditorReviewWorkspaceSerializer(
                    payload,
                    context={
                        "is_editor": True,
                        "request": request,
                    },
                ).data,
                status=status.HTTP_200_OK,
            )

        assignments = list(
            ReviewerAssignment.objects.filter(
                version=current_version,
            )
            .select_related(
                "review",
                "reviewer",
                "assigned_by",
                "cancelled_by",
                "version",
                "version__submission",
                "version__submission__section",
            )
            .order_by("assigned_at")
        )

        status_counts = {
            assignment_status: sum(
                assignment.status == assignment_status
                for assignment in assignments
            )
            for assignment_status in ReviewerAssignment.Status.values
        }

        accepted_count = status_counts[
            ReviewerAssignment.Status.ACCEPTED
        ]
        submitted_count = sum(
            hasattr(assignment, "review")
            for assignment in assignments
            if assignment.status == ReviewerAssignment.Status.ACCEPTED
        )
        overdue_count = sum(
            assignment.is_overdue
            for assignment in assignments
        )

        reviews_available = (
            accepted_count >= REQUIRED_REVIEWS_COUNT
            and submitted_count == accepted_count
        )

        if accepted_count < REQUIRED_REVIEWS_COUNT:
            unavailable_reason = (
                f"At least {REQUIRED_REVIEWS_COUNT} accepted reviewers "
                f"are required. Currently accepted: {accepted_count}."
            )
        elif submitted_count < accepted_count:
            remaining_count = accepted_count - submitted_count
            unavailable_reason = (
                f"Waiting for {remaining_count} accepted reviewer"
                f"{'' if remaining_count == 1 else 's'} to submit."
            )
        else:
            unavailable_reason = ""

        reviews = [
            assignment.review
            for assignment in assignments
            if (
                reviews_available
                and assignment.status
                == ReviewerAssignment.Status.ACCEPTED
                and hasattr(assignment, "review")
            )
        ]

        can_make_decision = (
            reviews_available
            and submission.status == Submission.Status.REVIEWED
            and current_version.decision
            == current_version.Decision.PENDING
        )

        payload = {
            "submission_id": submission.id,
            "submission_status": submission.status,
            "current_version": current_version,
            "required_reviews": REQUIRED_REVIEWS_COUNT,
            "progress": {
                "total_invitations": len(assignments),
                "pending": status_counts[
                    ReviewerAssignment.Status.PENDING
                ],
                "accepted": accepted_count,
                "declined": status_counts[
                    ReviewerAssignment.Status.DECLINED
                ],
                "expired": status_counts[
                    ReviewerAssignment.Status.EXPIRED
                ],
                "cancelled": status_counts[
                    ReviewerAssignment.Status.CANCELLED
                ],
                "submitted": submitted_count,
                "overdue": overdue_count,
            },
            "assignments": assignments,
            "reviews_available": reviews_available,
            "reviews_unavailable_reason": unavailable_reason,
            "reviews": reviews,
            "can_make_decision": can_make_decision,
        }

        serializer = EditorReviewWorkspaceSerializer(
            payload,
            context={
                "is_editor": True,
                "request": request,
            },
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

# ------------------------------------------------------------------ #
#  EDITOR — EXPIRE ASSIGNMENT                                         #
# ------------------------------------------------------------------ #

class ExpireAssignmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, assignment_id):
        assignment = assigned_editor_reviewer_assignment_or_404(
            editor=request.user,
            assignment_id=assignment_id,
        )

        assignment = ReviewService.mark_assignment_expired(
            editor=request.user,
            assignment=assignment,
        )

        return Response(
            ReviewerAssignmentSerializer(
                assignment,
                context={'is_editor': True, 'request': request},
            ).data,
            status=status.HTTP_200_OK,
        )


# ------------------------------------------------------------------ #
#  REVIEWER — LIST MY ASSIGNMENTS                                     #
# ------------------------------------------------------------------ #

class MyAssignmentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        assignments = (
            ReviewerAssignment.objects
            .filter(reviewer=request.user)
            .select_related(
                'version__submission__section',
                'assigned_by',
            )
            .order_by('-assigned_at')
        )

        return Response(
            ReviewerAssignmentSerializer(
                assignments,
                many=True,
                context={'is_editor': False, 'request': request},
            ).data,
            status=status.HTTP_200_OK,
        )


# ------------------------------------------------------------------ #
#  REVIEWER — RESPOND TO ASSIGNMENT                                   #
# ------------------------------------------------------------------ #

class RespondToAssignmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, assignment_id):
        assignment = reviewer_assignment_or_404(
            reviewer=request.user,
            assignment_id=assignment_id,
        )

        serializer = ReviewerAssignmentResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment = ReviewService.respond_to_assignment(
            reviewer=request.user,
            assignment=assignment,
            accept=serializer.validated_data['accept'],
        )

        return Response(
            ReviewerAssignmentSerializer(
                assignment,
                context={'is_editor': False, 'request': request},
            ).data,
            status=status.HTTP_200_OK,
        )


# ------------------------------------------------------------------ #
#  REVIEWER — SUBMIT REVIEW                                           #
# ------------------------------------------------------------------ #

class SubmitReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, assignment_id):
        assignment = get_object_or_404(
            ReviewerAssignment.objects.select_related('version__submission__section', 'reviewer'),
            pk=assignment_id,
        )

        serializer = ReviewSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review = ReviewService.submit_review(
            reviewer=request.user,
            assignment=assignment,
            recommendation=serializer.validated_data['recommendation'],
            comments_for_author=serializer.validated_data["comments_for_author"],
            comments_for_editor=serializer.validated_data.get("comments_for_editor", ""),
        )

        return Response(
            ReviewSerializer(review).data,
            status=status.HTTP_201_CREATED,
        )
    
 # ------------------------------------------------------------------ #
#  EDITOR — REVIEWER RECOMMENDATIONS                                  #
# ------------------------------------------------------------------ #

class ReviewerRecommendationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id):

        submission = assigned_editor_submission_or_404(
            editor=request.user,
            submission_id=submission_id,
        )

        # Limit capped at REVIEWER_RECOMMENDATION_COUNT — prevents abuse
        try:
            requested_limit = int(request.query_params.get("limit", REVIEWER_RECOMMENDATION_COUNT))
        except (ValueError, TypeError):
            requested_limit = REVIEWER_RECOMMENDATION_COUNT

        limit = min(requested_limit, REVIEWER_RECOMMENDATION_COUNT)

        recommendations = RecommendationService.get_recommendations(
            submission=submission,
            limit=limit,
        )

        return Response(
            {
                "submission_id": str(submission_id),
                "count": len(recommendations),
                "recommendations": recommendations,
            },
            status=status.HTTP_200_OK,
        )   
    
class MakeEditorDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, submission_id):
        submission = assigned_editor_submission_or_404(
            editor=request.user,
            submission_id=submission_id,
        )

        serializer = EditorDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        version = ReviewService.make_editor_decision(
            editor=request.user,
            submission=submission,
            decision=serializer.validated_data["decision"],
            decision_letter=serializer.validated_data.get("decision_letter", ""),
        )
        submission.refresh_from_db()  # Ensure we have the latest status after decision

        return Response(
            {
                "submission_id": str(submission.id),
                "submission_status": submission.status,
                "version": SubmissionVersionDecisionSerializer(version).data,
            },
            status=status.HTTP_200_OK,
        )
    
class ReviewerCandidateSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id):
        submission = assigned_editor_submission_or_404(
            editor=request.user,
            submission_id=submission_id,
        )

        query_serializer = (
            ReviewerCandidateSearchQuerySerializer(
                data=request.query_params
            )
        )
        query_serializer.is_valid(raise_exception=True)

        search = query_serializer.validated_data["search"]
        limit = query_serializer.validated_data["limit"]

        candidates = list(
            reviewer_candidates_for(
                submission=submission,
                search=search,
            )[:limit]
        )

        return Response(
            {
                "submission_id": str(submission.id),
                "count": len(candidates),
                "candidates": ReviewerCandidateSerializer(
                    candidates,
                    many=True,
                ).data,
            },
            status=status.HTTP_200_OK,
        )

class ReviewerManuscriptDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, assignment_id):
        assignment = get_object_or_404(
            ReviewerAssignment.objects.select_related(
                "reviewer",
                "version__submission",
            ),
            pk=assignment_id,
        )

        if assignment.reviewer_id != request.user.id:
            raise PermissionDenied(
                "You cannot access another reviewer's manuscript."
            )

        if assignment.status != ReviewerAssignment.Status.ACCEPTED:
            raise PermissionDenied(
                "You can access the manuscript only after accepting the review invitation."
            )

        object_name = assignment.version.blinded_file

        if not object_name:
            raise ValidationError(
                "No blinded manuscript file is attached to this submission version."
            )

        storage = StorageService()
        expires_in_seconds = 600

        manuscript_url = storage.get_public_url(
            object_name=object_name,
            expires_in_seconds=expires_in_seconds,
        )

        return Response(
            {
                "assignment_id": str(assignment.id),
                "submission_id": str(assignment.version.submission_id),
                "version_id": str(assignment.version_id),
                "version_number": assignment.version.version_number,
                "expires_in_seconds": expires_in_seconds,
                "manuscript_url": manuscript_url,
            },
            status=status.HTTP_200_OK,
        )

class CancelReviewerAssignmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, assignment_id):
        assignment = (
            assigned_editor_reviewer_assignment_or_404(
                editor=request.user,
                assignment_id=assignment_id,
            )
        )

        serializer = ReviewerAssignmentCancelSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        assignment = ReviewService.cancel_assignment(
            editor=request.user,
            assignment=assignment,
            reason=serializer.validated_data["reason"],
        )

        return Response(
            ReviewerAssignmentSerializer(
                assignment,
                context={
                    "is_editor": True,
                    "request": request,
                },
            ).data,
            status=status.HTTP_200_OK,
        )


class ReplaceReviewerAssignmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, assignment_id):
        assignment = (
            assigned_editor_reviewer_assignment_or_404(
                editor=request.user,
                assignment_id=assignment_id,
            )
        )

        serializer = ReviewerAssignmentReplaceSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        replacement_reviewer = get_object_or_404(
            User,
            pk=serializer.validated_data["reviewer_id"],
        )

        cancelled, replacement = (
            ReviewService.replace_assignment(
                editor=request.user,
                assignment=assignment,
                replacement_reviewer=replacement_reviewer,
                response_deadline=serializer.validated_data[
                    "response_deadline"
                ],
                review_deadline=serializer.validated_data[
                    "review_deadline"
                ],
                reason=serializer.validated_data["reason"],
            )
        )

        return Response(
            {
                "cancelled_assignment": (
                    ReviewerAssignmentSerializer(
                        cancelled,
                        context={
                            "is_editor": True,
                            "request": request,
                        },
                    ).data
                ),
                "replacement_assignment": (
                    ReviewerAssignmentSerializer(
                        replacement,
                        context={
                            "is_editor": True,
                            "request": request,
                        },
                    ).data
                ),
            },
            status=status.HTTP_201_CREATED,
        )