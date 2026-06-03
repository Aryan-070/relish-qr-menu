"""OpenAPI schema helpers for drf-spectacular.

- ``ErrorEnvelopeSerializer`` / the ``error_envelope_postprocessing_hook``
  document the project-wide error shape produced by
  ``common.exceptions.custom_exception_handler`` (``{success, error, detail}``)
  on every operation, without annotating each of the ~26 views by hand.
- ``TokenPairSerializer`` is the shared JWT response shape reused by the auth /
  tenant / OTP endpoints.
"""
from __future__ import annotations

from typing import Any

from rest_framework import serializers

ERROR_COMPONENT_NAME = "ErrorEnvelope"

# OpenAPI schema for the {success, error, detail} envelope. `detail` is an open
# schema (object | string | array) since DRF errors vary by exception type.
_ERROR_COMPONENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "success": {"type": "boolean", "example": False},
        "error": {"type": "string", "example": "Invalid input."},
        "detail": {
            "description": "Field errors (object), a message (string), or a list.",
            "oneOf": [
                {"type": "object", "additionalProperties": True},
                {"type": "string"},
                {"type": "array", "items": {}},
            ],
        },
    },
    "required": ["success", "error"],
}

_HTTP_METHODS = ("get", "post", "put", "patch", "delete")


class ErrorEnvelopeSerializer(serializers.Serializer):
    """Documents the standard error body (kept in sync with the hook component)."""

    success = serializers.BooleanField(default=False)
    error = serializers.CharField()
    detail = serializers.JSONField(required=False)


class TokenPairSerializer(serializers.Serializer):
    """A SimpleJWT access/refresh pair."""

    access = serializers.CharField()
    refresh = serializers.CharField()


def _error_response(description: str) -> dict[str, Any]:
    return {
        "description": description,
        "content": {
            "application/json": {
                "schema": {"$ref": f"#/components/schemas/{ERROR_COMPONENT_NAME}"}
            }
        },
    }


def _requires_auth(operation: dict[str, Any], root_security: Any) -> bool:
    """True only when the operation actually enforces authentication.

    drf-spectacular *omits* the ``security`` key for public operations (and
    root ``security`` is unset here), so absence means public. An explicit
    ``[]``, or a list containing the empty ``{}`` (auth-optional) requirement,
    is also public. Only a non-empty list whose every requirement is non-empty
    forces auth → it can return 401/403.
    """
    effective = operation.get("security", root_security)
    return bool(effective) and all(effective)


def error_envelope_postprocessing_hook(
    result: dict[str, Any], generator: Any, request: Any, public: bool
) -> dict[str, Any]:
    """Attach the standard error envelope to operations, accurately.

    - Registers the ``ErrorEnvelope`` component.
    - ``400`` only where there is a request body (validation can occur).
    - ``401``/``403`` only on operations that enforce authentication.
    - ``404`` only on operations with a path parameter.
    Never overwrites an explicitly-declared response.
    """
    components = result.setdefault("components", {}).setdefault("schemas", {})
    components.setdefault(ERROR_COMPONENT_NAME, _ERROR_COMPONENT_SCHEMA)
    root_security = result.get("security")

    for path, path_item in result.get("paths", {}).items():
        has_path_param = "{" in path
        for method, operation in path_item.items():
            if method not in _HTTP_METHODS or not isinstance(operation, dict):
                continue
            responses = operation.setdefault("responses", {})
            if "requestBody" in operation:
                responses.setdefault("400", _error_response("Validation error."))
            if _requires_auth(operation, root_security):
                responses.setdefault("401", _error_response("Authentication required."))
                responses.setdefault("403", _error_response("Permission denied."))
            if has_path_param:
                responses.setdefault("404", _error_response("Not found."))

    return result
