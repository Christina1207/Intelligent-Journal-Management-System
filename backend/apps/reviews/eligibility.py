from django.db.models import Q

from apps.workflow.models import ReviewerAssignment


ACTIVE_REVIEWER_ASSIGNMENT_STATUSES = (
    ReviewerAssignment.Status.PENDING,
    ReviewerAssignment.Status.ACCEPTED,
)


def submission_author_emails(submission) -> set[str]:
    """
    Return normalized identities that must not review this manuscript.

    We use exact email identity for the lightweight conflict check. We do not
    automatically exclude matching affiliations because that would produce
    excessive false positives for large universities.
    """
    emails = set()

    primary_email = (submission.author.email or "").strip().casefold()

    if primary_email:
        emails.add(primary_email)

    coauthor_emails = submission.coauthors.values_list(
        "email",
        flat=True,
    )

    for email in coauthor_emails:
        normalized = (email or "").strip().casefold()

        if normalized:
            emails.add(normalized)

    return emails


def reviewer_identity_conflict_q(
    *,
    submission,
    email_field: str,
) -> Q:
    """
    Build a case-insensitive Q expression for primary-author and coauthor
    identity conflicts.

    `email_field` supports both User querysets (`email`) and reviewer-profile
    querysets (`user__email`).
    """
    conflict_query = Q()

    for email in submission_author_emails(submission):
        conflict_query |= Q(
            **{f"{email_field}__iexact": email}
        )

    return conflict_query