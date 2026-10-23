import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock,patch
from declaration_documents import DocumentCollector
from document_retry import retry_plan,apply_retry_plan
from bulk_resume import complete_documents

OWNER='11111111-1111-4111-8111-111111111111'
SOURCE='a'*32
SCOPE=dict(year=2026,mode='upload',startDate='2026-07-22',endDate='2026-08-31',identities=['1234567890'])


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.portal=Path(self.tmp.name)
        self.folder=self.portal/'jobs'/SOURCE;self.folder.mkdir(parents=True)
        self.data=dict(schema='eworks.declarations.sync.v1',ownerId=OWNER,requestId=SOURCE,queryScope=SCOPE,
            documentFailures=[dict(identity='1234567890',recordId='parent',module=m) for m in ('declaration','sgk')],
            batches=[dict(authorizationVerified=True,accessEvidence=dict(identity='1234567890',method='same_session_contract_and_scoped_query',contractNumbers=['fixture']),records=[dict(identity='1234567890',recordId='parent',date='2026-08-05')])])
        self.save()
    def save(self):
        (self.folder/'declarations-sync-result.json').write_text(json.dumps(self.data))
        (self.folder/'request.json').write_text(json.dumps(dict(ownerId=OWNER,declarationSync=SCOPE)))
    def tearDown(self):self.tmp.cleanup()
    def test_parent_dedup_preserves_both_modules(self):
        plan=retry_plan(self.portal,OWNER,SOURCE)
        self.assertEqual(plan['failureCount'],2);self.assertEqual(plan['recordCount'],1)
        self.assertEqual(set(plan['targets'][0]['modules']),{'declaration','sgk'})
    def test_foreign_owner_and_path_traversal_rejected(self):
        for owner,source in [('different',SOURCE),(OWNER,'../'+SOURCE)]:
            with self.assertRaises(ValueError):retry_plan(self.portal,owner,source)
    def test_unknown_or_duplicate_target_rejected(self):
        self.data['documentFailures'][0]['recordId']='absent';self.save()
        with self.assertRaises(ValueError):retry_plan(self.portal,OWNER,SOURCE)
    def test_subset_never_counts_as_full_resume_coverage(self):
        self.assertFalse(complete_documents({'documentRetrySourceJobId':SOURCE,'records':[]}))


class CollectorTests(unittest.IsolatedAsyncioTestCase):
    async def test_unrelated_rows_never_request_pdf_or_storage(self):
        with tempfile.TemporaryDirectory() as temp:
            collector=DocumentCollector(Path(temp),OWNER,'synthetic',lambda *a:None)
            collector.retry_targets={('1234567890','target'):{'declaration'}}
            download=AsyncMock(return_value=[])
            with patch('importlib.reload',return_value=SimpleNamespace(download_documents=download)),patch('declaration_documents.verified_existing',return_value=[]) as verify:
                rows=[dict(identity='1234567890',recordId='other'),dict(identity='1234567890',recordId='target')]
                await collector.collect(SimpleNamespace(),rows)
                self.assertEqual(download.await_count,1);self.assertEqual(verify.call_count,1)
                self.assertNotIn('attachments',rows[0])


if __name__=='__main__':unittest.main()
