# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AllGasNoBrakes is a Flask-based photography portfolio website deployed on Vercel. It displays automotive photography with separate desktop and mobile image variants.

## Development Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
FLASK_ENV=development python app.py

# For Windows development
set FLASK_ENV=development && python app.py
```

## Architecture

### Core Application Structure
- **app.py**: Flask application with routes for serving photos and API endpoints
- **static/photos/**: Photo storage with `desktop/` and `mobile/` subdirectories
- **templates/**: Jinja2 templates with base layout and specific views
- **vercel.json**: Deployment configuration for Vercel hosting

### Key Routes
- `/`: Main gallery page (server-side renders mobile photos as fallback)
- `/api/photos?variant=[desktop|mobile]`: JSON API for dynamic photo loading
- `/photos/<variant>/<filename>`: Direct photo serving
- `/view/<variant>/<filename>`: Individual photo viewer page
- `/debug`: Development-only route for environment variable inspection

### Photo Management
Photos are automatically discovered from `static/photos/desktop/` and `static/photos/mobile/` directories. Supported formats: JPG, JPEG, PNG, WebP, AVIF. Files are sorted alphabetically for display order.

### Environment Variables
- `FLASK_ENV`: Set to 'development' for debug mode
- `WEB3FORMS_KEY`: API key for contact form functionality

### Frontend Architecture
The site uses progressive enhancement - works without JavaScript but enhanced when available. Mobile variant photos are server-side rendered as fallback, while desktop photos are loaded dynamically via the API.

## Deployment Notes

Deployed on Vercel using Python runtime. Static JavaScript files have specific cache headers configured to ensure immediate updates (no-cache policy).