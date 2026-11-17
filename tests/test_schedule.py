"""Saveo - off-peak download window tests."""

import unittest
import os
import shutil
import tempfile
import atexit
from datetime import datetime

_TEST_HOME = tempfile.mkdtemp(prefix="saveo-test-home-")
os.environ["HOME"] = _TEST_HOME
os.environ["USERPROFILE"] = _TEST_HOME
atexit.register(shutil.rmtree, _TEST_HOME, True)

from engine.schedule import is_allowed_now, parse_hhmm


def at(hour, minute=0):
    return datetime(2026, 1, 1, hour, minute)


class TestSchedule(unittest.TestCase):

    def test_disabled_always_allows(self):
        self.assertTrue(is_allowed_now("22:00", "06:00", False, at(12)))
        self.assertTrue(is_allowed_now("09:00", "17:00", False, at(3)))

    def test_daytime_window(self):
        self.assertFalse(is_allowed_now("09:00", "17:00", True, at(8, 59)))
        self.assertTrue(is_allowed_now("09:00", "17:00", True, at(9)))
        self.assertTrue(is_allowed_now("09:00", "17:00", True, at(16, 59)))
        self.assertFalse(is_allowed_now("09:00", "17:00", True, at(17)))

    def test_overnight_window(self):
        self.assertTrue(is_allowed_now("22:00", "06:00", True, at(23)))
        self.assertTrue(is_allowed_now("22:00", "06:00", True, at(2)))
        self.assertTrue(is_allowed_now("22:00", "06:00", True, at(5, 59)))
        self.assertFalse(is_allowed_now("22:00", "06:00", True, at(6)))
        self.assertFalse(is_allowed_now("22:00", "06:00", True, at(12)))

    def test_equal_start_and_stop_is_all_day(self):
        self.assertTrue(is_allowed_now("05:00", "05:00", True, at(12)))

    def test_bad_values_fall_back(self):
        self.assertEqual(parse_hhmm("not-a-time", "01:00"), 60)
        self.assertEqual(parse_hhmm("25:00", "01:00"), 60)
        # Bad start falls back to 01:00, so noon is outside the 01:00-07:00 window.
        self.assertFalse(is_allowed_now("bad", "07:00", True, at(12)))


if __name__ == "__main__":
    unittest.main()
