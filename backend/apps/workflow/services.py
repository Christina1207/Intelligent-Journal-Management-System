from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Role, User
from apps.journals.models import SectionEditorMembership
from apps.submissions.models import Submission , SubmissionVersion
from .constants import (
    TRIAGE_RESULT_CONCERN,
    TRIAGE_RESULT_NOT_APPLICABLE,
    get_triage_checklist,
)
from .models import SubmissionAssignment, TriageAssessment

class AssignmentService:
    @staticmethod
    @transaction.atomic
    def assign_editor(
        *,
        submission: Submission,
        editor: User,
        assigned_by: User,
    ) -> SubmissionAssignment:
        """
        Assign an eligible Section Editor to a submitted manuscript.

        The submission row is locked because assignment changes both the
        assignment history and the submission's current responsible editor.
        """
        submission = (
            Submission.objects.select_for_update()
            .select_related("section", "author")
            .get(pk=submission.pk)
        )

        if not assigned_by.has_role(Role.RoleName.SECTION_MANAGER):
            raise PermissionDenied(
                "Only a Section Manager can assign a Section Editor."
            )

        if submission.section.manager_id != assigned_by.id:
            raise PermissionDenied(
                "You do not manage the section containing this submission."
            )

        if submission.status != Submission.Status.SUBMITTED:
            raise ValidationError(
                {
                    "submission": (
                        "Only submissions in SUBMITTED status can receive "
                        "an initial Section Editor assignment."
                    )
                }
            )
        current_version = (
            submission.versions.order_by("-version_number").first()
        )

        if current_version is None:
            raise ValidationError(
                {"triage": "The submission has no manuscript version."}
            )

        triage_assessment = TriageAssessment.objects.filter(
            submission_version=current_version,
        ).first()

        if (
            triage_assessment is None
            or triage_assessment.status
            != TriageAssessment.Status.COMPLETED
            or triage_assessment.outcome
            != TriageAssessment.Outcome.PROCEED
        ):
            raise ValidationError(
                {
                    "triage": (
                        "Initial triage must be completed with the PROCEED "
                        "outcome before assigning a Section Editor."
                    )
                }
            )

        if submission.assigned_editor_id is not None:
            raise ValidationError(
                {
                    "submission": (
                        "This submission already has a Section Editor."
                    )
                }
            )

        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise ValidationError(
                {
                    "editor_id": (
                        "The selected user does not have the "
                        "SECTION_EDITOR role."
                    )
                }
            )

        if editor.status != User.Status.ACTIVE:
            raise ValidationError(
                {
                    "editor_id": (
                        "An inactive Section Editor cannot receive "
                        "new assignments."
                    )
                }
            )

        if editor.id == submission.author_id:
            raise ValidationError(
                {
                    "editor_id": (
                        "The manuscript author cannot be assigned as its "
                        "Section Editor."
                    )
                }
            )

        is_eligible_for_section = (
            SectionEditorMembership.objects.filter(
                section=submission.section,
                editor=editor,
                is_active=True,
            ).exists()
        )

        if not is_eligible_for_section:
            raise ValidationError(
                {
                    "editor_id": (
                        "The selected Section Editor is not an active "
                        "member of this submission's section."
                    )
                }
            )

        assignment = SubmissionAssignment.objects.create(
            submission=submission,
            assigned_to=editor,
            assigned_by=assigned_by,
            role=Role.RoleName.SECTION_EDITOR,
            assignment_reason=(
                SubmissionAssignment.AssignmentReason.INITIAL
            ),
        )

        submission.assigned_editor = editor
        submission.status = Submission.Status.ASSIGNED
        submission.save(update_fields=["assigned_editor", "status"])

        return assignment

    @staticmethod
    @transaction.atomic
    def reassign_editor(
        *,
        submission: Submission,
        editor: User,
        assigned_by: User,
        reason: str,
    ) -> SubmissionAssignment:
        submission = (
            Submission.objects.select_for_update()
            .select_related(
                "section",
                "author",
                "assigned_editor",
            )
            .get(pk=submission.pk)
        )

        if not assigned_by.has_role(Role.RoleName.SECTION_MANAGER):
            raise PermissionDenied(
                "Only a Section Manager can reassign a Section Editor."
            )

        if submission.section.manager_id != assigned_by.id:
            raise PermissionDenied(
                "You do not manage the section containing this submission."
            )

        if submission.assigned_editor_id is None:
            raise ValidationError(
                {
                    "submission": (
                        "This submission does not currently have a "
                        "Section Editor. Use the initial assignment endpoint."
                    )
                }
            )

        if submission.status in {
            Submission.Status.ACCEPTED,
            Submission.Status.REJECTED,
        }:
            raise ValidationError(
                {
                    "submission": (
                        "A finalized submission cannot be reassigned."
                    )
                }
            )

        if editor.id == submission.assigned_editor_id:
            raise ValidationError(
                {
                    "editor_id": (
                        "The selected editor is already assigned to "
                        "this submission."
                    )
                }
            )

        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise ValidationError(
                {
                    "editor_id": (
                        "The selected user does not have the "
                        "SECTION_EDITOR role."
                    )
                }
            )

        if editor.status != User.Status.ACTIVE:
            raise ValidationError(
                {
                    "editor_id": (
                        "An inactive Section Editor cannot receive "
                        "new assignments."
                    )
                }
            )

        if editor.id == submission.author_id:
            raise ValidationError(
                {
                    "editor_id": (
                        "The manuscript author cannot be assigned as "
                        "its Section Editor."
                    )
                }
            )

        is_eligible_for_section = (
            SectionEditorMembership.objects.filter(
                section=submission.section,
                editor=editor,
                is_active=True,
            ).exists()
        )

        if not is_eligible_for_section:
            raise ValidationError(
                {
                    "editor_id": (
                        "The selected Section Editor is not an active "
                        "member of this submission's section."
                    )
                }
            )

        valid_reasons = {
            value
            for value, _ in (
                SubmissionAssignment.AssignmentReason.choices
            )
            if value != SubmissionAssignment.AssignmentReason.INITIAL
        }

        if reason not in valid_reasons:
            raise ValidationError(
                {"reason": "Select a valid reassignment reason."}
            )

        assignment = SubmissionAssignment.objects.create(
            submission=submission,
            assigned_to=editor,
            assigned_by=assigned_by,
            role=Role.RoleName.SECTION_EDITOR,
            assignment_reason=reason,
        )

        # Keep the manuscript in its current workflow state.
        submission.assigned_editor = editor
        submission.save(update_fields=["assigned_editor"])

        return assignment
    
