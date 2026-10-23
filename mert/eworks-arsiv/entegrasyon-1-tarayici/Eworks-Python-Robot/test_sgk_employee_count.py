import unittest
from types import SimpleNamespace
from unittest.mock import patch
from sgk_employee_count import service_employee_count

class EmployeeCountTests(unittest.TestCase):
    def parse(self,pages):
        objects=[SimpleNamespace(extract_text=lambda value=value:value) for value in pages]
        with patch('sgk_employee_count.PdfReader',return_value=SimpleNamespace(pages=objects)):
            return service_employee_count(b'fixture')

    def test_unique_people_across_pages_not_rows(self):
        header='Sno S.Güvenlik No Adı Soyadı ÜcretTL İkramiyeTL Gün Meslek Kod\n'
        row='1 11111111111 TEST PERSON 2.202,00 0,00 30 5223.78\n'
        self.assertEqual(self.parse([header+row,header+row+'2 22222222222 SECOND PERSON 1.202,00 0,00 20 5223.78']),2)

    def test_unknown_or_empty_pdf_is_not_zero_employees(self):
        self.assertIsNone(self.parse(['Tahakkuk fişi\n1 11111111111 TEST 1.000,00 0,00']))
        self.assertIsNone(self.parse(['Sno S.Güvenlik No Adı Soyadı Meslek Kod\n']))

if __name__=='__main__':unittest.main()
