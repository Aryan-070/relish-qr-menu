"""Staff-management routes (mounted under ``accounts/staff/``)."""
from __future__ import annotations

from django.urls import path

from accounts.staff_views import (
    AcceptInviteView,
    StaffDeactivateView,
    StaffDetailView,
    StaffListCreateView,
    StaffPermissionsView,
)

urlpatterns = [
    path("", StaffListCreateView.as_view(), name="staff_list"),
    path("accept-invite/", AcceptInviteView.as_view(), name="accept_invite"),
    path("<uuid:pk>/", StaffDetailView.as_view(), name="staff_detail"),
    path("<uuid:pk>/deactivate/", StaffDeactivateView.as_view(), name="staff_deactivate"),
    path("<uuid:pk>/permissions/", StaffPermissionsView.as_view(), name="staff_permissions"),
]
