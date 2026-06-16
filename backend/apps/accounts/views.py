from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Role
from .tasks import generate_reviewer_expertise_embedding
from .serializers import RegisterSerializer, UserProfileSerializer, ReviewerProfileSerializer


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data)


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

    profile, _ = request.user.reviewer_profile.__class__.objects.get_or_create(
        user=request.user
    )
    serializer = ReviewerProfileSerializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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