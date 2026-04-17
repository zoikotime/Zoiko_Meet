import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.deps import get_user_from_token
from app.core.security import verify_password
from app.models.meeting import (
    Meeting,
    MeetingParticipant,
    ROLE_HOST,
    ROLE_COHOST,
    ROLE_PARTICIPANT,
    STATUS_PENDING,
    STATUS_ADMITTED,
    STATUS_DISCONNECTED,
    STATUS_DENIED,
    STATUS_KICKED,
    STATUS_LEFT,
)
from app.websocket.manager import meet_manager

router = APIRouter()


# Track connection metadata per websocket
_conn_info: dict[WebSocket, dict] = {}
# Reverse lookup: (meeting_id, user_id) -> WebSocket (for sending admission signals)
_user_ws: dict[tuple[int, int], WebSocket] = {}


def _is_host_or_cohost(meeting: Meeting, user_id: int, db: Session) -> bool:
    if meeting.host_id == user_id:
        return True
    p = db.scalar(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting.id,
            MeetingParticipant.user_id == user_id,
            MeetingParticipant.role == ROLE_COHOST,
        )
    )
    return p is not None


def _get_participant(meeting_id: int, user_id: int, db: Session) -> MeetingParticipant | None:
    return db.scalar(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.user_id == user_id,
        )
    )


async def _send_waiting_list(room: str, meeting: Meeting, db: Session):
    """Send the current waiting-room list to all host/co-host connections."""
    pending = db.scalars(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting.id,
            MeetingParticipant.status == STATUS_PENDING,
        )
    ).all()

    waiting = []
    from app.models.user import User
    for p in pending:
        u = db.get(User, p.user_id)
        waiting.append({
            "user_id": p.user_id,
            "name": u.name if u else "Unknown",
            "color": u.avatar_color if u else "#5b8def",
        })

    for member_ws in meet_manager.members(room):
        info = _conn_info.get(member_ws)
        if info and info.get("is_host_or_cohost"):
            try:
                await member_ws.send_json({"type": "waiting-room", "waiting": waiting})
            except Exception:
                pass


