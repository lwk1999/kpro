import { setGroupOptions, type GuideStepProps } from '@kpro/core';
import { defineComponent, inject, onMounted, provide, type InjectionKey, type PropType } from 'vue';

/** GuideProvider 的组级配置。 */
export interface GuideProviderOptions {
  /** 该指引组的标识。 */
  id: string;
  /** 组级是否启用「不再提示」能力，默认 true。 */
  dontShowAgain?: boolean;
}

/** 注入键。 */
export const GUIDE_PROVIDER_KEY: InjectionKey<Required<GuideProviderOptions>> = Symbol('kpro-guide-provider');

/**
 * 可选的组级容器。
 *
 * 不放置 Provider 时，`useGuide(id)` 与各步骤组件依然可用（引擎自身按 `id` 维护分组）；
 * Provider 的作用是集中声明组级配置，例如整体关闭「不再提示」能力。
 *
 * @example
 * ```vue
 * <GuideProvider id="dashboard" :dont-show-again="false">
 *   <KProGuide id="dashboard" :serial="1" title="概览">…</KProGuide>
 * </GuideProvider>
 * ```
 */
export const GuideProvider = defineComponent({
  name: 'KProGuideProvider',
  props: {
    id: { type: String as PropType<string>, required: true },
    dontShowAgain: { type: Boolean as PropType<boolean>, default: true },
  },
  setup(props, { slots }) {
    const options: Required<GuideProviderOptions> = {
      id: props.id,
      dontShowAgain: props.dontShowAgain,
    };
    provide(GUIDE_PROVIDER_KEY, options);

    onMounted(() => {
      setGroupOptions(props.id, { dontShowAgain: props.dontShowAgain });
    });

    return () => slots.default?.() ?? null;
  },
});

/** 读取当前所处的 Provider 配置，不存在时返回 null。 */
export function useGuideProvider(): Required<GuideProviderOptions> | null {
  return inject(GUIDE_PROVIDER_KEY, null);
}

/** 步骤组件的 props 定义，由公共契约派生。 */
export const guideProps = {
  id: { type: String as PropType<string>, required: true },
  serial: { type: Number as PropType<number>, required: true },
  title: { type: String as PropType<string>, default: undefined },
  content: { type: String as PropType<string>, default: undefined },
  placement: {
    type: String as PropType<GuideStepProps['placement']>,
    default: undefined,
  },
  padding: { type: Number as PropType<number>, default: undefined },
  showHighlight: { type: Boolean as PropType<boolean>, default: undefined },
  maskOpacity: { type: Number as PropType<number>, default: undefined },
  closable: { type: Boolean as PropType<boolean>, default: undefined },
  showDontShowAgain: { type: Boolean as PropType<boolean>, default: undefined },
  disabled: { type: Boolean as PropType<boolean>, default: undefined },
  autoScroll: { type: Boolean as PropType<boolean>, default: undefined },
} as const;
