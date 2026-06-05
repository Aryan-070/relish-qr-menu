"""Staff-management routes (mounted under ``accounts/staff/``)."""
from __future__ import annotations

from django.urls import path

from accounts.password_views import (
    PasswordApproveView,
    PasswordChangeRequestView,
    PasswordRejectView,
    PasswordRequestListView,
)
from accounts.staff_views import (
    AcceptInviteView,
    AdminResetPasswordView,
    StaffCreateAccountView,
    StaffDeactivateView,
    StaffDetailView,
    StaffListCreateView,
    StaffPermissionsView,
)

urlpatterns = [
    path("", StaffListCreateView.as_view(), name="staff_list"),
    path("create/", StaffCreateAccountView.as_view(), name="staff_create"),
    path("accept-invite/", AcceptInviteView.as_view(), name="accept_invite"),
    # Password-change-with-approval (specific routes before the <uuid:pk> catch).
    path(
        "password/request/",
        PasswordChangeRequestView.as_view(),
        name="password_request",
    ),
    path(
        "password/requests/",
        PasswordRequestListView.as_view(),
        name="password_request_list",
    ),
    path(
        "password/requests/<uuid:pk>/approve/",
        PasswordApproveView.as_view(),
        name="password_approve",
    ),
    path(
        "password/requests/<uuid:pk>/reject/",
        PasswordRejectView.as_view(),
        name="password_reject",
    ),
    path("<uuid:pk>/", StaffDetailView.as_view(), name="staff_detail"),
    path(
        "<uuid:pk>/deactivate/",
        StaffDeactivateView.as_view(),
        name="staff_deactivate",
    ),
    path(
        "<uuid:pk>/reset-password/",
        AdminResetPasswordView.as_view(),
        name="staff_reset_password",
    ),
    path(
        "<uuid:pk>/permissions/",
        StaffPermissionsView.as_view(),
        name="staff_permissions",
    ),
]
