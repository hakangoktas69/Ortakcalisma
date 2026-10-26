"""OCR subprocess adaptörü: ağ, geçici görüntü ve komut satırında kod yok."""
import base64
import json
import os
import re
import subprocess
from pathlib import Path


def interpreter_path():
    root = Path(__file__).resolve().parent
    configured = os.environ.get('EWORKS_OCR_PYTHON')
    return Path(configured) if configured else root / '.ocr-venv' / 'Scripts' / 'python.exe'


def read_local_suggestion(image_bytes):
    root = Path(__file__).resolve().parent
    python = interpreter_path()
    if not python.is_file():
        return ''
    if not image_bytes or len(image_bytes) > 2_000_000:
        return ''
    try:
        result = subprocess.run(
            [str(python), str(root / 'local_ocr_worker.py')],
            input=json.dumps({'image': base64.b64encode(image_bytes).decode('ascii')}).encode('utf-8'),
            capture_output=True, timeout=20,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
        if result.returncode:
            return ''
        text = json.loads(result.stdout.decode('utf-8')).get('text', '')
        return text if isinstance(text, str) and re.fullmatch(r'[A-Za-z0-9]{4,8}', text) else ''
    except (OSError, subprocess.TimeoutExpired, ValueError, AttributeError):
        return ''
