/**
 * `@kpro/react` —— kpro 组件库的 React 18 实现。
 *
 * 当前包含首个组件：指引（Guide）。
 */

export { Guide } from './guide/Guide';
export { GuideProvider, useGuideProvider } from './guide/GuideProvider';
export type { GuideProps, GuideProviderProps } from './guide/GuideProvider';
export { GuideOverlay } from './guide/GuideOverlay';
export type { GuideOverlayProps } from './guide/GuideOverlay';
export { useGuide } from './guide/useGuide';
export type { UseGuideResult } from './guide/useGuide';

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
