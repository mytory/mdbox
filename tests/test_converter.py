"""Tests for python/converter.py — the markitdown wrapper.

These tests exercise the converter through its public interface:
stdin JSON → stdout JSON. No mocking — we use real files.
"""
import subprocess
import json
import tempfile
import os
from pathlib import Path

import pytest

CONVERTER = Path(__file__).parent.parent / "python" / "converter.py"


def run_converter(file_path: str, llm_config: dict = None) -> dict:
    """Run the converter script with given input and return parsed JSON output."""
    payload = {"file_path": file_path}
    if llm_config:
        payload["llm_config"] = llm_config
    result = subprocess.run(
        ["python3", str(CONVERTER)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Converter failed:\nstdout: {result.stdout}\nstderr: {result.stderr}")
    return json.loads(result.stdout)


# ── Fixtures ──────────────────────────────────────────────

@pytest.fixture
def text_file():
    """Creates a temporary .txt file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write("Hello, this is a plain text file.")
        path = f.name
    yield path
    os.unlink(path)


@pytest.fixture
def csv_file():
    """Creates a temporary .csv file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write("name,age,city\nAlice,30,Seoul\nBob,25,Tokyo")
        path = f.name
    yield path
    os.unlink(path)


@pytest.fixture
def html_file():
    """Creates a temporary .html file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False) as f:
        f.write("<h1>Title</h1><p>Hello <strong>world</strong>.</p><ul><li>Item 1</li><li>Item 2</li></ul>")
        path = f.name
    yield path
    os.unlink(path)


# ── Tests ─────────────────────────────────────────────────

class TestBasicConversion:
    """Core conversion — the most important behavior."""

    def test_txt_to_markdown(self, text_file):
        """A .txt file should be converted verbatim to markdown."""
        result = run_converter(text_file)
        assert result["success"] is True
        assert "Hello, this is a plain text file." in result["markdown"]

    def test_csv_to_markdown_table(self, csv_file):
        """A .csv file should become a markdown table."""
        result = run_converter(csv_file)
        assert result["success"] is True
        assert "| name" in result["markdown"]
        assert "| Alice" in result["markdown"]

    def test_html_to_markdown(self, html_file):
        """HTML tags should be converted to markdown formatting."""
        result = run_converter(html_file)
        assert result["success"] is True
        assert "# Title" in result["markdown"]
        assert "**world**" in result["markdown"]
        assert "Item 1" in result["markdown"]

    def test_nonexistent_file_returns_error(self):
        """A file that doesn't exist should return success=false."""
        result = run_converter("/tmp/nonexistent_file_12345.xyz")
        assert result["success"] is False
        assert "error" in result


class TestOutputMetadata:
    """The converter should report timing info."""

    def test_reports_elapsed_ms(self, text_file):
        """Response should include elapsed_ms."""
        result = run_converter(text_file)
        assert isinstance(result.get("elapsed_ms"), (int, float))
        assert result["elapsed_ms"] >= 0


class TestLLMConfig:
    """LLM config in input should not break anything when absent."""

    def test_without_llm_config(self, text_file):
        """Converter should work without llm_config."""
        payload = json.dumps({"file_path": text_file})
        result = subprocess.run(
            ["python3", str(CONVERTER)],
            input=payload,
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = json.loads(result.stdout)
        assert output["success"] is True

    def test_with_empty_llm_config(self, text_file):
        """Converter should work with empty llm_config."""
        result = run_converter(text_file, llm_config={})
        assert result["success"] is True
