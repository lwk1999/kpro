/**
 * 指引组件的共享样式。
 *
 * Vue 与 React 两端使用完全相同的类名与 CSS 变量，这是两个框架视觉一致的基础。
 * 样式通过 `<style>` 标签在首次渲染时注入，仅注入一次。
 */

/** 样式注入使用的元素 id。 */
export const STYLE_ELEMENT_ID = 'kpro-guide-styles';

/** 共享 CSS 文本。 */
export const GUIDE_CSS = `
.kpro-guide {
  --kpro-mask-bg: rgba(0, 0, 0);
  --kpro-mask-opacity: 0.5;
  --kpro-primary: #2f6bff;
  --kpro-tooltip-bg: #ffffff;
  --kpro-tooltip-color: #1f2430;
  --kpro-tooltip-radius: 10px;
  --kpro-tooltip-shadow: 0 12px 32px rgba(15, 23, 42, 0.24);
  --kpro-z-index: 9999;
  position: fixed;
  inset: 0;
  z-index: var(--kpro-z-index);
  pointer-events: none;
}

.kpro-guide__mask {
  position: fixed;
  background: var(--kpro-mask-bg);
  opacity: var(--kpro-mask-opacity);
  pointer-events: auto;
  transition: opacity 0.2s ease;
}

.kpro-guide__highlight {
  position: fixed;
  box-sizing: border-box;
  border: 2px solid var(--kpro-primary);
  border-radius: 6px;
  pointer-events: none;
  transition: top 0.18s ease, left 0.18s ease, width 0.18s ease, height 0.18s ease;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0);
}

.kpro-guide__tooltip {
  position: fixed;
  box-sizing: border-box;
  max-width: min(320px, calc(100vw - 16px));
  padding: 14px 16px;
  border-radius: var(--kpro-tooltip-radius);
  background: var(--kpro-tooltip-bg);
  color: var(--kpro-tooltip-color);
  box-shadow: var(--kpro-tooltip-shadow);
  pointer-events: auto;
  font-size: 14px;
  line-height: 1.6;
  transition: top 0.18s ease, left 0.18s ease;
}

.kpro-guide__tooltip--sheet {
  left: 0;
  right: 0;
  bottom: 0;
  top: auto !important;
  max-width: none;
  border-radius: var(--kpro-tooltip-radius) var(--kpro-tooltip-radius) 0 0;
  padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
}

.kpro-guide__title {
  margin: 0 20px 6px 0;
  font-size: 15px;
  font-weight: 600;
}

.kpro-guide__content {
  margin: 0;
  color: #4b5563;
  word-break: break-word;
}

.kpro-guide__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.kpro-guide__progress {
  font-size: 12px;
  color: #8b93a5;
}

.kpro-guide__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.kpro-guide__btn {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
  background: transparent;
  color: var(--kpro-tooltip-color);
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.kpro-guide__btn:focus-visible {
  outline: 2px solid var(--kpro-primary);
  outline-offset: 2px;
}

.kpro-guide__btn--primary {
  background: var(--kpro-primary);
  color: #fff;
}

.kpro-guide__btn--primary:hover {
  opacity: 0.9;
}

.kpro-guide__btn--ghost:hover {
  background: rgba(15, 23, 42, 0.06);
}

.kpro-guide__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.kpro-guide__close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8b93a5;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.kpro-guide__close:hover {
  background: rgba(15, 23, 42, 0.06);
  color: var(--kpro-tooltip-color);
}

.kpro-guide__dont-show {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  user-select: none;
}

.kpro-guide__dont-show input {
  margin: 0;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .kpro-guide__mask,
  .kpro-guide__highlight,
  .kpro-guide__tooltip {
    transition: none;
  }
}
`;

/**
 * 注入共享样式；重复调用只会注入一次。
 * 在 SSR 环境下（无 document）直接返回。
 */
export function injectStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = GUIDE_CSS;
  document.head.appendChild(style);
}