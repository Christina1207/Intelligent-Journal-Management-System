from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.integrity.models import PlagiarismScreening
from apps.integrity.tasks import (
    run_plagiarism_screening,
)
from apps.journals.models import Section
from apps.submissions.models import (
    Submission,
    SubmissionVersion,
)
from plagiarism_core.ingestion.errors import (
    PdfOcrRequiredError,
)


class PlagiarismScreeningTaskTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()

        cls.author = user_model.objects.create_user(
            username="screening-task-author",
            email="screening-task@example.com",
            password="testpass123",
        )

        cls.section = Section.objects.create(
            name="Integrity Task Tests",
        )

        cls.submission = Submission.objects.create(
            title="Arabic plagiarism task manuscript",
            abstract="An abstract for task execution tests.",
            language="ar",
            author=cls.author,
            section=cls.section,
        )

        cls.version = SubmissionVersion.objects.create(
            submission=cls.submission,
            version_number=1,
            file=(
                "submissions/integrity-task/v1/full/"
                "manuscript.pdf"
            ),
            blinded_file=(
                "submissions/integrity-task/v1/blinded/"
                "manuscript.pdf"
            ),
        )

    def setUp(self):
        self.screening = PlagiarismScreening.objects.create(
            submission_version=self.version,
            source_type="test_source",
            pipeline_version=(
                "383efcaca1b074cc60bd1fb7a7488f719ae8b183"
            ),
            checkpoint_id="f2_x2_o1_c1/best_model.pt",
        )

    @contextmanager
    def downloaded_pdf(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "manuscript.pdf"
            path.write_bytes(b"%PDF-test-content")
            yield path

    def test_completed_screening_stores_report(self):
        report = {
            "schema_version": "plagiarism_report_v1",
            "summary": {
                "plagiarism_detected": True,
                "flagged_segments_count": 1,
                "flagged_coverage_percent": 12.5,
            },
            "findings": [{"finding_id": "finding-1"}],
        }

        storage = MagicMock()
        storage.temporary_download.return_value = (
            self.downloaded_pdf()
        )

        checker = MagicMock()
        checker.check_file.return_value = SimpleNamespace(
            report=report,
        )

        with (
            patch(
                "apps.integrity.tasks._execute_screening",
            ) as execute_mock,
        ):
            execute_mock.return_value = report

            result = run_plagiarism_screening.apply(
                args=[str(self.screening.id)],
                task_id="plagiarism-task-1",
            )

        self.assertTrue(result.successful())

        self.screening.refresh_from_db()

        self.assertEqual(
            self.screening.status,
            PlagiarismScreening.Status.COMPLETED,
        )
        self.assertEqual(
            self.screening.celery_task_id,
            "plagiarism-task-1",
        )
        self.assertEqual(
            self.screening.report_schema_version,
            "plagiarism_report_v1",
        )
        self.assertEqual(
            self.screening.summary,
            report["summary"],
        )
        self.assertEqual(self.screening.report, report)
        self.assertIsNotNone(self.screening.started_at)
        self.assertIsNotNone(self.screening.completed_at)
        self.assertEqual(self.screening.error_code, "")
        self.assertEqual(self.screening.error_message, "")

    def test_ingestion_failure_uses_safe_message(self):
        raw_error = (
            "OCR failed at C:\\private\\secret\\manuscript.pdf"
        )

        with patch(
            "apps.integrity.tasks._execute_screening",
            side_effect=PdfOcrRequiredError(raw_error),
        ):
            result = run_plagiarism_screening.apply(
                args=[str(self.screening.id)],
                task_id="plagiarism-task-2",
            )

        self.assertTrue(result.successful())

        self.screening.refresh_from_db()

        self.assertEqual(
            self.screening.status,
            PlagiarismScreening.Status.FAILED,
        )
        self.assertEqual(
            self.screening.error_code,
            "PDF_OCR_REQUIRED",
        )
        self.assertEqual(
            self.screening.error_message,
            (
                "The manuscript has no usable embedded text. "
                "An OCR-processed PDF is required."
            ),
        )
        self.assertNotIn(
            "C:\\private",
            self.screening.error_message,
        )
        self.assertIsNotNone(self.screening.completed_at)

    def test_terminal_screening_is_not_executed_again(self):
        self.screening.status = (
            PlagiarismScreening.Status.COMPLETED
        )
        self.screening.completed_at = timezone.now()
        self.screening.save(
            update_fields=[
                "status",
                "completed_at",
                "updated_at",
            ]
        )

        with patch(
            "apps.integrity.tasks._execute_screening",
        ) as execute_mock:
            result = run_plagiarism_screening.apply(
                args=[str(self.screening.id)],
                task_id="plagiarism-task-3",
            )

        self.assertTrue(result.successful())
        execute_mock.assert_not_called()

    def test_task_is_routed_to_plagiarism_queue(self):
        route = settings.CELERY_TASK_ROUTES[
            "apps.integrity.tasks.run_plagiarism_screening"
        ]

        self.assertEqual(route["queue"], "plagiarism")
        self.assertEqual(
            route["routing_key"],
            "plagiarism",
        )