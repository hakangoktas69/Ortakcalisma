import json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from notice_service import NoticeListCollector,page_data,record,listing_url,page_cursor,date_value

def row(i):return dict(tebligId=str(i),belgeNo='TEST-'+str(i),belgeTuruAciklama='TEST',kurumAciklama='TEST KURUM',gonderimZamani='2026-10-01T10:00:00',mukellefOkumaZamani=None,tebligZamani=None,tebligSecureId='DO-NOT-SAVE')
def response(n,rows):return dict(data=dict(count=3,tebligatDtoList=rows),pageDetail=dict(total=3,pageNo=n,pageSize=2,totalPage=2))
class NoticeServiceTests(unittest.IsolatedAsyncioTestCase):
 async def test_observed_pagination_and_no_secret_persistence(self):
  with tempfile.TemporaryDirectory() as d:
   c=NoticeListCollector(Path(d));c.first=response(0,[row(1),row(2)])
   c.request=SimpleNamespace(url='https://dijital.gib.gov.tr/apigateway/etebligat/etebligat/tebligat-listele',post_data=json.dumps(dict(pageNo=0,pageSize=2,filter='unchanged')),all_headers=AsyncMock(return_value={'Authorization':'PRIVATE'}))
   fetch=AsyncMock(return_value=SimpleNamespace(status=200,json=AsyncMock(return_value=response(1,[row(3)]))))
   result=await c.collect(SimpleNamespace(request=SimpleNamespace(fetch=fetch)),'owner','firm','1234567890','12345678901',('1234567890','12345678901'))
   self.assertEqual(result['count'],3)
   sent=json.loads(fetch.call_args.kwargs['data']);self.assertEqual(sent,dict(pageNo=1,pageSize=2,filter='unchanged'))
   saved=(Path(d)/'notice-list-result.json').read_text();self.assertNotIn('DO-NOT-SAVE',saved);self.assertNotIn('PRIVATE',saved)
 async def test_wrong_account_rejected_before_network(self):
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaises(ValueError):await NoticeListCollector(Path(d)).collect(None,'o','f','1234567890','0987654321',('1234567890',))
 def test_contract_and_source_fail_closed(self):
  self.assertFalse(listing_url('https://evil.invalid/apigateway/etebligat/etebligat/tebligat-listele'))
  with self.assertRaises(ValueError):page_data(response(0,[row(1)])|{'data':dict(count=2,tebligatDtoList=[])})
  with self.assertRaises(ValueError):page_cursor(dict(other=1))
  self.assertNotIn('tebligSecureId',record(row(1),'1234567890'))

 def test_turkish_source_dates_and_missing_values(self):
  for value in ['26.10.2026 10:20','26/10/2026 10:20:33','26/10/2026','2026-10-26T10:20:33Z']:
   self.assertEqual(date_value(value),'2026-10-26')
  self.assertIsNone(date_value(None))
  with self.assertRaises(ValueError):date_value('31/02/2026')
