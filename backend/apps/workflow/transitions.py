from collections.abc import Iterable

from django.core.exceptions import ValidationError

from apps.submissions.models import Submission


ALLOWED_SUBMISSION_TRANSITIONS = {
    Submission.Status.SUBMITTED: frozenset(
        {
            Submission.Status.ASSIGNED,
            Submission.Status.REJECTED,
        }
    ),
    Submission.Status.ASSIGNED: frozenset(
        {
            Submission.Status.UNDER_REVIEW,
        }
    ),
    Submission.Status.UNDER_REVIEW: frozenset(
        {
            Submission.Status.REVIEWED,
        }
    ),
    Submission.Status.REVIEWED: frozenset(
        {
            Submission.Status.ACCEPTED,
            Submission.Status.REJECTED,
            Submission.Status.UNDER_REVISION,
        }
    ),
    Submission.Status.UNDER_REVISION: frozenset(
        {
            Submission.Status.UNDER_REVIEW,
        }
    ),
    Submission.Status.SUSPENDED: frozenset(),
    Submission.Status.REVISED: frozenset(),
    Submission.Status.ACCEPTED: frozenset(),
    Submission.Status.REJECTED: frozenset(),
}


class InvalidSubmissionTransition(ValidationError):
    """Raised when a submission is moved through an illegal state transition."""

    def __init__(self, current_status: str, target_status: str):
        self.current_status = current_status
        self.target_status = target_status

        super().__init__(
            (
                "Submission cannot transition from "
                "%(current_status)s to %(target_status)s."
            ),
            code="invalid_submission_transition",
            params={
                "current_status": current_status,
                "target_status": target_status,
            },
        )


def transition_submission(
    submission: Submission,
    target_status: str,
    *,
    update_fields: Iterable[str] = (),
) -> Submission:
    """
    Validate and persist a Submission status transition.

    Transaction boundaries and row locking remain the responsibility of the
    calling service.
    """
    current_status = submission.status
    allowed_targets = ALLOWED_SUBMISSION_TRANSITIONS.get(
        current_status,
        frozenset(),
    )

    if target_status not in allowed_targets:
        raise InvalidSubmissionTransition(
            current_status=current_status,
            target_status=target_status,
        )

    submission.status = target_status

    fields_to_update = list(
        dict.fromkeys(("status", *update_fields))
    )
    submission.save(update_fields=fields_to_update)

    return submission