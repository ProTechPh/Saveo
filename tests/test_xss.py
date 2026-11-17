"""Saveo - untrusted media text must be escaped before it reaches innerHTML."""

import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class TestXSSEscaping(unittest.TestCase):

    def test_queue_and_toast_escape_titles(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")

        result = subprocess.run(
            [node, str(Path(__file__).with_name("xss_check.js")), str(ROOT / "web" / "js" / "components.js")],
            capture_output=True,
            text=True,
            timeout=60,
        )
        self.assertEqual(result.returncode, 0, f"{result.stdout}\n{result.stderr}")


if __name__ == "__main__":
    unittest.main()
