import logging
from bertopic import BERTopic
from celery import shared_task
from django.utils import timezone
from umap import UMAP

from config.constants import MIN_SUBMISSIONS_FOR_CLUSTERING, CELERY_TASK_MAX_RETRIES

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def check_and_trigger_section_clustering(self):
    """
    Daily beat task — checks every active section for new submissions
    since last_clustered_at. If the count meets MIN_SUBMISSIONS_FOR_CLUSTERING,
    dispatches a full re-cluster task for that section.

    Sections below threshold are skipped silently — this is expected
    behavior, not an error condition.
    """
    from .models import Section
    from apps.submissions.models import Submission

    sections = Section.objects.filter(is_active=True)
    triggered = 0

    for section in sections:
        filters = {"section": section, "abstract_embedding__isnull": False}
        if section.last_clustered_at:
            filters["submitted_at__gt"] = section.last_clustered_at

        new_count = (
            Submission.objects.filter(**filters)
            .exclude(abstract__isnull=True)
            .exclude(abstract__exact="")
            .count()
        )

        if new_count >= MIN_SUBMISSIONS_FOR_CLUSTERING:
            cluster_section_topics.delay(str(section.id))
            triggered += 1
            logger.info(
                "Section %s has %d new submissions — clustering triggered.",
                section.id, new_count,
            )
        else:
            logger.info(
                "Section %s has %d new submissions — below threshold (%d), skipping.",
                section.id, new_count, MIN_SUBMISSIONS_FOR_CLUSTERING,
            )

    logger.info(
        "check_and_trigger_section_clustering: %d section(s) triggered for clustering.",
        triggered,
    )


@shared_task(
    bind=True,
    max_retries=CELERY_TASK_MAX_RETRIES,
    default_retry_delay=120,
    # TODO Phase 7: exponential backoff via retry_backoff=True
)
def cluster_section_topics(self, section_id: str):
    """
    Full re-cluster for a single section using BERTopic.
    Uses precomputed abstract_embedding (no redundant embedding compute) —
    BERTopic still needs raw abstract text for c-TF-IDF keyword extraction.

    Overwrites all SubmissionTopic rows for this section's submissions.
    Outliers (BERTopic topic -1) get label=None, keywords=[].
    """
    import numpy as np
    from bertopic import BERTopic
    from .models import Section
    from apps.submissions.models import Submission, SubmissionTopic

    try:
        section = Section.objects.get(id=section_id)
    except Section.DoesNotExist:
        logger.error("cluster_section_topics: Section %s not found.", section_id)
        return

    submissions = list(
        Submission.objects.filter(
            section=section,
            abstract_embedding__isnull=False,
        )
        .exclude(abstract__isnull=True)
        .exclude(abstract__exact="")
    )

    if len(submissions) < MIN_SUBMISSIONS_FOR_CLUSTERING:
        logger.warning(
            "cluster_section_topics: Section %s dropped below threshold "
            "(%d submissions) before task ran — skipping.",
            section_id, len(submissions),
        )
        return

    # BERTopic's UMAP step needs more than a couple of points to build a graph.
    if len(submissions) < 3:
        logger.warning(
            "cluster_section_topics: Section %s has only %d submissions — "
            "skipping BERTopic clustering.",
            section_id, len(submissions),
        )
        return

    docs = [s.abstract for s in submissions]
    embeddings = np.array([s.abstract_embedding for s in submissions])

    try:
        n_neighbors = min(15, len(submissions) - 1)
        n_components = min(5, max(1, len(submissions) - 2))
        umap_model = UMAP(n_neighbors=n_neighbors, n_components=n_components, min_dist=0.0, metric="cosine", random_state=42)
        topic_model = BERTopic(min_topic_size=2, umap_model=umap_model)
        topics, _ = topic_model.fit_transform(docs, embeddings=embeddings)
    except Exception as exc:
        logger.error(
            "BERTopic clustering failed for section %s: %s", section_id, str(exc)
        )
        raise self.retry(exc=exc)

    topic_info = topic_model.get_topic_info()
    # Build a lookup: topic_id -> top keywords
    topic_keywords = {}
    for topic_id in topic_info["Topic"]:
        if topic_id == -1:
            continue
        words = topic_model.get_topic(topic_id)
        topic_keywords[topic_id] = [w for w, _ in words[:10]] if words else []

    updated = 0
    for submission, topic_id in zip(submissions, topics):
        if topic_id == -1:
            label = None
            keywords = []
        else:
            label = topic_info.loc[
                topic_info["Topic"] == topic_id, "Name"
            ].values[0]
            keywords = topic_keywords.get(topic_id, [])

        SubmissionTopic.objects.update_or_create(
            submission=submission,
            defaults={"label": label, "keywords": keywords},
        )
        updated += 1

    section.last_clustered_at = timezone.now()
    section.save(update_fields=["last_clustered_at"])

    logger.info(
        "cluster_section_topics: Section %s re-clustered. "
        "%d submissions processed, %d topics found.",
        section_id, updated, len(topic_keywords),
    )