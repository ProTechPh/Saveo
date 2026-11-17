"""Saveo - a cancelled or paused task must not touch other tasks' partial files."""

import shutil
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

import engine.providers.ytdlp_provider as provider_module
from engine.providers.ytdlp_provider import YtDlpProvider


class Paused(Exception):
    pass


class FakeYDL:
    """Calls the real progress hook once, then lets the stop signal propagate."""

    def __init__(self, opts, output_dir):
        self.opts = opts
        self.output_dir = Path(output_dir)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def extract_info(self, url, download=True):
        task_file = self.output_dir / "Task.mp4"
        task_part = self.output_dir / "Task.mp4.part"
        other_part = self.output_dir / "Other.mp4.part"
        task_file.write_bytes(b"task-final")
        task_part.write_bytes(b"task-partial")
        other_part.write_bytes(b"other-partial")

        hook = self.opts["progress_hooks"][0]
        hook({
            "status": "downloading",
            "filename": str(task_file),
            "tmpfilename": str(task_part),
            "downloaded_bytes": 10,
            "total_bytes": 100,
        })
        return {}


class TestYtdlpPartialCleanup(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _run(self, cancel_check):
        fake_module = types.SimpleNamespace(
            YoutubeDL=lambda opts: FakeYDL(opts, self.temp_dir)
        )
        provider = YtDlpProvider()
        with patch.object(provider_module, "get_yt_dlp", return_value=fake_module):
            provider.download(
                url="https://example.com/video",
                format_id="1080p",
                output_dir=self.temp_dir,
                filename_template="{title}",
                is_audio=False,
                audio_format="mp3",
                on_progress=lambda info: None,
                cancel_check=cancel_check,
                title="Task",
            )

    def test_pause_keeps_own_and_other_partials(self):
        with self.assertRaises(Paused):
            self._run(lambda: (_ for _ in ()).throw(Paused("paused")))

        self.assertTrue((Path(self.temp_dir) / "Task.mp4.part").exists())
        self.assertTrue((Path(self.temp_dir) / "Other.mp4.part").exists())

    def test_cancel_removes_only_own_files(self):
        with self.assertRaises(Exception):
            self._run(lambda: True)

        self.assertFalse((Path(self.temp_dir) / "Task.mp4").exists())
        self.assertFalse((Path(self.temp_dir) / "Task.mp4.part").exists())
        self.assertTrue((Path(self.temp_dir) / "Other.mp4.part").exists())


if __name__ == "__main__":
    unittest.main()
