"""Saveo - provenance sidecar and integrity tests."""

import os
import shutil
import tempfile
import unittest
import atexit
from pathlib import Path

_TEST_HOME = tempfile.mkdtemp(prefix="saveo-test-home-")
os.environ["HOME"] = _TEST_HOME
os.environ["USERPROFILE"] = _TEST_HOME
atexit.register(shutil.rmtree, _TEST_HOME, True)

from engine.provenance import read_sidecar, sha256_file, sidecar_path, verify_file, write_sidecar


class TestProvenance(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.media = Path(self.temp_dir) / "clip.mp3"
        self.media.write_bytes(b"saveo-integrity-test")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_hash_and_sidecar(self):
        digest = sha256_file(str(self.media))
        self.assertEqual(len(digest), 64)

        target = write_sidecar(str(self.media), {"source_url": "https://example.com", "sha256": digest})
        self.assertTrue(os.path.exists(target))
        self.assertEqual(target, sidecar_path(str(self.media)))
        self.assertEqual(read_sidecar(str(self.media))["source_url"], "https://example.com")

    def test_verify_states(self):
        digest = sha256_file(str(self.media))
        write_sidecar(str(self.media), {"sha256": digest})
        self.assertEqual(verify_file(str(self.media))["status"], "verified")

        Path(self.media).write_bytes(b"tampered")
        self.assertEqual(verify_file(str(self.media))["status"], "changed")

        os.remove(self.media)
        self.assertEqual(verify_file(str(self.media))["status"], "missing")

    def test_unverified_without_hash(self):
        self.assertEqual(verify_file(str(self.media))["status"], "unverified")


if __name__ == "__main__":
    unittest.main()
