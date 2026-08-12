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
        # PyInstaller does not yet reliably produce runnable macOS binaries
        # with the latest Python release. Prefer the project-supported 3.12.
        if command -v python3.12 &>/dev/null; then
            PYTHON_CMD="python3.12"
        else
            PYTHON_CMD="python3"
        fi
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

    # Python 버전이 바뀌면 기존 venv의 인터프리터를 재사용하지 않는다.
    # 특히 Python 3.14로 만든 PyInstaller 바이너리는 macOS에서 실행이 멈출 수 있다.
    REQUESTED_PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    if [ -f "$VENV_PYTHON" ]; then
        VENV_PYTHON_VERSION=$($VENV_PYTHON -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        if [ "$VENV_PYTHON_VERSION" != "$REQUESTED_PYTHON_VERSION" ]; then
            echo "Recreating virtualenv for Python $REQUESTED_PYTHON_VERSION..."
            rm -rf "$VENV_DIR"
        fi
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

# 기존 onefile 출력물은 onedir 디렉터리와 이름이 충돌하므로 제거한다.
OLD_BINARY="$PROJECT_DIR/python/dist/converter"
if [ -f "$OLD_BINARY" ]; then
    rm -f "$OLD_BINARY"
fi

$PYTHON_CMD -m PyInstaller --noconfirm --onedir --name converter converter.py \
    --exclude-module magika \
    --exclude-module onnxruntime \
    --distpath "$PROJECT_DIR/python/dist" \
    --workpath "$PROJECT_DIR/python/build" \
    --specpath "$PROJECT_DIR/python"

echo "==> Build complete: $(ls -lh "$PROJECT_DIR/python/dist/converter/converter" 2>/dev/null || ls -lh "$PROJECT_DIR/python/dist/converter/converter.exe" 2>/dev/null || echo "check dist/")"
