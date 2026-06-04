from uuid import uuid4

import pytest

from app.models.dream import Dream, DreamGroup
from app.schemas.dream import DreamGiveRequest
from app.services import dream_service


class FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.committed = False
        self.refreshed: list[object] = []

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, value: object) -> None:
        self.refreshed.append(value)


@pytest.mark.asyncio
async def test_give_dream_allows_friend_share_to_multiple_sender_rooms(monkeypatch) -> None:
    giver_id = uuid4()
    receiver_id = uuid4()
    dream_id = uuid4()
    group_ids = [uuid4(), uuid4()]
    dream = Dream(
        id=dream_id,
        giver_id=giver_id,
        raw_input="dream input",
        title="Good dream",
        title_visible=True,
        short_message="A good dream is on the way",
        summary="summary",
        story="story",
        image_prompt="warm dream",
        main_mood="warm",
        tags=[],
        design={"card_color": "beige", "card_frame": "classic", "font_style": "dahaeng"},
        status="draft",
        image_status="empty",
    )
    session = FakeSession()
    group_member_checks: list[tuple[object, object]] = []
    shared_member_checks: list[tuple[object, object]] = []

    async def fake_get_dream(_session, requested_dream_id):
        assert requested_dream_id == dream_id
        return dream

    async def fake_require_shared_group_member(_session, user_id, checked_receiver_id):
        shared_member_checks.append((user_id, checked_receiver_id))

    async def fake_require_group_member(_session, group_id, user_id):
        group_member_checks.append((group_id, user_id))

    async def fake_attach_group_ids(_session, attached_dream):
        attached_dream.group_ids = group_ids
        return attached_dream

    async def fake_send_dream_given_push(*_args, **_kwargs):
        return None

    monkeypatch.setattr(dream_service, "_get_dream", fake_get_dream)
    monkeypatch.setattr(
        dream_service,
        "_require_shared_group_member",
        fake_require_shared_group_member,
    )
    monkeypatch.setattr(dream_service, "_require_group_member", fake_require_group_member)
    monkeypatch.setattr(dream_service, "_attach_group_ids", fake_attach_group_ids)
    monkeypatch.setattr(dream_service, "send_dream_given_push", fake_send_dream_given_push)

    result = await dream_service.give_dream(
        session,
        giver_id,
        dream_id,
        DreamGiveRequest(receiver_id=receiver_id, group_ids=group_ids),
    )

    assert result is dream
    assert shared_member_checks == [(giver_id, receiver_id)]
    assert group_member_checks == [(group_ids[0], giver_id), (group_ids[1], giver_id)]
    assert dream.receiver_id == receiver_id
    assert dream.status == "given"
    assert dream.image_status == "queued"
    assert session.committed is True
    assert session.refreshed == [dream]
    assert [item.group_id for item in session.added if isinstance(item, DreamGroup)] == group_ids
