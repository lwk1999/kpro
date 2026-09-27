/**
 * `@kpro/core` 公共出口。
 *
 * Vue 与 React 适配层只依赖本文件导出的能力，组件行为因此由 core 单点决定。
 */

export {
  GUIDE_STEP_DEFAULTS,
  NARROW_VIEWPORT_WIDTH,
  type GuideController,
  type GuideEventMap,
  type GuideEventName,
  type GuideGroupSnapshot,
  type GuidePlacement,
  type GuidePlacementInput,
  type GuideStep,
  type GuideStepChangePayload,
  type GuideStepProps,
  type Rect,
  type Size,
} from './types';

export {
  clearDismissedGuides,
  configureGuide,
  DEFAULT_STORAGE_KEY,
  dismissGuide,
  getGuideConfig,
  isGuideDismissed,
  restoreGuide,
  type GuideConfig,
} from './storage';

export {
  createController,
  dismiss,
  finish,
  getSnapshot,
  goTo,
  next,
  normalizeStep,
  prev,
  registerStep,
  reset,
  resetEngine,
  setGroupOptions,
  start,
  stop,
  subscribe,
  subscribeEvent,
  unregisterStep,
} from './engine';

export {
  computeCutoutRects,
  computeHole,
  computeOverlayLayout,
  computeTooltipPosition,
  isSheetLayout,
  resolvePlacement,
  TOOLTIP_GAP,
  VIEWPORT_MARGIN,
  type OverlayLayout,
  type OverlayLayoutInput,
} from './dom/cutout';

export {
  getElementRect,
  getViewport,
  isRectFullyVisible,
  observeElement,
  scrollIntoViewIfNeeded,
} from './dom/rect';

export { GUIDE_CSS, injectStyles, STYLE_ELEMENT_ID } from './style';

export type { GuideStorageAdapter } from './types.internal';