from django.http import HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from .renderers import render_oai_response
from .services import OAIProviderService


class OAIProviderView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]

    def get(self, request):
        service = OAIProviderService(request=request)
        response = service.handle()
        content = render_oai_response(
            response=response,
            request_url=service.oai_base_url,
        )
        return HttpResponse(content, content_type="application/xml; charset=utf-8")

