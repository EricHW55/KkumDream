from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


MOBILE_ROOT = Path(__file__).resolve().parents[1]
DECORATION_DIR = MOBILE_ROOT / "src" / "assets" / "letter-paper" / "decorations"
OUTPUT_DIR = MOBILE_ROOT / "src" / "assets" / "letter-paper" / "baked"
PAPER_TEXTURE_PATH = MOBILE_ROOT / "src" / "assets" / "textures" / "paper_texture.webp"

BASE_WIDTH = 286
BASE_HEIGHT = 500
SCALE = 3
OUTPUT_WIDTH = BASE_WIDTH * SCALE
OUTPUT_HEIGHT = BASE_HEIGHT * SCALE


def scaled(value: float) -> int:
    return round(value * SCALE)


def open_decoration(name: str) -> Image.Image:
    return Image.open(DECORATION_DIR / name).convert("RGBA")


def apply_opacity(image: Image.Image, opacity: float) -> Image.Image:
    if opacity >= 1:
        return image

    image = image.copy()
    alpha = image.getchannel("A")
    alpha = Image.eval(alpha, lambda value: round(value * opacity))
    image.putalpha(alpha)
    return image


def alpha_composite_at(base: Image.Image, overlay: Image.Image, xy: tuple[int, int]) -> None:
    x, y = xy
    crop_left = max(0, -x)
    crop_top = max(0, -y)
    crop_right = min(overlay.width, base.width - x)
    crop_bottom = min(overlay.height, base.height - y)

    if crop_right <= crop_left or crop_bottom <= crop_top:
        return

    cropped = overlay.crop((crop_left, crop_top, crop_right, crop_bottom))
    base.alpha_composite(cropped, (x + crop_left, y + crop_top))


