import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    orcid = models.CharField(max_length=37, blank=True, default="")
    affiliation = models.CharField(max_length=255, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=20, default="active")

    class Meta:
        db_table = "accounts_user"

    def __str__(self):
        return self.email