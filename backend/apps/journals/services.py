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
    def deactivate(section: Section):
        """
        Deactivate a section without deleting historical editorial data.
        """
        section.is_active = False
        section.save(update_fields=["is_active"])

        return section

    @staticmethod
    def activate(section: Section):
        """
        Reactivate a section so it can be used for new submissions.
        """
        section.is_active = True
        section.save(update_fields=["is_active"])

        return section
