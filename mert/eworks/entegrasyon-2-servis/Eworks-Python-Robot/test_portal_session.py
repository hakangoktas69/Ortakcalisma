import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from portal_session import validate_scope, run


class PortalScopeTests(unittest.TestCase):
    def test_only_fixed_destinations_and_exact_identifiers(self):
        scope = dict(firmId='fixture', identity='1234567890', target='digital')
        self.assertEqual(validate_scope(scope), scope)
        for key, value in [('target','https://example.invalid'), ('target','sgk'),
                           ('firmId',''), ('identity','١٢٣٤٥٦٧٨٩٠'), ('identity','123')]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                validate_scope({**scope, key:value})


class PortalCredentialTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_firm_account_never_launches_or_uses_advisor(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder/'request.json').write_text(json.dumps(dict(ownerId='synthetic-owner',
                requestId='synthetic-job', portalSession=dict(firmId='firm-1',
                identity='1234567890',target='digital'))))
            with patch('portal_session.fetch_firm_credentials', side_effect=ValueError('Firma hesabı yok')) as fetch, \
                 patch('portal_session.async_playwright') as browser:
                with self.assertRaises(ValueError):
                    await run(folder,'synthetic-access')
                fetch.assert_called_once_with('synthetic-access','synthetic-owner','firm-1','1234567890',include_scope=True)
                browser.assert_not_called()
                self.assertFalse((folder/'portal-session-result.json').exists())
