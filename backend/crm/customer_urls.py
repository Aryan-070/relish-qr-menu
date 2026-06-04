"""Customer + loyalty routes, mounted under ``api/crm/`` by ``crm.urls``.

Exposes ``/api/crm/customers/`` (list/create/retrieve/update/destroy) plus the
loyalty detail actions ``earn/``, ``redeem/`` and ``ledger/``. No ``app_name``
here — the parent ``crm.urls`` owns the namespace.
"""
from rest_framework.routers import DefaultRouter

from crm.customer_views import CustomerViewSet

router = DefaultRouter()
router.register(r"customers", CustomerViewSet, basename="customer")

urlpatterns = router.urls
