import json

import firebase_admin
from firebase_admin import credentials, messaging

from app.core.config import settings


def initialize_firebase() -> None:
    if firebase_admin._apps:
        return
    if not settings.firebase_credentials_json:
        return
    info = json.loads(settings.firebase_credentials_json)
    firebase_admin.initialize_app(credentials.Certificate(info))


async def send_dream_ready_push(token: str, dream_id: str) -> None:
    initialize_firebase()
    if not firebase_admin._apps:
        return
    message = messaging.Message(
        token=token,
        notification=messaging.Notification(
            title="꿈이 도착했어요",
            body="누군가가 당신에게 꿈을 건넸어요.",
        ),
        data={"dreamId": dream_id, "route": "DreamDetail"},
    )
    messaging.send(message)

