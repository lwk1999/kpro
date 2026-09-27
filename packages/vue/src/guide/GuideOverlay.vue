<script setup lang="ts">
import {
  computeOverlayLayout,
  getViewport,
  injectStyles,
  observeElement,
  type GuidePlacementInput,
  type Rect,
  type Size,
} from '@kpro/core';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

/**
 * 指引浮层：挖孔遮罩 + 高亮描边 + 步骤卡片。
 *
 * 遮罩由最多 4 块矩形拼成，目标元素所在的区域不被覆盖，
 * 因此真实 DOM 保持原样可见、可交互，位置与尺寸与原 DOM 完全一致。
 */
const props = defineProps<{
  /** 目标元素（即默认插槽中的 DOM）。 */
  target: HTMLElement | null;
  /** 当前步骤序号。 */
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
}>();

const emit = defineEmits<{
  (event: 'next'): void;
  (event: 'prev'): void;
  (event: 'close'): void;
  (event: 'dismiss'): void;
}>();

injectStyles();

const maskOpacity = computed(() => props.maskOpacity ?? 0.5);
const padding = computed(() => props.padding ?? 8);
const targetRect = shallowRef<Rect | null>(null);
const viewport = shallowRef<Size>(getViewport());
const tooltipSize = shallowRef<Size>({ width: 0, height: 0 });
const tooltipRef = ref<HTMLElement | null>(null);
/** 「不再提示」勾选状态，随每次打开重置。 */
const dontShowAgain = ref(false);

const layout = computed(() => {
  const target = targetRect.value;
  if (!target) return null;
  return computeOverlayLayout({
    target,
    viewport: viewport.value,
    tooltip: tooltipSize.value,
    padding: padding.value,
    placement: props.placement ?? 'auto',
  });
});

const rootStyle = computed(() => ({
  // 未测量到目标时保留布局盒但不可见，避免首帧闪烁。
  visibility: layout.value ? ('visible' as const) : ('hidden' as const),
}));

const highlightStyle = computed(() => {
  const hole = layout.value?.hole;
  if (!hole) return { display: 'none' };
  return {
    top: `${hole.top}px`,
    left: `${hole.left}px`,
    width: `${hole.width}px`,
    height: `${hole.height}px`,
  };
});

const tooltipStyle = computed(() => {
  const current = layout.value;
  if (!current || current.sheet || !current.tooltip) return {};
  return {
    top: `${current.tooltip.top}px`,
    left: `${current.tooltip.left}px`,
  };
});

function maskStyle(rect: Rect): Record<string, string> {
  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

function measureTooltip(): void {
  const el = tooltipRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  tooltipSize.value = { width: rect.width, height: rect.height };
}

let stopObserve: (() => void) | null = null;
let tooltipObserver: ResizeObserver | null = null;

function startObserve(): void {
  stopObserve?.();
  stopObserve = null;
  targetRect.value = null;
  if (!props.target) return;
  stopObserve = observeElement(props.target, (rect) => {
    targetRect.value = rect;
  });
}

function handleViewportChange(): void {
  viewport.value = getViewport();
  measureTooltip();
}

onMounted(() => {
  startObserve();
  measureTooltip();
  if (typeof ResizeObserver !== 'undefined' && tooltipRef.value) {
    tooltipObserver = new ResizeObserver(measureTooltip);
    tooltipObserver.observe(tooltipRef.value);
  }
  window.addEventListener('resize', handleViewportChange);
});

onBeforeUnmount(() => {
  stopObserve?.();
  stopObserve = null;
  tooltipObserver?.disconnect();
  tooltipObserver = null;
  window.removeEventListener('resize', handleViewportChange);
});

watch(() => props.target, startObserve);

/** 勾选了「不再提示」时，任意退出动作都转化为永久关闭。 */
function handleExit(action: 'close' | 'next'): void {
  if (dontShowAgain.value) {
    emit('dismiss');
    return;
  }
  if (action === 'close') emit('close');
  else emit('next');
}

function handleContainerClick(event: MouseEvent): void {
  const el = event.target as HTMLElement | null;
  // 点击遮罩区域视为关闭指引，点击目标 DOM 不受影响。
  if (el?.classList.contains('kpro-guide__mask')) handleExit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      class="kpro-guide"
      :style="rootStyle"
      @click="handleContainerClick"
    >
      <div
        v-for="(mask, index) in layout?.masks ?? []"
        :key="index"
        class="kpro-guide__mask"
        :style="{ ...maskStyle(mask), opacity: String(maskOpacity) }"
      />

      <div
        v-if="showHighlight"
        class="kpro-guide__highlight"
        :style="highlightStyle"
      />

      <div
        ref="tooltipRef"
        class="kpro-guide__tooltip"
        :class="{ 'kpro-guide__tooltip--sheet': layout?.sheet }"
        :style="tooltipStyle"
        role="dialog"
        aria-modal="false"
        :aria-label="title || '操作指引'"
      >
        <button
          v-if="closable !== false"
          type="button"
          class="kpro-guide__close"
          aria-label="关闭指引"
          @click="handleExit('close')"
        >
          ×
        </button>

        <h4
          v-if="title"
          class="kpro-guide__title"
        >
          {{ title }}
        </h4>
        <p class="kpro-guide__content">
          <slot>{{ content }}</slot>
        </p>

        <div class="kpro-guide__footer">
          <span class="kpro-guide__progress">第 {{ currentIndex }} / {{ total }} 步</span>

          <label
            v-if="showDontShowAgain"
            class="kpro-guide__dont-show"
          >
            <input
              v-model="dontShowAgain"
              type="checkbox"
            >
            不再提示
          </label>

          <div class="kpro-guide__actions">
            <button
              type="button"
              class="kpro-guide__btn kpro-guide__btn--ghost"
              :disabled="!canPrev"
              @click="emit('prev')"
            >
              上一步
            </button>
            <button
              type="button"
              class="kpro-guide__btn kpro-guide__btn--primary"
              @click="handleExit('next')"
            >
              {{ currentIndex >= total ? '完成' : '下一步' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
