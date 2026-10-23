import base64
import json
import tempfile
import time
import unittest
from pathlib import Path
from bulk_resume import load_resume,token_run_budget,complete_documents


class ResumeTests(unittest.TestCase):
    def token(self,seconds):
        body=base64.urlsafe_b64encode(json.dumps({'exp':time.time()+seconds}).encode()).decode().rstrip('=')
        return 'synthetic.'+body+'.synthetic'

    def test_run_budget_never_extends_token_or_40_minute_cap(self):
        run,left=token_run_budget(self.token(600));self.assertTrue(478<=run<=480)
        self.assertLessEqual(run,left-120)
        self.assertEqual(token_run_budget(self.token(7200))[0],2400)
        self.assertEqual(token_run_budget(self.token(60))[0],0)
        self.assertEqual(token_run_budget('malformed'),(0,0))

    def fixture(self):
        temp=tempfile.TemporaryDirectory();root=Path(temp.name);jobs=root/'jobs';jobs.mkdir()
        old='a'*32;new='b'*32;source=jobs/old;source.mkdir();folder=jobs/new;folder.mkdir()
        owner='11111111-1111-4111-8111-111111111111'
        scope={'year':2026,'identities':['1234567890'],'mode':'upload','startDate':'2026-07-22','endDate':'2026-10-15'}
        request={'ownerId':owner,'requestId':new,'declarationSync':scope,'downloadDocuments':True}
        prior={**request,'requestId':old}
        (source/'request.json').write_text(json.dumps(prior))
        batch={'sourceJobId':old,'year':2026,'uploadMonths':[7],'count':0,'records':[],
            'authorizationVerified':True,'accessEvidence':{'identity':'1234567890',
            'contractNumbers':['synthetic-contract'],'method':'same_session_contract_and_scoped_query'}}
        result={'schema':'eworks.declarations.sync.v1','requestId':old,'ownerId':owner,'queryScope':scope,'batches':[batch]}
        (source/'declarations-sync-result.json').write_text(json.dumps(result))
        plan={'ownerId':owner,'scope':scope,'createdAt':time.time(),'sourceJobId':old}
        (root/'pending-bulk-resume.json').write_text(json.dumps(plan))
        return temp,root,source,folder,request,scope,result

    def test_matching_scope_reuses_only_complete_proven_batch_and_keeps_provenance(self):
        temp,root,source,folder,request,scope,result=self.fixture()
        with temp:
            batches=load_resume(folder,request,scope,{'1234567890':['synthetic-contract']})
            self.assertEqual(len(batches),1)
            self.assertEqual(batches[0]['sourceJobId'],'b'*32)
            self.assertEqual(batches[0]['sourceObservationJobId'],'a'*32)
            self.assertTrue((folder/'resume-plan.json').exists());self.assertFalse((root/'pending-bulk-resume.json').exists())
            self.assertEqual(json.loads((source/'declarations-sync-result.json').read_text())['batches'][0]['sourceJobId'],'a'*32)

    def test_wrong_owner_scope_or_traversal_plan_never_reuses(self):
        for change in ({'ownerId':'other'},{'sourceJobId':'../escape'},{'createdAt':0}):
            temp,root,source,folder,request,scope,result=self.fixture()
            with temp:
                path=root/'pending-bulk-resume.json';plan=json.loads(path.read_text());plan.update(change);path.write_text(json.dumps(plan))
                with self.assertRaises(ValueError):load_resume(folder,request,scope,{'1234567890':['synthetic-contract']})
                self.assertTrue(path.exists())

    def test_document_failure_or_missing_live_contract_not_skipped(self):
        self.assertFalse(complete_documents({'records':[{'documentStatus':'failed'}]}))
        self.assertFalse(complete_documents({'records':[{'documentStatus':'saved','sgkSyncStatus':'failed'}]}))
        temp,root,source,folder,request,scope,result=self.fixture()
        with temp:self.assertEqual(load_resume(folder,request,scope,{}),[])

    def test_explicit_end_date_narrowing_excludes_october_and_keeps_september_provenance(self):
        temp,root,source,folder,request,scope,result=self.fixture()
        with temp:
            for month in (9,10):
                batch=json.loads(json.dumps(result['batches'][0]))
                batch['uploadMonths']=[month]
                batch['queryRange']={'year':2026,'month':month,'startDate':f'2026-{month:02d}-01','endDate':'2026-09-30' if month==9 else '2026-10-15','mode':'upload'}
                result['batches'].append(batch)
            (source/'declarations-sync-result.json').write_text(json.dumps(result))
            narrowed={**scope,'endDate':'2026-09-30'}
            p=root/'pending-bulk-resume.json';plan=json.loads(p.read_text());plan.update(scope=narrowed,sourceScope=scope);p.write_text(json.dumps(plan))
            batches=load_resume(folder,{**request,'declarationSync':narrowed},narrowed,{'1234567890':['synthetic-contract']})
            self.assertEqual([b['uploadMonths'] for b in batches],[[9]])
            self.assertEqual(batches[0]['sourceObservationJobId'],'a'*32)
            self.assertEqual(batches[0]['resumeScopeChange']['endDate'],'2026-09-30')
            self.assertEqual(len(json.loads((source/'declarations-sync-result.json').read_text())['batches']),3)

    def test_scope_narrowing_rejects_expansion_identity_start_and_mode_changes(self):
        for change in ({'endDate':'2026-10-20'},{'identities':['9999999999']},{'startDate':'2026-08-01'},{'mode':'period','periodStart':'2026-07','periodEnd':'2026-09'}):
            temp,root,source,folder,request,scope,result=self.fixture()
            with temp:
                new_scope={**scope,**change}
                p=root/'pending-bulk-resume.json';plan=json.loads(p.read_text());plan.update(scope=new_scope,sourceScope=scope);p.write_text(json.dumps(plan))
                with self.assertRaises(ValueError):load_resume(folder,{**request,'declarationSync':new_scope},new_scope,{'1234567890':['synthetic-contract']})


if __name__=='__main__':unittest.main()
