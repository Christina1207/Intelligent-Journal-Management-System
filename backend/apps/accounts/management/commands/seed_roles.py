from django.core.management.base import BaseCommand
from apps.accounts.models import Role


class Command(BaseCommand):
    help = "Seed all system roles. Safe to run multiple times."

    def handle(self, *args, **options):
        created_count = 0

        for role_name in Role.RoleName.values:
            role, created = Role.objects.get_or_create(name=role_name)
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  Created role: {role_name}"))
            else:
                self.stdout.write(f"  Already exists: {role_name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. {created_count} role(s) created, "
                f"{len(Role.RoleName.values) - created_count} already existed."
            )
        )