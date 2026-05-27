import asyncio
import logging
from datetime import UTC, datetime, time as datetime_time, timedelta
from zoneinfo import ZoneInfo

from app.core.database import AsyncSessionLocal
from app.services.dream_service import purge_all_stale_drafts

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")


def _seconds_until_next_kst_midnight(now: datetime | None = None) -> float:
    now_utc = now or datetime.now(UTC)
    now_kst = now_utc.astimezone(_KST)
    next_midnight_kst = datetime.combine(
        now_kst.date() + timedelta(days=1), datetime_time.min, tzinfo=_KST
    )
    delta = next_midnight_kst.astimezone(UTC) - now_utc
    return max(delta.total_seconds(), 1.0)


async def _run_cleanup_once() -> None:
    async with AsyncSessionLocal() as session:
        deleted = await purge_all_stale_drafts(session)
        if deleted:
            logger.info("Purged %d stale dream drafts", deleted)


async def run_midnight_cleanup_loop() -> None:
    while True:
        try:
            await asyncio.sleep(_seconds_until_next_kst_midnight())
            await _run_cleanup_once()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("Dream draft cleanup loop failed; retrying in 60s")
            await asyncio.sleep(60)
