/**
 * `@kpro/vue` —— kpro 组件库的 Vue 3 实现。
 *
 * 当前包含首个组件：指引（Guide）。
 */

export { Guide } from './guide/Guide';
export { Guide as KProGuide } from './guide/Guide';
export { GuideProvider, GUIDE_PROVIDER_KEY, useGuideProvider } from './guide/GuideProvider';
export { useGuide, type UseGuideResult } from './guide/useGuide';
export { default as GuideOverlay } from './guide/GuideOverlay.vue';
export type {
  GuideController,
  GuideGroupSnapshot,
  GuidePlacement,
  GuidePlacementInput,
  GuideStep,
  GuideStepChangePayload,
  GuideStepProps,
} from '@kpro/core';

// 便于宿主应用统一配置存储与主题相关行为。
export { configureGuide, isGuideDismissed, dismissGuide, restoreGuide } from '@kpro/core';
