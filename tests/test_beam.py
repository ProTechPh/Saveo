"""Saveo - Beam page/token tests (no LAN server started)."""

import unittest

from server.beam import BeamServer, render_form


class TestBeam(unittest.TestCase):

    def test_form_includes_escaped_token_and_action(self):
        page = render_form("abc-123")
        self.assertIn('action="/beam/abc-123"', page)
        self.assertIn("Send to Saveo", page)
        self.assertNotIn("{{", page)

    def test_form_escapes_error_message(self):
        page = render_form("t", "<script>alert(1)</script>", True)
        self.assertNotIn("<script>alert(1)</script>", page)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", page)

    def test_disabled_info(self):
        beam = BeamServer()
        self.assertEqual(beam.info(), {"enabled": False, "url": ""})


if __name__ == "__main__":
    unittest.main()
