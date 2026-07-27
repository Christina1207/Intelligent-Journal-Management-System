from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import NotFound, ValidationError

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)

from .models import Role,ReviewerProfile,ReviewerApplication
from .tasks import generate_reviewer_expertise_embedding
from .serializers import (
    CurrentUserProfileUpdateSerializer,
    DetailMessageSerializer,
    RegisterSerializer,
    RegistrationResponseSerializer,
    ReviewerApplicationApprovalSerializer,
    ReviewerApplicationRejectionSerializer,
    ReviewerApplicationSerializer,
    ReviewerApplicationSubmitSerializer,
    ReviewerProfileSerializer,
    UserProfileSerializer,
)
from .services import ReviewerProfileService,ReviewerApplicationService
from .permissions import CanManageReviewerApplications

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }

@extend_schema(
    tags=["Auth"],
    auth=[],
    request=RegisterSerializer,
    responses={201: RegistrationResponseSerializer},
)
@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        tokens = get_tokens_for_user(user)
        return Response(
            {
                "user": UserProfileSerializer(user).data,
                "tokens": tokens,
            },
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@extend_schema_view(
    get=extend_schema(
        tags=["Auth"],
        responses={200: UserProfileSerializer},
    ),
    patch=extend_schema(
        tags=["Auth"],
        request=CurrentUserProfileUpdateSerializer,
        responses={200: UserProfileSerializer},
    ),
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me_view(request):
    if request.method == "GET":
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    serializer = CurrentUserProfileUpdateSerializer(
        request.user,
        data=request.data,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    return Response(UserProfileSerializer(user).data)

@extend_schema_view(
    get=extend_schema(
        tags=["Reviewer Applications"],
        responses={
            200: ReviewerApplicationSerializer,
            404: OpenApiResponse(
                description="The authenticated user has no application."
            ),
        },
        description=(
            "Return the authenticated user's reviewer application."
        ),
    ),
    post=extend_schema(
        tags=["Reviewer Applications"],
        request=ReviewerApplicationSubmitSerializer,
        responses={
            201: ReviewerApplicationSerializer,
            400: OpenApiResponse(
                description="Invalid application or ineligible applicant."
            ),
        },
        description=(
            "Submit a reviewer application for one active section."
        ),
    ),
    patch=extend_schema(
        tags=["Reviewer Applications"],
        request=ReviewerApplicationSubmitSerializer,
        responses={
            200: ReviewerApplicationSerializer,
            400: OpenApiResponse(
                description="Invalid update or immutable application."
            ),
            404: OpenApiResponse(
                description="Reviewer application not found."
            ),
        },
        description=(
            "Update a pending application or resubmit a rejected one."
        ),
    ),
)
class ReviewerApplicationView(generics.GenericAPIView):
    serializer_class = ReviewerApplicationSubmitSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            application = (
                ReviewerApplication.objects
                .select_related(
                    "user",
                    "section",
                    "reviewed_by",
                )
                .get(user=request.user)
            )
        except ReviewerApplication.DoesNotExist as exc:
            raise NotFound(
                "You have not submitted a reviewer application."
            ) from exc

        return Response(
            ReviewerApplicationSerializer(
                application,
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = self.get_serializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        application = (
            ReviewerApplicationService.submit_application(
                user=request.user,
                **serializer.validated_data,
            )
        )

        return Response(
            ReviewerApplicationSerializer(
                application,
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request):
        serializer = self.get_serializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        application = (
            ReviewerApplicationService.update_application(
                user=request.user,
                **serializer.validated_data,
            )
        )

        return Response(
            ReviewerApplicationSerializer(
                application,
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_200_OK,
        )

@extend_schema(
    tags=["Reviewer Applications"],
    parameters=[
        OpenApiParameter(
            name="status",
            location=OpenApiParameter.QUERY,
            required=False,
            type=OpenApiTypes.STR,
            enum=ReviewerApplication.Status.values,
            description=(
                "Optionally filter applications by status."
            ),
        ),
    ],
    responses={
        200: ReviewerApplicationSerializer(many=True),
        403: OpenApiResponse(
            description=(
                "Only journal-wide editorial administrators "
                "can list applications."
            )
        ),
    },
)
class ReviewerApplicationListView(generics.ListAPIView):
    serializer_class = ReviewerApplicationSerializer
    permission_classes = [CanManageReviewerApplications]

    queryset = (
        ReviewerApplication.objects
        .select_related(
            "user",
            "section",
            "reviewed_by",
        )
        .order_by("-submitted_at")
    )

    def get_queryset(self):
        queryset = super().get_queryset()

        raw_status = self.request.query_params.get("status")

        if not raw_status:
            return queryset

        normalized_status = raw_status.strip().upper()

        if normalized_status not in ReviewerApplication.Status.values:
            allowed_statuses = ", ".join(
                ReviewerApplication.Status.values
            )

            raise ValidationError(
                {
                    "status": (
                        f"Invalid status. Use one of: "
                        f"{allowed_statuses}."
                    )
                }
            )

        return queryset.filter(
            status=normalized_status,
        )

@extend_schema(
    tags=["Reviewer Applications"],
    request=ReviewerApplicationApprovalSerializer,
    responses={
        200: ReviewerApplicationSerializer,
        400: OpenApiResponse(
            description="The application cannot be approved."
        ),
        403: OpenApiResponse(
            description=(
                "The authenticated user cannot manage "
                "reviewer applications."
            )
        ),
        404: OpenApiResponse(
            description="Reviewer application not found."
        ),
    },
)
class ReviewerApplicationApproveView(
    generics.GenericAPIView
):
    serializer_class = ReviewerApplicationApprovalSerializer
    permission_classes = [CanManageReviewerApplications]

    def post(self, request, application_id):
        serializer = self.get_serializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        application = (
            ReviewerApplicationService.approve_application(
                application_id=application_id,
                reviewed_by=request.user,
                **serializer.validated_data,
            )
        )

        return Response(
            ReviewerApplicationSerializer(
                application,
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_200_OK,
        )

@extend_schema(
    tags=["Reviewer Applications"],
    request=ReviewerApplicationRejectionSerializer,
    responses={
        200: ReviewerApplicationSerializer,
        400: OpenApiResponse(
            description="The application cannot be rejected."
        ),
        403: OpenApiResponse(
            description=(
                "The authenticated user cannot manage "
                "reviewer applications."
            )
        ),
        404: OpenApiResponse(
            description="Reviewer application not found."
        ),
    },
)
class ReviewerApplicationRejectView(
    generics.GenericAPIView
):
    serializer_class = ReviewerApplicationRejectionSerializer
    permission_classes = [CanManageReviewerApplications]

    def post(self, request, application_id):
        serializer = self.get_serializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        application = (
            ReviewerApplicationService.reject_application(
                application_id=application_id,
                reviewed_by=request.user,
                **serializer.validated_data,
            )
        )

        return Response(
            ReviewerApplicationSerializer(
                application,
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_200_OK,
        )

@extend_schema(
    tags=["Auth"],
    request=ReviewerProfileSerializer,
    responses={
        200: ReviewerProfileSerializer,
        400: OpenApiResponse(description="Invalid reviewer profile data."),
        401: OpenApiResponse(description="Authentication credentials were not provided."),
        403: OpenApiResponse(description="Only reviewers can update a reviewer profile."),
    },
    description="Update the authenticated reviewer's expertise profile.",
)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def reviewer_profile_update_view(request):
    """
    Allows a reviewer to update their keywords and biography.
    PATCH only — partial updates supported.
    """
    if not request.user.has_role(Role.RoleName.REVIEWER):
        from django.core.exceptions import PermissionDenied
        raise PermissionDenied("Only reviewers can update a reviewer profile.")

    profile = ReviewerProfileService.get_or_create_profile(
        request.user
    )
    serializer = ReviewerProfileSerializer(
        profile,
        data=request.data,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)

    profile = serializer.save(
        expertise_embedding=None,
        sync_status=ReviewerProfile.SyncStatus.PENDING,
        last_synced_at=None,
    )

    return Response(
        ReviewerProfileSerializer(profile).data,
        status=status.HTTP_200_OK,
    )

@extend_schema(
    tags=["Auth"],
    request=None,
    responses={202: DetailMessageSerializer},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_orcid_view(request):
    """
    Manually trigger ORCID sync and embedding regeneration
    for the authenticated reviewer.
    Returns 202 Accepted immediately — task runs async.
    Poll GET /api/v1/auth/me/ to check sync_status and last_synced_at.
    """
    if not request.user.has_role(Role.RoleName.REVIEWER):
        from django.core.exceptions import PermissionDenied
        raise PermissionDenied("Only reviewers can trigger an ORCID sync.")

    generate_reviewer_expertise_embedding.delay(str(request.user.id))

    return Response(
        {"detail": "ORCID sync dispatched. Poll your profile for status updates."},
        status=status.HTTP_202_ACCEPTED,
    )