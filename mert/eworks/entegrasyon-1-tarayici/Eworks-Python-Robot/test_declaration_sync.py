import unittest
import tempfile
import json
from pathlib import Path
from datetime import datetime
from unittest.mock import patch,AsyncMock
from playwright.async_api import async_playwright
from declaration_sync import synchronize
from declaration_sync import latest_saved_sync,save_checkpoint,recover_checkpoint
from declaration_reader import HEADERS
from declaration_sync import validate_scope,empty_result_dialog,query_segments


class SyncTests(unittest.TestCase):
    def test_repeated_source_warning_is_bounded_and_other_dialogs_reset_it(self):
        from declaration_sync import source_failure_streak
        warning=dict(type='alert',message='Hata: Site geçersiz bir cevap döndü. Lütfen çağrı merkezine haber veriniz.')
        streak=0
        for _ in range(8):streak=source_failure_streak(streak,warning)
        self.assertEqual(streak,8)
        self.assertEqual(source_failure_streak(streak,None),0)
        self.assertEqual(source_failure_streak(streak,dict(type='confirm',message=warning['message'])),0)
        self.assertEqual(source_failure_streak(streak,dict(type='alert',message='Kayıt bulunamadı.')),0)

    def test_checkpoint_survives_browser_failure_but_never_crosses_owner_or_cancel(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)/'jobs'/('a'*32);folder.mkdir(parents=True);scope=dict(year=2026,identities=['1234567890'])
            request=dict(ownerId='owner',requestId='a'*32,declarationSync=scope)
            result=dict(schema='eworks.declarations.sync.v1',ownerId='owner',requestId='a'*32,
                identities=scope['identities'],completedScopes=1,totalScopes=2,batches=[{'validated':'synthetic'}],failures=[])
            save_checkpoint(folder,result)
            recovered=recover_checkpoint(folder,request,'TargetClosedError')
            self.assertEqual(recovered['completedScopes'],1)
            self.assertEqual(recovered['batches'],result['batches'])
            self.assertIn('korundu',recovered['failures'][0]['message'])
            (folder/'request.json').write_text(json.dumps(request))
            # Son sorgu yükleme yalnız kesilmiş işe ait ara sonucu sunar.
            (folder/'status.json').write_text(json.dumps(dict(state='running')))
            self.assertIsNone(latest_saved_sync(folder.parents[1],'owner'))
            (folder/'status.json').write_text(json.dumps(dict(state='failed',message='PermissionError')))
            self.assertEqual(latest_saved_sync(folder.parents[1],'owner')['completedScopes'],1)
            self.assertIsNone(recover_checkpoint(folder,dict(request,ownerId='other'),'TargetClosedError'))
            (folder/'cancel').touch()
            self.assertIsNone(recover_checkpoint(folder,request,'TargetClosedError'))

    def test_exact_dates_split_across_years_and_reject_invalid_dates(self):
        scope=dict(year=2025,identities=['1234567890'],mode='upload',startDate='2025-12-30',endDate='2026-01-02')
        self.assertEqual(query_segments(validate_scope(scope)),[
            dict(year=2025,month=12,startDate='2025-12-30',endDate='2025-12-31'),
            dict(year=2026,month=1,startDate='2026-01-01',endDate='2026-01-02')])
        for values in [dict(startDate='2026-02-30'),dict(endDate='2100-01-01'),dict(startDate='2026-02-01',endDate='2026-01-01'),dict(mode='period',periodStart='2026-02',periodEnd='2026-01')]:
            with self.subTest(values=values),self.assertRaises(ValueError):validate_scope(dict(scope,**values))

    def test_valid_scope_and_rejected_duplicates(self):
        scope=dict(year=2026,identities=['1234567890'])
        self.assertEqual(validate_scope(scope),scope)
        for invalid in [None,{},dict(scope,year=2100),dict(scope,identities=[]),
                        dict(scope,identities=['1234567890']*2),dict(scope,identities=['invalid'])]:
            with self.subTest(invalid=invalid),self.assertRaises(ValueError):validate_scope(invalid)

    def test_only_observed_no_matches_alert_counts_as_empty(self):
        text='Hata: Sorgu yaptığınız kriterlere uyan beyanname bulunamamıştır.'
        self.assertTrue(empty_result_dialog(dict(type='alert',message=text)))
        self.assertTrue(empty_result_dialog(dict(type='alert',message=text.replace('kriterlere uyan','kriterlere\n  uyan'))))
        self.assertFalse(empty_result_dialog(dict(type='confirm',message=text)))
        self.assertFalse(empty_result_dialog(dict(type='alert',message='Oturumunuz sona erdi.')))
        self.assertFalse(empty_result_dialog(dict(type='alert',message='Yetkili kullanıcı bulunamadı.')))

    def test_saved_results_are_bound_to_owner_and_job(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);folder=root/'jobs'/('a'*32);folder.mkdir(parents=True)
            scope=dict(year=2026,identities=['1234567890'])
            (folder/'request.json').write_text(json.dumps(dict(ownerId='owner',declarationSync=scope)))
            result=dict(schema='eworks.declarations.sync.v1',requestId=folder.name,ownerId='owner',**scope)
            (folder/'declarations-sync-result.json').write_text(json.dumps(result))
            self.assertEqual(latest_saved_sync(root,'owner'),result)
            self.assertIsNone(latest_saved_sync(root,'other'))
            result['requestId']='b'*32
            (folder/'declarations-sync-result.json').write_text(json.dumps(result))
            with self.assertRaises(ValueError):latest_saved_sync(root,'owner')


