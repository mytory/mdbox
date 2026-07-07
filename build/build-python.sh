#!/usr/bin/env bash
# Build markitdown converter into a standalone binary via PyInstaller.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/.venv"

echo "==> Building markitdown converter binary..."

# Ensure virtualenv exists
if [ ! -f "$VENV_DIR/bin/python3" ]; then
    echo "Creating Python virtualenv..."
    python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

# Install dependencies
pip install --quiet pyinstaller "markitdown[docx,pptx,xlsx,xls,pdf]" 2>&1 | tail -3

# Build
cd "$PROJECT_DIR/python"
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
SITE_PACKAGES="$VENV_DIR/lib/python$PYTHON_VERSION/site-packages"
MAGIKA_DIR="$SITE_PACKAGES/magika"
pyinstaller --onefile --name converter converter.py \
    --add-data "$MAGIKA_DIR/config:magika/config" \
    --add-data "$MAGIKA_DIR/models:magika/models" \
    --collect-data magika \
    --hidden-import magika \
    --distpath "$PROJECT_DIR/python/dist" \
    --workpath "$PROJECT_DIR/python/build" \
    --specpath "$PROJECT_DIR/python"

echo "==> Build complete: $(ls -lh "$PROJECT_DIR/python/dist/converter" 2>/dev/null || echo "check dist/")"
