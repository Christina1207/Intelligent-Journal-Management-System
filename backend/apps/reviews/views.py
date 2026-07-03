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
    ReviewerAssignmentCreateSerializer,
    ReviewerAssignmentResponseSerializer,
    ReviewerAssignmentSerializer,
    ReviewSubmitSerializer,
    ReviewSerializer,
    SubmissionVersionDecisionSerializer,
)
from config.constants import REVIEWER_RECOMMENDATION_COUNT
from apps.core.recommendations import RecommendationService
from apps.core.storage import StorageService

# ------------------------------------------------------------------ #
#  EDITOR — ASSIGN REVIEWER                                           #
# ------------------------------------------------------------------ #

class AssignReviewerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, submission_id):
        submission = get_object_or_404(
            Submission.objects.select_related('author', 'section'),
            pk=submission_id,
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
        submission = get_object_or_404(Submission.objects.select_related('assigned_editor'), pk=submission_id)

        if not request.user.has_role(Role.RoleName.SECTION_EDITOR):
            raise PermissionDenied("Only section editors can view submission reviews.")
        
        if submission.assigned_editor_id != request.user.id:
            raise PermissionDenied(
                "Only the assigned section editor can view reviews for this submission."
            )

        if submission.status != Submission.Status.REVIEWED:
            return Response(
                {
                    'available': False,
                    'reason': 'Reviews are not available until all reviewers have submitted.',
                    'reviews': [],
                },
                status=status.HTTP_200_OK,
            )
        current_version = submission.versions.order_by('-version_number').first()
        assignments = (
            ReviewerAssignment.objects
            .filter(
                version=current_version,
                status=ReviewerAssignment.Status.ACCEPTED,
            )
            .select_related('review',"reviewer")
        )

        reviews = [
            a.review for a in assignments
            if hasattr(a, 'review')
        ]

        return Response(
            {
                'available': True,
                'reviews': ReviewSerializer(reviews, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------------------------------------------ #
#  EDITOR — EXPIRE ASSIGNMENT                                         #
# ------------------------------------------------------------------ #

class ExpireAssignmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, assignment_id):
        assignment = get_object_or_404(ReviewerAssignment.objects.select_related("version__submission"), pk=assignment_id)

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
        assignment = get_object_or_404(
            ReviewerAssignment.objects.select_related('version__submission__section', 'reviewer'),
            pk=assignment_id,
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
    from django.core.exceptions import PermissionDenied
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id):

        if not request.user.has_role(Role.RoleName.SECTION_EDITOR):
            raise PermissionDenied("Only section editors can view recommendations.")

        submission = get_object_or_404(
            Submission.objects.select_related("author"),
            pk=submission_id,
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
        submission = get_object_or_404(
            Submission.objects.select_related("assigned_editor"),
            pk=submission_id,
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

        object_name = assignment.version.file

        if not object_name:
            raise ValidationError(
                "No manuscript file is attached to this submission version."
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