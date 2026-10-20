#!/bin/sh
# OpenBao ilk kurulumu — openbao container'ı İÇİNDE bir kez çalışır (scripts/openbao-init.mjs çağırır).
# Çıktı satırları KEY=VALUE biçimindedir; çağıran betik sırları dosyalara yazar, açma anahtarlarını bir kez gösterir.
set -eu
export BAO_ADDR=http://127.0.0.1:8200

if bao status -format=json 2>/dev/null | grep -q '"initialized": true'; then
  echo "HATA=OpenBao zaten kurulmuş. Yeniden kurulum anahtarları kaybettirir; durduruldu." >&2
  exit 1
fi

# 3 açma anahtarı, açmak için 2 tanesi gerekir (anahtarlar farklı kişilerde, çevrim dışı saklanır)
INIT="$(bao operator init -key-shares=3 -key-threshold=2)"
K1="$(echo "$INIT" | sed -n 's/^Unseal Key 1: //p')"
K2="$(echo "$INIT" | sed -n 's/^Unseal Key 2: //p')"
K3="$(echo "$INIT" | sed -n 's/^Unseal Key 3: //p')"
ROOT="$(echo "$INIT" | sed -n 's/^Initial Root Token: //p')"
bao operator unseal "$K1" >/dev/null
bao operator unseal "$K2" >/dev/null
export BAO_TOKEN="$ROOT"

bao secrets enable transit >/dev/null
bao write -f transit/keys/mukellef type=aes256-gcm96 >/dev/null

# Uygulama yalnız veri anahtarını çözebilir ve yeni sarılmış anahtar isteyebilir (rotasyon); başka hiçbir yetki yok
bao policy write mukellef-app - >/dev/null <<'POLICY'
path "transit/decrypt/mukellef" { capabilities = ["update"] }
path "transit/datakey/wrapped/mukellef" { capabilities = ["update"] }
path "auth/token/renew-self" { capabilities = ["update"] }
path "auth/token/lookup-self" { capabilities = ["read"] }
POLICY

# Süreli (periodic) anahtar: uygulama açılışta ve günlük yeniler; 32 gün yenilenmezse geçersizleşir
APP_TOKEN="$(bao token create -policy=mukellef-app -no-default-policy -orphan -period=768h -field=token)"
WRAPPED="$(bao write -f -field=ciphertext transit/datakey/wrapped/mukellef bits=256)"

# Kök anahtar kalıcı tutulmaz; gerektiğinde açma anahtarlarıyla yeniden üretilir (bao operator generate-root)
bao token revoke -self >/dev/null

echo "UNSEAL_KEY_1=$K1"
echo "UNSEAL_KEY_2=$K2"
echo "UNSEAL_KEY_3=$K3"
echo "OPENBAO_TOKEN=$APP_TOKEN"
echo "OPENBAO_WRAPPED_DEK=$WRAPPED"
