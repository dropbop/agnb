# AllGasNoBrakes Photography

Static site hosted via GitHub Pages. Everything that ships lives under `docs/`—there's no build step or template source anymore.

## Repo Layout

- `docs/index.html` – landing page + desktop carousel/mobile gallery toggle
- `docs/view/index.html` – full-screen view for a single photo
- `docs/assets/` – CSS, JS, and the `photos/` directories referenced by the pages
- `docs/assets/js/photos.js` – declarative list of files to show in each gallery variant

## Updating Photos

1. Drop the new image into `docs/assets/photos/desktop/` or `docs/assets/photos/mobile/`
2. Append the filename to the matching array in `docs/assets/js/photos.js` (order controls display order)
3. Commit and push – Pages publishes the updated `docs/` tree automatically

Keep filenames web-safe; the scripts handle URL encoding for spaces or capitalisation.

## Local Preview

```
python3 -m http.server --directory docs
```

Then open <http://localhost:8000>. The contact form still posts to Web3Forms – set your key directly in `docs/index.html` if you need to change it.
