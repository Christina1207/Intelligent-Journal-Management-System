import logging
from django.utils import timezone
from django.db import transaction
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.core.embeddings import EmbeddingService
from apps.core.orcid import ORCIDClient

from .models import (
    ReviewerApplication,
    ReviewerProfile,
    Role,
    User,
)

logger = logging.getLogger(__name__)


class ReviewerProfileService:
    """
    Service layer for reviewer profile and expertise embedding operations.

    Reviewer profiles are normally created during reviewer-application
    approval. The get-or-create behavior remains as a defensive fallback for
    legacy reviewer accounts and manually created administrative data.
    """

    @staticmethod
    def get_or_create_profile(user) -> ReviewerProfile:
        """
        Retrieve or initialize a ReviewerProfile for an approved reviewer.

        Creation here is retained as a compatibility fallback. The normal
        onboarding path creates the profile during application approval.
        """
        profile, _ = ReviewerProfile.objects.get_or_create(user=user)
        return profile

    @staticmethod
    @transaction.atomic
    def sync_orcid_and_generate_embedding(user) -> ReviewerProfile:
        """
        Full sync cycle for a reviewer:
        1. Fetch publications from ORCID API
        2. Store raw publications on profile
        3. Generate expertise embedding from keywords + biography + publications
        4. Persist embedding and update sync metadata

        Sets sync_status to FAILED gracefully if embedding cannot be generated.
        ORCID fetch failure is non-fatal — embedding still attempted from
        existing keywords and biography.
        """
        profile = ReviewerProfileService.get_or_create_profile(user)

        # Mark as pending at start
        profile.sync_status = ReviewerProfile.SyncStatus.PENDING
        profile.save(update_fields=["sync_status"])

        # Step 1: Fetch ORCID publications — degrade gracefully on failure
        if user.orcid:
            publications = ORCIDClient.fetch_publications(user.orcid)
            if publications:
                profile.publications = publications
                profile.save(update_fields=["publications"])
            else:
                logger.warning(
                    "ORCID fetch returned no publications for user %s — "
                    "proceeding with existing data.",
                    user.id,
                )
        else:
            logger.info(
                "User %s has no ORCID ID — skipping publication fetch.", user.id
            )

        # Step 2: Build embedding input
        # Keywords repeated twice for weighting — see design decision in Sprint 3.
        keywords_str = ", ".join(profile.keywords) if profile.keywords else ""
        pub_titles = [p["title"] for p in profile.publications if p.get("title")]

        texts = [t for t in [keywords_str, keywords_str, profile.biography] + pub_titles if t.strip()]

        if not texts:
            logger.warning(
                "User %s has no content to generate embedding from — "
                "skipping embedding generation.",
                user.id,
            )
            profile.sync_status = ReviewerProfile.SyncStatus.FAILED
            profile.last_synced_at = timezone.now()
            profile.save(update_fields=["sync_status", "last_synced_at"])
            return profile

        # Step 3: Generate and persist embedding
        try:
            embedding = EmbeddingService.generate_combined(texts)
            profile.expertise_embedding = embedding
            profile.sync_status = ReviewerProfile.SyncStatus.COMPLETED
        except Exception as e:
            logger.error(
                "Embedding generation failed for user %s: %s", user.id, str(e)
            )
            profile.sync_status = ReviewerProfile.SyncStatus.FAILED

        profile.last_synced_at = timezone.now()
        profile.save(update_fields=["expertise_embedding", "sync_status", "last_synced_at"])

        return profile