class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def test_live_scopes_use_contract_proof_and_keep_prior_year_period(self,dated=False,period=False,alias=False,warning=False,transient=False):
        class January(datetime):
            @classmethod
            def now(cls,tz=None):return cls(2026,1,30,tzinfo=tz)
        owner='11111111-1111-4111-8111-111111111111'
        identities=['1234567890','9876543210','9999999999']
        contracts=[dict(taxNumber=v,number='T'+str(i),type='Aracılık ve Sorumluluk Sözleşmesi') for i,v in enumerate(identities[:2])]
        if alias:contracts[0]['identityNumber']='11112223334'
        if warning:contracts.append(dict(taxNumber=identities[2],number='T2',type='Aracılık ve Sorumluluk Sözleşmesi'))
        html='<table><tr><td>Vergi Kimlik Numarası</td><td><input name="vergiNo"></td></tr></table>'
        html+='<table><tr><td>TC Kimlik Numarası</td><td><input name="tcKimlikNo"></td></tr></table>'
        html+=''.join('<input type="checkbox" name="sorguTipi'+s+'">' for s in ('N','T','B','P','V','Z','D'))
        for name,value in (('baslangicTarihiGun','28' if dated else '01'),('baslangicTarihiAy','01'),('baslangicTarihiYil','2026'),('bitisTarihiGun','28' if dated else '31'),('bitisTarihiAy','01'),('bitisTarihiYil','2026')):
            html+='<input disabled name="'+name+'" value="'+value+'">'
        for name in ('donemBasAy','donemBitAy'):html+='<select name="'+name+'"><option value="12">Aralık</option></select>'
        for name in ('donemBasYil','donemBitYil'):html+='<select name="'+name+'"><option>2025</option><option>2026</option></select>'
        html+='<input type="button" name="sorgulaButon" value="Sorgula" onclick="showResult()"><div id="results"></div>'
        headers=''.join('<td>'+h+'</td>' for h in HEADERS)
        html+='''<script>function showResult(){
          window.sends=(window.sends||0)+1;
          (window.queryTimes||(window.queryTimes=[])).push(performance.now());
          const tax=document.querySelector('[name=sorguTipiT]').checked?document.querySelector('[name=tcKimlikNo]').value:document.querySelector('[name=vergiNo]').value;
          (window.queryIdentities||(window.queryIdentities=[])).push(tax);
          const cells=['','KDV1',tax,'SYNTHETIC','Office','12/2025-12/2025','','28.01.2026 - 11:43:37','Onaylandı',''];
          document.getElementById('results').innerHTML='<table><tr>HEADERS</tr><tr id="rowone" title="000000_'+tax+'_KDV1_1_01122025-31122025.xml">'+cells.map(v=>'<td>'+v+'</td>').join('')+'</tr></table><table><tr><td>1 - 1 / 1</td><td><input type="button" title="Sonraki Sayfa" disabled></td></tr></table>';
        }</script>'''.replace('HEADERS',headers)
        if alias:html=html.replace("['','KDV1',tax,","['','KDV1',tax==='1234567890'?'11112223334':tax,")
        if warning:html=html.replace("const cells=", "if(tax==='9876543210'){alert('Sistem sorguyu tamamlayamadı.');return;} const cells=")
        if transient:html=html.replace("const cells=", "if(window.sends===1){alert('Hata: Site geçersiz bir cevap döndü. Lütfen çağrı merkezine haber veriniz.');return;} const cells=")
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page();await page.goto('https://ebeyanname.gib.gov.tr/synthetic')
                request=dict(ownerId=owner,requestId='a'*32,declarationSync=dict(year=2026,identities=identities))
                if dated:
                    request['declarationSync'].update(mode='period' if period else 'upload',startDate='2026-01-28',endDate='2026-01-28')
                    if period:request['declarationSync'].update(periodStart='2025-12',periodEnd='2025-12')
                with tempfile.TemporaryDirectory() as directory,patch('declaration_sync.datetime',January),patch('declaration_sync.inspect_module_screen',new_callable=AsyncMock),patch.dict('institution_discovery._LIVE_QUERY_ALIASES',{'1234567890':['1234567890','11112223334']} if alias else {},clear=True):
                    result=await synchronize(context,Path(directory),request,contracts,AsyncMock(return_value={}),lambda *args:None)
                self.assertEqual(result['completedScopes'],2)
                self.assertEqual(result['totalScopes'],3)
                self.assertEqual(len(result['failures']),1)
                self.assertEqual(result['failures'][0]['identity'],identities[1] if warning else identities[-1])
                self.assertEqual(await page.evaluate('window.sends'),3 if warning or transient else 2)
                times=await page.evaluate('window.queryTimes')
                self.assertTrue(all(b-a>=1450 for a,b in zip(times,times[1:])))
                if transient and alias:self.assertEqual(await page.evaluate('window.queryIdentities'),['1234567890','11112223334','9876543210'])
                self.assertEqual([b['records'][0]['identity'] for b in result['batches']],[identities[0],identities[2]] if warning else identities[:2])
                self.assertTrue(all(b['records'][0]['period']=='2025-12' for b in result['batches']))
                self.assertEqual(await page.locator('[name=sorguTipiP]').is_checked(),period)
                if alias:
                    self.assertEqual(result['batches'][0]['records'][0]['metadata']['observedIdentity'],'11112223334')
                    self.assertIn('11112223334',result['batches'][0]['accessEvidence']['identityAliases'])
                if dated:
                    self.assertEqual(result['queryScope'],request['declarationSync'])
                    self.assertEqual(result['segments'],[dict(year=2026,month=1,startDate='2026-01-28',endDate='2026-01-28')])
                    self.assertEqual(result['batches'][0]['queryRange']['startDate'],'2026-01-28')
            finally:await browser.close()

    async def test_exact_upload_day_is_sent_to_gib(self):
        await self.test_live_scopes_use_contract_proof_and_keep_prior_year_period(dated=True)

    async def test_observed_transient_gib_error_is_retried_once_with_pacing(self):
        await self.test_live_scopes_use_contract_proof_and_keep_prior_year_period(transient=True)

    async def test_transient_retry_can_use_only_live_verified_contract_alias(self):
        await self.test_live_scopes_use_contract_proof_and_keep_prior_year_period(transient=True,alias=True)

    async def test_period_and_upload_day_are_both_sent_to_gib(self):
        await self.test_live_scopes_use_contract_proof_and_keep_prior_year_period(dated=True,period=True)

    async def test_tax_query_accepts_identity_number_only_from_same_live_contract(self):
        await self.test_live_scopes_use_contract_proof_and_keep_prior_year_period(dated=True,alias=True)

    async def test_unknown_warning_is_not_empty_and_does_not_stop_next_firm(self):
        await self.test_live_scopes_use_contract_proof_and_keep_prior_year_period(dated=True,warning=True)
