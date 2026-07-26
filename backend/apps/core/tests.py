from types import SimpleNamespace

from apps.core.recommendations import RecommendationService
from unittest.mock import MagicMock, call, patch

from django.test import SimpleTestCase, override_settings

from apps.core.storage import StorageService


@override_settings(
    MINIO_ENDPOINT="minio:9000",
    MINIO_PUBLIC_ENDPOINT="localhost:9000",
    MINIO_ACCESS_KEY="minioadmin",
    MINIO_SECRET_KEY="minioadmin",
    MINIO_BUCKET_NAME="journal-submissions",
    MINIO_REGION="us-east-1",
    MINIO_USE_SSL=False,
)
class StorageServiceTests(SimpleTestCase):
    @patch("apps.core.storage.Minio")
    def test_internal_client_uses_internal_endpoint(self, minio_class):
        internal_client = MagicMock()
        internal_client.bucket_exists.return_value = True
        minio_class.return_value = internal_client

        service = StorageService()

        minio_class.assert_called_once_with(
            endpoint="minio:9000",
            access_key="minioadmin",
            secret_key="minioadmin",
            secure=False,
            region="us-east-1",
        )
        self.assertIs(service.client, internal_client)

    @patch("apps.core.storage.Minio")
    def test_public_url_is_signed_with_public_endpoint(self, minio_class):
        internal_client = MagicMock()
        public_client = MagicMock()
        internal_client.bucket_exists.return_value = True
        public_client.presigned_get_object.return_value = (
            "http://localhost:9000/journal-submissions/submissions/test.pdf"
            "?X-Amz-Signature=signed"
        )
        minio_class.side_effect = [internal_client, public_client]

        service = StorageService()
        url = service.get_public_url(
            "submissions/test.pdf",
            expires_in_seconds=900,
        )

        self.assertTrue(url.startswith("http://localhost:9000/journal-submissions/"))
        minio_class.assert_has_calls(
            [
                call(
                    endpoint="minio:9000",
                    access_key="minioadmin",
                    secret_key="minioadmin",
                    secure=False,
                    region="us-east-1",
                ),
                call(
                    endpoint="localhost:9000",
                    access_key="minioadmin",
                    secret_key="minioadmin",
                    secure=False,
                    region="us-east-1",
                ),
            ]
        )
        public_client.presigned_get_object.assert_called_once()
        internal_client.presigned_get_object.assert_not_called()

    @patch("apps.core.storage.Minio")
    def test_internal_url_generation_still_uses_internal_client(self, minio_class):
        internal_client = MagicMock()
        internal_client.bucket_exists.return_value = True
        internal_client.presigned_get_object.return_value = (
            "http://minio:9000/journal-submissions/submissions/test.pdf"
            "?X-Amz-Signature=signed"
        )
        minio_class.return_value = internal_client

        service = StorageService()
        url = service.get_url("submissions/test.pdf")

        self.assertTrue(url.startswith("http://minio:9000/journal-submissions/"))
        minio_class.assert_called_once()
        internal_client.presigned_get_object.assert_called_once()

class RecommendationScoringTests(SimpleTestCase):
    @patch.multiple(
        "apps.core.recommendations",
        REVIEWER_RECOMMENDATION_SEMANTIC_WEIGHT=0.85,
        REVIEWER_RECOMMENDATION_KEYWORD_WEIGHT=0.15,
    )
    def test_scoring_exposes_semantic_and_keyword_evidence(self):
        profile = SimpleNamespace(
            user=SimpleNamespace(
                id="reviewer-1",
                first_name="Grace",
                last_name="Hopper",
                username="grace",
                email="grace@example.com",
                affiliation="Computing Institute",
            ),
            keywords=[
                "machine learning",
                "compiler design",
            ],
            biography="Researcher in computing.",
            similarity=0.8,
            active_assignment_count=1,
            has_reviewed_before=True,
        )

        recommendation = (
            RecommendationService._serialize_profile(
                profile,
                author_keywords=[
                    "Machine Learning",
                    "Peer Review",
                ],
                topic_keywords=[
                    "Editorial Intelligence",
                ],
            )
        )

        # One of three unique manuscript keywords matched.
        expected_keyword_score = 1 / 3
        expected_score = (
            0.85 * 0.8
            + 0.15 * expected_keyword_score
        )

        self.assertAlmostEqual(
            recommendation["keyword_overlap_score"],
            expected_keyword_score,
            places=4,
        )
        self.assertAlmostEqual(
            recommendation["recommendation_score"],
            expected_score,
            places=4,
        )
        self.assertEqual(
            recommendation["matched_author_keywords"],
            ["Machine Learning"],
        )
        self.assertEqual(
            recommendation["matched_topic_keywords"],
            [],
        )
        self.assertEqual(
            recommendation["active_assignment_count"],
            1,
        )
        self.assertIn(
            "85% semantic similarity",
            recommendation["explanation"],
        )
        self.assertIn(
            "Matched author keywords",
            recommendation["explanation"],
        )

    def test_final_ranking_uses_score_then_workload(self):
        recommendations = [
            {
                "full_name": "Semantic Only",
                "recommendation_score": 0.68,
                "active_assignment_count": 0,
            },
            {
                "full_name": "Semantic And Keyword",
                "recommendation_score": 0.79,
                "active_assignment_count": 1,
            },
            {
                "full_name": "Same Score Lower Workload",
                "recommendation_score": 0.79,
                "active_assignment_count": 0,
            },
        ]

        ranked = (
            RecommendationService._rank_recommendations(
                recommendations,
                limit=3,
            )
        )

        self.assertEqual(
            [
                recommendation["full_name"]
                for recommendation in ranked
            ],
            [
                "Same Score Lower Workload",
                "Semantic And Keyword",
                "Semantic Only",
            ],
        )