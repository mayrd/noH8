#!/usr/bin/env python3
"""
Generate the NoH8 browser-extension icons from the rainbow emoji (🌈, U+1F308).

Uses the OpenMoji color render of U+1F308 (CC BY-SA 4.0) as the highest
quality open source source, then downscales it to every size the extension
manifest references (16, 32, 48, 128 px).

Requires Pillow. Run from the repo root:

    python3 scripts/generate-icons.py
"""

from __future__ import annotations

import os
import sys
from urllib.request import urlopen

try:
    from PIL import Image
except ImportError:  # pragma: no cover - environment guard
    sys.exit("Pillow is required. Install it with: pip install Pillow")

# OpenMoji color PNG for U+1F308 (RAINBOW), CC BY-SA 4.0.
SOURCE_URL = (
    "https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/"
    "color/618x618/1F308.png"
)

# Sizes referenced by public/manifest.json and vite.config.ts.
SIZES = [16, 32, 48, 128]

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(REPO_ROOT, "public", "icons")


def download_source(url: str, timeout: int = 30) -> Image.Image:
    """Download the source emoji PNG and return it as an RGBA image."""
    print(f"Downloading {url}")
    with urlopen(url, timeout=timeout) as resp:
        data = resp.read()
    if not data:
        raise RuntimeError(f"Downloaded empty payload from {url}")
    image = Image.open(__import__("io").BytesIO(data))
    return image.convert("RGBA")


def generate() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    source = download_source(SOURCE_URL)

    for size in SIZES:
        resized = source.resize((size, size), Image.LANCZOS)
        # Flatten onto transparent canvas at the exact requested size.
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.paste(resized, (0, 0), resized)
        path = os.path.join(OUTPUT_DIR, f"icon{size}.png")
        canvas.save(path, format="PNG")
        print(f"Wrote {path} ({size}x{size})")


if __name__ == "__main__":
    generate()