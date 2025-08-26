from flask import Flask, render_template, send_from_directory, request, abort, redirect, url_for
import os

# Environment detection
IS_DEVELOPMENT = os.environ.get('FLASK_ENV') == 'development'

# Be explicit about static folder for clarity on Vercel and locally
app = Flask(__name__, static_folder="static", static_url_path="/static")

# Media guards
ALLOWED_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp')
ALLOWED_MEDIA_DIRS = {'photos', 'photos_mobile', 'photos_portfolio'}


@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'

    # Make sure JS bundle isn't aggressively cached (belt & suspenders alongside ?v=…)
    try:
        path = request.path or ''
    except Exception:
        path = ''
    if path.startswith('/static/js/'):
        response.headers['Cache-Control'] = 'public, max-age=0, must-revalidate'

    return response


# 404 -> home (unchanged behavior)
@app.errorhandler(404)
def page_not_found(e):
    if IS_DEVELOPMENT:
        app.logger.error(f"404 error: {request.path}")
    return redirect(url_for('index'))


def _list_images(subdir: str):
    """Return sorted list of image filenames from /static/<subdir>."""
    dir_path = os.path.join(app.static_folder, subdir)
    if not os.path.isdir(dir_path):
        return []
    files = [f for f in os.listdir(dir_path) if f.lower().endswith(ALLOWED_EXTENSIONS)]
    files.sort()
    return files


def _is_mobile_request():
    """
    Heuristic UA check: treat phones as mobile; exclude iPad/tablets.
    Supports debug overrides ?force=mobile or ?force=desktop.
    """
    forced = (request.args.get("force") or "").lower()
    if forced == "mobile":
        return True
    if forced == "desktop":
        return False

    ua = (request.user_agent.string or "")
    is_phone = any(t in ua for t in ["Mobile", "iPhone", "Android"])
    is_tablet = any(t in ua for t in ["iPad", "Tablet"])
    return is_phone and not is_tablet


@app.route('/')
def index():
    # Curated sets
    desktop_photos = _list_images('photos')
    mobile_photos = _list_images('photos_mobile')
    is_mobile = _is_mobile_request()

    # Contact form key
    web3forms_key = os.environ.get('WEB3FORMS_KEY', '')

    return render_template(
        'index.html',
        is_mobile=is_mobile,
        desktop_photos=desktop_photos,
        mobile_photos=mobile_photos,
        web3forms_key=web3forms_key
    )


@app.route('/portfolio')
def portfolio():
    """
    Portfolio shows original aspect ratios.
    Prefer /static/photos_portfolio, fall back to /static/photos if empty.
    """
    portfolio_photos = _list_images('photos_portfolio')
    subdir = 'photos_portfolio' if portfolio_photos else 'photos'
    if not portfolio_photos:
        portfolio_photos = _list_images('photos')
    return render_template('portfolio.html', photos=portfolio_photos, subdir=subdir)


# Legacy back-compat: /view/<filename> assumed photos/
@app.route('/view/<path:filename>')
def view_image_legacy(filename):
    return redirect(url_for('view_image', subdir='photos', filename=filename), code=302)


@app.route('/view/<subdir>/<path:filename>')
def view_image(subdir, filename):
    if subdir not in ALLOWED_MEDIA_DIRS:
        abort(404)
    return render_template('view_image.html', subdir=subdir, filename=filename)


@app.route('/media/<subdir>/<path:filename>')
def get_media(subdir, filename):
    if subdir not in ALLOWED_MEDIA_DIRS:
        abort(404)
    # Long-cache static assets (Flask 2.0 uses max_age, not cache_timeout)
    return send_from_directory(
        os.path.join(app.static_folder, subdir),
        filename,
        max_age=31536000  # 1 year
    )


# Back-compat for existing /photos/<file> links
@app.route('/photos/<path:filename>')
def get_photo(filename):
    return get_media('photos', filename)


# Debug route (unchanged; only in development)
@app.route('/debug')
def debug():
    if not IS_DEVELOPMENT:
        abort(404)

    web3forms_key = os.environ.get('WEB3FORMS_KEY', '')
    masked_key = web3forms_key[:5] + '***' if web3forms_key and len(web3forms_key) > 5 else (web3forms_key or '')

    access_key_in_form = request.args.get('access_key', '')

    env_vars = {}
    for key, value in os.environ.items():
        if not key.lower().startsWith(('secret_', 'api_', 'password', 'token', 'key')):
            env_vars[key] = value
        elif key.lower() == 'web3forms_key' and value:
            env_vars[key] = value[:5] + '***' if len(value) > 5 else '***'

    return render_template('debug.html',
                           web3forms_key=masked_key,
                           access_key_in_form=access_key_in_form,
                           env_vars=env_vars)


# Local dev
if __name__ == "__main__":
    app.run(debug=IS_DEVELOPMENT)
