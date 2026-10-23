import unittest
from declaration_adapter import normalize_declaration_rows


class DeclarationAdapterTests(unittest.TestCase):
    def test_url_encoded_opaque_id_keeps_source_and_uses_safe_storage_id(self):
        from source_record_id import canonical_source_id
        raw='abcdefgh%40%C2%BD%3E1234'
        row=dict(self.row(),sourceRowId=raw,sourceFilename='',sourceReferenceType='source_record_id')
        result=self.normalize([row])[0]
        self.assertEqual(result['recordId'],canonical_source_id(raw))
        self.assertRegex(result['recordId'],r'^encoded-[a-f0-9]{64}$')
        self.assertEqual(result['metadata']['sourceRowId'],raw)
        self.assertEqual(result['reference'],raw)
        for bad in ('abc%2F..%2Fdef','abc%22def','abc%00def','abc%ZZdef'):
            with self.assertRaises(ValueError):canonical_source_id(bad)

    def test_identity_alias_requires_explicit_contract_mapping(self):
        row=self.row();row['identity']='11112223334'
        with self.assertRaises(ValueError):self.normalize([row])
        result=self.normalize([row],identity_aliases=['1234567890','11112223334'])[0]
        self.assertEqual(result['identity'],'1234567890')
        self.assertEqual(result['metadata']['observedIdentity'],'11112223334')
        with self.assertRaises(ValueError):self.normalize([row],identity_aliases=['1234567890','99999999999'])

    def row(self):
        return dict(identity='1234567890',sourceRowId='synthetic-1',document='KDV1',
            period='06/2026-06/2026',uploadedAt='28.07.2026 - 11:43:37',
            taxStatus='Onaylandı',sgkStatus='',sourceFilename='000000_1234567890_KDV1_1_01062026-30062026.xml')

    def normalize(self,rows,**kw):
        args=dict(identity='1234567890',year=2026,upload_month=7,expected_count=len(rows))
        args.update(kw)
        return normalize_declaration_rows(rows,**args)

    def test_preserves_period_upload_status_and_source_reference(self):
        row=self.row()
        result=self.normalize([row])[0]
        self.assertEqual(result['period'],'2026-06')
        self.assertEqual(result['date'],'2026-07-28')
        self.assertEqual(result['reference'],row['sourceFilename'])
        self.assertEqual(result['metadata']['uploadedAt'],'2026-07-28T11:43:37+03:00')
        self.assertNotIn('complete',result)
        self.assertNotIn('observedAccountIdentity',result)

    def test_rejects_wrong_identity_year_upload_month_and_reference(self):
        for field,value in (('identity','9999999999'),('period','06/2025-06/2025'),
            ('uploadedAt','28.08.2026 - 11:43:37'),('sourceFilename','fake.xml'),('taxStatus',None)):
            with self.subTest(field=field),self.assertRaises(ValueError):
                self.normalize([dict(self.row(),**{field:value})])

    def test_new_gib_status_is_preserved_without_approval_claim(self):
        result=self.normalize([dict(self.row(),taxStatus='SYNTHETIC-NEW-STATUS')])[0]
        self.assertEqual(result['status'],'SYNTHETIC-NEW-STATUS')
        self.assertFalse(result['metadata']['taxStatusRecognized'])
        missing=self.normalize([dict(self.row(),taxStatus='')])[0]
        self.assertEqual(missing['status'],'Durum belirtilmedi')
        self.assertEqual(missing['metadata']['sourceTaxStatus'],'')
        self.assertFalse(missing['metadata']['taxStatusRecognized'])
        multiline=self.normalize([dict(self.row(),taxStatus='Onaylandı\nunknown')])[0]
        self.assertEqual(multiline['status'],'Onaylandı unknown')
        self.assertEqual(multiline['metadata']['sourceTaxStatus'],'Onaylandı\nunknown')
        self.assertFalse(multiline['metadata']['taxStatusRecognized'])
        self.assertEqual(self.normalize([dict(self.row(),taxStatus='x'*101)])[0]['status'],'x'*101)
        for status in ('x'*1025,'Onaylandı\x00unknown'):
            with self.assertRaises(ValueError):self.normalize([dict(self.row(),taxStatus=status)])

    def test_rejects_duplicates_and_incomplete_count(self):
        with self.assertRaises(ValueError):self.normalize([self.row(),self.row()])
        with self.assertRaises(ValueError):self.normalize([self.row()],expected_count=2)

    def test_exact_upload_dates_and_taxable_period_are_checked(self):
        self.assertEqual(len(self.normalize([self.row()],upload_year_only=True,upload_range=('2026-07-28','2026-07-28'),period_range=('2026-06','2026-06'))),1)
        with self.assertRaises(ValueError):self.normalize([self.row()],upload_range=('2026-07-20','2026-07-27'))
        with self.assertRaises(ValueError):self.normalize([self.row()],period_range=('2026-07','2026-07'))

    def test_preserves_cancelled_record(self):
        self.assertEqual(self.normalize([dict(self.row(),taxStatus='İptal')])[0]['status'],'İptal')

    def test_empty_list_never_means_complete_year(self):
        self.assertEqual(self.normalize([]),[])


if __name__=='__main__':unittest.main()
