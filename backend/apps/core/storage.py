from minio import Minio
from minio.error import S3Error
from django.conf import settings
import uuid


class StorageService:
    """
    Abstraction over MinIO.
    All file operations go through here — swap the underlying
    provider without touching any business logic.
    """

    def __init__(self):
        self.client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL,
        )
        self.bucket = settings.MINIO_BUCKET_NAME
        self._ensure_bucket()

    def _ensure_bucket(self):
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def upload(self, file_obj, submission_id: str, version_number: int, filename: str) -> str:
        """
        Upload a file and return its object path.
        Path: submissions/{submission_id}/v{version_number}/{filename}
        """
        object_name = f"submissions/{submission_id}/v{version_number}/{filename}"

        self.client.put_object(
            bucket_name=self.bucket,
            object_name=object_name,
            data=file_obj,
            length=-1,
            part_size=10 * 1024 * 1024,  # 10MB parts
            content_type='application/pdf',
        )

        return object_name

    def get_url(self, object_name: str, expires_in_seconds: int = 3600) -> str:
        """
        Generate a pre-signed URL for temporary access.
        Default expiry: 1 hour.
        """
        from datetime import timedelta
        return self.client.presigned_get_object(
            bucket_name=self.bucket,
            object_name=object_name,
            expires=timedelta(seconds=expires_in_seconds),
        )