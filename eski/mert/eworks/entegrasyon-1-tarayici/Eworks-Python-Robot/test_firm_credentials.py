import unittest
from unittest.mock import patch, Mock
from firm_credentials import fetch_firm_credentials

OWNER = '11111111-1111-4111-8111-111111111111'
IDENTITY = '1234567890'


class FirmCredentialsTests(unittest.TestCase):
    def response(self, **changes):
        value = dict(scope='firm', firmId='TEST-FIRM', ownerId=OWNER,
                     taxNumber=IDENTITY, username='synthetic', password='synthetic')
        value.update(changes)
        return Mock(status_code=200, json=lambda: value)

    @patch('firm_credentials.requests.post')
    def test_routes_to_firm_and_returns_only_credentials(self, post):
        post.return_value = self.response()
        result = fetch_firm_credentials('synthetic-token', OWNER, 'TEST-FIRM', IDENTITY)
        self.assertEqual(set(result), {'username', 'password'})
        self.assertEqual(post.call_args.kwargs['json'], {'action':'robot','firmId':'TEST-FIRM'})
        self.assertFalse(post.call_args.kwargs['allow_redirects'])

    @patch('firm_credentials.requests.post')
    def test_legacy_wrong_owner_firm_or_identity_never_falls_back(self, post):
        for change in [dict(scope=None),dict(firmId='OTHER'),dict(ownerId='OTHER'),
                       dict(taxNumber='0987654321'),dict(password='')]:
            with self.subTest(change=change):
                post.reset_mock()
                post.return_value = self.response(**change)
                with self.assertRaises(ValueError):
                    fetch_firm_credentials('synthetic-token',OWNER,'TEST-FIRM',IDENTITY)
                self.assertEqual(post.call_count,1)

    @patch('firm_credentials.requests.post')
    def test_failed_deployment_never_falls_back(self, post):
        post.return_value = Mock(status_code=409)
        with self.assertRaises(ValueError):
            fetch_firm_credentials('synthetic-token',OWNER,'TEST-FIRM',IDENTITY)
        self.assertEqual(post.call_count,1)
