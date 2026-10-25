import amqp from 'amqplib';

// RabbitMQ (01 §3, 02 §5.3): tek topic exchange, quorum kuyruklar, ölü mektup kuyruğu. Mesajda yalnız kimlik bulunur.
// Kuyruk argümanları Python ACL'deki (services/integration … core/kuyruk.py) tanımla aynı olmalı.

export const EXCHANGE = 'eworks';
export const DLX = 'eworks.dlx';
export const KUYRUKLAR = { robotGib: 'robot.gib', sonuc: 'entegrasyon.sonuc', dlq: 'eworks.dlq' } as const;
const ARGUMANLAR = { 'x-queue-type': 'quorum', 'x-dead-letter-exchange': DLX, 'x-delivery-limit': 5 };

export type Kanal = amqp.ConfirmChannel;

export async function kuyrukBaglan(url: string) {
  const conn = await amqp.connect(url, { clientProperties: { connection_name: 'eworks-node' } });
  const ch = await conn.createConfirmChannel();
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  await ch.assertExchange(DLX, 'fanout', { durable: true });
  await ch.assertQueue(KUYRUKLAR.dlq, { durable: true, arguments: { 'x-queue-type': 'quorum' } });
  await ch.bindQueue(KUYRUKLAR.dlq, DLX, '');
  for (const q of [KUYRUKLAR.robotGib, KUYRUKLAR.sonuc]) {
    await ch.assertQueue(q, { durable: true, arguments: ARGUMANLAR });
    await ch.bindQueue(q, EXCHANGE, q);
  }
  await ch.prefetch(1);
  return { conn, ch };
}

/** Yayımlar ve sunucu onayını bekler (outbox: onaydan sonra "yayımlandı" işaretlenir). */
export function yayimla(ch: Kanal, anahtar: string, mesaj: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    ch.publish(EXCHANGE, anahtar, Buffer.from(JSON.stringify(mesaj)), { persistent: true, contentType: 'application/json' }, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}
