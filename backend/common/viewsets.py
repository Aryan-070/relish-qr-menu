"""Base viewset for tenant-scoped resources.

``TenantViewSet`` relies on the model's :class:`~common.managers.TenantManager`
(via ``Model.objects``) for read scoping — the active tenant is applied
automatically — and stamps the active ``restaurant_id`` onto new rows so writes
land in the correct tenant without the client (or serializer) supplying it.
"""
from __future__ import annotations

from rest_framework import viewsets

from common.context import get_current_restaurant_id


class TenantViewSet(viewsets.ModelViewSet):
    """ModelViewSet base that auto-scopes reads and stamps the tenant on create.

    Subclasses set ``queryset`` / ``serializer_class`` as usual. As long as the
    model uses ``TenantManager`` as its default manager, list/retrieve are
    already scoped to the active tenant; this base only adds create stamping.
    """

    def perform_create(self, serializer) -> None:
        model = getattr(self, "queryset", None)
        model = model.model if model is not None else serializer.Meta.model
        if any(field.name == "restaurant_id" for field in model._meta.get_fields()):
            serializer.save(restaurant_id=get_current_restaurant_id())
        else:
            serializer.save()
