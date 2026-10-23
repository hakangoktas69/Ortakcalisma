"""Kurum kaydı sözleşmesi; yalnızca sentetik veri, ağ isteği yok."""
import copy
import unittest
from institution_records import validate_module_batch, merge_module_records

OWNER = '11111111-1111-4111-8111-111111111111'
IDENTITY = '1234567890'


def fixture():
    return dict(schema='eworks.gib.module.v1', ownerId=OWNER, module='notices',
                sourceURL='https://dijital.gib.gov.tr/portal/',
                observedAccountIdentity=IDENTITY, year=2026, complete=True,
                expectedCount=1, observedAt='2026-10-19T12:00:00+03:00',
                records=[dict(identity=IDENTITY, recordId='SYNTHETIC-1',
                              document='Sentetik kayıt', reference='TEST',
                              period='2026-10', status='Kaynak durumu', date='2026-10-19')])


class RecordTests(unittest.TestCase):
    def validate(self, batch):
        return validate_module_batch(batch, owner_id=OWNER, identity=IDENTITY, year=2026)

    def test_wrong_owner_account_period_source_or_total_rejected(self):
        changes = [('ownerId', 'other'), ('observedAccountIdentity', '0987654321'),
                   ('year', 2025), ('complete', False), ('expectedCount', 2),
                   ('sourceURL', 'https://dijital.gib.gov.tr.evil.invalid/'),
                   ('sourceURL', 'https://dijital.gib.gov.tr/?token=secret')]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                batch = fixture(); batch[key] = value
                with self.assertRaises(ValueError): self.validate(batch)

    def test_cross_firm_duplicate_and_wrong_period_rows_rejected(self):
        for key, value in [('identity', '0987654321'), ('period', '2025-10')]:
            batch = fixture(); batch['records'][0][key] = value
            with self.assertRaises(ValueError): self.validate(batch)
        batch = fixture(); batch['records'] *= 2; batch['expectedCount'] = 2
        with self.assertRaises(ValueError): self.validate(batch)

    def test_upsert_idempotent_preserves_other_modules_and_does_not_mutate(self):
        batch = fixture()
        existing = [dict(batch['records'][0], module='declarations')]
        original = copy.deepcopy(existing)
        result = merge_module_records(existing, batch, owner_id=OWNER, identity=IDENTITY, year=2026)
        self.assertEqual(existing, original)
        self.assertEqual(len(result), 2)
        self.assertEqual(merge_module_records(result, batch, owner_id=OWNER, identity=IDENTITY, year=2026), result)

    def test_empty_result_preserves_existing(self):
        batch = fixture(); existing = [dict(batch['records'][0], module='notices')]
        batch['records'] = []; batch['expectedCount'] = 0
        self.assertEqual(merge_module_records(existing, batch, owner_id=OWNER, identity=IDENTITY, year=2026), existing)
