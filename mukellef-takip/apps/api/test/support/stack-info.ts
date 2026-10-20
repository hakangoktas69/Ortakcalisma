/** global-setup.ts'in test dosyalarına verdiği ortam bilgisi. */
export interface TenantFixture {
  id: string;
  email: string;
  password: string;
  companyId: string;
  reportId: string | null;
}

export interface StackInfo {
  adminUrl: string;
  appRoleUrl: string;
  redisUrl: string;
  vaultKey: string;
  jwtSecret: string;
  /** prisma/seed.ts ile yüklenen zengin demo bürosu */
  demo: TenantFixture & { staffEmail: string; staffPassword: string };
  /** İzolasyon testleri için en küçük ikinci büro */
  B: TenantFixture;
}

declare module 'vitest' {
  export interface ProvidedContext {
    stack: StackInfo;
  }
}
