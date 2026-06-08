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

    card_bytes = await asyncio.to_thread(_to_webp, image_bytes, 1024, 90)
    thumb_bytes = await asyncio.to_thread(_to_webp, image_bytes, 320, 86)

    card_key = f"dreams/{dream_id}/card.webp"
    thumb_key = f"dreams/{dream_id}/thumb.webp"
    await asyncio.to_thread(_upload, card_key, card_bytes)
    await asyncio.to_thread(_upload, thumb_key, thumb_bytes)
    return (
        f"{settings.r2_public_base_url}/{card_key}",
        f"{settings.r2_public_base_url}/{thumb_key}",
    )


async def store_profile_image(user_id: UUID, image_bytes: bytes) -> str:
    avatar_bytes = await asyncio.to_thread(_to_webp, image_bytes, 512, 90)
    avatar_key = f"profiles/{user_id}/avatar.webp"
    await asyncio.to_thread(_upload, avatar_key, avatar_bytes)
    return f"{settings.r2_public_base_url}/{avatar_key}"


async def store_front_preview(dream_id: UUID, version: int, image_bytes: bytes) -> str:
    # The client uploads a flattened PNG of the card front (with a transparent
    # margin so the baked shadow is preserved). Transcode to alpha-aware WebP at
    # list resolution and store under a versioned, immutable key so the CDN can
    # cache it forever while a version bump produces a fresh URL.
    preview_bytes = await asyncio.to_thread(_to_webp, image_bytes, 600, 82, True)
    key = f"dreams/{dream_id}/front-preview-v{version}.webp"
    await asyncio.to_thread(_upload, key, preview_bytes)
    return f"{settings.r2_public_base_url}/{key}"


def _to_webp(source: bytes, size: int, quality: int, keep_alpha: bool = False) -> bytes:
    with Image.open(BytesIO(source)) as image:
        image = image.convert("RGBA" if keep_alpha else "RGB")
        image.thumbnail((size, size))
        output = BytesIO()
        image.save(output, format="WEBP", quality=quality, method=6)
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
