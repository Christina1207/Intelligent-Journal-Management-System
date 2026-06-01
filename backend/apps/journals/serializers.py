from rest_framework import serializers
from .models import Section


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "name", "description", "issn", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]