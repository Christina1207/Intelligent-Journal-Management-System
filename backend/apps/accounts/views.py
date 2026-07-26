from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)

from .models import Role,ReviewerProfile
from .tasks import generate_reviewer_expertise_embedding
from .serializers import (
    CurrentUserProfileUpdateSerializer,
    RegisterSerializer,
    ReviewerProfileSerializer,
    UserProfileSerializer,
    RegistrationResponseSerializer,
    DetailMessageSerializer,
)
from .services import ReviewerProfileService


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