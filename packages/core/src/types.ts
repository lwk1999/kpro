/**
 * kpro 指引组件 —— 跨框架公共契约。
 *
 * 本文件中的属性名、取值与默认值同时被 `@kpro/vue` 与 `@kpro/react` 使用，
 * 两个框架的组件 API 因此保持完全一致。
 */

/** 浮层相对目标元素的显示方位。 */
export type GuidePlacement = 'top' | 'right' | 'bottom' | 'left';

/** 传入的方位，`auto` 表示按视口可用空间自动翻转。 */
export type GuidePlacementInput = GuidePlacement | 'auto';

/** 视口坐标系下的矩形（单位 px）。 */
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** 尺寸（单位 px）。 */
export interface Size {
  width: number;
  height: number;
}

/**
 * 指引步骤的公共属性契约。
 * 这是 Vue / React 两个版本组件 props 的唯一事实来源。
 */
export interface GuideStepProps {
  /** 指引组标识，用于区分不同的指引组。 */
  id: string;
  /** 当前步骤在整组指引流程中的顺序，从 1 开始。 */
  serial: number;
  /** 步骤标题。 */
  title?: string;
  /** 步骤说明文案。 */
  content?: string;
  /** 浮层方位，默认 `auto`。 */
  placement?: GuidePlacementInput;
  /** 高亮区域相对目标元素外扩的像素，默认 8。 */
  padding?: number;
  /** 是否显示目标元素四周的高亮描边，默认 false。 */
  showHighlight?: boolean;
  /** 遮罩不透明度，默认 0.5。 */
  maskOpacity?: number;
  /** 是否显示右上角关闭按钮，默认 true。 */
  closable?: boolean;
  /** 是否显示「不再提示」选项，默认 true。 */
  showDontShowAgain?: boolean;
  /** 为 true 时该步骤会被流程跳过，默认 false。 */
  disabled?: boolean;
  /** 激活时若目标不在视口内则自动滚动到可见区域，默认 true。 */
  autoScroll?: boolean;
}

/** 补全默认值之后的步骤定义。 */
export interface GuideStep extends Required<Omit<GuideStepProps, 'title' | 'content'>> {
  title?: string;
  content?: string;
}

/** 步骤属性的默认值，Vue / React 共用。 */
export const GUIDE_STEP_DEFAULTS = {
  placement: 'auto',
  padding: 8,
  showHighlight: false,
  maskOpacity: 0.5,
  closable: true,
  showDontShowAgain: true,
  disabled: false,
  autoScroll: true,
} as const;

/** 指引组对外暴露的只读快照。 */
export interface GuideGroupSnapshot {
  /** 组标识。 */
  id: string;
  /** 组内已注册的步骤（含 disabled），按 serial 升序。可用数量见 `stepCount`。 */
  steps: GuideStep[];
  /** 当前激活步骤的 serial，未激活时为 null。 */
  current: number | null;
  /** 是否处于激活态（即是否显示遮罩）。 */
  isActive: boolean;
  /** 该指引组是否已被标记为「不再提示」。 */
  isDismissed: boolean;
  /** 组级是否启用「不再提示」能力。 */
  dontShowAgainEnabled: boolean;
  /** 组内可用步骤数量。 */
  stepCount: number;
  /**
   * 负责向宿主转发组级事件的步骤 serial。
   *
   * 同一组内可能有多个步骤组件，若每个都转发会导致事件重复；
   * 引擎指定其中唯一一个作为事件出口（首个注册者，注销后自动移交）。
   */
  eventOwner: number | null;
}

/** 步骤切换事件的载荷。 */
export interface GuideStepChangePayload {
  id: string;
  /** 切换前的 serial。 */
  from: number | null;
  /** 切换后的 serial。 */
  to: number | null;
}

/** 指引组对外抛出的事件表。 */
export interface GuideEventMap {
  'step-change': GuideStepChangePayload;
  next: GuideStepChangePayload;
  prev: GuideStepChangePayload;
  finish: { id: string };
  close: { id: string };
  'dont-show-again': { id: string };
}

/** 指引组事件名。 */
export type GuideEventName = keyof GuideEventMap;

/**
 * 控制器，`useGuide(id)` 在 Vue 与 React 中返回同样的形状。
 */
export interface GuideController {
  readonly id: string;
  readonly steps: GuideStep[];
  readonly current: number | null;
  readonly isActive: boolean;
  readonly isDismissed: boolean;
  readonly stepCount: number;
  /** 开始指引，可指定起始 serial。已被「不再提示」时不会启动。 */
  start: (from?: number) => void;
  /** 进入下一步，已是最后一步时自动结束。 */
  next: () => void;
  /** 回到上一步，已是第一步时不动作。 */
  prev: () => void;
  /** 跳转到指定 serial，serial 不存在或已禁用时不动作。 */
  goTo: (serial: number) => void;
  /** 关闭指引（触发 close 事件）。 */
  stop: () => void;
  /** 结束指引（触发 finish 事件）。 */
  finish: () => void;
  /** 标记为「不再提示」、持久化并关闭。 */
  dismiss: () => void;
  /** 清除「不再提示」标记。 */
  reset: () => void;
}

/** 窄视口断点，低于该宽度时浮层降级为底部抽屉。 */
export const NARROW_VIEWPORT_WIDTH = 640;