class ReviewerApplicationService:
    """
    Owns reviewer-application eligibility rules, state transitions,
    reviewer role assignment, profile creation, and embedding dispatch.
    """

    MANAGER_ROLE_NAMES = (
        Role.RoleName.EDITOR_IN_CHIEF,
        Role.RoleName.ADMIN,
    )

    APPLICATION_FIELDS = {
        "section",
        "keywords",
        "biography",
    }

    @classmethod
    def _ensure_applicant_is_eligible(cls, user):
        if not user.is_active:
            raise ValidationError(
                {
                    "detail": (
                        "Inactive accounts cannot submit "
                        "reviewer applications."
                    )
                }
            )

        if user.has_role(Role.RoleName.REVIEWER):
            raise ValidationError(
                {
                    "detail": (
                        "This account is already registered "
                        "as a reviewer."
                    )
                }
            )

        required_profile_fields = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "affiliation": user.affiliation,
            "country": user.country,
        }

        missing_fields = [
            field_name
            for field_name, value in required_profile_fields.items()
            if not str(value or "").strip()
        ]

        if missing_fields:
            raise ValidationError(
                {
                    "profile": (
                        "Complete the following profile fields before "
                        "applying: "
                        + ", ".join(missing_fields)
                        + "."
                    )
                }
            )

    @classmethod
    def _ensure_manager_can_decide(cls, user):
        if not user or not user.is_authenticated:
            raise PermissionDenied(
                "Authentication is required."
            )

        if user.is_superuser:
            return

        if not user.roles.filter(
            name__in=cls.MANAGER_ROLE_NAMES
        ).exists():
            raise PermissionDenied(
                "Only the Editor-in-Chief or a system administrator "
                "can manage reviewer applications."
            )

    @staticmethod
    def _ensure_section_is_active(section):
        if not section.is_active:
            raise ValidationError(
                {
                    "section_id": (
                        "Reviewer applications can only target "
                        "active sections."
                    )
                }
            )

    @staticmethod
    def _get_application_for_update(
        *,
        user=None,
        application_id=None,
    ):
        queryset = (
            ReviewerApplication.objects
            .select_related(
                "user",
                "section",
            )
            .select_for_update(of=("self",))
        )

        if user is not None:
            lookup = {"user": user}
        else:
            lookup = {"id": application_id}

        try:
            return queryset.get(**lookup)
        except ReviewerApplication.DoesNotExist as exc:
            raise NotFound(
                "Reviewer application not found."
            ) from exc

    @classmethod
    @transaction.atomic
    def submit_application(
        cls,
        *,
        user,
        section,
        keywords,
        biography,
    ):
        """
        Create the user's only reviewer application.

        Locking the user row prevents concurrent requests from creating
        duplicate one-to-one application records.
        """
        locked_user = (
            User.objects
            .select_for_update()
            .prefetch_related("roles")
            .get(pk=user.pk)
        )

        existing_application = (
            ReviewerApplication.objects
            .filter(user=locked_user)
            .only("status")
            .first()
        )

        if existing_application:
            if (
                existing_application.status
                == ReviewerApplication.Status.PENDING
            ):
                message = (
                    "You already have a pending reviewer application."
                )
            elif (
                existing_application.status
                == ReviewerApplication.Status.REJECTED
            ):
                message = (
                    "Update your rejected application to resubmit it."
                )
            else:
                message = (
                    "Your reviewer application has already been approved."
                )

            raise ValidationError({"detail": message})

        cls._ensure_applicant_is_eligible(locked_user)
        cls._ensure_section_is_active(section)

        return ReviewerApplication.objects.create(
            user=locked_user,
            section=section,
            keywords=keywords,
            biography=biography,
        )

    @classmethod
    @transaction.atomic
    def update_application(
        cls,
        *,
        user,
        **changes,
    ):
        """
        Update a pending application or update and resubmit a rejected one.
        """
        unsupported_fields = (
            set(changes.keys()) - cls.APPLICATION_FIELDS
        )

        if unsupported_fields:
            raise ValidationError(
                {
                    field: "This application field cannot be updated."
                    for field in sorted(unsupported_fields)
                }
            )

        if not changes:
            raise ValidationError(
                {
                    "detail": (
                        "Provide at least one application field "
                        "to update."
                    )
                }
            )

        application = cls._get_application_for_update(user=user)

        if (
            application.status
            == ReviewerApplication.Status.APPROVED
        ):
            raise ValidationError(
                {
                    "detail": (
                        "Approved reviewer applications cannot be edited."
                    )
                }
            )

        if application.status not in {
            ReviewerApplication.Status.PENDING,
            ReviewerApplication.Status.REJECTED,
        }:
            raise ValidationError(
                {
                    "detail": (
                        "This reviewer application cannot currently "
                        "be updated."
                    )
                }
            )

        cls._ensure_applicant_is_eligible(application.user)

        section = changes.get("section")
        if section is not None:
            cls._ensure_section_is_active(section)

        for field_name, value in changes.items():
            setattr(application, field_name, value)

        if (
            application.status
            == ReviewerApplication.Status.REJECTED
        ):
            application.status = ReviewerApplication.Status.PENDING
            application.decision_note = ""
            application.reviewed_by = None
            application.reviewed_at = None
            application.submitted_at = timezone.now()

        application.save()

        return application

    @classmethod
    @transaction.atomic
    def approve_application(
        cls,
        *,
        application_id,
        reviewed_by,
        decision_note="",
    ):
        """
        Approve a pending application atomically.

        Approval grants the reviewer role, creates or refreshes the
        reviewer profile, assigns exactly one section, and dispatches
        embedding generation only after the transaction commits.
        """
        cls._ensure_manager_can_decide(reviewed_by)

        application = cls._get_application_for_update(
            application_id=application_id,
        )

        if (
            application.status
            != ReviewerApplication.Status.PENDING
        ):
            raise ValidationError(
                {
                    "detail": (
                        "Only pending reviewer applications "
                        "can be approved."
                    )
                }
            )

        if not application.user.is_active:
            raise ValidationError(
                {
                    "detail": (
                        "An inactive applicant cannot be approved "
                        "as a reviewer."
                    )
                }
            )

        cls._ensure_section_is_active(application.section)

        reviewer_role = Role.objects.get(
            name=Role.RoleName.REVIEWER,
        )

        application.user.roles.add(reviewer_role)

        profile, _ = ReviewerProfile.objects.get_or_create(
            user=application.user,
        )

        profile.keywords = application.keywords
        profile.biography = application.biography
        profile.expertise_embedding = None
        profile.sync_status = ReviewerProfile.SyncStatus.PENDING
        profile.last_synced_at = None
        profile.save(
            update_fields=[
                "keywords",
                "biography",
                "expertise_embedding",
                "sync_status",
                "last_synced_at",
            ]
        )

        # The application workflow currently approves one section only.
        # set() also removes stale legacy section assignments.
        profile.sections.set([application.section])

        application.status = ReviewerApplication.Status.APPROVED
        application.decision_note = (decision_note or "").strip()
        application.reviewed_by = reviewed_by
        application.reviewed_at = timezone.now()
        application.save(
            update_fields=[
                "status",
                "decision_note",
                "reviewed_by",
                "reviewed_at",
                "updated_at",
            ]
        )

        # Import locally because tasks.py imports ReviewerProfileService.
        # A module-level import here would create a circular import.
        from .tasks import generate_reviewer_expertise_embedding

        reviewer_user_id = str(application.user_id)

        transaction.on_commit(
            lambda: generate_reviewer_expertise_embedding.delay(
                reviewer_user_id
            )
        )

        return application

    @classmethod
    @transaction.atomic
    def reject_application(
        cls,
        *,
        application_id,
        reviewed_by,
        decision_note,
    ):
        """
        Reject a pending application without granting reviewer access.
        """
        cls._ensure_manager_can_decide(reviewed_by)

        normalized_note = (decision_note or "").strip()

        if not normalized_note:
            raise ValidationError(
                {
                    "decision_note": (
                        "A rejection reason is required."
                    )
                }
            )

        application = cls._get_application_for_update(
            application_id=application_id,
        )

        if (
            application.status
            != ReviewerApplication.Status.PENDING
        ):
            raise ValidationError(
                {
                    "detail": (
                        "Only pending reviewer applications "
                        "can be rejected."
                    )
                }
            )

        application.status = ReviewerApplication.Status.REJECTED
        application.decision_note = normalized_note
        application.reviewed_by = reviewed_by
        application.reviewed_at = timezone.now()
        application.save(
            update_fields=[
                "status",
                "decision_note",
                "reviewed_by",
                "reviewed_at",
                "updated_at",
            ]
        )

        return application