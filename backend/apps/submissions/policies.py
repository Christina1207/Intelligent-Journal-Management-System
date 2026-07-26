from django.core.exceptions import ValidationError

from config.constants import MAX_REVISION_ROUNDS


def revision_rounds_used(submission) -> int:
    """
    Return the number of revised versions already submitted.

    Version 1 is the original manuscript. Versions 2 and above each
    represent one completed revision round.
    """
    version_count = submission.versions.count()

    return max(version_count - 1, 0)


def validate_revision_round_available(submission) -> None:
    """
    Ensure another revised version may be requested and uploaded.

    This policy is called both when the editor requests revision and when
    the author uploads it. The second check protects against stale clients
    and future callers that bypass the normal decision endpoint.
    """
    used_rounds = revision_rounds_used(submission)

    if used_rounds >= MAX_REVISION_ROUNDS:
        raise ValidationError(
            (
                f"Maximum revision rounds ({MAX_REVISION_ROUNDS}) reached. "
                "The latest version must now be accepted or rejected."
            )
        )