from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import (
    SimpleUploadedFile,
)
from django.test import TestCase, override_settings

from apps.integrity.models import PlagiarismScreening
from apps.journals.models import Section
from apps.submissions.models import SubmissionVersion
from apps.submissions.services import SubmissionService


AUTOMATIC_SCREENING_SETTINGS = {
    "PLAGIARISM_ENABLED": True,
    "PLAGIARISM_SOURCE_TYPE": "test_source",
    "PLAGIARISM_PIPELINE_VERSION": (
        "383efcaca1b074cc60bd1fb7a7488f719ae8b183"
    ),
    "PLAGIARISM_CHECKPOINT_ID": (
        "f2_x2_o1_c1/best_model.pt"
    ),
}


@override_settings(**AUTOMATIC_SCREENING_SETTINGS)
class AutomaticSubmissionScreeningTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()

        cls.author = user_model.objects.create_user(
            username="automatic-screening-author",
            email="automatic-screening@example.com",
            password="testpass123",
        )

        cls.section = Section.objects.create(
            name="Automatic Screening Tests",
        )

    def pdf_upload(self, name):
        return SimpleUploadedFile(
            name,
            b"%PDF-1.4\nmanuscript\n%%EOF",
            content_type="application/pdf",
        )

    def create_submission(self, language):
        return SubmissionService.create_submission(
            author=self.author,
            validated_data={
                "title": (
                    f"Automatic screening {language} manuscript"
                ),
                "abstract": (
                    "An abstract for automatic screening tests."
                ),
                "language": language,
                "section": self.section,
            },
            file=self.pdf_upload("full.pdf"),
            blinded_file=self.pdf_upload(
                "blinded.pdf"
            ),
        )

    def configure_storage(self, storage_class):
        storage_class.return_value.upload.side_effect = [
            "submissions/automatic/v1/full/manuscript.pdf",
            (
                "submissions/automatic/v1/blinded/"
                "manuscript.pdf"
            ),
        ]

    def test_arabic_v1_is_screened_after_commit(self):
        with (
            patch(
                "apps.submissions.services.StorageService"
            ) as storage_class,
            patch(
                (
                    "apps.submissions.tasks."
                    "generate_submission_embedding.delay"
                )
            ) as embedding_mock,
            patch(
                (
                    "apps.integrity.services.screenings."
                    "_dispatch_screening"
                )
            ) as dispatch_mock,
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.configure_storage(storage_class)
            submission = self.create_submission("ar")

        initial_version = SubmissionVersion.objects.get(
            submission=submission,
            version_number=1,
        )
        screening = PlagiarismScreening.objects.get(
            submission_version=initial_version,
        )

        self.assertEqual(
            screening.status,
            PlagiarismScreening.Status.QUEUED,
        )
        self.assertIsNone(screening.requested_by)
        self.assertEqual(
            screening.source_type,
            "test_source",
        )

        embedding_mock.assert_called_once_with(
            str(submission.id)
        )
        dispatch_mock.assert_called_once_with(
            screening_id=str(screening.id),
            task_id=screening.celery_task_id,
        )

    def test_non_arabic_submission_is_not_screened(self):
        with (
            patch(
                "apps.submissions.services.StorageService"
            ) as storage_class,
            patch(
                (
                    "apps.submissions.tasks."
                    "generate_submission_embedding.delay"
                )
            ),
            patch(
                (
                    "apps.integrity.services.screenings."
                    "request_initial_plagiarism_screening"
                )
            ) as request_mock,
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.configure_storage(storage_class)
            submission = self.create_submission("en")

        request_mock.assert_not_called()
        self.assertFalse(
            PlagiarismScreening.objects.filter(
                submission_version__submission=submission,
            ).exists()
        )

    @override_settings(PLAGIARISM_ENABLED=False)
    def test_disabled_pipeline_does_not_register_screening(self):
        with (
            patch(
                "apps.submissions.services.StorageService"
            ) as storage_class,
            patch(
                (
                    "apps.submissions.tasks."
                    "generate_submission_embedding.delay"
                )
            ),
            patch(
                (
                    "apps.integrity.services.screenings."
                    "request_initial_plagiarism_screening"
                )
            ) as request_mock,
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.configure_storage(storage_class)
            submission = self.create_submission("ar")

        request_mock.assert_not_called()
        self.assertFalse(
            PlagiarismScreening.objects.filter(
                submission_version__submission=submission,
            ).exists()
        )

    @override_settings(
        PLAGIARISM_SOURCE_TYPE="",
    )
    def test_pipeline_misconfiguration_does_not_fail_submission(
        self,
    ):
        with (
            patch(
                "apps.submissions.services.StorageService"
            ) as storage_class,
            patch(
                (
                    "apps.submissions.tasks."
                    "generate_submission_embedding.delay"
                )
            ),
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.configure_storage(storage_class)
            submission = self.create_submission("ar")

        self.assertTrue(
            submission.versions.filter(
                version_number=1
            ).exists()
        )
        self.assertFalse(
            PlagiarismScreening.objects.filter(
                submission_version__submission=submission,
            ).exists()
        )

    def test_embedding_dispatch_failure_does_not_block_screening(
        self,
    ):
        with (
            patch(
                "apps.submissions.services.StorageService"
            ) as storage_class,
            patch(
                (
                    "apps.submissions.tasks."
                    "generate_submission_embedding.delay"
                ),
                side_effect=RuntimeError(
                    "Simulated embedding broker failure"
                ),
            ),
            patch(
                (
                    "apps.integrity.services.screenings."
                    "_dispatch_screening"
                )
            ) as dispatch_mock,
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.configure_storage(storage_class)
            submission = self.create_submission("ar")

        screening = PlagiarismScreening.objects.get(
            submission_version__submission=submission,
        )

        dispatch_mock.assert_called_once_with(
            screening_id=str(screening.id),
            task_id=screening.celery_task_id,
        )