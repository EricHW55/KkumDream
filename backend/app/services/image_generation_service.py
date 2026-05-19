import asyncio

import replicate

from app.core.config import settings

REPLICATE_IMAGE_COSTS = {
    "black-forest-labs/flux-schnell": 0.003,
}


async def generate_image_url(image_prompt: str) -> str:
    if settings.ai_mock_mode or not settings.replicate_api_token:
        return "mock://dream-image"

    client = replicate.Client(api_token=settings.replicate_api_token)
    output = await asyncio.to_thread(
        client.run,
        settings.replicate_flux_model,
        input={
            "prompt": image_prompt,
            "go_fast": True,
            "num_outputs": 1,
            "aspect_ratio": "1:1",
            "num_inference_steps": 4,
            "megapixels": "1",
            "output_format": "webp",
            "output_quality": 90,
            "disable_safety_checker": False,
        },
    )
    if isinstance(output, list):
        return str(output[0])
    return str(output)


def estimate_image_generation_cost(
    model_name: str, output_count: int = 1
) -> float | None:
    cost_per_image = REPLICATE_IMAGE_COSTS.get(model_name)
    if cost_per_image is None:
        return None
    return cost_per_image * output_count
