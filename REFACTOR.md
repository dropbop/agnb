# Static Migration Refactor

This document captures the current architecture of the AllGasNoBrakes photography portfolio and the plan for migrating it from a Flask application deployed on Vercel to a static site served by GitHub Pages.

## Current State

- **Framework & Runtime**
  - `app.py` runs a small Flask app. Vercel boots it via the provided configuration.
  - The app exposes only a handful of routes: `/` (main page), `/api/photos` (JSON manifest for the galleries), `/photos/<variant>/<filename>` (static file passthrough), `/view/<variant>/<filename>` (full-screen view template), and `/debug` (development-only diagnostics).
  - Error handling is minimal: a 404 redirects back to the index page in production.

- **Templates & Rendering**
  - The `templates/` directory contains Jinja templates. `base.html` defines the shared `<head>`/`<body>` scaffolding and references `static/default.css` and `static/js/script.js` via `url_for`.
  - `index.html` renders the main gallery experience. It server-renders the mobile gallery so that touch users see photos even if JavaScript fails, and it injects a hidden Web3Forms access key into the contact form.
  - `view_image.html` renders a single image, taking `variant` and `filename` from the route parameters.

- **Static Assets**
  - `static/` houses CSS, JavaScript, and photos. Photos are organized under `static/photos/desktop` and `static/photos/mobile`. The Flask helper `list_photos()` lists files in those directories and sorts them alpha-numerically.
  - The front-end script (`static/js/script.js`) drives both the desktop carousel and mobile list. It detects device capabilities, calls `/api/photos` to fetch photo metadata, and renders the appropriate DOM. The carousel clones slides for an infinite scroll illusion and preloads nearby images.

- **Contact Form**
  - The contact form posts to Web3Forms. The Flask route injects the `WEB3FORMS_KEY` environment variable into the hidden `access_key` field. If the key is missing, the client-side code shows an error before attempting the network request.

- **Deployment**
  - Vercel runs the Flask app, wiring static asset serving through Flask’s built-in `send_from_directory`. There is no build step beyond the implicit `pip install -r requirements.txt`. Photos are bundled as ordinary repository files and deployed as part of the Vercel build.

## Refactor Objectives

1. Remove the Flask dependency and render the entire portfolio as static assets (HTML, CSS, JS, and images).
2. Preserve end-user functionality and layout: device-aware gallery, deep-linkable photo views, and working Web3Forms contact form.
3. Host the static site via GitHub Pages, leveraging its automatic build and deployment pipeline.
4. Maintain a contributor-friendly workflow for adding new photos.

## Migration Plan

1. **Capture Photo Metadata Statically**
   - Introduce a small local build step (Python, Node, or shell) that walks `static/photos/desktop` and `static/photos/mobile`, producing JSON manifests (e.g., `assets/photos.desktop.json`, `assets/photos.mobile.json`). Each entry should mimic the current `/api/photos` shape (`filename`, `url`, `view_url`) using relative URLs suitable for GitHub Pages.
   - Commit the manifests so GitHub Pages can serve them as static files. Document the script so future photo additions remain easy.

2. **Flatten Jinja Templates into Static HTML**
   - Translate `templates/base.html` and `templates/index.html` into plain HTML files under the future publish directory (GitHub Pages can serve from the repo root or `/docs`). Replace `url_for` calls with relative paths (`assets/css/default.css`, `assets/js/script.js`, etc.).
   - For the mobile gallery fallback, either bake the manifest directly into the HTML during the local build step (generating `<img>` tags) or fetch the JSON manifest at runtime and hydrate the markup with JavaScript before the HTML loads. The first option mirrors the current server-rendered safety net; the second keeps the HTML simpler but requires graceful JS error handling.

3. **Adjust Front-End Logic**
   - Update `static/js/script.js` to load the static manifests instead of calling `/api/photos`. Option 1: embed manifests via `<script type="application/json">` tags inside the HTML and read them synchronously. Option 2: fetch `/assets/photos.desktop.json` and `/assets/photos.mobile.json` over HTTP. Ensure the new paths work both locally (via `file://`) and on GitHub Pages.
   - Modify deep-link URLs (`view_url`) to target the new static structure (e.g., `/view/?variant=desktop&file=...` or `/view/desktop/<filename>.html`).

4. **Rebuild the Photo Detail View**
   - Create a static `view/index.html` that reads query parameters and loads the appropriate image, or pre-generate one HTML file per image during the build step. The dynamic option keeps the repo smaller; the pre-generated option allows prettier URLs (`/view/desktop/001-ferrari.html`). Decide based on desired URL semantics and maintenance effort.

5. **Bundle Assets for GitHub Pages**
   - Adopt a static-site structure: e.g., `docs/index.html`, `docs/view/`, `docs/assets/css/`, `docs/assets/js/`, `docs/assets/photos/desktop/`, etc. Add a `.nojekyll` file if using directories that start with underscores or if you want to bypass Jekyll processing entirely.
   - Update asset references in HTML and JS to match the chosen directory layout.

6. **Handle the Web3Forms Access Key**
   - Without Flask, secrets cannot be injected at request time. Options:
     - Store the Web3Forms key in a small client-side config file committed to the repo (only if acceptable to expose publicly).
     - Use a GitHub Action with repository secrets to populate the key during a build step and write it to a JSON config that gets deployed. This keeps the key out of source control while still delivering static output.
   - Update the HTML/JS to read the key from this new location.

7. **Clean Up Server Artifacts**
   - Remove `app.py`, `requirements.txt`, and `vercel.json` once the static build is in place. Update `readme.md` to describe how to run the build, add photos, and deploy.
   - Archive or delete any Flask-specific utilities (e.g., the `/debug` template).

8. **Verify Locally**
   - Open the generated `index.html` in a browser (either directly or via `python -m http.server`) and confirm the gallery, carousel switching, deep linking, and contact form still work. Pay special attention to relative URLs and caching of the JSON manifests.

9. **Deploy to GitHub Pages**
   - Enable GitHub Pages in repository settings, selecting the `main` branch and the chosen publish folder (root or `/docs`).
   - If the site uses a custom domain, update DNS records to point to GitHub Pages and commit a `CNAME` file.
   - Once the static site is live, disable or remove the old Vercel deployment to avoid confusion.

10. **Post-Migration Maintenance**
    - Document the new photo upload workflow (e.g., “run `python scripts/build_manifests.py` and commit the updated JSON”).
    - Consider adding a GitHub Action that runs the manifest build and lints the HTML/CSS/JS to catch issues automatically.

Following these steps will eliminate the Flask dependency, simplify hosting, and keep the user-facing experience consistent while making deployment on GitHub Pages straightforward.
