"""Yalnızca üretilen test görselleri; canlı CAPTCHA okunmaz/gönderilmez."""
import unittest
from io import BytesIO
from unittest.mock import patch

import cv2
import numpy as np
from PIL import Image
from gib_automation import captcha_image_variants, read_captcha_suggestion, OCR_CONFIG


def synthetic_image():
    data = np.full((90, 300, 3), 255, dtype=np.uint8)
    cv2.putText(data, 'AB7X2', (22, 62), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 3)
    cv2.line(data, (0, 35), (299, 35), (0, 0, 0), 2)
    cv2.line(data, (285, 0), (285, 89), (0, 0, 0), 1)
    out = BytesIO()
    Image.fromarray(data).save(out, format='PNG')
    return out.getvalue()


def result(text='', confidence=0):
    return {'text': ['', text], 'conf': [-1, confidence]}


class OcrTests(unittest.TestCase):
    def test_low_confidence_never_fills_a_guess(self):
        with patch('gib_automation.pytesseract.image_to_data', return_value=result('WRONG', 15)):
            self.assertEqual(read_captcha_suggestion(synthetic_image()), '')

    def test_disagreeing_high_confidence_results_are_rejected(self):
        with patch('gib_automation.pytesseract.image_to_data', side_effect=[
                result('AB7X2', 95), result('AB7X2', 96),
                result('ZZ9Y1', 97), result('AB7X2', 95)]):
            self.assertEqual(read_captcha_suggestion(synthetic_image(), min_agreement=2), '')

    def test_two_matching_confident_reads_required(self):
        with patch('gib_automation.pytesseract.image_to_data', side_effect=[
                result('AB7X2', 95), result('AB7X2', 96), result(), result()]):
            self.assertEqual(read_captcha_suggestion(synthetic_image(), min_agreement=2), 'AB7X2')
        with patch('gib_automation.pytesseract.image_to_data', side_effect=[
                result('AB7X2', 95), result(), result(), result()]):
            self.assertEqual(read_captcha_suggestion(synthetic_image(), min_agreement=2), '')

    def test_binary_images_remove_long_line_but_keep_foreground(self):
        variants = list(captcha_image_variants(synthetic_image()))
        self.assertEqual(len(variants), 4)
        for image in variants:
            self.assertEqual(image.ndim, 2)
            self.assertEqual(image.dtype, np.uint8)
            self.assertTrue(set(np.unique(image)).issubset({0, 255}))
            self.assertGreater(np.count_nonzero(image == 0), 100)
        # Uzun çizginin metin dışındaki sol kesimi silinmiş olmalı.
        line_region = variants[0][12+34*3:12+37*3, 12:12+18*3]
        self.assertLess(np.count_nonzero(line_region == 0), line_region.size//3)

    def test_retry_after_empty_and_low_confidence(self):
        with patch('gib_automation.pytesseract.image_to_data', side_effect=[
                result(), result('AB7X2', 20), result('AB7X2', 90)]) as ocr:
            self.assertEqual(read_captcha_suggestion(synthetic_image()), 'AB7X2')
            self.assertEqual(ocr.call_count, 3)
            self.assertEqual(ocr.call_args.kwargs['config'], OCR_CONFIG)
            self.assertEqual(ocr.call_args.kwargs['timeout'], 3)

    def test_attempts_bounded_and_timeout_falls_back_to_manual(self):
        with patch('gib_automation.pytesseract.image_to_data', side_effect=RuntimeError('timeout')) as ocr:
            self.assertEqual(read_captcha_suggestion(synthetic_image()), '')
            self.assertEqual(ocr.call_count, 4)
        with self.assertRaises(ValueError):
            read_captcha_suggestion(synthetic_image(), max_attempts=5)

    def test_wrong_length_or_invalid_characters_are_not_suggestions(self):
        with patch('gib_automation.pytesseract.image_to_data', side_effect=[
                result('AB7X', 99), result('AB7X!', 99), result('AB7X2', 95)]) as ocr:
            self.assertEqual(read_captcha_suggestion(synthetic_image(), expected_length=5), 'AB7X2')
            self.assertEqual(ocr.call_count, 3)

    def test_invalid_or_oversized_image_rejected(self):
        with self.assertRaises(ValueError):
            list(captcha_image_variants(b''))
        out = BytesIO()
        Image.new('RGB', (2049, 20), 'white').save(out, format='PNG')
        with self.assertRaises(ValueError):
            list(captcha_image_variants(out.getvalue()))
