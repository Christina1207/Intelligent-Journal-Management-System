from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterator

from django.conf import settings
from minio import Minio

class StorageService:
    """
    Abstraction over MinIO.
    All file operations go through here — swap the underlying
    provider without touching any business logic.
    """

    def __init__(self):
        self.client = self._build_client(settings.MINIO_ENDPOINT)
        self.public_client = None
        self.bucket = settings.MINIO_BUCKET_NAME
        self._ensure_bucket()

    def _build_client(self, endpoint: str) -> Minio:
        return Minio(
            endpoint=endpoint,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL,
            region=settings.MINIO_REGION,
        )

    def _get_public_client(self) -> Minio:
        if self.public_client is None:
            self.public_client = self._build_client(settings.MINIO_PUBLIC_ENDPOINT)
        return self.public_client

    def _ensure_bucket(self):
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def upload(
        self,
        file_obj,
        submission_id: str,
        version_number: int,
        filename: str,
        *,
        variant: str,
    ) -> str:
        """
        Upload a manuscript and return its private object path.

        Paths:
        submissions/{submission_id}/v{version_number}/full/{filename}
        submissions/{submission_id}/v{version_number}/blinded/{filename}
        """
        if variant not in {"full", "blinded"}:
            raise ValueError("Manuscript variant must be 'full' or 'blinded'.")

        safe_filename = Path(filename).name
        object_name = (
            f"submissions/{submission_id}/v{version_number}/"
            f"{variant}/{safe_filename}"
        )

        self.client.put_object(
            bucket_name=self.bucket,
            object_name=object_name,
            data=file_obj,
            length=-1,
            part_size=10 * 1024 * 1024,
            content_type="application/pdf",
        )

        return object_name

    @contextmanager
    def temporary_download(
        self,
        object_name: str,
        *,
        filename: str = "downloaded-object.bin",
    ) -> Iterator[Path]:
        """
        Stream a private MinIO object to an isolated temporary file.

        The file and its containing directory are removed automatically,
        including when processing raises an exception.
        """
        if not object_name:
            raise ValueError("object_name cannot be empty.")

        safe_filename = Path(filename).name
        if not safe_filename:
            raise ValueError("filename cannot be empty.")

        with TemporaryDirectory(prefix="ijms-storage-") as directory:
            destination = Path(directory) / safe_filename

            self.client.fget_object(
                bucket_name=self.bucket,
                object_name=object_name,
                file_path=str(destination),
            )

            yield destination

    def get_url(
        self,
        object_name: str,
        expires_in_seconds: int = 3600,
        *,
        public: bool = False,
    ) -> str:
        """
        Generate a pre-signed URL for temporary access.
        Default expiry: 1 hour.
        """
        from datetime import timedelta

        client = self._get_public_client() if public else self.client
        return client.presigned_get_object(
            bucket_name=self.bucket,
            object_name=object_name,
            expires=timedelta(seconds=expires_in_seconds),
        )

    def get_public_url(self, object_name: str, expires_in_seconds: int = 3600) -> str:
        return self.get_url(
            object_name,
            expires_in_seconds=expires_in_seconds,
            public=True,
        )
    
    def delete(self, object_name: str) -> None:
        self.client.remove_object(
            bucket_name=self.bucket,
            object_name=object_name,
        )
