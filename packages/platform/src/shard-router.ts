import { createPool, type Pool } from './db.ts';

// ShardRouter (07 §2.1): ofisin verisi tek shard'dadır; hangi shard olduğu kontrol düzlemindeki dizinden okunur.
// Ofis → shard eşlemesi nadiren değişir, süreç içinde kısa süre önbelleklenir.

export class UnknownOrganizationError extends Error {
  constructor() {
    super('Ofis bulunamadı');
    this.name = 'UnknownOrganizationError';
  }
}

export class ShardRouter {
  private readonly cache = new Map<string, { shard: string; until: number }>();
  readonly control: Pool;
  private readonly shards: ReadonlyMap<string, Pool>;
  private readonly ttlMs: number;

  constructor(control: Pool, shards: ReadonlyMap<string, Pool>, ttlMs = 60_000) {
    this.control = control;
    this.shards = shards;
    this.ttlMs = ttlMs;
  }

  static fromUrls(controlUrl: string, shardUrls: ReadonlyMap<string, string>) {
    return new ShardRouter(createPool(controlUrl), new Map([...shardUrls].map(([id, url]) => [id, createPool(url)])));
  }

  get shardIds(): string[] {
    return [...this.shards.keys()];
  }

  pool(shardId: string): Pool {
    const p = this.shards.get(shardId);
    if (!p) throw new Error(`Tanımsız shard: ${shardId}`);
    return p;
  }

  async shardOf(orgId: string): Promise<string> {
    const hit = this.cache.get(orgId);
    if (hit && hit.until > Date.now()) return hit.shard;
    const { rows } = await this.control.query<{ shard_id: string }>(
      `select shard_id from directory.organizations where id = $1 and status = 'active'`,
      [orgId],
    );
    const shard = rows[0]?.shard_id;
    if (!shard) throw new UnknownOrganizationError();
    this.cache.set(orgId, { shard, until: Date.now() + this.ttlMs });
    return shard;
  }

  async poolFor(orgId: string): Promise<Pool> {
    return this.pool(await this.shardOf(orgId));
  }

  /** Yeni ofis için en az ofisi olan, yeni ofis kabul eden shard (07 §2.3). */
  async leastLoadedShard(): Promise<string> {
    const { rows } = await this.control.query<{ id: string }>(
      `select s.id from directory.shards s
         left join directory.organizations o on o.shard_id = s.id
        where s.accepting and s.id = any($1)
        group by s.id order by count(o.id), s.id limit 1`,
      [this.shardIds],
    );
    if (!rows[0]) throw new Error('Yeni ofis kabul eden shard yok');
    return rows[0].id;
  }

  async end() {
    await Promise.all([this.control.end(), ...[...this.shards.values()].map((p) => p.end())]);
  }
}
