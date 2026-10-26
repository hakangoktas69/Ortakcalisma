import subprocess
import unittest
from unittest.mock import patch
from local_ocr import read_local_suggestion


class LocalTests(unittest.TestCase):
    def test_configured_interpreter_keeps_worker_in_second_integration(self):
        from pathlib import Path
        import local_ocr
        interpreter=str(Path('isolated-ocr')/'python.exe')
        with patch.dict('os.environ',{'EWORKS_OCR_PYTHON':interpreter}), patch('local_ocr.Path.is_file',return_value=True), patch('local_ocr.subprocess.run',return_value=subprocess.CompletedProcess([],0,b'{"text":"AB7X2"}')) as run:
            self.assertEqual(read_local_suggestion(b'test'),'AB7X2')
            self.assertEqual(run.call_args.args[0][0],interpreter)
            self.assertEqual(Path(run.call_args.args[0][1]).parent,Path(local_ocr.__file__).parent)

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
