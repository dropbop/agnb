from flask import Flask, render_template, send_from_directory, request, abort, redirect, url_for, jsonify
import os

# Define environment detection
IS_DEVELOPMENT = os.environ.get('FLASK_ENV') == 'development'

app = Flask(__name__)

@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    return response

# 404 error handler - redirect to home page
@app.errorhandler(404)
def page_not_found(e):
    if IS_DEVELOPMENT:
        app.logger.error(f"404 error: {request.path}")
    return redirect(url_for('index'))

PHOTO_BASE = os.path.join(app.static_folder, 'photos')

def list_photos(variant: str):
    """Return sorted filenames for the variant's folder."""
    folder = os.path.join(PHOTO_BASE, variant)
    if not os.path.isdir(folder):
        return []
    files = [
        f for f in os.listdir(folder)
        if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.avif'))
    ]
    files.sort()
    return files

@app.route('/')
def index():
    # SSR fallback for mobile; JS can still enhance/replace it
    web3forms_key = os.environ.get('WEB3FORMS_KEY', '')
    mobile_photos = list_photos('mobile')
    return render_template('index.html',
                           web3forms_key=web3forms_key,
                           mobile_photos=mobile_photos)

@app.route('/api/photos')
def api_photos():
    """Return JSON list of photos for ?variant=desktop|mobile."""
    variant = (request.args.get('variant') or 'desktop').lower()
    if variant not in ('desktop', 'mobile'):
        return jsonify({'error': 'invalid variant'}), 400
    files = list_photos(variant)
    photos = [{
        'filename': f,
        'url': url_for('get_photo', variant=variant, filename=f),
        'view_url': url_for('view_image', variant=variant, filename=f)
    } for f in files]
    return jsonify({'variant': variant, 'count': len(photos), 'photos': photos})

@app.route('/photos/<variant>/<filename>')
def get_photo(variant, filename):
    if variant not in ('desktop', 'mobile'):
        abort(404)
    return send_from_directory(os.path.join(PHOTO_BASE, variant), filename)

@app.route('/view/<variant>/<filename>')
def view_image(variant, filename):
    if variant not in ('desktop', 'mobile'):
        abort(404)
    return render_template('view_image.html', variant=variant, filename=filename)

# Debug route to check environment variables - only available in development
@app.route('/debug')
def debug():
    if not IS_DEVELOPMENT:
        abort(404)
    web3forms_key = os.environ.get('WEB3FORMS_KEY', '')
    if web3forms_key:
        masked_key = web3forms_key[:5] + '***' if len(web3forms_key) > 5 else '***'
    else:
        masked_key = ''
    env_vars = {}
    for key, value in os.environ.items():
        if not key.lower().startswith(('secret_', 'api_', 'password', 'token', 'key')):
            env_vars[key] = value
        elif key.lower() == 'web3forms_key' and value:
            env_vars[key] = value[:5] + '***' if len(value) > 5 else '***'
    return render_template('debug.html',
                          web3forms_key=masked_key,
                          access_key_in_form=request.args.get('access_key', ''),
                          env_vars=env_vars)

# Vercel
app.config['STATIC_FOLDER'] = 'static'

if __name__ == "__main__":
    app.run(debug=IS_DEVELOPMENT)
