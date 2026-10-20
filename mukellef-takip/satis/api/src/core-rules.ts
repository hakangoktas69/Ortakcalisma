// apps/api'den alınan SAF kurallar (yan etkisiz; domain katmanı yalnız bunu import eder). Diğer ortak parçalar: core.ts
export { PLANS, extendExpiry, type Plan } from '../../../apps/api/src/modules/billing/domain/plans.js';
