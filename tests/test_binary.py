"""Integration tests for the PyInstaller-built converter binary."""
import subprocess
import json
import tempfile
import os
from pathlib import Path

import pytest

BINARY = Path(__file__).parent.parent / "python" / "dist" / "converter"


@pytest.mark.skipif(not BINARY.exists(), reason="PyInstaller binary not built")
class TestBinaryConversion:
    """Test the compiled binary behaves identically to the script."""

    def test_binary_converts_txt(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("Hello from binary!")
            path = f.name
        try:
            result = subprocess.run(
                [str(BINARY)],
                input=json.dumps({"file_path": path}),
                capture_output=True, text=True, timeout=30,
            )
            output = json.loads(result.stdout)
            assert output["success"] is True
            assert "Hello from binary!" in output["markdown"]
            assert "elapsed_ms" in output
        finally:
            os.unlink(path)

    def test_binary_handles_nonexistent(self):
        result = subprocess.run(
            [str(BINARY)],
            input=json.dumps({"file_path": "/tmp/nonexistent_binary_test_file.xyz"}),
            capture_output=True, text=True, timeout=30,
        )
        output = json.loads(result.stdout)
        assert output["success"] is False
        assert "File not found" in output["error"]

    def test_binary_handles_csv(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write("a,b\n1,2")
            path = f.name
        try:
            result = subprocess.run(
                [str(BINARY)],
                input=json.dumps({"file_path": path}),
                capture_output=True, text=True, timeout=30,
            )
            output = json.loads(result.stdout)
            assert output["success"] is True
            assert "a" in output["markdown"]
        finally:
            os.unlink(path)

    def test_binary_produces_valid_json(self):
        """Even on error, output must be valid JSON."""
        result = subprocess.run(
            [str(BINARY)],
            input="garbage input",
            capture_output=True, text=True, timeout=30,
        )
        # Should still produce valid JSON even with bad input
        try:
            output = json.loads(result.stdout)
            assert "success" in output
        except json.JSONDecodeError:
            pytest.fail("Binary produced invalid JSON")
