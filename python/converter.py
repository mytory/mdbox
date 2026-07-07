#!/usr/bin/env python3
"""
Mytory MDBox — markitdown converter wrapper.

Reads JSON from stdin:  {"file_path": "...", "llm_config": {...}}
Writes JSON to stdout:  {"success": true, "markdown": "...", "elapsed_ms": 123}
                        {"success": false, "error": "..."}
"""
import json
import sys
import time
from pathlib import Path

from markitdown import MarkItDown


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
        markdown = result.text_content

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
