from unittest.mock import patch

from django.test import SimpleTestCase

from apps.submissions.models import Submission
from apps.workflow.transitions import (
    ALLOWED_SUBMISSION_TRANSITIONS,
    InvalidSubmissionTransition,
    transition_submission,
)


class SubmissionTransitionTests(SimpleTestCase):
    LEGAL_TRANSITIONS = (
        (
            Submission.Status.SUBMITTED,
            Submission.Status.ASSIGNED,
        ),
        (
            Submission.Status.SUBMITTED,
            Submission.Status.REJECTED,
        ),
        (
            Submission.Status.ASSIGNED,
            Submission.Status.UNDER_REVIEW,
        ),
        (
            Submission.Status.UNDER_REVIEW,
            Submission.Status.REVIEWED,
        ),
        (
            Submission.Status.REVIEWED,
            Submission.Status.ACCEPTED,
        ),
        (
            Submission.Status.REVIEWED,
            Submission.Status.REJECTED,
        ),
        (
            Submission.Status.REVIEWED,
            Submission.Status.UNDER_REVISION,
        ),
        (
            Submission.Status.UNDER_REVISION,
            Submission.Status.UNDER_REVIEW,
        ),
    )

    ILLEGAL_TRANSITIONS = (
        (
            Submission.Status.SUBMITTED,
            Submission.Status.ACCEPTED,
        ),
        (
            Submission.Status.UNDER_REVIEW,
            Submission.Status.ACCEPTED,
        ),
        (
            Submission.Status.ACCEPTED,
            Submission.Status.UNDER_REVIEW,
        ),
        (
            Submission.Status.REVIEWED,
            Submission.Status.REVIEWED,
        ),
    )

    def test_every_legal_transition_is_allowed(self):
        for current_status, target_status in self.LEGAL_TRANSITIONS:
            with self.subTest(
                current_status=current_status,
                target_status=target_status,
            ):
                submission = Submission(status=current_status)

                with patch.object(submission, "save") as save_mock:
                    result = transition_submission(
                        submission,
                        target_status,
                    )

                self.assertIs(result, submission)
                self.assertEqual(submission.status, target_status)
                save_mock.assert_called_once_with(
                    update_fields=["status"]
                )

    def test_every_submission_status_is_in_transition_map(self):
        self.assertEqual(
            set(ALLOWED_SUBMISSION_TRANSITIONS),
            set(Submission.Status.values),
        )

    def test_illegal_transitions_do_not_mutate_or_save_submission(self):
        for current_status, target_status in self.ILLEGAL_TRANSITIONS:
            with self.subTest(
                current_status=current_status,
                target_status=target_status,
            ):
                submission = Submission(status=current_status)

                with patch.object(submission, "save") as save_mock:
                    with self.assertRaises(
                        InvalidSubmissionTransition
                    ) as raised:
                        transition_submission(
                            submission,
                            target_status,
                        )

                self.assertEqual(submission.status, current_status)
                self.assertEqual(
                    raised.exception.current_status,
                    current_status,
                )
                self.assertEqual(
                    raised.exception.target_status,
                    target_status,
                )
                save_mock.assert_not_called()

    def test_transition_saves_additional_update_fields(self):
        submission = Submission(
            status=Submission.Status.SUBMITTED
        )

        with patch.object(submission, "save") as save_mock:
            transition_submission(
                submission,
                Submission.Status.ASSIGNED,
                update_fields=("assigned_editor", "status"),
            )

        save_mock.assert_called_once_with(
            update_fields=["status", "assigned_editor"]
        )

    def test_unused_statuses_are_not_submission_choices(self):
        self.assertNotIn(
            "SUSPENDED",
            Submission.Status.values,
        )
        self.assertNotIn(
            "REVISED",
            Submission.Status.values,
        )