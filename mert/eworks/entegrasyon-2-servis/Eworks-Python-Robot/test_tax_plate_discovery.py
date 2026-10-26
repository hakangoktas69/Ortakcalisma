import tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock,patch
from tax_plate_discovery import inspect_tax_plate_screen,TaxPlateProbe
class TaxPlateDiscoveryTests(unittest.IsolatedAsyncioTestCase):
 async def test_navigation_error_has_safe_stage_without_raw_message(self):
  context=SimpleNamespace(pages=[])
  with patch('tax_plate_discovery.visible_target',side_effect=RuntimeError('PRIVATE-TOKEN')):
   result=await inspect_tax_plate_screen(context)
  self.assertEqual(result['errorType'],'RuntimeError');self.assertEqual(result['stage'],'e-Vergi Levhası')
  self.assertNotIn('PRIVATE-TOKEN',str(result));self.assertFalse(result['clientAuthorizationVerified'])
 async def test_probe_does_not_save_authentication_values(self):
  with tempfile.TemporaryDirectory() as d:
   response=SimpleNamespace(url='https://dijital.gib.gov.tr/apigateway/levha/sorgula',status=200,headers={'content-type':'application/json'},body=AsyncMock(return_value=b'{"token":"PRIVATE","rows":[]}'),request=SimpleNamespace(post_data='{"identity":"1234567890"}'))
   await TaxPlateProbe(Path(d)).observe(response)
   result=(Path(d)/'taxplate-source-structure.json').read_text()
   self.assertNotIn('PRIVATE',result);self.assertNotIn('1234567890',result)
