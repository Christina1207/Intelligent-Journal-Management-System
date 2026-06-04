from django.contrib import admin
from .models import Review

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display  = ['id', 'assignment', 'recommendation', 'submitted_at']
    list_filter   = ['recommendation']
    raw_id_fields = ['assignment']