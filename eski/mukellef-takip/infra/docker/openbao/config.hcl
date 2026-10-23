# OpenBao (anahtar yönetimi, docs/adr/0005). Yalnız iç "app" ağında erişilir; host'a port açılmaz.
# Her yeniden başlatmada kasa mühürlü açılır: iki yetkili açma anahtarını girer (infra/docker/README.md).
# OpenBao bellek kilidi (mlock) kullanmaz: host'ta swap kapalı (veya şifreli) olmalı.

# Yerleşik (Raft) depolama: tek düğüm; ileride düğüm eklenerek yüksek erişilebilirliğe geçilebilir
storage "raft" {
  path    = "/openbao/file"
  node_id = "openbao-1"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  # İç ağda düz HTTP. Ağ kurum dışına açılacaksa sertifika verin: tls_cert_file / tls_key_file
  tls_disable = true
}

api_addr     = "http://openbao:8200"
cluster_addr = "http://openbao:8201"
ui           = false