class TriageService:
    @staticmethod
    def _lock_submission(*, submission, manager):
        submission = (
            Submission.objects.select_for_update()
            .select_related("section", "author")
            .get(pk=submission.pk)
        )

        if not manager.has_role(Role.RoleName.SECTION_MANAGER):
            raise PermissionDenied(
                "Only a Section Manager can perform initial triage."
            )

        if submission.section.manager_id != manager.id:
            raise PermissionDenied(
                "You do not manage this submission's section."
            )

        if submission.status != Submission.Status.SUBMITTED:
            raise ValidationError(
                {
                    "submission": (
                        "Initial triage is available only while the "
                        "submission is in SUBMITTED status."
                    )
                }
            )

        return submission

    @staticmethod
    def _latest_version(submission):
        version = (
            submission.versions.order_by("-version_number").first()
        )

        if version is None:
            raise ValidationError(
                {"submission": "The submission has no manuscript version."}
            )

        return version

    @staticmethod
    def _definitions_by_code(checklist_version):
        definitions = get_triage_checklist(checklist_version)

        return {
            definition["code"]: definition
            for definition in definitions
        }

    @classmethod
    def _validate_required_checks(cls, assessment):
        definitions = get_triage_checklist(
            assessment.checklist_version
        )
        saved_checks = assessment.checks or {}

        missing = []
        invalid_not_applicable = []

        for definition in definitions:
            if not definition["required"]:
                continue

            saved_check = saved_checks.get(definition["code"])
            result = (
                saved_check.get("result")
                if isinstance(saved_check, dict)
                else None
            )

            if not result:
                missing.append(definition["label"])
                continue

            if (
                result == TRIAGE_RESULT_NOT_APPLICABLE
                and not definition["allow_not_applicable"]
            ):
                invalid_not_applicable.append(
                    definition["label"]
                )

        if missing:
            raise ValidationError(
                {
                    "checks": (
                        "Complete all required checklist items: "
                        + ", ".join(missing)
                    )
                }
            )

        if invalid_not_applicable:
            raise ValidationError(
                {
                    "checks": (
                        "Not applicable is not permitted for: "
                        + ", ".join(invalid_not_applicable)
                    )
                }
            )

        return definitions, saved_checks

    @classmethod
    @transaction.atomic
    def update_draft(
        cls,
        *,
        submission,
        manager,
        internal_notes=None,
        checks=None,
    ):
        submission = cls._lock_submission(
            submission=submission,
            manager=manager,
        )
        version = cls._latest_version(submission)

        assessment, _ = (
            TriageAssessment.objects.select_for_update()
            .get_or_create(
                submission_version=version,
                defaults={"created_by": manager},
            )
        )

        if assessment.status == TriageAssessment.Status.COMPLETED:
            raise ValidationError(
                {
                    "triage": (
                        "A completed triage assessment cannot be edited."
                    )
                }
            )

        definitions = cls._definitions_by_code(
            assessment.checklist_version
        )
        saved_checks = dict(assessment.checks or {})

        for check in checks or []:
            code = check["code"]
            definition = definitions.get(code)

            if definition is None:
                raise ValidationError(
                    {
                        "checks": (
                            f"'{code}' is not a valid checklist item "
                            "for this assessment."
                        )
                    }
                )

            result = check["result"]

            if (
                result == TRIAGE_RESULT_NOT_APPLICABLE
                and not definition["allow_not_applicable"]
            ):
                raise ValidationError(
                    {
                        "checks": (
                            f"'{definition['label']}' cannot be marked "
                            "not applicable."
                        )
                    }
                )

            saved_checks[code] = {
                "result": result,
                "note": check.get("note", ""),
            }

        assessment.checks = saved_checks

        if internal_notes is not None:
            assessment.internal_notes = internal_notes

        assessment.save(
            update_fields=[
                "checks",
                "internal_notes",
                "updated_at",
            ]
        )

        return assessment

    @classmethod
    @transaction.atomic
    def complete_for_assignment(
        cls,
        *,
        submission,
        manager,
    ):
        submission = cls._lock_submission(
            submission=submission,
            manager=manager,
        )
        version = cls._latest_version(submission)

        assessment = (
            TriageAssessment.objects.select_for_update()
            .filter(submission_version=version)
            .first()
        )

        if assessment is None:
            raise ValidationError(
                {
                    "triage": (
                        "Save the checklist before completing triage."
                    )
                }
            )

        if assessment.status == TriageAssessment.Status.COMPLETED:
            raise ValidationError(
                {"triage": "This assessment is already completed."}
            )

        definitions, saved_checks = (
            cls._validate_required_checks(assessment)
        )

        concerns = [
            definition["label"]
            for definition in definitions
            if (
                definition["required"]
                and saved_checks[definition["code"]]["result"]
                == TRIAGE_RESULT_CONCERN
            )
        ]

        if concerns:
            raise ValidationError(
                {
                    "checks": (
                        "Resolve these concerns or desk reject the "
                        "submission: "
                        + ", ".join(concerns)
                    )
                }
            )

        assessment.status = TriageAssessment.Status.COMPLETED
        assessment.outcome = TriageAssessment.Outcome.PROCEED
        assessment.completed_by = manager
        assessment.completed_at = timezone.now()
        assessment.save(
            update_fields=[
                "status",
                "outcome",
                "completed_by",
                "completed_at",
                "updated_at",
            ]
        )

        return assessment

    @classmethod
    @transaction.atomic
    def desk_reject(
        cls,
        *,
        submission,
        manager,
        reason_code,
        author_message,
    ):
        submission = cls._lock_submission(
            submission=submission,
            manager=manager,
        )
        version = cls._latest_version(submission)

        assessment = (
            TriageAssessment.objects.select_for_update()
            .filter(submission_version=version)
            .first()
        )

        if assessment is None:
            raise ValidationError(
                {
                    "triage": (
                        "Save the checklist before desk rejection."
                    )
                }
            )

        if assessment.status == TriageAssessment.Status.COMPLETED:
            raise ValidationError(
                {"triage": "This assessment is already completed."}
            )

        definitions, saved_checks = (
            cls._validate_required_checks(assessment)
        )

        has_concern = any(
            saved_checks.get(definition["code"], {}).get("result")
            == TRIAGE_RESULT_CONCERN
            for definition in definitions
        )

        if not has_concern:
            raise ValidationError(
                {
                    "checks": (
                        "At least one checklist item must identify a "
                        "concern before desk rejection."
                    )
                }
            )

        if version.decision != SubmissionVersion.Decision.PENDING:
            raise ValidationError(
                {
                    "submission": (
                        "The current version already has an editorial "
                        "decision."
                    )
                }
            )

        now = timezone.now()

        assessment.status = TriageAssessment.Status.COMPLETED
        assessment.outcome = TriageAssessment.Outcome.DESK_REJECTED
        assessment.rejection_reason = reason_code
        assessment.author_message = author_message
        assessment.completed_by = manager
        assessment.completed_at = now
        assessment.save(
            update_fields=[
                "status",
                "outcome",
                "rejection_reason",
                "author_message",
                "completed_by",
                "completed_at",
                "updated_at",
            ]
        )

        version.decision = SubmissionVersion.Decision.REJECTED
        version.decided_by = manager
        version.decided_at = now
        version.decision_letter = author_message
        version.save(
            update_fields=[
                "decision",
                "decided_by",
                "decided_at",
                "decision_letter",
            ]
        )

        submission.status = Submission.Status.REJECTED
        submission.save(update_fields=["status"])

        return assessment