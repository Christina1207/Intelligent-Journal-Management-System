import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from apps.journals.models import JournalMetadataSettings
from apps.submissions.models import SubmissionVersion
from apps.workflow.models import SubmissionAssignment


logger = logging.getLogger(__name__)


def _format_datetime(value):
    if value is None:
        return "Not specified"

    return timezone.localtime(value).strftime(
        "%d %B %Y, %H:%M %Z"
    )


def _recipient_name(recipient):
    full_name = recipient.get_full_name().strip()

    return full_name or recipient.username or "there"


def _build_action_url(action_path):
    base_url = settings.FRONTEND_URL.strip()

    return (
        f"{base_url.rstrip('/')}/"
        f"{action_path.lstrip('/')}"
    )


def _send_notification_email(
    *,
    recipient,
    subject,
    heading,
    message,
    action_label,
    action_path,
    details=(),
):
    if not recipient.email:
        logger.warning(
            "Email notification skipped because user %s has no email.",
            recipient.pk,
        )
        return False

    journal_settings = JournalMetadataSettings.get_current()
    action_url = _build_action_url(action_path)

    context = {
        "journal_title": journal_settings.journal_title,
        "primary_color": journal_settings.primary_color,
        "recipient_name": _recipient_name(recipient),
        "heading": heading,
        "message": message,
        "details": [
            {
                "label": label,
                "value": value,
            }
            for label, value in details
        ],
        "action_label": action_label,
        "action_url": action_url,
    }

    text_body = render_to_string(
        "notifications/email.txt",
        context,
    )
    html_body = render_to_string(
        "notifications/email.html",
        context,
    )

    email = EmailMultiAlternatives(
        subject=(
            f"[{journal_settings.journal_title}] {subject}"
        ),
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient.email],
    )
    email.attach_alternative(html_body, "text/html")

    return email.send(fail_silently=False) == 1


def send_reviewer_invitation(assignment):
    submission = assignment.version.submission

    return _send_notification_email(
        recipient=assignment.reviewer,
        subject="New review invitation",
        heading="You have received a review invitation",
        message=(
            "You have been invited to review a manuscript. "
            "Please review the invitation and respond before "
            "the response deadline."
        ),
        action_label="View invitation",
        action_path=(
            f"/reviewer/assignments/{assignment.id}"
        ),
        details=(
            ("Manuscript", submission.title),
            ("Section", submission.section.name),
            (
                "Response deadline",
                _format_datetime(
                    assignment.response_deadline
                ),
            ),
            (
                "Review deadline",
                _format_datetime(
                    assignment.review_deadline
                ),
            ),
        ),
    )


def send_editor_assignment(assignment):
    submission = assignment.submission
    is_reassignment = (
        assignment.assignment_reason
        != SubmissionAssignment.AssignmentReason.INITIAL
    )

    if is_reassignment:
        subject = "Manuscript reassigned to you"
        heading = "A manuscript has been reassigned to you"
        message = (
            "You are now the responsible Section Editor for "
            "this manuscript."
        )
    else:
        subject = "New manuscript assignment"
        heading = "A manuscript has been assigned to you"
        message = (
            "You have been assigned as the responsible Section "
            "Editor for this manuscript."
        )

    return _send_notification_email(
        recipient=assignment.assigned_to,
        subject=subject,
        heading=heading,
        message=message,
        action_label="Open manuscript workspace",
        action_path=(
            f"/section-editor/submissions/{submission.id}"
        ),
        details=(
            ("Manuscript", submission.title),
            ("Section", submission.section.name),
        ),
    )


def send_author_decision(
    version,
    *,
    desk_rejection=False,
):
    submission = version.submission

    if version.decision == SubmissionVersion.Decision.PENDING:
        logger.warning(
            "Decision email skipped for pending version %s.",
            version.pk,
        )
        return False

    revision_decisions = {
        SubmissionVersion.Decision.MINOR_REVISION,
        SubmissionVersion.Decision.MAJOR_REVISION,
    }

    if desk_rejection:
        subject = "Initial editorial decision"
        heading = "Your submission was not sent for peer review"
        message = (
            "The initial editorial assessment has been "
            "completed. Sign in to view the decision details."
        )
        action_label = "View decision"
    elif version.decision in revision_decisions:
        subject = "Revision requested"
        heading = "A revision has been requested"
        message = (
            "The editorial team has requested changes to your "
            "submission. Sign in to view the decision and "
            "reviewer feedback."
        )
        action_label = "View decision and upload revision"
    elif version.decision == SubmissionVersion.Decision.ACCEPTED:
        subject = "Submission accepted"
        heading = "Your submission has been accepted"
        message = (
            "An acceptance decision has been recorded for your "
            "submission. Sign in to view the full decision."
        )
        action_label = "View submission"
    else:
        subject = "Editorial decision"
        heading = "A decision has been made on your submission"
        message = (
            "An editorial decision has been recorded for your "
            "submission. Sign in to view the full decision."
        )
        action_label = "View decision"

    return _send_notification_email(
        recipient=submission.author,
        subject=subject,
        heading=heading,
        message=message,
        action_label=action_label,
        action_path=(
            f"/author/submissions/{submission.id}"
        ),
        details=(
            ("Manuscript", submission.title),
            ("Decision", version.get_decision_display()),
        ),
    )


def send_revision_ready(assignment):
    submission = assignment.version.submission

    return _send_notification_email(
        recipient=assignment.reviewer,
        subject="Revised manuscript ready for review",
        heading="A revised manuscript is ready",
        message=(
            "The author has uploaded a revised manuscript for "
            "a review assignment you previously accepted."
        ),
        action_label="Open review workspace",
        action_path=(
            f"/reviewer/assignments/{assignment.id}"
        ),
        details=(
            ("Manuscript", submission.title),
            (
                "Review round",
                f"Version {assignment.version.version_number}",
            ),
            (
                "Review deadline",
                _format_datetime(
                    assignment.review_deadline
                ),
            ),
        ),
    )


def send_review_deadline_reminder(assignment):
    submission = assignment.version.submission

    return _send_notification_email(
        recipient=assignment.reviewer,
        subject="Review deadline reminder",
        heading="Your review deadline is approaching",
        message=(
            "This is a reminder that an accepted review "
            "assignment is due soon."
        ),
        action_label="Open review workspace",
        action_path=(
            f"/reviewer/assignments/{assignment.id}"
        ),
        details=(
            ("Manuscript", submission.title),
            (
                "Review deadline",
                _format_datetime(
                    assignment.review_deadline
                ),
            ),
        ),
    )


def send_article_published(article):
    submission = article.submission

    return _send_notification_email(
        recipient=submission.author,
        subject="Your article has been published",
        heading="Your article is now published",
        message=(
            "Your article is now available on the journal's "
            "public website."
        ),
        action_label="View published article",
        action_path=f"/articles/{article.slug}",
        details=(
            ("Article", article.title),
            ("Section", article.section.name),
            (
                "Published",
                _format_datetime(article.published_at),
            ),
        ),
    )