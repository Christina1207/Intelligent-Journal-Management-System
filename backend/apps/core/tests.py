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
