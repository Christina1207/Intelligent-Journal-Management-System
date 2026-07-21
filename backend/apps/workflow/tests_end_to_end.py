import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, ReviewerProfile
from apps.journals.models import (
    Section,
    SectionEditorMembership,
)
from apps.publishing.models import PublishedArticle
from apps.reviews.models import Review
from apps.submissions.models import Submission, SubmissionVersion
from apps.workflow.constants import get_triage_checklist
from apps.workflow.models import ReviewerAssignment
from config.constants import REQUIRED_REVIEWS_COUNT


class CompleteEditorialWorkflowApiTests(APITestCase):
    """
    Prove the defense-critical workflow through public API contracts:

    submit → triage → editor assignment → review round 1 →
    revision → review round 2 → acceptance → publication draft.

    Only MinIO and Celery are mocked because they are external
    infrastructure boundaries.
    """

    def setUp(self):
        self.roles = {}

        for role_name, _ in Role.RoleName.choices:
            role, _ = Role.objects.get_or_create(
                name=role_name,
            )
            self.roles[role_name] = role

        self.author = self.create_user(
            "gate-author",
            Role.RoleName.AUTHOR,
        )
        self.manager = self.create_user(
            "gate-manager",
            Role.RoleName.SECTION_MANAGER,
        )
        self.editor = self.create_user(
            "gate-editor",
            Role.RoleName.SECTION_EDITOR,
        )

        self.assertGreaterEqual(
            REQUIRED_REVIEWS_COUNT,
            1,
            "The journal must require at least one review.",
        )

        self.reviewers = [
            self.create_user(
                f"gate-reviewer-{index + 1}",
                Role.RoleName.REVIEWER,
            )
            for index in range(REQUIRED_REVIEWS_COUNT)
        ]

        self.section = Section.objects.create(
            name="Defense Workflow Section",
            description="Section used for complete workflow verification.",
            manager=self.manager,
            is_active=True,
        )

        for reviewer in self.reviewers:
            reviewer_profile = ReviewerProfile.objects.create(
                user=reviewer,
            )
            reviewer_profile.sections.add(self.section)

        SectionEditorMembership.objects.create(
            section=self.section,
            editor=self.editor,
            created_by=self.manager,
            is_active=True,
        )

    def create_user(self, username, role_name):
        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
            first_name=username.replace("-", " ").title(),
            last_name="User",
        )
        user.roles.add(self.roles[role_name])
        return user

    def pdf_upload(self, filename, content):
        return SimpleUploadedFile(
            filename,
            b"%PDF-1.4\n" + content + b"\n%%EOF",
            content_type="application/pdf",
        )

    def storage_upload_side_effect(
        self,
        *,
        file_obj,
        submission_id,
        version_number,
        filename,
        variant,
    ):
        return (
            f"submissions/{submission_id}/v{version_number}/"
            f"{variant}/{filename}"
        )

    @patch(
        "apps.submissions.tasks."
        "generate_submission_embedding.delay"
    )
    @patch("apps.submissions.services.StorageService")
    def test_submit_review_revision_acceptance_and_draft_path(
        self,
        storage_class,
        embedding_delay,
    ):
        storage_class.return_value.upload.side_effect = (
            self.storage_upload_side_effect
        )

        # --------------------------------------------------------------
        # 1. Author submits the original full and blinded manuscripts.
        # --------------------------------------------------------------
        self.client.force_authenticate(self.author)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("submission-create"),
                {
                    "title": (
                        "A Complete Intelligent Journal Workflow"
                    ),
                    "abstract": (
                        "A sufficiently detailed abstract for the "
                        "complete editorial workflow integration test."
                    ),
                    "keywords": json.dumps(
                        [
                            "editorial workflow",
                            "peer review",
                            "journal management",
                        ]
                    ),
                    "language": "en",
                    "cover_letter": (
                        "Please consider this manuscript for review."
                    ),
                    "section": str(self.section.id),
                    "file": self.pdf_upload(
                        "manuscript-v1.pdf",
                        b"original full manuscript",
                    ),
                    "blinded_file": self.pdf_upload(
                        "manuscript-v1-blinded.pdf",
                        b"original anonymized manuscript",
                    ),
                },
                format="multipart",
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        submission = Submission.objects.get(
            pk=response.data["id"],
        )
        version_one = submission.versions.get(
            version_number=1,
        )

        self.assertEqual(
            submission.status,
            Submission.Status.SUBMITTED,
        )
        self.assertTrue(version_one.file)
        self.assertTrue(version_one.blinded_file)
        embedding_delay.assert_called_once_with(str(submission.id))

        # --------------------------------------------------------------
        # 2. Section Manager saves and completes initial triage.
        # --------------------------------------------------------------
        triage_checks = [
            {
                "code": definition["code"],
                "result": "PASS",
                "note": "",
            }
            for definition in get_triage_checklist()
            if definition["required"]
        ]

        self.client.force_authenticate(self.manager)

        response = self.client.patch(
            reverse(
                "manager-submission-triage",
                args=[submission.id],
            ),
            {
                "checks": triage_checks,
                "internal_notes": (
                    "The manuscript is suitable for peer review."
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        response = self.client.post(
            reverse(
                "manager-submission-triage-complete",
                args=[submission.id],
            ),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )
        self.assertEqual(response.data["status"], "COMPLETED")
        self.assertEqual(response.data["outcome"], "PROCEED")

        # --------------------------------------------------------------
        # 3. Manager assigns an eligible Section Editor.
        # --------------------------------------------------------------
        response = self.client.post(
            reverse(
                "manager-assign-editor",
                args=[submission.id],
            ),
            {
                "editor_id": str(self.editor.id),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        submission.refresh_from_db()

        self.assertEqual(
            submission.assigned_editor,
            self.editor,
        )
        self.assertEqual(
            submission.status,
            Submission.Status.ASSIGNED,
        )

        # --------------------------------------------------------------
        # 4. Editor invites the required number of reviewers.
        # --------------------------------------------------------------
        self.client.force_authenticate(self.editor)

        invitation_ids = {}
        response_deadline = timezone.now() + timedelta(days=3)
        review_deadline = timezone.now() + timedelta(days=14)

        for reviewer in self.reviewers:
            response = self.client.post(
                reverse(
                    "editor-reviews:assign-reviewer",
                    args=[submission.id],
                ),
                {
                    "reviewer_id": str(reviewer.id),
                    "response_deadline": (
                        response_deadline.isoformat()
                    ),
                    "review_deadline": review_deadline.isoformat(),
                },
                format="json",
            )

            self.assertEqual(
                response.status_code,
                status.HTTP_201_CREATED,
                response.data,
            )
            self.assertEqual(response.data["status"], "PENDING")

            invitation_ids[reviewer.id] = response.data["id"]

        submission.refresh_from_db()

        self.assertEqual(
            submission.status,
            Submission.Status.UNDER_REVIEW,
        )

        # --------------------------------------------------------------
        # 5. Every reviewer accepts the invitation.
        # --------------------------------------------------------------
        for reviewer in self.reviewers:
            self.client.force_authenticate(reviewer)

            response = self.client.post(
                reverse(
                    "reviewer:respond-assignment",
                    args=[invitation_ids[reviewer.id]],
                ),
                {"accept": True},
                format="json",
            )

            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                response.data,
            )
            self.assertEqual(response.data["status"], "ACCEPTED")
            self.assertTrue(
                response.data["can_download_manuscript"]
            )
            self.assertTrue(response.data["can_submit_review"])

        # --------------------------------------------------------------
        # 6. Reviewers submit round-one reports.
        # --------------------------------------------------------------
        for index, reviewer in enumerate(self.reviewers, start=1):
            self.client.force_authenticate(reviewer)

            response = self.client.post(
                reverse(
                    "reviewer:submit-review",
                    args=[invitation_ids[reviewer.id]],
                ),
                {
                    "recommendation": (
                        Review.Recommendation.MINOR_REVISION
                    ),
                    "comments_for_author": (
                        f"Reviewer {index}: clarify the evaluation "
                        "method and improve the discussion."
                    ),
                    "comments_for_editor": (
                        f"Confidential round-one comment {index}."
                    ),
                },
                format="json",
            )

            self.assertEqual(
                response.status_code,
                status.HTTP_201_CREATED,
                response.data,
            )

        submission.refresh_from_db()

        self.assertEqual(
            submission.status,
            Submission.Status.REVIEWED,
        )

        # --------------------------------------------------------------
        # 7. Editor sees the complete round and requests revision.
        # --------------------------------------------------------------
        self.client.force_authenticate(self.editor)

        response = self.client.get(
            reverse(
                "editor-reviews:submission-reviews",
                args=[submission.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )
        self.assertTrue(response.data["reviews_available"])
        self.assertTrue(response.data["can_make_decision"])
        self.assertEqual(
            response.data["progress"]["submitted"],
            REQUIRED_REVIEWS_COUNT,
        )
        self.assertEqual(
            len(response.data["reviews"]),
            REQUIRED_REVIEWS_COUNT,
        )

        decision_letter = (
            "Please submit a revised manuscript addressing all "
            "reviewer comments."
        )

        response = self.client.post(
            reverse(
                "editor-reviews:submission-make-editor-decision",
                args=[submission.id],
            ),
            {
                "decision": (
                    SubmissionVersion.Decision.MINOR_REVISION
                ),
                "decision_letter": decision_letter,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        submission.refresh_from_db()
        version_one.refresh_from_db()

        self.assertEqual(
            submission.status,
            Submission.Status.UNDER_REVISION,
        )
        self.assertEqual(
            version_one.decision,
            SubmissionVersion.Decision.MINOR_REVISION,
        )
        self.assertEqual(
            version_one.decision_letter,
            decision_letter,
        )

        # --------------------------------------------------------------
        # 8. Author sees anonymized feedback only.
        # --------------------------------------------------------------
        self.client.force_authenticate(self.author)

        response = self.client.get(
            reverse(
                "submission-version-list",
                args=[submission.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        author_version_one = response.data["results"][0]

        self.assertEqual(
            author_version_one["version_number"],
            1,
        )
        self.assertEqual(
            len(author_version_one["reviewer_feedback"]),
            REQUIRED_REVIEWS_COUNT,
        )

        serialized_author_history = str(response.data)

        self.assertNotIn(
            "Confidential round-one comment",
            serialized_author_history,
        )

        for reviewer in self.reviewers:
            self.assertNotIn(
                reviewer.email,
                serialized_author_history,
            )
            self.assertNotIn(
                str(reviewer.id),
                serialized_author_history,
            )

        # --------------------------------------------------------------
        # 9. Author uploads full/blinded v2 and response to reviewers.
        # --------------------------------------------------------------
        response_to_reviewers = (
            "We clarified the evaluation methodology, added the "
            "requested experimental details, and expanded the discussion."
        )

        response = self.client.post(
            reverse(
                "submission-revision-upload",
                args=[submission.id],
            ),
            {
                "file": self.pdf_upload(
                    "manuscript-v2.pdf",
                    b"revised full manuscript",
                ),
                "blinded_file": self.pdf_upload(
                    "manuscript-v2-blinded.pdf",
                    b"revised anonymized manuscript",
                ),
                "response_to_reviewers": response_to_reviewers,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )
        self.assertEqual(response.data["version_number"], 2)
        self.assertEqual(
            response.data["response_to_reviewers"],
            response_to_reviewers,
        )

        submission.refresh_from_db()
        version_two = submission.versions.get(
            version_number=2,
        )

        self.assertEqual(
            submission.status,
            Submission.Status.UNDER_REVIEW,
        )
        self.assertTrue(version_two.file)
        self.assertTrue(version_two.blinded_file)

        # --------------------------------------------------------------
        # 10. Carried reviewers see and submit the second round.
        # --------------------------------------------------------------
        for index, reviewer in enumerate(self.reviewers, start=1):
            self.client.force_authenticate(reviewer)

            response = self.client.get(
                reverse("reviewer:my-assignments")
            )

            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                response.data,
            )

            round_two_assignment = next(
                assignment
                for assignment in response.data
                if (
                    assignment["submission"]["id"]
                    == str(submission.id)
                    and assignment["version"]["version_number"] == 2
                )
            )

            self.assertEqual(
                round_two_assignment["status"],
                "ACCEPTED",
            )
            self.assertEqual(
                round_two_assignment["version"][
                    "response_to_reviewers"
                ],
                response_to_reviewers,
            )
            self.assertTrue(
                round_two_assignment["can_download_manuscript"]
            )
            self.assertTrue(
                round_two_assignment["can_submit_review"]
            )

            response = self.client.post(
                reverse(
                    "reviewer:submit-review",
                    args=[round_two_assignment["id"]],
                ),
                {
                    "recommendation": Review.Recommendation.ACCEPT,
                    "comments_for_author": (
                        f"Reviewer {index}: the requested revisions "
                        "have been addressed."
                    ),
                    "comments_for_editor": (
                        f"Confidential round-two comment {index}."
                    ),
                },
                format="json",
            )

            self.assertEqual(
                response.status_code,
                status.HTTP_201_CREATED,
                response.data,
            )

        submission.refresh_from_db()

        self.assertEqual(
            submission.status,
            Submission.Status.REVIEWED,
        )

        # --------------------------------------------------------------
        # 11. Editor accepts the latest reviewed version.
        # --------------------------------------------------------------
        self.client.force_authenticate(self.editor)

        response = self.client.post(
            reverse(
                "editor-reviews:submission-make-editor-decision",
                args=[submission.id],
            ),
            {
                "decision": SubmissionVersion.Decision.ACCEPTED,
                "decision_letter": (
                    "The revised manuscript is accepted for publication."
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        submission.refresh_from_db()
        version_two.refresh_from_db()

        self.assertEqual(
            submission.status,
            Submission.Status.ACCEPTED,
        )
        self.assertEqual(
            version_two.decision,
            SubmissionVersion.Decision.ACCEPTED,
        )

        # --------------------------------------------------------------
        # 12. Editor creates the publication draft from accepted v2.
        # --------------------------------------------------------------
        response = self.client.post(
            reverse(
                "publishing-create-draft",
                args=[submission.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        article = PublishedArticle.objects.get(
            submission=submission,
        )

        self.assertEqual(
            article.status,
            PublishedArticle.Status.DRAFT,
        )
        self.assertEqual(
            article.source_version,
            version_two,
        )
        self.assertEqual(
            article.pdf_file,
            version_two.file,
        )

        # --------------------------------------------------------------
        # Final audit/history assertions.
        # --------------------------------------------------------------
        self.assertEqual(submission.versions.count(), 2)
        self.assertEqual(
            ReviewerAssignment.objects.filter(
                version__submission=submission,
            ).count(),
            REQUIRED_REVIEWS_COUNT * 2,
        )
        self.assertEqual(
            Review.objects.filter(
                assignment__version__submission=submission,
            ).count(),
            REQUIRED_REVIEWS_COUNT * 2,
        )
