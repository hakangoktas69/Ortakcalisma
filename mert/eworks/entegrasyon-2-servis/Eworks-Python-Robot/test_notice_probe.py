import unittest
from notice_probe import shape
from portal_session import validate_scope
class NoticeProbeTests(unittest.TestCase):
 def test_values_never_enter_report(self):
  import json
  report=shape({'token':'PRIVATE','items':[{'name':'PERSON','identity':'1234567890'}],'count':4})
  text=json.dumps(report)
  for private in ['PRIVATE','PERSON','1234567890']:self.assertNotIn(private,text)
  self.assertEqual(report['items']['length'],1)
 def test_notice_is_fixed_target(self):
  self.assertEqual(validate_scope(dict(firmId='test',identity='1234567890',target='notices'))['target'],'notices')
