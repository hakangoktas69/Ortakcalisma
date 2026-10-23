"""Eworks yerel sunucusunu container içinde çalıştırır; mert/eworks dosyalarını değiştirmez.

- Kaynaklar /src'de salt okunur durur; /app'e kopyalanırken Supabase yer tutucuları doldurulur.
  Tarayıcı Supabase'e ana makineden (BROWSER_SUPABASE_URL), yerel sunucu ise container
  içinden (SERVER_SUPABASE_URL, host.docker.internal) ulaşır.
- yerel-sunucu.py 127.0.0.1'e bağlanır; container dışından erişim için aynı Handler
  0.0.0.0 üzerinde başlatılır. Host/Origin kontrolleri değişmez (port 8765 eşlenmeli).
"""
import os
import runpy
import shutil
from http.server import ThreadingHTTPServer
from pathlib import Path

SRC, APP = Path('/src'), Path('/app')
KEY = os.environ['SUPABASE_KEY']


def patch(path, url):
    text = path.read_text(encoding='utf-8')
    text = text.replace('https://YOUR_PROJECT.supabase.co', url).replace('YOUR_SUPABASE_PUBLISHABLE_KEY', KEY)
    path.write_text(text, encoding='utf-8')


shutil.rmtree(APP, ignore_errors=True)
shutil.copytree(SRC, APP)
patch(APP / 'Eworks-Portal' / 'eworks-tasarim.html', os.environ['BROWSER_SUPABASE_URL'])
patch(APP / 'Eworks-Python-Robot' / 'cloud_credentials.py', os.environ['SERVER_SUPABASE_URL'])

module = runpy.run_path(str(APP / 'Eworks-Portal' / 'yerel-sunucu.py'), run_name='yerel_sunucu')
(module['ROOT'] / 'incoming').mkdir(exist_ok=True)
print('Eworks: http://127.0.0.1:8765/eworks-tasarim.html', flush=True)
ThreadingHTTPServer(('0.0.0.0', 8765), module['Handler']).serve_forever()
