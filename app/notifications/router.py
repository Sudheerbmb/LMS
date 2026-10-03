from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.identity.auth import get_current_user
from app.identity.models import User
from app.notifications.models import Notification
from app.notifications.schemas import NotificationRead
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[NotificationRead]:
    return list((await session.scalars(select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()))).all())


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NotificationRead:
    notification = await session.scalar(select(Notification).where(
        Notification.id == notification_id, Notification.user_id == current_user.id
    ))
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    from datetime import datetime, timezone
    notification.read_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(notification)
    return notification


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    from datetime import datetime, timezone
    notifs = list((await session.scalars(select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.read_at.is_(None)
    ))).all())
    for n in notifs:
        n.read_at = datetime.now(timezone.utc)
    await session.commit()
    return {"status": "success", "count": len(notifs)}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if current_user.role == "admin":
        notification = await session.scalar(select(Notification).where(Notification.id == notification_id))
    else:
        notification = await session.scalar(select(Notification).where(
            Notification.id == notification_id, Notification.user_id == current_user.id
        ))
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    await session.delete(notification)
    await session.commit()
    return {"status": "deleted", "id": str(notification_id)}


@router.post("/flush-all")
@router.delete("/flush-all")
async def flush_all_notifications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """
    Flushes all notifications for the current user (or for admin, can flush all notifications).
    """
    if current_user.role == "admin":
        notifs = list((await session.scalars(select(Notification))).all())
    else:
        notifs = list((await session.scalars(select(Notification).where(Notification.user_id == current_user.id))).all())
    count = len(notifs)
    for n in notifs:
        await session.delete(n)
    await session.commit()
    return {"status": "success", "deleted_count": count, "message": f"Successfully flushed {count} notifications."}
