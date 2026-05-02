import asyncio
from io import BytesIO
from uuid import UUID

import boto3
import httpx
from PIL import Image

from app.core.config import settings


async def store_generated_image(dream_id: UUID, source_url: str) -> tuple[str, str]:
    if source_url.startswith("mock://"):
        return (
            f"{settings.r2_public_base_url}/dreams/{dream_id}/card.webp",
            f"{settings.r2_public_base_url}/dreams/{dream_id}/thumb.webp",
        )

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(source_url)
        response.raise_for_status()
        image_bytes = response.content

    card_bytes = await asyncio.to_thread(_to_webp, image_bytes, 768)
    thumb_bytes = await asyncio.to_thread(_to_webp, image_bytes, 256)

    card_key = f"dreams/{dream_id}/card.webp"
    thumb_key = f"dreams/{dream_id}/thumb.webp"
    await asyncio.to_thread(_upload, card_key, card_bytes)
    await asyncio.to_thread(_upload, thumb_key, thumb_bytes)
    return (
        f"{settings.r2_public_base_url}/{card_key}",
        f"{settings.r2_public_base_url}/{thumb_key}",
    )


def _to_webp(source: bytes, size: int) -> bytes:
    with Image.open(BytesIO(source)) as image:
        image = image.convert("RGB")
        image.thumbnail((size, size))
        output = BytesIO()
        image.save(output, format="WEBP", quality=82, method=6)
        return output.getvalue()


def _upload(key: str, body: bytes) -> None:
    if not all(
        [
            settings.r2_endpoint_url,
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
            settings.r2_bucket,
        ]
    ):
        raise RuntimeError("Cloudflare R2 is not configured")

    client = boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
    )
    client.put_object(
        Bucket=settings.r2_bucket,
        Key=key,
        Body=body,
        ContentType="image/webp",
        CacheControl="public, max-age=31536000, immutable",
    )

