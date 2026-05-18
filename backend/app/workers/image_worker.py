import asyncio
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.ai_generation import AiGenerationJob, AiGenerationLog
from app.models.dream import Dream
from app.services.image_generation_service import (
    estimate_image_generation_cost,
    generate_image_url,
)
from app.services.storage_service import store_generated_image


async def run_once() -> bool:
    async with AsyncSessionLocal() as session:
        job = await session.scalar(
            select(AiGenerationJob)
            .where(
                AiGenerationJob.generation_type == "image",
                AiGenerationJob.status == "pending",
                AiGenerationJob.attempt_count < AiGenerationJob.max_attempts,
            )
            .order_by(AiGenerationJob.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if job is None:
            return False

        dream = await session.get(Dream, job.dream_id)
        if dream is None:
            job.status = "failed"
            job.error_message = "Dream not found"
            await session.commit()
            return True

        job.status = "running"
        job.attempt_count += 1
        job.updated_at = datetime.now(UTC)
        dream.image_status = "generating"
        await session.commit()

        try:
            source_url = await generate_image_url(dream.image_prompt)
            image_url, thumbnail_url = await store_generated_image(dream.id, source_url)
            dream.image_url = image_url
            dream.thumbnail_url = thumbnail_url
            dream.image_status = "ready"
            job.status = "succeeded"
            session.add(
                AiGenerationLog(
                    user_id=job.user_id,
                    dream_id=dream.id,
                    model_name=settings.replicate_flux_model,
                    generation_type="image",
                    cost_estimate=estimate_image_generation_cost(
                        settings.replicate_flux_model
                    ),
                    status="success",
                )
            )
        except Exception as exc:
            dream.image_status = "failed"
            job.status = "failed" if job.attempt_count >= job.max_attempts else "pending"
            job.error_message = str(exc)
            session.add(
                AiGenerationLog(
                    user_id=job.user_id,
                    dream_id=dream.id,
                    model_name=settings.replicate_flux_model,
                    generation_type="image",
                    status="failure",
                    error_message=str(exc),
                )
            )
        finally:
            job.updated_at = datetime.now(UTC)
            await session.commit()
        return True


async def main() -> None:
    while True:
        processed = await run_once()
        if not processed:
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
