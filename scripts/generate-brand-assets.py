"""Regenerate every derived brand-icon asset from the canonical logo.

Usage: python scripts/generate-brand-assets.py [path/to/source-logo.png]

Source defaults to assets/images/ngaren-logo.png (the checked-in master).
Run this after replacing the master logo, then `npx expo prebuild --clean`
so the native android/ project picks up the regenerated launcher icons and
splash drawable.
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'images')
DEFAULT_SRC = os.path.join(OUT, 'ngaren-logo.png')


def load_trimmed_logo(path):
    """Load and trim to the tight bounding box of the visible artwork (drops
    any fully-transparent margin) so every derived asset insets consistently."""
    im = Image.open(path).convert('RGBA')
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def square_canvas(logo, canvas_size, fill_ratio, background=None):
    """Center `logo` on a square canvas of canvas_size, scaled so its largest
    dimension is fill_ratio * canvas_size. background=None -> transparent;
    otherwise an RGBA tuple to flatten onto (e.g. opaque white)."""
    canvas = Image.new('RGBA', (canvas_size, canvas_size), background or (0, 0, 0, 0))
    target = int(canvas_size * fill_ratio)
    w, h = logo.size
    scale = target / max(w, h)
    new_size = (round(w * scale), round(h * scale))
    resized = logo.resize(new_size, Image.LANCZOS)
    x = (canvas_size - new_size[0]) // 2
    y = (canvas_size - new_size[1]) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def monochrome_from(logo, canvas_size, fill_ratio):
    """Android themed-icon monochrome layer: alpha-only silhouette, solid
    white, inset to the same adaptive-icon safe zone as the foreground."""
    alpha = logo.split()[-1]
    white_rgba = Image.new('RGBA', logo.size, (255, 255, 255, 255))
    white_rgba.putalpha(alpha)
    return square_canvas(white_rgba, canvas_size, fill_ratio, background=(0, 0, 0, 0))


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    logo = load_trimmed_logo(src)
    print('trimmed logo size:', logo.size)

    # Canonical brand mark — clean, transparent, full resolution.
    master = square_canvas(logo, 1024, 0.94)
    master.save(os.path.join(OUT, 'ngaren-logo.png'))

    # Main app icon — Play Store / launcher fallback. No transparency allowed.
    icon = square_canvas(logo, 1024, 0.88, background=(255, 255, 255, 255))
    icon.convert('RGB').save(os.path.join(OUT, 'icon.png'))

    # Adaptive icon foreground — inset to Android's ~66%-diameter safe zone.
    fg = square_canvas(logo, 512, 0.62)
    fg.save(os.path.join(OUT, 'android-icon-foreground.png'))

    # Adaptive icon background — solid white behind the foreground layer.
    bg = Image.new('RGBA', (512, 512), (255, 255, 255, 255))
    bg.save(os.path.join(OUT, 'android-icon-background.png'))

    # Adaptive icon monochrome (Android 13+ themed icons).
    mono = monochrome_from(logo, 432, 0.62 * 512 / 432)
    mono.save(os.path.join(OUT, 'android-icon-monochrome.png'))

    # Splash-screen logo — transparent, square, generous resolution.
    splash = square_canvas(logo, 512, 0.92)
    splash.save(os.path.join(OUT, 'splash-icon.png'))

    # Favicon (web output target).
    favicon = square_canvas(logo, 48, 0.9, background=(255, 255, 255, 255))
    favicon.convert('RGB').save(os.path.join(OUT, 'favicon.png'))

    print('done')


if __name__ == '__main__':
    main()
