#!/usr/bin/env bash
# Build markitdown converter into a standalone binary via PyInstaller.
#
# On CI (GitHub Actions), Python dependencies are installed system-wide
# since runners are ephemeral.  On dev machines, creates/uses .venv.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/.venv"

echo "==> Building markitdown converter binary..."

# OS 감지
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
        IS_WINDOWS=true
        PYTHON_CMD="python"
        ;;
    *)
        IS_WINDOWS=false
        PYTHON_CMD="python3"
        ;;
esac

# Python 확인
if ! command -v "$PYTHON_CMD" &>/dev/null; then
    echo "Error: $PYTHON_CMD not found"
    exit 1
fi

# CI 환경인지 확인 (GitHub Actions, GitLab CI 등)
if [ "${CI:-}" = "true" ]; then
    echo "CI 환경 감지 — 시스템 Python 사용"
    PIP_CMD="pip3"
    PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    # 시스템 site-packages 경로
    SITE_PACKAGES=$($PYTHON_CMD -c "import site; print(site.getsitepackages()[0])")
else
    # 개발 환경: 가상환경 사용
    if [ "$IS_WINDOWS" = true ]; then
        VENV_PYTHON="$VENV_DIR/Scripts/python.exe"
    else
        VENV_PYTHON="$VENV_DIR/bin/python3"
    fi

    if [ ! -f "$VENV_PYTHON" ]; then
        echo "Creating Python virtualenv..."
        "$PYTHON_CMD" -m venv "$VENV_DIR"
    fi

    PYTHON_CMD="$VENV_PYTHON"
    PIP_CMD="$PYTHON_CMD -m pip"
    PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')

    if [ "$IS_WINDOWS" = true ]; then
        SITE_PACKAGES="$VENV_DIR/Lib/site-packages"
    else
        SITE_PACKAGES="$VENV_DIR/lib/python$PYTHON_VERSION/site-packages"
    fi
fi

# Install dependencies
"$PYTHON_CMD" -m pip install --quiet pyinstaller "markitdown[docx,pptx,xlsx,xls,pdf]" 2>&1 | tail -3

# Build
cd "$PROJECT_DIR/python"

MAGIKA_DIR="$SITE_PACKAGES/magika"

# PyInstaller path separator
if [ "$IS_WINDOWS" = true ]; then
    SEP=";"
else
    SEP=":"
fi

if [ ! -d "$MAGIKA_DIR" ]; then
    echo "Warning: magika not found at $MAGIKA_DIR, trying alternatives..."
    # Try to find magika location
    MAGIKA_DIR=$($PYTHON_CMD -c "import magika; import os; print(os.path.dirname(magika.__file__))" 2>/dev/null || echo "")
    if [ -z "$MAGIKA_DIR" ]; then
        echo "Error: cannot find magika package"
        exit 1
    fi
    echo "Found magika at: $MAGIKA_DIR"
fi

$PYTHON_CMD -m PyInstaller --onefile --name converter converter.py \
    --add-data "${MAGIKA_DIR}/config${SEP}magika/config" \
    --add-data "${MAGIKA_DIR}/models${SEP}magika/models" \
    --collect-data magika \
    --hidden-import magika \
    --distpath "$PROJECT_DIR/python/dist" \
    --workpath "$PROJECT_DIR/python/build" \
    --specpath "$PROJECT_DIR/python"

echo "==> Build complete: $(ls -lh "$PROJECT_DIR/python/dist/converter" 2>/dev/null || ls -lh "$PROJECT_DIR/python/dist/converter.exe" 2>/dev/null || echo "check dist/")"
