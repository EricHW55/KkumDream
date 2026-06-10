import asyncio
from io import BytesIO
from uuid import UUID

import boto3
import httpx
from botocore.exceptions import BotoCoreError, ClientError
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


async def store_front_preview(
    dream_id: UUID, version: int, image_bytes: bytes, content_hash: str | None = None
) -> str:
    # The client uploads a flattened PNG of the card front (with a transparent
    # margin so the baked shadow is preserved). Transcode to alpha-aware WebP at
    # list resolution and store under a versioned, immutable key so the CDN can
    # cache it forever while a version bump produces a fresh URL.
    preview_bytes = await asyncio.to_thread(_to_webp, image_bytes, 800, 88, True)
    key = f"dreams/{dream_id}/front-preview-v{version}.webp"
    await asyncio.to_thread(_upload, key, preview_bytes)
    # Best-effort: now that this dream's current preview is stored, drop any
    # older versioned previews for the same dream so a FRONT_PREVIEW_VERSION
    # bump doesn't leave orphaned files accumulating in R2. Each card cleans up
    # its own stale previews the moment it is re-baked — no batch job needed.
    await asyncio.to_thread(_delete_other_front_previews, dream_id, key)
    # The object is served with an immutable, year-long cache, and a re-bake
    # overwrites the same versioned key — so append the content hash as a cache
    # key. When the card's data changes the hash changes, yielding a fresh URL
    # the CDN/clients refetch, while identical content keeps a stable URL.
    url = f"{settings.r2_public_base_url}/{key}"
    if content_hash:
        url = f"{url}?h={content_hash}"
    return url


def _to_webp(source: bytes, size: int, quality: int, keep_alpha: bool = False) -> bytes:
    with Image.open(BytesIO(source)) as image:
        image = image.convert("RGBA" if keep_alpha else "RGB")
        image.thumbnail((size, size))
        output = BytesIO()
        save_kwargs: dict[str, object] = {
            "format": "WEBP",
            "quality": quality,
            "method": 6,
        }
        if keep_alpha:
            # The card front preview is RGB illustration + a soft drop shadow in
            # the alpha channel. Lossy WebP crushes that faint alpha gradient, so
            # the shadow halo gets eaten. Keep RGB lossy (the illustration stays
            # small) but make the alpha near-lossless and preserve transparent
            # pixels so the soft shadow survives, at a small size cost.
            save_kwargs["alpha_quality"] = 100
            save_kwargs["exact"] = True
        image.save(output, **save_kwargs)
        return output.getvalue()


def _r2_client():
    if not all(
        [
            settings.r2_endpoint_url,
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
            settings.r2_bucket,
        ]
    ):
        raise RuntimeError("Cloudflare R2 is not configured")

    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
    )


def _upload(key: str, body: bytes) -> None:
    client = _r2_client()
    client.put_object(
        Bucket=settings.r2_bucket,
        Key=key,
        Body=body,
        ContentType="image/webp",
        CacheControl="public, max-age=31536000, immutable",
    )


def _delete_other_front_previews(dream_id: UUID, keep_key: str) -> None:
    """Delete every front-preview-v*.webp for this dream except ``keep_key``.

    Lazy, per-dream cleanup so previous preview versions don't pile up after a
    FRONT_PREVIEW_VERSION bump. This is best-effort: the new preview is already
    stored by the time we get here, so a cleanup failure must never surface to
    the caller (the worst case is a tiny orphaned WebP that costs ~nothing).
    """
    try:
        client = _r2_client()
        prefix = f"dreams/{dream_id}/front-preview-v"
        response = client.list_objects_v2(Bucket=settings.r2_bucket, Prefix=prefix)
        stale = [
            {"Key": obj["Key"]}
            for obj in response.get("Contents", [])
            if obj["Key"] != keep_key
        ]
        if stale:
            client.delete_objects(
                Bucket=settings.r2_bucket,
                Delete={"Objects": stale, "Quiet": True},
            )
    except (BotoCoreError, ClientError, RuntimeError):
        # Cleanup is optional; never fail an otherwise-successful preview upload.
        pass