def contained_image(source_name: str, width: float, height: float, opacity: float = 1) -> Image.Image:
    box_width = scaled(width)
    box_height = scaled(height)
    source = open_decoration(source_name)
    fit_scale = min(box_width / source.width, box_height / source.height)
    fit_size = (
        max(1, round(source.width * fit_scale)),
        max(1, round(source.height * fit_scale)),
    )
    resized = source.resize(fit_size, Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", (box_width, box_height), (0, 0, 0, 0))
    alpha_composite_at(
        layer,
        resized,
        ((box_width - fit_size[0]) // 2, (box_height - fit_size[1]) // 2),
    )
    return apply_opacity(layer, opacity)


def transform_layer(
    layer: Image.Image,
    *,
    rotate: float = 0,
    scale_x: float = 1,
) -> Image.Image:
    if scale_x < 0:
        layer = ImageOps.mirror(layer)
    if rotate:
        layer = layer.rotate(
            -rotate,
            resample=Image.Resampling.BICUBIC,
            expand=True,
        )
    return layer


def place_box(
    canvas: Image.Image,
    source_name: str,
    *,
    width: float,
    height: float,
    left: float | None = None,
    top: float | None = None,
    right: float | None = None,
    bottom: float | None = None,
    opacity: float = 1,
    rotate: float = 0,
    scale_x: float = 1,
) -> None:
    x = left if left is not None else BASE_WIDTH - (right or 0) - width
    y = top if top is not None else BASE_HEIGHT - (bottom or 0) - height
    center_x = scaled(x + width / 2)
    center_y = scaled(y + height / 2)

    layer = contained_image(source_name, width, height, opacity)
    layer = transform_layer(layer, rotate=rotate, scale_x=scale_x)
    alpha_composite_at(
        canvas,
        layer,
        (center_x - layer.width // 2, center_y - layer.height // 2),
    )


def place_layer(
    canvas: Image.Image,
    layer: Image.Image,
    *,
    width: float,
    height: float,
    left: float,
    top: float,
    rotate: float = 0,
    scale_x: float = 1,
) -> None:
    center_x = scaled(left + width / 2)
    center_y = scaled(top + height / 2)
    layer = transform_layer(layer, rotate=rotate, scale_x=scale_x)
    alpha_composite_at(
        canvas,
        layer,
        (center_x - layer.width // 2, center_y - layer.height // 2),
    )


def place_crop(
    canvas: Image.Image,
    source_name: str,
    *,
    crop_width: float,
    crop_height: float,
    left: float,
    top: float,
    child_width: float,
    child_height: float,
    child_left: float = 0,
    child_top: float = 0,
    child_scale_x: float = 1,
    opacity: float = 1,
) -> None:
    crop = Image.new("RGBA", (scaled(crop_width), scaled(crop_height)), (0, 0, 0, 0))
    child = contained_image(source_name, child_width, child_height, opacity)
    child = transform_layer(child, scale_x=child_scale_x)
    alpha_composite_at(crop, child, (scaled(child_left), scaled(child_top)))
    alpha_composite_at(canvas, crop, (scaled(left), scaled(top)))


def background(hex_color: str) -> Image.Image:
    return Image.new("RGBA", (OUTPUT_WIDTH, OUTPUT_HEIGHT), hex_color)


def paper_texture_background(hex_color: str) -> Image.Image:
    texture = Image.open(PAPER_TEXTURE_PATH).convert("RGBA")
    texture = ImageOps.fit(
        texture,
        (OUTPUT_WIDTH, OUTPUT_HEIGHT),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    tint = background(hex_color)
    return Image.blend(texture, tint, 0.42)


def make_background(hex_color: str, *, textured: bool) -> Image.Image:
    return paper_texture_background(hex_color) if textured else background(hex_color)


def bake_flower_rain_stop(*, textured: bool = False) -> Image.Image:
    canvas = make_background("#FFF9F2", textured=textured)

    bottom_flower = Image.new("RGBA", (scaled(110), scaled(286)), (0, 0, 0, 0))
    flower_image = contained_image("flower1.png", 210, 315, opacity=0.92)
    alpha_composite_at(bottom_flower, flower_image, (0, 0))
    place_layer(
        canvas,
        bottom_flower,
        left=5,
        top=BASE_HEIGHT - (-30) - 286,
        width=96,
        height=286,
        scale_x=-1,
        rotate=12,
    )

    place_box(
        canvas,
        "flower2.png",
        top=-62,
        right=-18,
        width=204,
        height=306,
        opacity=0.88,
    )
    return canvas


def bake_butterfly_breath(*, textured: bool = False) -> Image.Image:
    canvas = make_background("#FFFDF8", textured=textured)
    place_box(
        canvas,
        "butterfly1.png",
        left=-35,
        bottom=20,
        width=132,
        height=100,
        opacity=0.7,
        rotate=7,
    )
    place_box(
        canvas,
        "butterfly3.png",
        left=36,
        bottom=110,
        width=56,
        height=66,
        opacity=0.78,
        rotate=7,
    )
    place_box(
        canvas,
        "butterfly5.png",
        top=110,
        right=-22,
        width=134,
        height=101,
        opacity=0.9,
        rotate=-20,
    )
    place_box(
        canvas,
        "butterfly2.png",
        top=45,
        right=28,
        width=80,
        height=60,
        opacity=0.85,
        rotate=13,
    )
    place_box(
        canvas,
        "butterfly4.png",
        top=4,
        right=0,
        width=51,
        height=61,
        opacity=0.92,
        rotate=-17,
    )
    return canvas


def bake_moonlit_sleep(*, textured: bool = False) -> Image.Image:
    canvas = make_background("#FFF9F1", textured=textured)
    place_box(
        canvas,
        "cloud4.png",
        left=-10,
        bottom=-5,
        width=200,
        height=200,
        opacity=0.94,
        scale_x=-1,
    )
    place_box(
        canvas,
        "star_violet.png",
        left=45,
        bottom=90,
        width=50,
        height=50,
        opacity=0.95,
        rotate=-3,
    )
    place_box(
        canvas,
        "star_violet.png",
        left=65,
        bottom=115,
        width=35,
        height=35,
        opacity=0.85,
    )
    place_box(
        canvas,
        "cloud2.png",
        top=225,
        right=-32,
        width=120,
        height=120,
        opacity=0.95,
    )
    place_box(
        canvas,
        "cloud2.png",
        top=10,
        left=-15,
        width=200,
        height=200,
        opacity=0.94,
        scale_x=-1,
    )
    place_box(
        canvas,
        "moon.png",
        top=75,
        left=42,
        width=58,
        height=68,
        rotate=-7,
    )
    place_crop(
        canvas,
        "cloud2_blur.png",
        left=-57,
        top=99,
        crop_width=95,
        crop_height=100,
        child_width=100,
        child_height=100,
        opacity=0.84,
    )
    place_crop(
        canvas,
        "cloud2_blur.png",
        left=22,
        top=100,
        crop_width=80,
        crop_height=100,
        child_left=-12,
        child_width=100,
        child_height=100,
        child_scale_x=-1,
        opacity=0.84,
    )
    place_box(
        canvas,
        "star.png",
        top=152,
        left=53,
        width=28,
        height=30,
        opacity=0.95,
        rotate=-7,
    )
    place_box(
        canvas,
        "star_violet.png",
        top=170,
        left=75,
        width=35,
        height=35,
        opacity=0.85,
        rotate=4,
    )
    return canvas


def save(image: Image.Image, filename: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT_DIR / filename, optimize=True)


def main() -> None:
    save(bake_moonlit_sleep(), "moonlit-sleep.png")
    save(bake_flower_rain_stop(), "flower-rain-stop.png")
    save(bake_butterfly_breath(), "butterfly-breath.png")
    save(bake_moonlit_sleep(textured=True), "moonlit-sleep-paper-texture.png")
    save(bake_flower_rain_stop(textured=True), "flower-rain-stop-paper-texture.png")
    save(bake_butterfly_breath(textured=True), "butterfly-breath-paper-texture.png")
    print(f"Wrote baked letter-paper PNGs to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
