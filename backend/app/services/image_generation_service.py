import asyncio

import replicate

from app.core.config import settings

REPLICATE_IMAGE_COSTS = {
    "black-forest-labs/flux-schnell": 0.003,
}
DEFAULT_IMAGE_TEXTURE = "oil_pastel"
IMAGE_TEXTURE_GUIDES = {
    "watercolor": (
        "watercolor texture with translucent washes, soft pigment blooms, "
        "wet-on-dry edges, and visible absorbent paper grain"
    ),
    "acrylic": (
        "acrylic paint texture with opaque color, visible brush strokes, "
        "slightly thick matte paint, and layered hand-painted surfaces"
    ),
    "crayon": (
        "crayon texture with waxy strokes, uneven pressure marks, rough paper "
        "grain, and hand-colored surfaces"
    ),
    "colored_pencil": (
        "colored pencil texture with fine pencil hatching, layered pigment, "
        "visible paper tooth, and delicate hand-drawn shading"
    ),
    "oil_pastel": (
        "oil pastel and gouache texture with soft smudged pastel color, creamy "
        "brush marks, visible crayon edges, and matte paper grain"
    ),
}


async def generate_image_url(image_prompt: str, image_texture: str | None = None) -> str:
    if settings.ai_mock_mode or not settings.replicate_api_token:
        return "mock://dream-image"

    final_prompt = apply_image_texture_prompt(image_prompt, image_texture)
    client = replicate.Client(api_token=settings.replicate_api_token)
    output = await asyncio.to_thread(
        client.run,
        settings.replicate_flux_model,
        input={
            "prompt": final_prompt,
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


def apply_image_texture_prompt(image_prompt: str, image_texture: str | None) -> str:
    texture = (
        image_texture if image_texture in IMAGE_TEXTURE_GUIDES else DEFAULT_IMAGE_TEXTURE
    )
    texture_guide = IMAGE_TEXTURE_GUIDES[texture]
    return (
        f"{image_prompt}. Use {texture_guide}; keep the same hand-drawn "
        "storybook drawing style and change only the physical art texture and "
        "material finish"
    )


def estimate_image_generation_cost(
    model_name: str, output_count: int = 1
) -> float | None:
    cost_per_image = REPLICATE_IMAGE_COSTS.get(model_name)
    if cost_per_image is None:
        return None
    return cost_per_image * output_count
