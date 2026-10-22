import subprocess
import unittest
from unittest.mock import patch
from local_ocr import read_local_suggestion


class LocalTests(unittest.TestCase):
    def test_worker_failure_returns_empty(self):
        with patch('local_ocr.Path.is_file', return_value=True), patch('local_ocr.subprocess.run', side_effect=subprocess.TimeoutExpired('ocr', 20)):
            self.assertEqual(read_local_suggestion(b'test'), '')

    def test_malformed_result_is_rejected(self):
        with patch('local_ocr.Path.is_file', return_value=True), patch('local_ocr.subprocess.run', return_value=subprocess.CompletedProcess([], 0, b'{"text":"<invalid>"}')):
            self.assertEqual(read_local_suggestion(b'test'), '')

    def test_bytes_are_stdin_not_command_arguments(self):
        with patch('local_ocr.Path.is_file', return_value=True), patch('local_ocr.subprocess.run', return_value=subprocess.CompletedProcess([], 0, b'{"text":"AB7X2"}')) as run:
            self.assertEqual(read_local_suggestion(b'IMAGE-BYTES'), 'AB7X2')
            self.assertNotIn('IMAGE-BYTES', str(run.call_args.args))
            self.assertIn('input', run.call_args.kwargs)
