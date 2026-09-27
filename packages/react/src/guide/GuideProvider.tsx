import { injectStyles, setGroupOptions, type GuideEventMap, type GuideStepProps } from '@kpro/core';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type FC,
  type PropsWithChildren,
  type ReactElement,
} from 'react';

/** GuideProvider 的组级配置。 */
export interface GuideProviderProps {
  /** 该指引组的标识。 */
  id: string;
  /** 组级是否启用「不再提示」能力，默认 true。 */
  dontShowAgain?: boolean;
}

interface GuideProviderContextValue {
  id: string;
  dontShowAgain: boolean;
}

const GuideProviderContext = createContext<GuideProviderContextValue | null>(null);

/**
 * 可选的组级容器。
 *
 * 不放置 Provider 时，`useGuide(id)` 与各步骤组件依然可用（引擎自身按 `id` 维护分组）；
 * Provider 的作用是集中声明组级配置，例如整体关闭「不再提示」能力。
 *
 * @example
 * ```tsx
 * <GuideProvider id="dashboard" dontShowAgain={false}>
 *   <Guide id="dashboard" serial={1} title="概览">{<button>新建</button>}</Guide>
 * </GuideProvider>
 * ```
 */
export const GuideProvider: FC<PropsWithChildren<GuideProviderProps>> = ({
  id,
  dontShowAgain = true,
  children,
}) => {
  injectStyles();

  useEffect(() => {
    setGroupOptions(id, { dontShowAgain });
  }, [id, dontShowAgain]);

  const value = useMemo<GuideProviderContextValue>(() => ({ id, dontShowAgain }), [id, dontShowAgain]);

  return <GuideProviderContext.Provider value={value}>{children}</GuideProviderContext.Provider>;
};

/** 读取当前所处的 Provider 配置，不存在时返回 null。 */
export function useGuideProvider(): GuideProviderContextValue | null {
  return useContext(GuideProviderContext);
}

/** 步骤组件的 props，由公共契约派生，命名与 Vue 版本保持一致。 */
export type GuideProps = GuideStepProps & {
  /** 默认插槽：作为当前步骤目标 DOM 的单个元素。 */
  children: ReactElement;
  /**
   * 组级事件回调。与 Vue 版本的 emit 事件一一对应：
   * `step-change` ↔ `onStepChange`、`next` ↔ `onNext`、`prev` ↔ `onPrev`、
   * `finish` ↔ `onFinish`、`close` ↔ `onClose`、`dont-show-again` ↔ `onDontShowAgain`。
   */
  onStepChange?: (payload: GuideEventMap['step-change']) => void;
  onNext?: (payload: GuideEventMap['next']) => void;
  onPrev?: (payload: GuideEventMap['prev']) => void;
  onFinish?: (payload: GuideEventMap['finish']) => void;
  onClose?: (payload: GuideEventMap['close']) => void;
  onDontShowAgain?: (payload: GuideEventMap['dont-show-again']) => void;
};