import logging
from django.utils import timezone
from django.db import transaction

from apps.core.embeddings import EmbeddingService
from apps.core.orcid import ORCIDClient
from .models import ReviewerProfile

logger = logging.getLogger(__name__)


class ReviewerProfileService:
    """
    Service layer for reviewer profile and expertise embedding operations.
    All business logic lives here — views and tasks delegate to this service.

    # TODO: Add UserService.assign_role() here when the reviewer application
    # workflow is implemented (Sprint 4). That method will own ReviewerProfile
    # creation atomically on role assignment.
    """

    @staticmethod
    def get_or_create_profile(user) -> ReviewerProfile:
        """
        Retrieve or initialize a ReviewerProfile for the given user.
        Creation is lazy until the reviewer application workflow is built.
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