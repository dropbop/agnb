#!/usr/bin/env python3
"""Generate the static GitHub Pages build under docs/."""
from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT / "static"
PHOTOS_DIR = STATIC_DIR / "photos"
OUTPUT_DIR = ROOT / "docs"
ASSETS_DIR = OUTPUT_DIR / "assets"
TEMPLATE_DIR = ROOT / "site_src"

PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


@dataclass
class Photo:
    variant: str
    filename: str

    @property
    def encoded_filename(self) -> str:
        return quote(self.filename)

    @property
    def asset_url(self) -> str:
        return f"assets/photos/{self.variant}/{self.encoded_filename}"

    @property
    def view_url(self) -> str:
        return f"view/?variant={self.variant}&file={self.encoded_filename}"


def read_photos(variant: str) -> list[Photo]:
    folder = PHOTOS_DIR / variant
    if not folder.is_dir():
        return []
    photos = [
        Photo(variant=variant, filename=entry.name)
        for entry in folder.iterdir()
        if entry.is_file() and entry.suffix.lower() in PHOTO_EXTENSIONS
    ]
    photos.sort(key=lambda p: p.filename.lower())
    return photos


def clean_output() -> None:
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (ASSETS_DIR / "css").mkdir(parents=True, exist_ok=True)
    (ASSETS_DIR / "js").mkdir(parents=True, exist_ok=True)
    (ASSETS_DIR / "photos").mkdir(parents=True, exist_ok=True)


def copy_assets() -> None:
    css_src = STATIC_DIR / "default.css"
    if css_src.is_file():
        shutil.copy2(css_src, ASSETS_DIR / "css" / "default.css")

    js_src_dir = STATIC_DIR / "js"
    if js_src_dir.is_dir():
        shutil.copytree(js_src_dir, ASSETS_DIR / "js", dirs_exist_ok=True)

    photos_src = PHOTOS_DIR
    if photos_src.is_dir():
        shutil.copytree(photos_src, ASSETS_DIR / "photos", dirs_exist_ok=True)


def write_manifests(photos_by_variant: dict[str, list[Photo]]) -> None:
    for variant, photos in photos_by_variant.items():
        manifest_path = ASSETS_DIR / f"photos.{variant}.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "variant": variant,
            "count": len(photos),
            "photos": [
                {
                    "filename": photo.filename,
                    "url": photo.asset_url,
                    "view_url": photo.view_url,
                }
                for photo in photos
            ],
        }
        manifest_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def render_index(photos_by_variant: dict[str, list[Photo]], web3forms_key: str) -> None:
    template_path = TEMPLATE_DIR / "index.html"
    if not template_path.is_file():
        print("[build] Skipping index.html; template missing")
        return

    html = template_path.read_text(encoding="utf-8")

    mobile_markup = "\n".join(
        [
            "  <a class=\"mobile-card\" href=\"{view}\">\n"
            "    <img src=\"{src}\" alt=\"Photo {idx}\" loading=\"{loading}\" decoding=\"async\">\n"
            "  </a>".format(
                view=photo.view_url,
                src=photo.asset_url,
                idx=i + 1,
                loading="eager" if i < 2 else "lazy",
            )
            for i, photo in enumerate(photos_by_variant.get("mobile", []))
        ]
    )

    html = html.replace("{{MOBILE_GALLERY}}", mobile_markup)
    html = html.replace("{{WEB3FORMS_KEY}}", web3forms_key or "YOUR_ACCESS_KEY_HERE")

    dest = OUTPUT_DIR / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding="utf-8")


def render_view() -> None:
    template_path = TEMPLATE_DIR / "view" / "index.html"
    if not template_path.is_file():
        print("[build] Skipping view/index.html; template missing")
        return

    html = template_path.read_text(encoding="utf-8")
    dest_dir = OUTPUT_DIR / "view"
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / "index.html").write_text(html, encoding="utf-8")


def write_nojekyll() -> None:
    (OUTPUT_DIR / ".nojekyll").write_text("", encoding="utf-8")


def main() -> None:
    web3forms_key = os.environ.get("WEB3FORMS_KEY", "")

    clean_output()
    copy_assets()

    photos_by_variant = {
        variant: read_photos(variant)
        for variant in ("desktop", "mobile")
    }

    write_manifests(photos_by_variant)
    render_index(photos_by_variant, web3forms_key)
    render_view()
    write_nojekyll()

    print("[build] Static site generated in docs/")


if __name__ == "__main__":
    main()
