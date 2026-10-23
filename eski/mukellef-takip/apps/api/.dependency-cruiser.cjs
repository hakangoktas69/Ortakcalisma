// DDD katman ve context sınırı kuralları (docs/ai/architecture.md). `npm run arch:check` ile çalışır; CI'da zorunlu.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'context-ici-dosyaya-erisim',
      comment: 'Bir context başka bir context’e yalnız onun index.ts (public API) dosyası üzerinden erişir.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/([^/]+)/(?!index\\.ts$)', pathNot: '^src/modules/$1/' },
    },
    {
      name: 'domain-saf-kalir',
      comment: 'domain katmanı Nest, Prisma, HTTP veya altyapı import etmez; yalnız kendi domain’i ve shared-kernel.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        pathNot: ['^src/modules/[^/]+/domain/', '^src/shared-kernel/', '^src/generated/prisma/enums\\.ts$'],
        // Node çekirdek modülleri (ör. crypto) saf hesaplama için serbest
        dependencyTypesNot: ['type-only', 'core'],
      },
    },
    {
      name: 'domain-baska-context-kullanmaz',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/domain/' },
      to: { path: '^src/modules/', pathNot: '^src/modules/$1/domain/' },
    },
    {
      name: 'application-interface-katmanini-kullanmaz',
      comment: 'Uygulama katmanı HTTP katmanına bağımlı olmaz (guard tipleri dışında).',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/application/' },
      to: { path: '^src/modules/$1/interface/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'shared-kernel-saf-kalir',
      severity: 'error',
      from: { path: '^src/shared-kernel/(?!testing/)' },
      to: { pathNot: ['^src/shared-kernel/'], dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'platform-is-kurali-icermez',
      comment: 'Platform (altyapı) context’lere bağımlı olmaz.',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'dongusel-bagimlilik',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { circular: true, pathNot: '^src/generated/' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', 'src/generated'] },
    exclude: { path: ['\\.spec\\.ts$', '\\.e2e-spec\\.ts$'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.js'] },
  },
};
