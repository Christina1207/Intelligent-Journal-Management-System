from django.apps import AppConfig
from django.db.models.signals import post_migrate


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts" 
    label = "accounts"

    def ready(self):
        from .models import Role

        def seed_default_roles(sender, **kwargs):
            if sender.label != self.label:
                return

            for role_name in Role.RoleName.values:
                Role.objects.get_or_create(name=role_name)

        post_migrate.connect(
            seed_default_roles,
            sender=self,
            dispatch_uid="accounts.seed_default_roles",
        )