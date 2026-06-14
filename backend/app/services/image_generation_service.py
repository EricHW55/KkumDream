import asyncio

import replicate

from app.core.config import settings

REPLICATE_IMAGE_COSTS = {
    "black-forest-labs/flux-schnell": 0.003,
}
DEFAULT_IMAGE_TEXTURE = "oil_pastel"
IMAGE_TEXTURE_GUIDES = {
    "watercolor": (
        "transparent watercolor material with translucent layered washes, "
        "wet-on-wet color bleeding, pigment granulation, paint blooms and "
        "backruns, uneven pooled pigment along ink edges, and rough cold-press "
        "paper fibers visible through every painted area"
    ),
    "acrylic": (
        "matte acrylic paint material with opaque layered color, visible brush "
        "strokes, dry-brush streaks, slight raised paint ridges, scumbled edges, "
        "and hand-painted paper tooth visible under the paint"
    ),
    "crayon": (
        "wax crayon material with chunky waxy strokes, uneven pressure marks, "
        "broken color gaps, overlapping hand-colored scribble texture, colored "
        "wax buildup at edges, and rough paper grain showing through"
    ),
    "colored_pencil": (
        "colored pencil material with fine pencil hatching, visible directional "
        "strokes, layered translucent pigment, soft burnished shading, uneven "
        "pressure, and paper tooth showing through the color"
    ),
    "oil_pastel": (
        "oil pastel and gouache material with creamy smudged pastel strokes, "
        "opaque soft color, finger-blended edges, visible waxy pastel ridges, "
        "gouache brush marks, and matte paper grain"
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
        "storybook drawing style, rounded picture-book shapes, muted cozy "
        "palette, and imperfect ink linework. Change only the physical art "
        "texture and material finish. Make the selected texture visible across "
        "the whole image, including characters, clothing, objects, sky, ground, "
        "and background. Not clean flat digital fills, not smooth vector-like "
        "coloring"
    )


def estimate_image_generation_cost(
    model_name: str, output_count: int = 1
) -> float | None:
    cost_per_image = REPLICATE_IMAGE_COSTS.get(model_name)
    if cost_per_image is None:
        return None
    return cost_per_image * output_count
