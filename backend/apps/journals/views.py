from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Section
from .serializers import SectionSerializer


class SectionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SectionSerializer

    def get_queryset(self):
        # Only expose active sections via the API
        # Inactive sections are admin-only concern
        return Section.objects.filter(is_active=True)