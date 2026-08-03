from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import (
    APIException,
    ValidationError,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.integrity.models import PlagiarismScreening
from apps.integrity.permissions import (
    CanManagePlagiarismScreenings,
)
from apps.integrity.serializers import (
    PlagiarismScreeningDetailSerializer,
    PlagiarismScreeningSummarySerializer,
)
from apps.integrity.services.screenings import (
    ScreeningRequestError,
    request_plagiarism_screening,
)
from apps.submissions.models import Submission


class PlagiarismServiceUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_code = "plagiarism_service_unavailable"


def _raise_request_error(
    error: ScreeningRequestError,
) -> None:
    detail = {
        "code": error.code,
        "message": error.message,
    }

    if error.code in {
        "PLAGIARISM_DISABLED",
        "PIPELINE_NOT_CONFIGURED",
    }:
        raise PlagiarismServiceUnavailable(detail)

    raise ValidationError(
        {
            "screening": detail,
        }
    )


class ManagerPlagiarismScreeningListCreateView(
    generics.GenericAPIView
):
    permission_classes = [
        IsAuthenticated,
        CanManagePlagiarismScreenings,
    ]
    serializer_class = (
        PlagiarismScreeningSummarySerializer
    )

    def get_submission(self):
        if not hasattr(self, "_managed_submission"):
            self._managed_submission = get_object_or_404(
                Submission.objects.select_related("section"),
                id=self.kwargs["submission_id"],
                section__manager=self.request.user,
            )

        return self._managed_submission

    def get_queryset(self):
        submission = self.get_submission()

        return (
            PlagiarismScreening.objects
            .filter(
                submission_version__submission=submission,
            )
            .select_related(
                "submission_version",
                "requested_by",
            )
            .order_by("-created_at")
        )

    @extend_schema(
        responses={
            200: PlagiarismScreeningSummarySerializer(
                many=True
            ),
        },
        summary="List plagiarism screenings",
        description=(
            "List plagiarism screening history for a submission "
            "in a section managed by the authenticated user."
        ),
    )
    def get(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(
                page,
                many=True,
            )
            return self.get_paginated_response(
                serializer.data
            )

        serializer = self.get_serializer(
            queryset,
            many=True,
        )
        return Response(serializer.data)

    @extend_schema(
        request=None,
        responses={
            200: PlagiarismScreeningSummarySerializer,
            201: PlagiarismScreeningSummarySerializer,
        },
        summary="Request plagiarism screening",
        description=(
            "Request screening of the submission's latest version. "
            "If that version already has a queued or running screening, "
            "the existing record is returned instead."
        ),
    )
    def post(self, request, *args, **kwargs):
        submission = self.get_submission()

        latest_version = (
            submission.versions
            .order_by("-version_number")
            .first()
        )

        if latest_version is None:
            raise ValidationError(
                {
                    "submission": (
                        "The submission has no manuscript version."
                    )
                }
            )

        try:
            result = request_plagiarism_screening(
                submission_version=latest_version,
                requested_by=request.user,
            )
        except ScreeningRequestError as error:
            _raise_request_error(error)

        # The on-commit callback may already have marked dispatch
        # as failed or the worker may have claimed the screening.
        result.screening.refresh_from_db()

        response_status = (
            status.HTTP_201_CREATED
            if result.created
            else status.HTTP_200_OK
        )

        return Response(
            self.get_serializer(result.screening).data,
            status=response_status,
        )


class ManagerPlagiarismScreeningDetailView(
    generics.RetrieveAPIView
):
    permission_classes = [
        IsAuthenticated,
        CanManagePlagiarismScreenings,
    ]
    serializer_class = (
        PlagiarismScreeningDetailSerializer
    )
    lookup_field = "id"
    lookup_url_kwarg = "screening_id"

    def get_queryset(self):
        return (
            PlagiarismScreening.objects
            .filter(
                submission_version__submission__section__manager=(
                    self.request.user
                ),
            )
            .select_related(
                "submission_version",
                "requested_by",
            )
        )

    @extend_schema(
        responses={
            200: PlagiarismScreeningDetailSerializer,
        },
        summary="Get plagiarism screening report",
        description=(
            "Return a complete plagiarism report only when the "
            "submission belongs to a section managed by the "
            "authenticated Section Manager."
        ),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)