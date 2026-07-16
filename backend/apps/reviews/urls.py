from django.urls import path
from apps.reviews.views import (
    AssignReviewerView,
    MakeEditorDecisionView,
    SubmissionReviewsView,
    ExpireAssignmentView,
    MyAssignmentsView,
    RespondToAssignmentView,
    SubmitReviewView,
    ReviewerManuscriptDownloadView,
    ReviewerCandidateSearchView,
)
from apps.reviews.views import ReviewerRecommendationsView

editor_urlpatterns = [
    path(
        'submissions/<uuid:submission_id>/assign-reviewer/',
        AssignReviewerView.as_view(),
        name='assign-reviewer',
    ),
    path(
        'submissions/<uuid:submission_id>/reviews/',
        SubmissionReviewsView.as_view(),
        name='submission-reviews',
    ),
    path(
        'assignments/<uuid:assignment_id>/expire/',
        ExpireAssignmentView.as_view(),
        name='expire-assignment',
    ),
    path(
        'submissions/<uuid:submission_id>/reviewer-recommendations/',
        ReviewerRecommendationsView.as_view(),
        name='reviewer-recommendations',
    ),
    path(
        'submissions/<uuid:submission_id>/decision/',
        MakeEditorDecisionView.as_view(),
        name='submission-make-editor-decision',
    ),
    path(
    "submissions/<uuid:submission_id>/reviewer-candidates/",
    ReviewerCandidateSearchView.as_view(),
    name="reviewer-candidates",
    ),
]

reviewer_urlpatterns = [
    path(
        'assignments/',
        MyAssignmentsView.as_view(),
        name='my-assignments',
    ),
    path(
        'assignments/<uuid:assignment_id>/respond/',
        RespondToAssignmentView.as_view(),
        name='respond-assignment',
    ),
    path(
        'assignments/<uuid:assignment_id>/submit-review/',
        SubmitReviewView.as_view(),
        name='submit-review',
    ),
    path(
        'assignments/<uuid:assignment_id>/manuscript/',
        ReviewerManuscriptDownloadView.as_view(),
        name='reviewer-manuscript-download',
    ),
]