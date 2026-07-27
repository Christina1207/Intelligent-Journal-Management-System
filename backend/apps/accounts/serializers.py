import re

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.journals.models import Section

from .models import (
    ReviewerApplication,
    ReviewerProfile,
    Role,
    User,
)

CURRENT_USER_PROFILE_UPDATE_FIELDS = (
    "first_name",
    "last_name",
    "orcid",
    "affiliation",
    "country",
)

def normalize_expertise_keywords(value):
    """
    Normalize expertise keywords while preserving their display casing.

    Whitespace-only values are removed and duplicates are compared
    case-insensitively.
    """
    normalized = []
    seen = set()

    for raw_keyword in value:
        keyword = " ".join(str(raw_keyword).split())

        if not keyword:
            continue

        normalized_key = keyword.casefold()

        if normalized_key in seen:
            continue

        seen.add(normalized_key)
        normalized.append(keyword)

    if not 3 <= len(normalized) <= 20:
        raise serializers.ValidationError(
            "Provide between 3 and 20 distinct expertise keywords."
        )

    return normalized


def normalize_reviewer_biography(
    value,
    *,
    minimum_length=0,
):
    biography = value.strip()

    if len(biography) < minimum_length:
        raise serializers.ValidationError(
            f"Biography must contain at least {minimum_length} characters."
        )

    if len(biography) > 5000:
        raise serializers.ValidationError(
            "Biography must contain at most 5000 characters."
        )

    return biography

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
    )
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "orcid",
            "affiliation",
            "country",
        ]
        extra_kwargs = {
            "first_name": {"required": True},
            "last_name": {"required": True},
            "affiliation": {"required": False},
            "country": {"required": False},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Every registered user gets AUTHOR role by default
        #TODO: In the future, we may want to allow users to select additional roles during registration like reviewer
        author_role = Role.objects.get(name=Role.RoleName.AUTHOR)
        user.roles.add(author_role)

        return user


class ReviewerProfileSerializer(serializers.ModelSerializer):
    """
    Exposes reviewer expertise data.

    Sections are assigned by journal staff and are read-only to the
    reviewer. Reviewers must not be able to approve themselves for a
    journal section.
    """

    sections = serializers.StringRelatedField(
        many=True,
        read_only=True,
    )

    class Meta:
        model = ReviewerProfile
        fields = [
            "sections",
            "keywords",
            "biography",
            "publications",
            "last_synced_at",
            "sync_status",
        ]
        read_only_fields = [
            "sections",
            "publications",
            "last_synced_at",
            "sync_status",
        ]
    def validate_keywords(self, value):
        return normalize_expertise_keywords(value)

    def validate_biography(self, value):
        return normalize_reviewer_biography(value)

class ReviewerApplicationSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = [
            "id",
            "name",
            "slug",
        ]
        read_only_fields = fields


class ReviewerApplicationApplicantSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source="get_full_name",
        read_only=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "orcid",
            "affiliation",
            "country",
        ]
        read_only_fields = fields


class ReviewerApplicationDecisionUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source="get_full_name",
        read_only=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
        ]
        read_only_fields = fields


class ReviewerApplicationSubmitSerializer(serializers.Serializer):
    """
    Validates reviewer-application submission and update data.

    The service layer remains responsible for eligibility checks,
    persistence, and application state transitions.
    """
    allowed_fields = {
        "section_id",
        "keywords",
        "biography",
    }

    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError(
                "Expected an object of application fields."
            )

        unsupported_fields = set(data.keys()) - self.allowed_fields

        if unsupported_fields:
            raise serializers.ValidationError(
                {
                    field: "This field cannot be submitted here."
                    for field in sorted(unsupported_fields)
                }
            )

        return super().to_internal_value(data)


    section_id = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        source="section",
        write_only=True,
        error_messages={
            "required": "section_id is required.",
            "does_not_exist": "No section exists with this id.",
            "incorrect_type": "section_id must be a valid UUID.",
        },
    )

    keywords = serializers.ListField(
        child=serializers.CharField(
            max_length=100,
            allow_blank=False,
        ),
        allow_empty=False,
    )

    biography = serializers.CharField(
        max_length=5000,
        allow_blank=False,
        trim_whitespace=False,
    )

    def validate_section_id(self, section):
        if not section.is_active:
            raise serializers.ValidationError(
                "Reviewer applications can only target active sections."
            )

        return section

    def validate_keywords(self, value):
        return normalize_expertise_keywords(value)

    def validate_biography(self, value):
        return normalize_reviewer_biography(
            value,
            minimum_length=50,
        )


class ReviewerApplicationSerializer(serializers.ModelSerializer):
    applicant = ReviewerApplicationApplicantSerializer(
        source="user",
        read_only=True,
    )

    section = ReviewerApplicationSectionSerializer(
        read_only=True,
    )

    reviewed_by = ReviewerApplicationDecisionUserSerializer(
        read_only=True,
    )

    class Meta:
        model = ReviewerApplication
        fields = [
            "id",
            "applicant",
            "section",
            "keywords",
            "biography",
            "status",
            "decision_note",
            "reviewed_by",
            "submitted_at",
            "updated_at",
            "reviewed_at",
        ]
        read_only_fields = fields


class ReviewerApplicationApprovalSerializer(serializers.Serializer):
    decision_note = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=2000,
        trim_whitespace=True,
    )


class ReviewerApplicationRejectionSerializer(serializers.Serializer):
    decision_note = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=2000,
        trim_whitespace=True,
    )

    def validate_decision_note(self, value):
        decision_note = value.strip()

        if not decision_note:
            raise serializers.ValidationError(
                "A rejection reason is required."
            )

        return decision_note

class UserProfileSerializer(serializers.ModelSerializer):
    roles = RoleSerializer(many=True, read_only=True)
    reviewer_profile = ReviewerProfileSerializer(read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "orcid",
            "affiliation",
            "country",
            "status",
            "roles",
            "reviewer_profile",
        ]
        read_only_fields = [
            "id",
            "username",
            "email",
            "status",
            "roles",
            "reviewer_profile",
        ]


class CurrentUserProfileUpdateSerializer(serializers.ModelSerializer):
    allowed_fields = set(CURRENT_USER_PROFILE_UPDATE_FIELDS)

    class Meta:
        model = User
        fields = CURRENT_USER_PROFILE_UPDATE_FIELDS

    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError("Expected an object of profile fields.")

        unsupported_fields = set(data.keys()) - self.allowed_fields
        if unsupported_fields:
            raise serializers.ValidationError(
                {
                    field: "This field cannot be updated here."
                    for field in sorted(unsupported_fields)
                }
            )

        return super().to_internal_value(data)

    def validate_orcid(self, value):
        normalized_value = value.upper()
        if normalized_value and not re.fullmatch(
            r"\d{4}-\d{4}-\d{4}-\d{3}[\dX]",
            normalized_value,
        ):
            raise serializers.ValidationError(
                "ORCID must use the format 0000-0000-0000-0000."
            )
        return normalized_value
class TokenPairSerializer(serializers.Serializer):
    refresh = serializers.CharField()
    access = serializers.CharField()


class RegistrationResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    tokens = TokenPairSerializer()


class DetailMessageSerializer(serializers.Serializer):
    detail = serializers.CharField()