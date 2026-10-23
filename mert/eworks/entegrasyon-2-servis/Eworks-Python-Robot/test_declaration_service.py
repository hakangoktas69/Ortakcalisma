import unittest
from datetime import date
from types import SimpleNamespace
from urllib.parse import urlencode
from declaration_reader import HEADERS
from declaration_service import DeclarationService,parse_list,compare_records


def fixture(*,total=1,disabled=True):
    return ('<table><tr>'+''.join('<th>'+h+'</th>' for h in HEADERS)+'</tr><tr id="row-fixture">'
        +''.join('<td>Örnek</td>' for _ in HEADERS)+'</tr></table><table><tr><td>1 - 1 / '+str(total)
        +'</td><td><input title="Sonraki Sayfa" '+('disabled' if disabled else '')+'></td></tr></table>')


class FakeResponse:
    def __init__(self,status=200,body=None):
        self.status=status;self.url='https://ebeyanname.gib.gov.tr/dispatch'
        self.headers={'content-type':'text/html; charset=UTF-8'}
        self.content=fixture().encode() if body is None else body;self.disposed=False
    async def body(self):return self.content
    async def dispose(self):self.disposed=True


class ServiceTests(unittest.IsolatedAsyncioTestCase):
    def service(self,response=None,fail=False):
        self.calls=[];self.response=response or FakeResponse()
        async def post(url,**kwargs):
            self.calls.append((url,kwargs))
            if fail:raise RuntimeError('SECRET_TOKEN must not leak')
            return self.response
        return DeclarationService(SimpleNamespace(request=SimpleNamespace(post=post)),date(2026,10,15),date(2026,10,22))

    def request(self,**changes):
        fields={'TOKEN':'SECRET_TOKEN','cmd':'synthetic-read-command','sorguTipiZ':'on',
            'baslangicTarihi':'15.10.2026','bitisTarihi':'22.10.2026'}
        fields.update(changes)
        return SimpleNamespace(method='POST',url='https://ebeyanname.gib.gov.tr/dispatch',post_data=urlencode(fields))

    async def test_valid_list_and_shared_session_request(self):
        s=self.service();s.capture(self.request());result=await s.query()
        self.assertEqual(result['totalRows'],1);self.assertEqual(result['records'][0]['cells'][1],'Örnek')
        self.assertEqual(len(self.calls),1);self.assertEqual(self.calls[0][1]['max_redirects'],0)
        self.assertTrue(self.response.disposed);s.close();self.assertIsNone(s.payload)

    async def test_no_template_or_extra_filter_never_sends(self):
        s=self.service();s.capture(self.request(vergiNo='1111111111'))
        with self.assertRaises(ValueError):await s.query()
        self.assertEqual(self.calls,[])

    async def test_scope_mismatch_rejected(self):
        s=self.service()
        s.capture(self.request(baslangicTarihi='01.01.2026'))
        with self.assertRaises(ValueError):await s.query()
        self.assertIsNone(s.payload)

    async def test_source_and_method_rejected(self):
        for url,method in [('https://evil.example/dispatch','POST'),('https://ebeyanname.gib.gov.tr/dispatch','GET')]:
            s=self.service();r=self.request();r.url=url;r.method=method;s.capture(r)
            with self.assertRaises(ValueError):await s.query()
        self.assertEqual(self.calls,[])

    async def test_auth_rate_limit_and_redirect_fail_without_retry(self):
        for status in (401,403,429,302,500):
            s=self.service(FakeResponse(status));s.capture(self.request())
            with self.assertRaises(ValueError):await s.query()
            self.assertEqual(len(self.calls),1);self.assertTrue(self.response.disposed)

    async def test_transport_exception_does_not_leak_token(self):
        s=self.service(fail=True);s.capture(self.request())
        with self.assertRaises(ValueError) as exc:await s.query()
        self.assertNotIn('SECRET_TOKEN',str(exc.exception));self.assertEqual(len(self.calls),1)

    def test_missing_table_warning_and_login_not_empty_success(self):
        for html in ('<script>alert("warning")</script>','<input type="password">','<table><tr><td>0</td></tr></table>'):
            with self.assertRaises(ValueError):parse_list(html)

    def test_paging_mismatch_or_duplicate_rows_rejected(self):
        with self.assertRaises(ValueError):parse_list(fixture(total=2,disabled=True))
        duplicate=fixture().replace('</tr></table><table>','</tr><tr id="row-fixture">'+''.join('<td>x</td>' for _ in HEADERS)+'</tr></table><table>')
        with self.assertRaises(ValueError):parse_list(duplicate)

    def test_comparison_ignores_only_whitespace(self):
        a=[{'id':'row1','cells':['2026 - 10','ŞİRKET A']}]
        self.assertTrue(compare_records(a,[{'id':'row1','cells':['2026-10','ŞİRKET\nA']}]))
        self.assertFalse(compare_records(a,[{'id':'row1','cells':['2026-11','ŞİRKET A']}]))
        self.assertFalse(compare_records(a,[{'id':'row2','cells':['2026-10','ŞİRKET A']}]))

    def test_gib_nested_status_table_keeps_outer_cell_text(self):
        html=fixture()
        cells=['<td>Örnek</td>']*10
        cells[8]='<td><table><tr><td><img src="ok.gif">&nbsp;Onaylandı</td><td><img src="pdf.gif"></td></tr></table></td>'
        html=html.replace(''.join('<td>Örnek</td>' for _ in HEADERS),''.join(cells))
        result=parse_list(html)
        self.assertEqual(result['records'][0]['cells'][8],'Onaylandı')
        self.assertEqual(len(result['records'][0]['cells']),10)


if __name__=='__main__':unittest.main()
