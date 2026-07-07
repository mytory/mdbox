#!/usr/bin/env python3
"""
Mytory MDBox — markitdown converter wrapper.

Reads JSON from stdin:  {"file_path": "...", "llm_config": {...}}
Writes JSON to stdout:  {"success": true, "markdown": "...", "elapsed_ms": 123}
                        {"success": false, "error": "..."}
"""
import io
import json
import sys
import time
from pathlib import Path

from markitdown import MarkItDown

# stdin/stdout을 명시적으로 UTF-8로 설정 (Windows CP949 환경 대응)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def _clean_markdown(text: str) -> str:
    """PDF 파서가 UTF-16LE 텍스트를 잘못 읽어 삽입한 \x00(null byte)을 제거합니다.

    일부 PDF(특히 한글 포함)에서 pdfminer가 인코딩을 잘못 처리하면
    문자 사이에 \x00이 삽입됩니다. 이를 제거하면 일반 텍스트 편집기에서
    정상적으로 읽을 수 있습니다.
    """
    if '\x00' not in text:
        return text
    return text.replace('\x00', '')


def convert(file_path: str, llm_config: dict | None = None) -> dict:
    start = time.perf_counter()
    try:
        path = Path(file_path)
        if not path.exists():
            return {"success": False, "error": f"File not found: {file_path}"}

        # Build markitdown kwargs
        kwargs = {}
        if llm_config and llm_config.get("endpoint") and llm_config.get("model"):
            # When LLM config is provided, we could set up an OpenAI client
            # For now, this is a placeholder for future LLM integration
            pass

        md = MarkItDown(**kwargs)
        result = md.convert(str(path))
        markdown = _clean_markdown(result.text_content)

        elapsed = (time.perf_counter() - start) * 1000
        return {
            "success": True,
            "markdown": markdown,
            "elapsed_ms": round(elapsed, 1),
        }
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        return {
            "success": False,
            "error": str(e),
            "elapsed_ms": round(elapsed, 1),
        }


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    file_path = payload.get("file_path", "")
    llm_config = payload.get("llm_config")
    result = convert(file_path, llm_config)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
