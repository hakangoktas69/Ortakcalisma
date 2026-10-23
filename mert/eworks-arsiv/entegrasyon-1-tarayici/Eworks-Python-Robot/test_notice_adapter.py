import unittest
from notice_adapter import HEADERS, build_notice_batch


class NoticeAdapterTests(unittest.TestCase):
    def batch(self, rows=None, **changes):
        options=dict(owner_id='11111111-1111-4111-8111-111111111111',identity='1234567890',
            observed_identity='1234567890',year=2026,expected_count=1,
            source_url='https://dijital.gib.gov.tr/portal/',observed_at='2026-10-19T16:00:00+03:00')
        options.update(changes)
        if rows is None: rows=[['','SENTETİK KURUM','TEST','TEST BELGESİ','SYNTHETIC-1','19.10.2026','—','—']]
        return build_notice_batch(HEADERS,rows,**options)

    def test_live_column_mapping_and_stable_identity(self):
        record=self.batch()['records'][0]
        self.assertEqual(record['date'],'2026-10-19')
        self.assertEqual(record['periodBasis'],'sent_date')
        self.assertIsNone(record['readDate'])
        self.assertEqual(self.batch()['records'][0]['recordId'],record['recordId'])
        self.assertNotIn('content',record)

    def test_scope_count_year_and_duplicates_rejected(self):
        for changes in [dict(observed_identity='0987654321'),dict(expected_count=2),dict(year=2025)]:
            with self.assertRaises(ValueError): self.batch(**changes)
        row=['','SENTETİK','TEST','TEST','TEST-1','19.10.2026','','']
        with self.assertRaises(ValueError): self.batch([row,row],expected_count=2)

    def test_invalid_date_and_missing_reference_rejected(self):
        for reference,sent in [('', '19.10.2026'),('TEST','31.02.2026')]:
            with self.assertRaises(ValueError):
                self.batch([['','SENTETİK','','TEST',reference,sent,'','']])
