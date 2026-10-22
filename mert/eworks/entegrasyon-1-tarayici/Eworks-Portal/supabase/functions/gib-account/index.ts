import { createClient } from 'npm:@supabase/supabase-js@2';

// Sunucu anahtarı Supabase ortamındadır; HTML/robot/disk dosyalarına gönderilmez.
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const origins = (Deno.env.get('EWORKS_ALLOWED_ORIGINS') ||
  'http://127.0.0.1:8765,http://localhost:8765').split(',').map(s => s.trim());

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (origin && origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (status: number, value: unknown) =>
    new Response(JSON.stringify(value), { status, headers });
  if (origin && !origins.includes(origin)) return reply(403, { message: 'Origin rejected' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { message: 'POST required' });
  try {
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) return reply(401, { message: 'Eworks oturumu gerekli.' });
    const { data: user, error: authError } = await admin.auth.getUser(auth.slice(7));
    if (authError || !user.user) return reply(401, { message: 'Eworks oturumu geçersiz.' });
    // Boyut sınırı request.text'ten önce akışta uygulanır; içerik loglanmaz.
    const reader = req.body?.getReader();
    if (!reader) return reply(400, { message: 'İstek boş.' });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); return reply(413, { message: 'İstek çok büyük.' }); }
      chunks.push(value);
    }
    const raw = new Uint8Array(size); let offset = 0;
    for (const part of chunks) { raw.set(part, offset); offset += part.length; }
    const body = JSON.parse(new TextDecoder().decode(raw));
    if (!['status', 'save', 'robot'].includes(body.action)) return reply(400, { message: 'Geçersiz işlem.' });
    if (body.firmId !== undefined && (typeof body.firmId !== 'string' ||
        !body.firmId.trim() || body.firmId.length > 160)) return reply(400, { message: 'Geçersiz firma.' });
    // Tarayıcı arayüzü şifreyi geri okuyamaz. Robot, kendi HTTP istemcisini kullanır.
    if (body.action === 'robot' && origin) return reply(403, { message: 'Yalnızca robot isteği.' });
    if (body.action === 'save' && (typeof body.username !== 'string' ||
        typeof body.password !== 'string' || !body.username.trim() ||
        body.username.length > 256 || !body.password || body.password.length > 1024)) {
      return reply(400, { message: 'Kullanıcı adı ve şifreyi kontrol edin.' });
    }
    const { data, error } = await admin.rpc(body.firmId === undefined ?
      'eworks_gib_credential_service' : 'eworks_firm_gib_credential_service', {
      p_owner: user.user.id, p_action: body.action,
      ...(body.firmId === undefined ? {} : { p_firm_id: body.firmId }),
      p_credentials: body.action === 'save' ? { username: body.username, password: body.password } : null,
    });
    if (error) return reply(409, { message: 'GİB hesabı hazır değil; Vault kurulumunu ve kaydı kontrol edin.' });
    return reply(200, data);
  } catch {
    return reply(400, { message: 'İstek işlenemedi.' });
  }
});
