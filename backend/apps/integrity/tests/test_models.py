from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from apps.integrity.models import PlagiarismScreening
from apps.journals.models import Section
from apps.submissions.models import Submission, SubmissionVersion


class PlagiarismScreeningModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()

        cls.author = user_model.objects.create_user(
            username="integrity-author",
            email="integrity-author@example.com",
            password="testpass123",
        )

        cls.section = Section.objects.create(
            name="Integrity Model Tests",
        )

        cls.submission = Submission.objects.create(
            title="Arabic integrity test manuscript",
            abstract="An abstract used for integrity model tests.",
            language="ar",
            author=cls.author,
            section=cls.section,
        )

        cls.version = SubmissionVersion.objects.create(
            submission=cls.submission,
            version_number=1,
            file="submissions/integrity/v1/manuscript.pdf",
            blinded_file=(
                "submissions/integrity/v1/blinded-manuscript.pdf"
            ),
        )

    def screening_fields(self):
        return {
            "submission_version": self.version,
            "source_type": "exara_test_source",
            "pipeline_version": (
                "383efcaca1b074cc60bd1fb7a7488f719ae8b183"
            ),
            "checkpoint_id": "f2_x2_o1_c1:epoch-7",
        }

    def test_new_screening_defaults_to_queued(self):
        screening = PlagiarismScreening.objects.create(
            **self.screening_fields(),
        )

        self.assertEqual(
            screening.status,
            PlagiarismScreening.Status.QUEUED,
        )
        self.assertEqual(screening.summary, {})
        self.assertEqual(screening.report, {})
        self.assertEqual(screening.error_code, "")
        self.assertEqual(screening.error_message, "")
        self.assertIsNone(screening.started_at)
        self.assertIsNone(screening.completed_at)

    def test_submission_version_cannot_have_two_active_screenings(self):
        PlagiarismScreening.objects.create(
            **self.screening_fields(),
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PlagiarismScreening.objects.create(
                    **self.screening_fields(),
                    status=PlagiarismScreening.Status.RUNNING,
                )

        self.assertEqual(
            PlagiarismScreening.objects.filter(
                submission_version=self.version,
            ).count(),
            1,
        )

    def test_completed_screening_does_not_block_new_screening(self):
        completed = PlagiarismScreening.objects.create(
            **self.screening_fields(),
            status=PlagiarismScreening.Status.COMPLETED,
            report_schema_version="plagiarism_report_v1",
            summary={"flagged_segment_count": 0},
            report={"schema_version": "plagiarism_report_v1"},
            completed_at=timezone.now(),
        )

        queued = PlagiarismScreening.objects.create(
            **self.screening_fields(),
        )

        self.assertNotEqual(completed.id, queued.id)
        self.assertEqual(
            PlagiarismScreening.objects.filter(
                submission_version=self.version,
            ).count(),
            2,
        )