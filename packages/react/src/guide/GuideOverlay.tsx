import {
  computeOverlayLayout,
  getViewport,
  injectStyles,
  observeElement,
  type GuidePlacementInput,
  type Rect,
  type Size,
} from '@kpro/core';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

/** 遮罩与高亮的 CSS 变量在 core 中统一定义，两个框架共用同一份样式。 */
export interface GuideOverlayProps {
  /** 目标元素（即默认插槽中的 DOM）。 */
  target: HTMLElement | null;
  serial: number;
  title?: string;
  content?: string;
  placement?: GuidePlacementInput;
  padding?: number;
  /** 是否显示目标元素四周的高亮描边，默认 false。 */
  showHighlight?: boolean;
  maskOpacity?: number;
  closable?: boolean;
  showDontShowAgain?: boolean;
  /** 当前步骤在可用步骤中的序号，从 1 开始。 */
  currentIndex: number;
  /** 可用步骤总数。 */
  total: number;
  /** 是否还有上一步。 */
  canPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onDismiss: () => void;
}

function toBoxStyle(rect: Rect): CSSProperties {
  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

/**
 * 指引浮层：挖孔遮罩 + 高亮描边 + 步骤卡片。
 *
 * 遮罩由最多 4 块矩形拼成，目标元素所在的区域不被覆盖，
 * 因此真实 DOM 保持原样可见、可交互，位置与尺寸与原 DOM 完全一致。
 */
export const GuideOverlay: FC<GuideOverlayProps> = ({
  target,
  title,
  content,
  placement,
  padding,
  showHighlight,
  maskOpacity,
  closable,
  showDontShowAgain,
  currentIndex,
  total,
  canPrev,
  onNext,
  onPrev,
  onClose,
  onDismiss,
}) => {
  injectStyles();

  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState<Size>(() => getViewport());
  const [tooltipSize, setTooltipSize] = useState<Size>({ width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  /** 「不再提示」勾选状态，随浮层挂载重置。 */
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const resolvedPadding = padding ?? 8;
  const resolvedOpacity = maskOpacity ?? 0.5;

  const measureTooltip = useCallback(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltipSize((previous) =>
      previous.width === rect.width && previous.height === rect.height
        ? previous
        : { width: rect.width, height: rect.height },
    );
  }, []);

  // 追踪目标元素的视口矩形。
  useEffect(() => {
    setTargetRect(null);
    if (!target) return undefined;
    return observeElement(target, setTargetRect);
  }, [target]);

  // 首帧同步测量，避免浮层位置出现跳变。
  useLayoutEffect(() => {
    measureTooltip();
    if (typeof ResizeObserver === 'undefined' || !tooltipRef.current) return undefined;
    const observer = new ResizeObserver(measureTooltip);
    observer.observe(tooltipRef.current);
    return () => observer.disconnect();
  }, [measureTooltip]);

  useEffect(() => {
    const handle = (): void => {
      setViewport(getViewport());
      measureTooltip();
    };
    window.addEventListener('resize', handle);
    window.addEventListener('orientationchange', handle);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle);
    };
  }, [measureTooltip]);

  const layout = useMemo(() => {
    if (!targetRect) return null;
    return computeOverlayLayout({
      target: targetRect,
      viewport,
      tooltip: tooltipSize,
      padding: resolvedPadding,
      placement: placement ?? 'auto',
    });
  }, [targetRect, viewport, tooltipSize, resolvedPadding, placement]);

  /** 勾选了「不再提示」时，任意退出动作都转化为永久关闭。 */
  const handleExit = useCallback(
    (action: 'close' | 'next') => {
      if (dontShowAgain) {
        onDismiss();
        return;
      }
      if (action === 'close') onClose();
      else onNext();
    },
    [dontShowAgain, onClose, onNext, onDismiss],
  );

  const handleContainerClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const el = event.target as HTMLElement | null;
      // 点击遮罩区域视为关闭指引，点击目标 DOM 不受影响。
      if (el?.classList.contains('kpro-guide__mask')) handleExit('close');
    },
    [handleExit],
  );

  const rootStyle: CSSProperties = useMemo(
    // 未测量到目标时保留布局盒但不可见，避免首帧闪烁。
    () => ({ visibility: layout ? 'visible' : 'hidden' }),
    [layout],
  );

  const tooltipStyle: CSSProperties = useMemo(() => {
    if (!layout || layout.sheet || !layout.tooltip) return {};
    return { top: `${layout.tooltip.top}px`, left: `${layout.tooltip.left}px` };
  }, [layout]);

  const highlightStyle: CSSProperties = layout
    ? toBoxStyle(layout.hole)
    : { display: 'none' };

  return createPortal(
    <div className="kpro-guide" style={rootStyle} onClick={handleContainerClick}>
      {(layout?.masks ?? []).map((mask, index) => (
        <div
          // 遮罩块的位置与数量随目标变化，用位置作为 key 即可稳定复用。
          key={`${index}-${mask.top}-${mask.left}`}
          className="kpro-guide__mask"
          style={{ ...toBoxStyle(mask), opacity: resolvedOpacity }}
        />
      ))}

      {showHighlight ? <div className="kpro-guide__highlight" style={highlightStyle} /> : null}

      <div
        ref={tooltipRef}
        className={`kpro-guide__tooltip${layout?.sheet ? ' kpro-guide__tooltip--sheet' : ''}`}
        style={tooltipStyle}
        role="dialog"
        aria-modal={false}
        aria-label={title || '操作指引'}
      >
        {closable !== false && (
          <button
            type="button"
            className="kpro-guide__close"
            aria-label="关闭指引"
            onClick={() => handleExit('close')}
          >
            ×
          </button>
        )}

        {title ? <h4 className="kpro-guide__title">{title}</h4> : null}
        <p className="kpro-guide__content">{content}</p>

        <div className="kpro-guide__footer">
          <span className="kpro-guide__progress">
            第 {currentIndex} / {total} 步
          </span>

          {showDontShowAgain ? (
            <label className="kpro-guide__dont-show">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(event) => setDontShowAgain(event.target.checked)}
              />
              不再提示
            </label>
          ) : null}

          <div className="kpro-guide__actions">
            <button
              type="button"
              className="kpro-guide__btn kpro-guide__btn--ghost"
              disabled={!canPrev}
              onClick={onPrev}
            >
              上一步
            </button>
            <button
              type="button"
              className="kpro-guide__btn kpro-guide__btn--primary"
              onClick={() => handleExit('next')}
            >
              {currentIndex >= total ? '完成' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};