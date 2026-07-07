from django.urls import path

from .views import OAIProviderView


urlpatterns = [
    path("oai", OAIProviderView.as_view(), name="oai-pmh"),
    path("oai/", OAIProviderView.as_view(), name="oai-pmh-slash"),
]
