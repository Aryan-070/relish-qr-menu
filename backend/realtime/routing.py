"""WebSocket URL routing for the realtime app (imported by config/asgi.py)."""
from __future__ import annotations

from django.urls import re_path

from realtime.consumers import KdsConsumer

websocket_urlpatterns = [
    re_path(r"^ws/kds/(?P<restaurant_id>[^/]+)/$", KdsConsumer.as_asgi()),
]