@router.websocket("/ws/meetings/{code}")
async def meeting_ws(websocket: WebSocket, code: str, token: str = "", pwd: str = ""):
    db: Session = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4401)
            return

        meeting = db.scalar(select(Meeting).where(Meeting.code == code))
        if not meeting or not meeting.is_active:
            await websocket.close(code=4404)
            return

        # Meeting password check (host exempt)
        if meeting.password_hash and meeting.host_id != user.id:
            if not pwd or not verify_password(pwd, meeting.password_hash):
                await websocket.close(code=4403, reason="Incorrect meeting password")
                return

        # ── Determine participant status ────────────────────────────────
        participant = _get_participant(meeting.id, user.id, db)
        is_host = meeting.host_id == user.id

        if participant:
            if participant.status in (STATUS_DENIED, STATUS_KICKED):
                await websocket.close(code=4403)
                return
            if participant.status == STATUS_DISCONNECTED:
                # Reconnection — re-admit
                participant.status = STATUS_ADMITTED
                participant.last_seen_at = datetime.now(timezone.utc)
                participant.left_at = None
                db.commit()
            elif participant.status == STATUS_LEFT:
                # Re-joining after leaving
                if meeting.waiting_room_enabled and not is_host:
                    participant.status = STATUS_PENDING
                else:
                    participant.status = STATUS_ADMITTED
                participant.last_seen_at = datetime.now(timezone.utc)
                participant.left_at = None
                db.commit()
        else:
            # New participant
            if meeting.locked and not is_host:
                await websocket.close(code=4423)
                return
            role = ROLE_HOST if is_host else ROLE_PARTICIPANT
            status = STATUS_ADMITTED if is_host or not meeting.waiting_room_enabled else STATUS_PENDING
            participant = MeetingParticipant(
                meeting_id=meeting.id,
                user_id=user.id,
                role=role,
                status=status,
            )
            db.add(participant)
            db.commit()
            db.refresh(participant)

        peer_id = uuid.uuid4().hex[:10]
        participant.peer_id = peer_id
        db.commit()

        await websocket.accept()
        room = f"meeting:{code}"

        host_or_cohost = _is_host_or_cohost(meeting, user.id, db)

        # Register reverse lookup
        _user_ws[(meeting.id, user.id)] = websocket

        # ── Waiting room: user is pending ───────────────────────────────
        if participant.status == STATUS_PENDING:
            _conn_info[websocket] = {
                "peer_id": peer_id,
                "user_id": user.id,
                "name": user.name,
                "color": user.avatar_color,
                "is_host_or_cohost": False,
                "role": participant.role,
                "status": STATUS_PENDING,
            }

            await websocket.send_json({
                "type": "waiting-room-hold",
                "meeting_title": meeting.title,
            })

            # Notify hosts that someone is waiting
            await meet_manager.join(room, websocket)
            await _send_waiting_list(room, meeting, db)

            try:
                while True:
                    data = await websocket.receive_json()
                    kind = data.get("type")

                    if kind == "leave":
                        participant.status = STATUS_LEFT
                        participant.left_at = datetime.now(timezone.utc)
                        db.commit()
                        break

                    # Check if status changed (admitted by host via REST or WS)
                    db.refresh(participant)
                    if participant.status == STATUS_ADMITTED:
                        break
                    if participant.status in (STATUS_DENIED, STATUS_KICKED):
                        await websocket.send_json({"type": "denied"})
                        await websocket.close(code=4403)
                        await meet_manager.leave(room, websocket)
                        _conn_info.pop(websocket, None)
                        _user_ws.pop((meeting.id, user.id), None)
                        await _send_waiting_list(room, meeting, db)
                        return
            except WebSocketDisconnect:
                await meet_manager.leave(room, websocket)
                _conn_info.pop(websocket, None)
                _user_ws.pop((meeting.id, user.id), None)
                await _send_waiting_list(room, meeting, db)
                return

            # If we get here, check if participant left voluntarily
            if participant.status == STATUS_LEFT:
                await meet_manager.leave(room, websocket)
                _conn_info.pop(websocket, None)
                _user_ws.pop((meeting.id, user.id), None)
                await _send_waiting_list(room, meeting, db)
                return

            # Admitted — fall through to main meeting loop
            await _send_waiting_list(room, meeting, db)

        else:
            # Directly admitted — join the room
            _conn_info[websocket] = {
                "peer_id": peer_id,
                "user_id": user.id,
                "name": user.name,
                "color": user.avatar_color,
                "is_host_or_cohost": host_or_cohost,
                "role": participant.role,
                "status": STATUS_ADMITTED,
            }
            await meet_manager.join(room, websocket)

        # ── Admitted: send welcome + enter main loop ────────────────────
        _conn_info[websocket] = {
            "peer_id": peer_id,
            "user_id": user.id,
            "name": user.name,
            "color": user.avatar_color,
            "is_host_or_cohost": host_or_cohost,
            "role": participant.role,
            "status": STATUS_ADMITTED,
        }

        existing = []
        for member_ws in meet_manager.members(room):
            info = _conn_info.get(member_ws)
            if info and info.get("status") == STATUS_ADMITTED and member_ws is not websocket:
                existing.append({
                    "peer_id": info["peer_id"],
                    "user_id": info["user_id"],
                    "name": info["name"],
                    "color": info["color"],
                })

        await websocket.send_json({
            "type": "welcome",
            "self": {
                "peer_id": peer_id,
                "user_id": user.id,
                "name": user.name,
                "color": user.avatar_color,
            },
            "peers": existing,
            "is_host": is_host,
            "role": participant.role,
            "meeting": {
                "title": meeting.title,
                "waiting_room_enabled": meeting.waiting_room_enabled,
                "locked": meeting.locked,
            },
        })

        # Notify everyone else
        await meet_manager.broadcast(
            room,
            {"type": "peer-joined", "peer": _conn_info[websocket]},
            exclude=websocket,
        )

        # If host just joined, send them the waiting list
        if host_or_cohost:
            await _send_waiting_list(room, meeting, db)

        try:
            while True:
                data = await websocket.receive_json()
                kind = data.get("type")

                if kind in {"offer", "answer", "ice-candidate"}:
                    target_peer_id = data.get("target")
                    if not target_peer_id:
                        continue
                    for member_ws in meet_manager.members(room):
                        info = _conn_info.get(member_ws)
                        if info and info["peer_id"] == target_peer_id:
                            await member_ws.send_json({
                                "type": kind,
                                "from": peer_id,
                                "from_user": user.name,
                                "payload": data.get("payload"),
                            })
                            break

                elif kind == "media-state":
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "media-state",
                            "peer_id": peer_id,
                            "audio": bool(data.get("audio", True)),
                            "video": bool(data.get("video", True)),
                            "screen": bool(data.get("screen", False)),
                        },
                        exclude=websocket,
                    )

                elif kind == "chat":
                    body = (data.get("body") or "").strip()
                    if not body:
                        continue
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "chat",
                            "peer_id": peer_id,
                            "user_id": user.id,
                            "name": user.name,
                            "color": user.avatar_color,
                            "body": body[:2000],
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )

                elif kind == "reaction":
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "reaction",
                            "peer_id": peer_id,
                            "name": user.name,
                            "emoji": (data.get("emoji") or "\U0001f44d")[:8],
                        },
                    )

                elif kind == "raise-hand":
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "raise-hand",
                            "peer_id": peer_id,
                            "name": user.name,
                            "raised": bool(data.get("raised", True)),
                        },
                    )

                # ── Collaboration: whiteboard, annotations, presenters ──
                elif kind == "wb-stroke":
                    # Relay whiteboard stroke to all others
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "wb-stroke",
                            "peer_id": peer_id,
                            "name": user.name,
                            "stroke": data.get("stroke"),
                        },
                        exclude=websocket,
                    )

                elif kind == "wb-clear":
                    await meet_manager.broadcast(
                        room,
                        {"type": "wb-clear", "peer_id": peer_id, "name": user.name},
                        exclude=websocket,
                    )

                elif kind == "annotation":
                    # Relay screen annotation to all others
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "annotation",
                            "peer_id": peer_id,
                            "name": user.name,
                            "annotation": data.get("annotation"),
                        },
                        exclude=websocket,
                    )

                elif kind == "annotation-clear":
                    await meet_manager.broadcast(
                        room,
                        {"type": "annotation-clear", "peer_id": peer_id},
                        exclude=websocket,
                    )

                elif kind == "screen-share-started":
                    # Broadcast that a user started sharing (multi-presenter)
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "screen-share-started",
                            "peer_id": peer_id,
                            "name": user.name,
                            "share_mode": data.get("share_mode", "screen"),
                        },
                        exclude=websocket,
                    )

                elif kind == "screen-share-stopped":
                    await meet_manager.broadcast(
                        room,
                        {
                            "type": "screen-share-stopped",
                            "peer_id": peer_id,
                            "name": user.name,
                        },
                        exclude=websocket,
                    )

                # ── Host/co-host actions via WebSocket ──────────────────
                elif kind == "admit" and host_or_cohost:
                    target_user_id = data.get("user_id")
                    if not target_user_id:
                        continue
                    tp = _get_participant(meeting.id, target_user_id, db)
                    if tp and tp.status == STATUS_PENDING:
                        tp.status = STATUS_ADMITTED
                        tp.last_seen_at = datetime.now(timezone.utc)
                        db.commit()
                        # Notify the waiting user
                        target_ws = _user_ws.get((meeting.id, target_user_id))
                        if target_ws:
                            try:
                                await target_ws.send_json({"type": "admitted"})
                            except Exception:
                                pass
                        await _send_waiting_list(room, meeting, db)

                elif kind == "admit-all" and host_or_cohost:
                    pending = db.scalars(
                        select(MeetingParticipant).where(
                            MeetingParticipant.meeting_id == meeting.id,
                            MeetingParticipant.status == STATUS_PENDING,
                        )
                    ).all()
                    for tp in pending:
                        tp.status = STATUS_ADMITTED
                        tp.last_seen_at = datetime.now(timezone.utc)
                        target_ws = _user_ws.get((meeting.id, tp.user_id))
                        if target_ws:
                            try:
                                await target_ws.send_json({"type": "admitted"})
                            except Exception:
                                pass
                    db.commit()
                    await _send_waiting_list(room, meeting, db)

                elif kind == "deny" and host_or_cohost:
                    target_user_id = data.get("user_id")
                    if not target_user_id:
                        continue
                    tp = _get_participant(meeting.id, target_user_id, db)
                    if tp and tp.status == STATUS_PENDING:
                        tp.status = STATUS_DENIED
                        db.commit()
                        target_ws = _user_ws.get((meeting.id, target_user_id))
                        if target_ws:
                            try:
                                await target_ws.send_json({"type": "denied"})
                            except Exception:
                                pass
                        await _send_waiting_list(room, meeting, db)

                elif kind == "kick" and host_or_cohost:
                    target_user_id = data.get("user_id")
                    if not target_user_id or target_user_id == meeting.host_id:
                        continue
                    tp = _get_participant(meeting.id, target_user_id, db)
                    if tp and tp.status == STATUS_ADMITTED:
                        tp.status = STATUS_KICKED
                        tp.left_at = datetime.now(timezone.utc)
                        db.commit()
                        # Find their websocket and notify
                        target_ws = _user_ws.get((meeting.id, target_user_id))
                        if target_ws:
                            try:
                                await target_ws.send_json({"type": "kicked"})
                            except Exception:
                                pass
                        # Broadcast peer-left
                        target_info = _conn_info.get(target_ws) if target_ws else None
                        if target_info:
                            await meet_manager.broadcast(
                                room,
                                {"type": "peer-left", "peer_id": target_info["peer_id"]},
                            )

                elif kind == "promote" and meeting.host_id == user.id:
                    target_user_id = data.get("user_id")
                    if not target_user_id:
                        continue
                    tp = _get_participant(meeting.id, target_user_id, db)
                    if tp and tp.status == STATUS_ADMITTED:
                        tp.role = ROLE_COHOST if tp.role == ROLE_PARTICIPANT else ROLE_PARTICIPANT
                        db.commit()
                        await meet_manager.broadcast(
                            room,
                            {
                                "type": "role-changed",
                                "user_id": target_user_id,
                                "role": tp.role,
                            },
                        )

                elif kind == "lock" and host_or_cohost:
                    locked = bool(data.get("locked", True))
                    meeting.locked = locked
                    db.commit()
                    await meet_manager.broadcast(
                        room,
                        {"type": "meeting-locked", "locked": locked},
                    )

                elif kind == "end-meeting" and meeting.host_id == user.id:
                    meeting.is_active = False
                    meeting.ended_at = datetime.now(timezone.utc)
                    db.commit()
                    await meet_manager.broadcast(
                        room,
                        {"type": "meeting-ended"},
                    )
                    break

        except WebSocketDisconnect:
            pass
        finally:
            await meet_manager.leave(room, websocket)
            leaving = _conn_info.pop(websocket, None)
            _user_ws.pop((meeting.id, user.id), None)

            if leaving:
                await meet_manager.broadcast(
                    room,
                    {"type": "peer-left", "peer_id": leaving["peer_id"]},
                )

            # Update participant status
            db.refresh(participant)
            if participant.status == STATUS_ADMITTED:
                participant.status = STATUS_DISCONNECTED
            participant.last_seen_at = datetime.now(timezone.utc)
            if participant.status not in (STATUS_DISCONNECTED,):
                participant.left_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()
