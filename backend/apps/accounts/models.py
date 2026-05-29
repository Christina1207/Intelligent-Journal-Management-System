import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.Model):
    class RoleName(models.TextChoices):
        AUTHOR = "AUTHOR", "Author"
        REVIEWER = "REVIEWER", "Reviewer"
        SECTION_MANAGER = "SECTION_MANAGER", "Section Manager"
        SECTION_EDITOR = "SECTION_EDITOR", "Section Editor"
        EDITOR_IN_CHIEF = "EDITOR_IN_CHIEF", "Editor in Chief"
        ADMIN = "ADMIN", "Admin"
        READER = "READER", "Reader"

    name = models.CharField(
        max_length=50,
        choices=RoleName.choices,
        unique=True,
    )

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]



class User(AbstractUser):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    orcid = models.CharField(max_length=19, blank=True, default="") # format: 0000-0000-0000-0000
    affiliation = models.CharField(max_length=255, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    roles = models.ManyToManyField(Role, blank=True, related_name="users")
    REQUIRED_FIELDS = ["email", "first_name", "last_name"]

    def __str__(self):
        return f"{self.username} <{self.email}>"

    def has_role(self, role_name: str) -> bool:
        """Convenience method for role checks throughout the codebase."""
        return self.roles.filter(name=role_name).exists()

    class Meta:
        ordering = ["username"]