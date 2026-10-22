import json
import tempfile
import unittest
from pathlib import Path
from declaration_adapter import normalize_declaration_rows
from declaration_review import load_declaration_review

OWNER='11111111-1111-4111-8111-111111111111'
OTHER='22222222-2222-4222-8222-222222222222'
JOB='a'*32


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        folder=self.root/'jobs'/JOB;folder.mkdir(parents=True)
        (folder/'request.json').write_text(json.dumps({'ownerId':OWNER}))
        config=dict(jobId=JOB,identity='1234567890',year=2026,uploadMonths=[7])
        (self.root/'declaration-review-source.json').write_text(json.dumps(config))
        row=dict(identity='1234567890',sourceRowId='synthetic',document='KDV1',period='06/2026-06/2026',
            uploadedAt='28.07.2026 - 11:43:37',taxStatus='Onaylandı',sgkStatus='',
            sourceFilename='000000_1234567890_KDV1_1_01062026-30062026.xml')
        records=normalize_declaration_rows([row],identity='1234567890',year=2026,upload_month=7,expected_count=1)
        self.batch=dict(schema='eworks.declaration.observation.v1',sourceOrigin='https://ebeyanname.gib.gov.tr',
            year=2026,uploadMonth=7,singlePageVerified=True,imported=False,authorizationVerified=False,
            records=records,observedCount=1,pageRange='1 - 1 / 1')
        self.write()

    def write(self):
        (self.root/'jobs'/JOB/'institution-live-structure.json').write_text(json.dumps({'frames':[
            dict(sourceOrigin='https://ebeyanname.gib.gov.tr',declarationResults={'7':self.batch})]}))

    def test_owner_bound_review_keeps_pending_authority(self):
        result=load_declaration_review(self.root,OWNER)
        self.assertEqual(result['count'],1)
        self.assertEqual(result['reviewState'],'pending_authority')
        self.assertFalse(result['authorizationVerified'])

    def test_other_owner_cannot_read(self):
        with self.assertRaises(PermissionError):load_declaration_review(self.root,OTHER)

    def evidence(self,owner=OWNER,identity='1234567890'):
        proof=dict(schema='eworks.advisor.contract-evidence.v1',ownerId=owner,requestId=JOB,
            sourceOrigin='https://intvrg.gib.gov.tr',sourceType='gib_live',observedAt='2026-10-20T10:00:00+00:00',
            contracts=[dict(taxNumber=identity,type='Aracılık ve Sorumluluk Sözleşmesi',number='C1')],observedCount=1)
        (self.root/'jobs'/JOB/'advisor-contract-evidence.json').write_text(json.dumps(proof))

    def test_same_job_contract_and_scoped_rows_enable_import(self):
        self.evidence()
        result=load_declaration_review(self.root,OWNER)
        self.assertTrue(result['authorizationVerified'])
        self.assertEqual(result['accessEvidence']['contractNumbers'],['C1'])

    def test_foreign_owner_or_taxpayer_evidence_rejected(self):
        for owner,identity in ((OTHER,'1234567890'),(OWNER,'9999999999')):
            with self.subTest(owner=owner,identity=identity):
                self.evidence(owner,identity)
                with self.assertRaises(ValueError):load_declaration_review(self.root,OWNER)

    def test_changed_normalized_data_is_rejected(self):
        self.batch['records'][0]['date']='2026-08-01';self.write()
        with self.assertRaises(ValueError):load_declaration_review(self.root,OWNER)

    def test_unverified_page_cannot_enter_review(self):
        self.batch['singlePageVerified']=False;self.write()
        with self.assertRaises(ValueError):load_declaration_review(self.root,OWNER)

