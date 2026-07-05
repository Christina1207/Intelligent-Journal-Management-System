from django.db.models import ProtectedError
from apps.accounts.models import User
from apps.journals.models import Section


class SectionManagementService:
    @staticmethod
    def assign_manager(section: Section, manager_id):
        manager = User.objects.get(id=manager_id)

        section.manager = manager
        section.save(update_fields=["manager"])

        return section

    @staticmethod
    def delete_or_deactivate(section: Section):
        """
        Delete empty sections, but deactivate sections that already have submissions.

        Because Submission.section uses PROTECT, sections with historical submissions
        must remain in the database.
        """

        if section.submissions.exists():
            section.is_active = False
            section.save(update_fields=["is_active"])
            return "deactivated"

        try:
            section.delete()
            return "deleted"
        except ProtectedError:
            section.is_active = False
            section.save(update_fields=["is_active"])
            return "deactivated"