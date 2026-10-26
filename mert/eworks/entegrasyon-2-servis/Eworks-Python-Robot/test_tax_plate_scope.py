import unittest
from portal_session import validate_scope
class TaxPlateScopeTests(unittest.TestCase):
 def test_only_advisor_latest_scope(self):
  expected=dict(target='taxplates',accessMode='advisor',selection='latest_available')
  self.assertEqual(validate_scope(expected),expected)
  for change in [dict(accessMode='firm'),dict(selection='all'),dict(selection=None)]:
   with self.assertRaises(ValueError):validate_scope({**expected,**change})
 def test_firm_destinations_never_use_advisor_route(self):
  with self.assertRaises(ValueError):validate_scope(dict(target='notices',accessMode='advisor',selection='latest_available'))
