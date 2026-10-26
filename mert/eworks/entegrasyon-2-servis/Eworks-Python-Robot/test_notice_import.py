import copy,unittest
from hashlib import sha256
from notice_import import prepare_notice_import
from notice_service import LIST_PATH
OWNER='11111111-1111-4111-8111-111111111111'
class NoticeImportTests(unittest.TestCase):
 def fixture(self):
  backup=dict(version=1,data=dict(firms=[dict(id='fixture',name='TEST FIRMA',taxNumber='1234567890',identityNumber='12345678901')],tasks=[dict(id='kept-task')],notes=[dict(id='kept',page='sgk-bildirge',ownerId=OWNER,attachments=[dict(keep=True)])]))
  snapshot=dict(schema='eworks.notice-list.v1',complete=True,accountVerified=True,documentsOpened=False,scope='observed_list_filter',ownerId=OWNER,firmId='fixture',identity='1234567890',observedAccountIdentity='12345678901',sourceURL='https://dijital.gib.gov.tr'+LIST_PATH,count=1,records=[dict(recordId=sha256(b'test').hexdigest(),identity='1234567890',reference='TEST-1',document='TEST',sender='TEST KURUM',date='2026-10-01',period='2026-10',readDate=None)])
  return snapshot,backup
 def test_additive_and_repeat_import_is_idempotent(self):
  s,b=self.fixture();before=copy.deepcopy(b)
  first,stats=prepare_notice_import(s,b,'a'*32);second,again=prepare_notice_import(s,first,'a'*32)
  self.assertEqual(stats['added'],1);self.assertEqual(again['added'],0);self.assertEqual(again['updated'],1)
  self.assertEqual(len(second['data']['notes']),2);self.assertEqual(second['data']['notes'][0],b['data']['notes'][0]);self.assertEqual(b,before)
  self.assertEqual(second['data']['tasks'],b['data']['tasks'])
 def test_wrong_owner_identity_partial_and_document_opening_are_rejected(self):
  s,b=self.fixture()
  for change in [dict(ownerId='22222222-2222-4222-8222-222222222222'),dict(observedAccountIdentity='0987654321'),dict(complete=False),dict(documentsOpened=True),dict(count=2)]:
   with self.subTest(change=change),self.assertRaises(ValueError):prepare_notice_import({**s,**change},b,'a'*32)
