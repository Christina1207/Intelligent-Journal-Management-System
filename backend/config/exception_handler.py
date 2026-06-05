from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied

from rest_framework import exceptions as drf_exceptions
from rest_framework.views import exception_handler as drf_exception_handler


def custom_exception_handler(exc, context):
    """
    Converts Django exceptions to DRF exceptions before
    passing to the default DRF handler.

    Django ValidationError  → DRF ValidationError (400)
    Django PermissionDenied → DRF PermissionDenied (403)

    Any exception not handled here falls through to DRF's
    default handler, which returns 500 for unrecognized exceptions.
    """

    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            exc = drf_exceptions.ValidationError(detail=exc.message_dict)
        else:
            exc = drf_exceptions.ValidationError(detail=exc.messages)

    elif isinstance(exc, DjangoPermissionDenied):
        exc = drf_exceptions.PermissionDenied(detail=str(exc))

    return drf_exception_handler(exc, context)