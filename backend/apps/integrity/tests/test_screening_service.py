from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.integrity.models import PlagiarismScreening
from apps.integrity.services.screenings import (
    ScreeningRequestError,
    _dispatch_screening,
    request_plagiarism_screening,
)
from apps.journals.models import Section
from apps.submissions.models import (
    Submission,
    SubmissionVersion,
)


SCREENING_SETTINGS = {
    "PLAGIARISM_ENABLED": True,
    "PLAGIARISM_SOURCE_TYPE": "test_source",
    "PLAGIARISM_PIPELINE_VERSION": (
        "383efcaca1b074cc60bd1fb7a7488f719ae8b183"
    ),
    "PLAGIARISM_CHECKPOINT_ID": (
        "f2_x2_o1_c1/best_model.pt"
    ),
}


@override_settings(**SCREENING_SETTINGS)
class ScreeningRequestServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()

        cls.manager = user_model.objects.create_user(
            username="screening-manager",
            email="screening-manager@example.com",
            password="testpass123",
        )
        cls.author = user_model.objects.create_user(
            username="screening-author",
            email="screening-author@example.com",
            password="testpass123",
        )

        cls.section = Section.objects.create(
            name="Screening Service Tests",
            manager=cls.manager,
        )
        cls.submission = Submission.objects.create(
            title="Arabic screening service manuscript",
            abstract="Service test abstract.",
            language="ar",
            author=cls.author,
            section=cls.section,
        )
        cls.version = SubmissionVersion.objects.create(
            submission=cls.submission,
            version_number=1,
            file="submissions/service/v1/full/manuscript.pdf",
            blinded_file=(
                "submissions/service/v1/blinded/manuscript.pdf"
            ),
        )

    @patch(
        "apps.integrity.services.screenings."
        "_dispatch_screening"
    )
    def test_creates_and_dispatches_after_commit(
        self,
        dispatch_mock,
    ):
        with self.captureOnCommitCallbacks(
            execute=True
        ):
            result = request_plagiarism_screening(
                submission_version=self.version,
                requested_by=self.manager,
            )

        self.assertTrue(result.created)
        self.assertEqual(
            result.screening.status,
            PlagiarismScreening.Status.QUEUED,
        )
        self.assertEqual(
            result.screening.requested_by,
            self.manager,
        )
        self.assertEqual(
            result.screening.source_type,
            "test_source",
        )
        self.assertTrue(
            result.screening.celery_task_id
        )

        dispatch_mock.assert_called_once_with(
            screening_id=str(result.screening.id),
            task_id=result.screening.celery_task_id,
        )

    @patch(
        "apps.integrity.services.screenings."
        "_dispatch_screening"
    )
    def test_duplicate_active_request_is_idempotent(
        self,
        dispatch_mock,
    ):
        with self.captureOnCommitCallbacks(
            execute=True
        ):
            first = request_plagiarism_screening(
                submission_version=self.version,
                requested_by=self.manager,
            )
            second = request_plagiarism_screening(
                submission_version=self.version,
                requested_by=self.manager,
            )

        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(
            first.screening.id,
            second.screening.id,
        )
        self.assertEqual(
            PlagiarismScreening.objects.count(),
            1,
        )
        dispatch_mock.assert_called_once()

    def test_unsupported_language_is_rejected(self):
        self.submission.language = "en"
        self.submission.save(
            update_fields=["language"]
        )

        with self.assertRaises(
            ScreeningRequestError
        ) as context:
            request_plagiarism_screening(
                submission_version=self.version,
                requested_by=self.manager,
            )

        self.assertEqual(
            context.exception.code,
            "UNSUPPORTED_LANGUAGE",
        )
        self.assertEqual(
            PlagiarismScreening.objects.count(),
            0,
        )

    def test_dispatch_failure_is_stored_safely(self):
        screening = PlagiarismScreening.objects.create(
            submission_version=self.version,
            celery_task_id="dispatch-test-task",
            source_type="test_source",
            pipeline_version="test-pipeline",
            checkpoint_id="test-checkpoint",
        )

        with patch(
            "apps.integrity.tasks."
            "run_plagiarism_screening.apply_async",
            side_effect=RuntimeError(
                "redis://user:secret@private-host"
            ),
        ):
            _dispatch_screening(
                screening_id=str(screening.id),
                task_id="dispatch-test-task",
            )

        screening.refresh_from_db()

        self.assertEqual(
            screening.status,
            PlagiarismScreening.Status.FAILED,
        )
        self.assertEqual(
            screening.error_code,
            "TASK_DISPATCH_FAILED",
        )
        self.assertNotIn(
            "secret",
            screening.error_message,
        )
        self.assertIsNotNone(
            screening.completed_at,
        )

    @patch(
        "apps.integrity.services.screenings."
        "_dispatch_screening"
    )
    def test_completed_screening_allows_new_request(
        self,
        dispatch_mock,
    ):
        PlagiarismScreening.objects.create(
            submission_version=self.version,
            status=PlagiarismScreening.Status.COMPLETED,
            source_type="old-source",
            pipeline_version="old-pipeline",
            checkpoint_id="old-checkpoint",
            report_schema_version="plagiarism_report_v1",
            summary={"plagiarism_detected": False},
            report={
                "schema_version": "plagiarism_report_v1",
                "summary": {
                    "plagiarism_detected": False,
                },
            },
            completed_at=timezone.now(),
        )

        with self.captureOnCommitCallbacks(
            execute=True
        ):
            result = request_plagiarism_screening(
                submission_version=self.version,
                requested_by=self.manager,
            )

        self.assertTrue(result.created)
        self.assertEqual(
            PlagiarismScreening.objects.count(),
            2,
        )
        dispatch_mock.assert_called_once()