// Mimari kurallar (docs/hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md §4, §6). `pnpm arch` ile çalışır; CI'da zorunlu.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'baglam-yalniz-index-uzerinden',
      comment: 'Bir bağlam başka bir bağlama yalnız onun src/index.ts (public API) dosyası üzerinden erişir.',
      severity: 'error',
      from: { path: '^packages/contexts/([^/]+)/' },
      to: { path: '^packages/contexts/([^/]+)/(?!src/index\\.ts$)', pathNot: '^packages/contexts/$1/' },
    },
    {
      name: 'uygulamalar-baglama-index-uzerinden',
      comment: 'apps/* bağlam paketlerinin iç dosyalarına erişmez.',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^packages/contexts/[^/]+/(?!src/index\\.ts$)' },
    },
    {
      name: 'domain-saf-kalir',
      comment: 'domain yalnız kendi domain\'ini ve kernel\'i kullanır (Supabase, Redis, platform, Next.js yok).',
      severity: 'error',
      from: { path: '^packages/contexts/([^/]+)/src/domain/' },
      to: { pathNot: ['^packages/contexts/$1/src/domain/', '^packages/kernel/src/'], dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'application-altyapiyi-kullanmaz',
      comment: 'application portları tanımlar; uygulamaları (infrastructure) ona bağımlıdır, tersi değil.',
      severity: 'error',
      from: { path: '^packages/contexts/([^/]+)/src/application/' },
      to: { path: '^packages/contexts/$1/src/infrastructure/' },
    },
    {
      name: 'kernel-saf-kalir',
      severity: 'error',
      from: { path: '^packages/kernel/src/' },
      to: { pathNot: '^packages/kernel/src/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'platform-alan-bilgisi-icermez',
      severity: 'error',
      from: { path: '^packages/platform/' },
      to: { path: '^packages/contexts/' },
    },
    {
      name: 'ui-altyapiya-erisemez',
      comment: 'Sunum katmanı platform veya bağlam altyapısını import etmez; server action üzerinden application\'ı çağırır.',
      severity: 'error',
      from: { path: '^apps/[^/]+/src/features/' },
      to: { path: ['^packages/platform/', '^packages/contexts/[^/]+/src/infrastructure/'] },
    },
    {
      name: 'ui-baska-ozellige-erisemez',
      comment: 'features/<ctx> başka bir bağlamın features klasörünü kullanmaz; ortak bileşen shared/ui\'dadır.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/src/features/([^/]+)/' },
      to: { path: '^apps/$1/src/features/', pathNot: '^apps/$1/src/features/$2/' },
    },
    {
      name: 'dongusel-bagimlilik',
      severity: 'error',
      from: { path: '^(packages|apps)/' },
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['(^|/)test/', '\\.test\\.ts$', '(^|/)node_modules/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'default'] },
  },
};
