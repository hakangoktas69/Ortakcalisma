"""Yerel köprü HTTP denetimleri; canlı GİB veya Supabase kullanılmaz."""
import importlib.util
import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / 'Eworks-Portal' / 'yerel-sunucu.py'
spec = importlib.util.spec_from_file_location('eworks_server_test', MODULE)
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
OWNER = '11111111-1111-4111-8111-111111111111'
OTHER = '22222222-2222-4222-8222-222222222222'


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_root, self.old_config, self.old_run = server.ROOT, server.robot_config, server.run_job
        self.old_verify = server.verify_owner
        server.verify_owner = lambda token, owner: token == 'synthetic' and owner == OWNER
        server.ROOT = Path(self.tmp.name)
        server.JOBS.clear()
        server.robot_config = lambda: {'mode': 'python'}
        def fake_run(job_id, config, access_token=''):
            folder = server.ROOT / 'jobs' / job_id
            folder.mkdir(parents=True)
            with server.LOCK:
                server.JOBS[job_id].update(state='awaiting_user', message='Test listesi bekleniyor')
        server.run_job = fake_run
        self.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        server.ROOT, server.robot_config, server.run_job = self.old_root, self.old_config, self.old_run
        server.verify_owner = self.old_verify
        self.tmp.cleanup()

    def request(self, path, body=None, token=True, owner=OWNER):
        headers={'Host': '127.0.0.1:8765', 'Origin': 'http://127.0.0.1:8765',
                 'Content-Type': 'application/json', 'X-Eworks-Owner': owner, 'Authorization': 'Bearer synthetic'}
        if token:
            headers['X-Eworks-Token']=server.TOKEN
        raw=None if body is None else json.dumps(body).encode()
        req=urllib.request.Request('http://127.0.0.1:'+str(self.http.server_port)+path, data=raw, headers=headers)
        try:
            response=urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:
            response=error
        return response.status,json.loads(response.read())

    def test_csrf_and_identity_required(self):
        self.assertEqual(self.request('/api/gib/update', {'ownerId': OWNER}, token=False)[0],403)
        self.assertEqual(self.request('/api/gib/update', {'ownerId': 'invalid'})[0],400)

    def test_unverified_supabase_session_cannot_start_robot(self):
        server.verify_owner = lambda token, owner: False
        self.assertEqual(self.request('/api/gib/update', {'ownerId': OWNER})[0],401)
        self.assertEqual(server.JOBS, {})

    def test_start_continue_and_private_result(self):
        code,created=self.request('/api/gib/update', {'ownerId': OWNER})
        self.assertEqual(code,202)
        job_id=created['jobId']
        # Sahte işin hazırlanmasını kısa bir Event döngüsüyle bekle.
        for _ in range(100):
            if server.JOBS[job_id]['state']=='awaiting_user':
                break
            threading.Event().wait(0.01)
        base='/api/jobs/'+job_id
        (server.ROOT/'jobs'/job_id/'worker.json').write_text(json.dumps({'pid':12345}))
        self.assertEqual(self.request(base+'/focus', {'ownerId': OTHER})[0],403)
        self.assertEqual(self.request(base+'/focus', {'ownerId': OWNER})[0],202)
        self.assertTrue((server.ROOT/'jobs'/'focus-12345.request').exists())
        code,reused=self.request('/api/gib/update', {'ownerId': OWNER})
        self.assertEqual(code,202)
        self.assertEqual(reused['jobId'],job_id)
        self.assertTrue(reused['reused'])
        self.assertEqual(len(server.JOBS),1)
        self.assertEqual(self.request(base, owner=OTHER)[0],403)
        self.assertEqual(self.request(base+'/continue', {'ownerId': OWNER, 'expectedCount': 0})[0],400)
        self.assertEqual(self.request(base+'/continue', {'ownerId': OTHER, 'expectedCount': 2})[0],403)
        self.assertEqual(self.request(base+'/continue', {'ownerId': OWNER, 'expectedCount': 2})[0],202)
        ready=json.loads((server.ROOT/'jobs'/job_id/'ready.json').read_text())
        self.assertEqual(ready['expectedCount'],2)
        with server.LOCK:
            server.JOBS[job_id].update(state='completed', _result={'contracts': ['synthetic']})
        self.assertNotIn('_result',self.request(base)[1])
        self.assertEqual(self.request(base+'/result', owner=OTHER)[0],403)
        self.assertEqual(self.request(base+'/result')[1],{'contracts':['synthetic']})


if __name__=='__main__':
    unittest.main()
