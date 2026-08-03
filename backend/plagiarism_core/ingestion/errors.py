from __future__ import annotations


class DocumentIngestionError(ValueError):
    """Base error for invalid or unsupported submitted files."""


class UnsupportedDocumentTypeError(DocumentIngestionError):
    """Raised when no configured extractor supports the submitted file."""


class InvalidDocumentError(DocumentIngestionError):
    """Raised when a submitted file is empty, malformed, or unreadable."""


class DocumentTooLargeError(DocumentIngestionError):
    """Raised when a submitted file exceeds the configured size limit."""


class EncryptedPdfError(DocumentIngestionError):
    """Raised when a PDF requires a password before its text can be read."""


class PdfOcrRequiredError(DocumentIngestionError):
    """Raised when a PDF has no usable embedded text layer."""
