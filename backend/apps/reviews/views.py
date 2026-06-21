from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.submissions.models import Submission
from apps.workflow.models import ReviewerAssignment
from apps.accounts.models import User
from apps.reviews.models import Review
from apps.reviews.services import ReviewService
from apps.reviews.serializers import (
    ReviewerAssignmentCreateSerializer,
    ReviewerAssignmentResponseSerializer,
    ReviewerAssignmentSerializer,
    ReviewSubmitSerializer,
    ReviewSerializer,
)
from config.constants import REVIEWER_RECOMMENDATION_COUNT
from apps.core.recommendations import RecommendationService

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
        submission = get_object_or_404(Submission, pk=submission_id)

        if submission.status != Submission.Status.REVIEWED:
            return Response(
                {
                    'available': False,
                    'reason': 'Reviews are not available until all reviewers have submitted.',
                    'reviews': [],
                },
                status=status.HTTP_200_OK,
            )

        assignments = (
            ReviewerAssignment.objects
            .filter(
                version__submission=submission,
                status=ReviewerAssignment.Status.ACCEPTED,
            )
            .select_related('review')
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
        assignment = get_object_or_404(ReviewerAssignment, pk=assignment_id)

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
#  EDITOR — OVERDUE ASSIGNMENT                                        #
# ------------------------------------------------------------------ #

class OverdueAssignmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, assignment_id):
        assignment = get_object_or_404(ReviewerAssignment, pk=assignment_id)

        assignment = ReviewService.mark_assignment_overdue(
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
            ReviewerAssignment.objects.select_related('submission', 'reviewer'),
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
            ReviewerAssignment.objects.select_related('submission', 'reviewer'),
            pk=assignment_id,
        )

        serializer = ReviewSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review = ReviewService.submit_review(
            reviewer=request.user,
            assignment=assignment,
            recommendation=serializer.validated_data['recommendation'],
            content=serializer.validated_data['content'],
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
        from apps.accounts.models import Role
        from django.core.exceptions import PermissionDenied

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