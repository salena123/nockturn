import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from models.entityChangeLog import EntityChangeLog


def serialize_change_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def log_entity_change(
    db: Session,
    *,
    actor_user_id: int | None,
    entity: str,
    entity_id: int,
    action: str,
    field_name: str | None = None,
    old_value: Any = None,
    new_value: Any = None,
) -> None:
    db.add(
        EntityChangeLog(
            actor_user_id=actor_user_id,
            entity=entity,
            entity_id=entity_id,
            field_name=field_name,
            old_value=serialize_change_value(old_value),
            new_value=serialize_change_value(new_value),
            action=action,
        )
    )


def log_model_updates(
    db: Session,
    *,
    actor_user_id: int | None,
    entity: str,
    entity_id: int,
    changes: dict[str, tuple[Any, Any]],
    action: str = "update",
) -> None:
    for field_name, (old_value, new_value) in changes.items():
        if old_value == new_value:
            continue
        log_entity_change(
            db,
            actor_user_id=actor_user_id,
            entity=entity,
            entity_id=entity_id,
            action=action,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
        )
