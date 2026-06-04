"""CRM URL aggregator. Customers/loyalty and bookings/feedback are separate
slices, each defining its own urlpatterns module (filled by Phase 5-CRM agents)."""
from django.urls import include, path

app_name = "crm"

urlpatterns = [
    path("", include("crm.customer_urls")),
    path("", include("crm.booking_urls")),
]
