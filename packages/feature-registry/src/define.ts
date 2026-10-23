// Özellik ağacı = yetki ağacı = TDD durum kaynağı (06 §8, 05 §3.1). Anahtar noktalıdır: modül → sayfa → işlem.
export type FeatureKind = 'module' | 'page' | 'action';

/** Sorumlu bounded context; null = henüz bir bağlama atanmadı (açık konu, docs/baglamlar/README.md). */
export type ContextName =
  | 'identity-access'
  | 'organization'
  | 'portfolio'
  | 'credentials'
  | 'sync'
  | 'tax-filing'
  | 'social-security'
  | 'documents'
  | 'workspace'
  | 'notifications'
  | 'audit'
  | 'sales';

export type FeatureDef = {
  readonly title: string;
  readonly kind: FeatureKind;
  /** Bağlam yalnız modülde verilir; alt düğümler miras alır. */
  readonly context?: ContextName | null;
  /** İşlem düğümü yeşil olmak için en az bir kabul testi ister. */
  readonly acceptance?: boolean;
  /** Ağaçtaki kaynağı: bugünkü portal ekranı (eski/mert/eworks) ya da yalnız hedef mimaride tanımlı. */
  readonly source?: 'portal' | 'hedef';
};

export type FeatureStatus = 'red' | 'green';

export type FeatureTree<K extends string = string> = Readonly<Record<K, FeatureDef>>;

export const defineFeatures = <const T extends Record<string, FeatureDef>>(tree: T): FeatureTree<Extract<keyof T, string>> => tree;

export const parentOf = (key: string): string | null => (key.includes('.') ? key.slice(0, key.lastIndexOf('.')) : null);

export const childrenOf = (tree: FeatureTree, key: string): string[] => Object.keys(tree).filter((k) => parentOf(k) === key);

export function contextOf(tree: FeatureTree, key: string): ContextName | null {
  for (let k: string | null = key; k; k = parentOf(k)) {
    const ctx = tree[k]?.context;
    if (ctx !== undefined) return ctx;
  }
  return null;
}

export type TestResult = { readonly feature: string; readonly passed: boolean };

export type NodeStatus = { readonly status: FeatureStatus; readonly green: number; readonly total: number; readonly tests: number };

/**
 * Durum elle işaretlenmez, test sonuçlarından hesaplanır (06 §8.2):
 * işlem yeşil = en az bir test var ve anahtara bağlı tüm testler geçiyor; ana düğüm yeşil = tüm işlemleri yeşil.
 */
export function computeStatus(tree: FeatureTree, results: readonly TestResult[]): Record<string, NodeStatus> {
  const byKey = new Map<string, TestResult[]>();
  for (const r of results) byKey.set(r.feature, [...(byKey.get(r.feature) ?? []), r]);
  const out: Record<string, NodeStatus> = {};
  const visit = (key: string): NodeStatus => {
    const cached = out[key];
    if (cached) return cached;
    const kids = childrenOf(tree, key);
    let s: NodeStatus;
    if (kids.length === 0) {
      const rs = byKey.get(key) ?? [];
      const green = rs.length > 0 && rs.every((r) => r.passed);
      s = { status: green ? 'green' : 'red', green: green ? 1 : 0, total: 1, tests: rs.length };
    } else {
      const parts = kids.map(visit);
      const green = parts.reduce((a, p) => a + p.green, 0);
      const total = parts.reduce((a, p) => a + p.total, 0);
      s = { status: green === total ? 'green' : 'red', green, total, tests: parts.reduce((a, p) => a + p.tests, 0) };
    }
    out[key] = s;
    return s;
  };
  for (const key of Object.keys(tree)) visit(key);
  return out;
}

/** Test adındaki özellik etiketleri: `@F:sgk.ebildirge.sync` veya `[F:sgk.ebildirge.sync]`. */
export const featureTags = (testName: string): string[] =>
  [...testName.matchAll(/(?:@F:|\[F:)([a-z0-9_.]+)\]?/g)].map((m) => m[1] as string);
