/**
 * 「不再提示」持久化。
 *
 * 默认写入 `localStorage`，在无 `localStorage` 的环境（SSR、隐私模式）下自动退化为内存实现。
 * 可通过 `configureGuide({ storageKey, storageAdapter })` 替换为任意后端（如 cookie、服务端接口）。
 */

import type { GuideStorageAdapter } from './types.internal';

/** 默认的存储键名。 */
export const DEFAULT_STORAGE_KEY = 'kpro:guide:dismissed';

/** 全局配置。 */
export interface GuideConfig {
  /** 存储键名，默认 `kpro:guide:dismissed`。 */
  storageKey?: string;
  /** 自定义存储适配器，缺省时使用 localStorage（不可用时退化为内存）。 */
  storageAdapter?: GuideStorageAdapter;
}

let config: GuideConfig = {};

/**
 * 配置 kpro 的全局行为。可在应用入口调用一次。
 *
 * @example
 * ```ts
 * configureGuide({ storageKey: 'my-app:guide:dismissed' });
 * ```
 */
export function configureGuide(next: GuideConfig): void {
  config = { ...config, ...next };
}

/** 读取当前全局配置（只读快照，主要供测试与调试使用）。 */
export function getGuideConfig(): Readonly<GuideConfig> {
  return config;
}

function createMemoryAdapter(): GuideStorageAdapter {
  const store = new Map<string, string>();
  return {
    read: (key) => (store.has(key) ? (store.get(key) as string) : null),
    write: (key, value) => {
      store.set(key, value);
    },
  };
}

function createLocalStorageAdapter(): GuideStorageAdapter | null {
  if (typeof window === 'undefined') return null;
  try {
    const ls = window.localStorage;
    // 隐私模式下 localStorage 可能存在但写入抛错，这里做一次探针写入。
    const probe = '__kpro_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      read: (key) => ls.getItem(key),
      write: (key, value) => {
        ls.setItem(key, value);
      },
    };
  } catch {
    return null;
  }
}

let fallbackAdapter: GuideStorageAdapter | null = null;

/** 解析当前生效的存储适配器。 */
function resolveAdapter(): GuideStorageAdapter {
  if (config.storageAdapter) return config.storageAdapter;
  const local = createLocalStorageAdapter();
  if (local) return local;
  if (!fallbackAdapter) fallbackAdapter = createMemoryAdapter();
  return fallbackAdapter;
}

function resolveKey(): string {
  return config.storageKey ?? DEFAULT_STORAGE_KEY;
}

function readDismissedIds(): Set<string> {
  try {
    const raw = resolveAdapter().read(resolveKey());
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === 'string'));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function writeDismissedIds(ids: Set<string>): void {
  try {
    resolveAdapter().write(resolveKey(), JSON.stringify(Array.from(ids)));
  } catch {
    // 存储不可用时静默失败，不影响指引本身的可用性。
  }
}

/** 判断某个指引组是否已被标记为「不再提示」。 */
export function isGuideDismissed(id: string): boolean {
  return readDismissedIds().has(id);
}

/** 将某个指引组标记为「不再提示」。 */
export function dismissGuide(id: string): void {
  const ids = readDismissedIds();
  if (ids.has(id)) return;
  ids.add(id);
  writeDismissedIds(ids);
}

/** 清除某个指引组的「不再提示」标记。 */
export function restoreGuide(id: string): void {
  const ids = readDismissedIds();
  if (!ids.delete(id)) return;
  writeDismissedIds(ids);
}

/** 清空所有「不再提示」标记。 */
export function clearDismissedGuides(): void {
  writeDismissedIds(new Set());
}