from apps.accounts.models import User
from .models import Section
from django.db import transaction


class SectionManagementService:
    @staticmethod
    @transaction.atomic
    def assign_manager(*, section: Section, manager: User) -> Section:
        """
        Assign or replace the manager responsible for a section.

        The manager object is expected to already be validated by the serializer.
        """

        if section.manager_id == manager.id:
            return section

        section.manager = manager
        section.save(update_fields=["manager"])

        return section

    @staticmethod
    @transaction.atomic
    def deactivate(section: Section):
        """
        Deactivate a section without deleting historical editorial data.
        """
        section.is_active = False
        section.save(update_fields=["is_active"])

        return section

    @staticmethod
    @transaction.atomic
    def activate(section: Section):
        """
        Reactivate a section so it can be used for new submissions.
        """
        section.is_active = True
        section.save(update_fields=["is_active"])

        return section
