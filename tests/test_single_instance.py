"""Saveo - single-instance guard tests (Windows only)."""

import os
import sys
import unittest

from server.single_instance import acquire_mutex


@unittest.skipUnless(sys.platform == "win32", "Windows named mutex test")
class TestSingleInstance(unittest.TestCase):

    def test_second_acquire_is_rejected(self):
        name = rf"Local\Saveo_Test_{os.getpid()}_{id(self)}"
        self.assertTrue(acquire_mutex(name))
        self.assertFalse(acquire_mutex(name))


if __name__ == "__main__":
    unittest.main()
