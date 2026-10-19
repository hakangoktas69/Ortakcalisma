"""Ayrı OCR ortamında çalışır; yalnızca stdin/stdout, dosya veya ağ kullanmaz."""
import base64
import contextlib
import io
import json
import re
import sys


def recognize(data):
    from PIL import Image, ImageOps
    import ddddocr
    if not data or len(data) > 2_000_000:
        raise ValueError('image_size')
    with Image.open(io.BytesIO(data)) as image:
        w, h = image.size
        if min(w, h) < 5 or max(w, h) > 2048 or w*h > 1_000_000:
            raise ValueError('image_dimensions')
        rgba = image.convert('RGBA')
        background = Image.new('RGBA', rgba.size, 'white')
        rgb = Image.alpha_composite(background, rgba).convert('RGB')
        gray = ImageOps.autocontrast(rgb.convert('L'))
        # İki farklı temsilde tutarlı öneri aranır. Bu doğruluk garantisi değildir.
        engine = ddddocr.DdddOcr(show_ad=False, use_gpu=False)
        answers = []
        for candidate in (rgb, gray):
            text = engine.classification(candidate).strip()
            if not re.fullmatch(r'[A-Za-z0-9]{4,8}', text):
                return ''
            answers.append(text)
        return answers[0] if answers[0] == answers[1] else ''


def main():
    try:
        request = json.loads(sys.stdin.buffer.read(2_800_001).decode('utf-8'))
        data = base64.b64decode(request['image'], validate=True)
        with contextlib.redirect_stdout(io.StringIO()):
            text = recognize(data)
        print(json.dumps({'text': text, 'engine': 'ddddocr'}))
        return 0
    except Exception:
        # Görsel, kod ve ham hata metni loglanmaz.
        print(json.dumps({'text': '', 'error': 'local_ocr_failed'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
