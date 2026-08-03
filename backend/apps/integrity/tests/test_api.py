from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role
from apps.integrity.models import PlagiarismScreening
from apps.journals.models import Section
from apps.submissions.models import (
    Submission,
    SubmissionVersion,
)
from apps.workflow.models import TriageAssessment
from apps.workflow.serializers import (
    TriageAssessmentDetailSerializer,
)


API_SCREENING_SETTINGS = {
    "PLAGIARISM_ENABLED": True,
    "PLAGIARISM_SOURCE_TYPE": "test_source",
    "PLAGIARISM_PIPELINE_VERSION": (
        "383efcaca1b074cc60bd1fb7a7488f719ae8b183"
    ),
    "PLAGIARISM_CHECKPOINT_ID": (
        "f2_x2_o1_c1/best_model.pt"
    ),
}


@override_settings(**API_SCREENING_SETTINGS)
class PlagiarismScreeningApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()

        manager_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.SECTION_MANAGER
        )
        author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR
        )

        cls.manager = user_model.objects.create_user(
            username="integrity-api-manager",
            email="integrity-api-manager@example.com",
            password="testpass123",
        )
        cls.manager.roles.add(manager_role)

        cls.other_manager = user_model.objects.create_user(
            username="other-integrity-manager",
            email="other-integrity-manager@example.com",
            password="testpass123",
        )
        cls.other_manager.roles.add(manager_role)

        cls.author = user_model.objects.create_user(
            username="integrity-api-author",
            email="integrity-api-author@example.com",
            password="testpass123",
        )
        cls.author.roles.add(author_role)

        cls.section = Section.objects.create(
            name="Integrity API Tests",
            manager=cls.manager,
        )
        cls.submission = Submission.objects.create(
            title="Arabic API screening manuscript",
            abstract="API screening test abstract.",
            language="ar",
            author=cls.author,
            section=cls.section,
        )
        cls.version = SubmissionVersion.objects.create(
            submission=cls.submission,
            version_number=1,
            file="submissions/api/v1/full/manuscript.pdf",
            blinded_file=(
                "submissions/api/v1/blinded/manuscript.pdf"
            ),
        )

    def list_url(self):
        return reverse(
            "manager-plagiarism-screening-list",
            args=[self.submission.id],
        )

    def detail_url(self, screening):
        return reverse(
            "manager-plagiarism-screening-detail",
            args=[screening.id],
        )

    def response_results(self, response):
        if (
            isinstance(response.data, dict)
            and "results" in response.data
        ):
            return response.data["results"]

        return response.data

    def test_manager_can_request_latest_version(self):
        latest_version = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=2,
            file="submissions/api/v2/full/manuscript.pdf",
            blinded_file=(
                "submissions/api/v2/blinded/manuscript.pdf"
            ),
        )

        self.client.force_authenticate(self.manager)

        response = self.client.post(
            self.list_url(),
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        screening = PlagiarismScreening.objects.get()

        self.assertEqual(
            screening.submission_version,
            latest_version,
        )
        self.assertEqual(
            screening.requested_by,
            self.manager,
        )
        self.assertEqual(
            response.data["status"],
            PlagiarismScreening.Status.QUEUED,
        )

    def test_duplicate_request_returns_existing_screening(self):
        self.client.force_authenticate(self.manager)

        first = self.client.post(
            self.list_url(),
            {},
            format="json",
        )
        second = self.client.post(
            self.list_url(),
            {},
            format="json",
        )

        self.assertEqual(
            first.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            second.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            first.data["id"],
            second.data["id"],
        )
        self.assertEqual(
            PlagiarismScreening.objects.count(),
            1,
        )

    def test_other_manager_cannot_access_submission(self):
        self.client.force_authenticate(
            self.other_manager
        )

        response = self.client.post(
            self.list_url(),
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_author_cannot_access_screening_endpoint(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(self.list_url())

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_summary_omits_report_but_detail_returns_it(self):
        report = {
            "schema_version": "plagiarism_report_v1",
            "summary": {
                "plagiarism_detected": True,
                "flagged_segments_count": 1,
                "flagged_coverage_percent": 12.5,
            },
            "findings": [
                {
                    "finding_id": "finding-1",
                    "source_document_id": "source-1",
                }
            ],
        }

        screening = PlagiarismScreening.objects.create(
            submission_version=self.version,
            requested_by=self.manager,
            status=PlagiarismScreening.Status.COMPLETED,
            source_type="test_source",
            pipeline_version="test-pipeline",
            checkpoint_id="test-checkpoint",
            report_schema_version="plagiarism_report_v1",
            summary=report["summary"],
            report=report,
            completed_at=timezone.now(),
        )

        self.client.force_authenticate(self.manager)

        list_response = self.client.get(
            self.list_url()
        )
        detail_response = self.client.get(
            self.detail_url(screening)
        )

        self.assertEqual(
            list_response.status_code,
            status.HTTP_200_OK,
        )
        summaries = self.response_results(
            list_response
        )
        self.assertNotIn("report", summaries[0])
        self.assertEqual(
            summaries[0]["summary"],
            report["summary"],
        )

        self.assertEqual(
            detail_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            detail_response.data["report"],
            report,
        )

    def test_other_manager_cannot_read_report(self):
        screening = PlagiarismScreening.objects.create(
            submission_version=self.version,
            status=PlagiarismScreening.Status.COMPLETED,
            source_type="test_source",
            pipeline_version="test-pipeline",
            checkpoint_id="test-checkpoint",
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

        self.client.force_authenticate(
            self.other_manager
        )

        response = self.client.get(
            self.detail_url(screening)
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_triage_exposes_latest_screening_summary(self):
        screening = PlagiarismScreening.objects.create(
            submission_version=self.version,
            status=PlagiarismScreening.Status.COMPLETED,
            source_type="test_source",
            pipeline_version="test-pipeline",
            checkpoint_id="test-checkpoint",
            report_schema_version="plagiarism_report_v1",
            summary={
                "plagiarism_detected": False,
            },
            report={
                "schema_version": "plagiarism_report_v1",
                "summary": {
                    "plagiarism_detected": False,
                },
            },
            completed_at=timezone.now(),
        )

        assessment = TriageAssessment(
            submission_version=self.version,
            created_by=self.manager,
        )

        data = TriageAssessmentDetailSerializer(
            assessment
        ).data

        self.assertEqual(
            data["plagiarism_screening"]["id"],
            str(screening.id),
        )
        self.assertEqual(
            data["plagiarism_screening"]["status"],
            PlagiarismScreening.Status.COMPLETED,
        )
        self.assertEqual(
            data["plagiarism_screening"]["summary"],
            {"plagiarism_detected": False},
        )
        self.assertNotIn(
            "report",
            data["plagiarism_screening"],
        )