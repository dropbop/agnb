# AllGasNoBrakes Photography

Static site hosted via GitHub Pages. The `/docs` directory contains the build output that Pages serves.

## Prerequisites

- Python 3.9+ for the local build script (no additional packages required)

## Local Build & Preview

1. Export your Web3Forms key so the contact form works: `export WEB3FORMS_KEY=...`
2. Run the generator: `python scripts/build_static.py`
3. Preview the site locally: `python -m http.server --directory docs`
4. Open <http://localhost:8000> in a browser

The build script regenerates the photo manifests, copies the photos and assets, and flattens the HTML templates into `/docs`.

## Adding Photos

1. Place desktop shots in `static/photos/desktop/`
2. Place mobile-friendly crops in `static/photos/mobile/`
3. Re-run `python scripts/build_static.py`
4. Commit the updated files under `static/` and `docs/`

Photos are sorted alpha-numerically, so use naming like `001-ferrari.jpg`, `002-porsche.jpg` to control ordering.

## Deployment Notes

- GitHub Pages should serve from the `docs/` folder on the default branch
- Configure a GitHub Actions workflow (or manual build) to run the build script with `WEB3FORMS_KEY` available as an environment secret before publishing
- Commit the generated `docs/` output so the site renders without an additional runtime
