// Özellik kaydı (06 §8): yetki anahtarları ve TDD durumunun tek kaynağı. Ön yüzde FeatureGate/FeatureBadge bunu okur.
export {
  childrenOf,
  computeStatus,
  contextOf,
  defineFeatures,
  featureTags,
  parentOf,
  type ContextName,
  type FeatureDef,
  type FeatureKind,
  type FeatureStatus,
  type FeatureTree,
  type LiveVerification,
  type NodeStatus,
  type TestResult,
} from './define.ts';
export { features, LIVE_ACTIONS } from './features.ts';
export { liveVerifications } from './live.ts';
