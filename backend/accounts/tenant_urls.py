"""Tenant lifecycle routes, included under the ``accounts`` namespace."""
from django.urls import path

from accounts.tenant_views import ProvisionOrgView, TenantSwitchView

urlpatterns = [
    path("provision/", ProvisionOrgView.as_view(), name="provision"),
    path("switch/", TenantSwitchView.as_view(), name="tenant_switch"),
]
