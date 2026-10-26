import importlib.util
import io
import json
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('portal_server_test',
    Path(__file__).resolve().parents[1]/'Eworks-Portal'/'yerel-sunucu.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
OWNER = '11111111-1111-4111-8111-111111111111'
SCOPE = dict(firmId='fixture-1', identity='1234567890', target='digital')


class PortalEndpointTests(unittest.TestCase):
    def setUp(self):
        server.JOBS.clear()

    def request(self, scope=SCOPE, verified=True, origin='http://127.0.0.1:8765'):
        handler = server.Handler.__new__(server.Handler)
        body = json.dumps(dict(ownerId=OWNER, portalSession=scope)).encode()
        handler.path = '/api/portal/open'
        handler.headers = {'Host':'127.0.0.1:8765', 'Origin':origin,
            'Content-Length':str(len(body)), 'X-Eworks-Token':server.TOKEN,
            'Authorization':'Bearer synthetic'}
        handler.rfile = io.BytesIO(body)
        handler.reply = Mock()
        with patch.object(server,'verify_owner',return_value=verified), \
             patch.object(server,'robot_config',return_value=dict(enabled=True)), \
             patch.object(server.threading,'Thread') as thread:
            handler.do_POST()
        return handler.reply.call_args.args, thread

    def test_rejects_unverified_owner_and_foreign_origin(self):
        self.assertEqual(self.request(verified=False)[0][0],401)
        self.assertEqual(self.request(origin='https://example.invalid')[0][0],403)
        self.assertFalse(server.JOBS)

    def test_requires_fixed_destination(self):
        self.assertEqual(self.request({**SCOPE,'target':'https://example.invalid'})[0][0],400)
        self.assertFalse(server.JOBS)

    def test_scope_is_preserved_and_another_firm_cannot_reuse_it(self):
        result, thread = self.request()
        self.assertEqual(result[0],202)
        config = thread.call_args.kwargs['args'][1]
        self.assertEqual(config,dict(portalSession=SCOPE))
        self.assertEqual(self.request({**SCOPE,'firmId':'fixture-2'})[0][0],409)
        public = server.public_job(result[1]['jobId'])
        self.assertNotIn('portalSession',public)
        self.assertNotIn(SCOPE['identity'],json.dumps(public))
