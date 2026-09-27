import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDismissedGuides,
  configureGuide,
  DEFAULT_STORAGE_KEY,
  dismissGuide,
  isGuideDismissed,
  restoreGuide,
} from './storage';
import type { GuideStorageAdapter } from './types.internal';

beforeEach(() => {
  window.localStorage.clear();
  configureGuide({ storageKey: DEFAULT_STORAGE_KEY, storageAdapter: undefined });
});

describe('默认使用 localStorage', () => {
  it('dismiss / restore / isDismissed 往返一致', () => {
    expect(isGuideDismissed('a')).toBe(false);

    dismissGuide('a');
    expect(isGuideDismissed('a')).toBe(true);
    expect(isGuideDismissed('b')).toBe(false);

    restoreGuide('a');
    expect(isGuideDismissed('a')).toBe(false);
  });

  it('以字符串数组的形式存放在约定的键名下', () => {
    dismissGuide('a');
    dismissGuide('b');

    expect(JSON.parse(window.localStorage.getItem(DEFAULT_STORAGE_KEY) as string)).toEqual(['a', 'b']);
  });

  it('重复 dismiss 不会写入重复项', () => {
    dismissGuide('a');
    dismissGuide('a');

    expect(JSON.parse(window.localStorage.getItem(DEFAULT_STORAGE_KEY) as string)).toEqual(['a']);
  });

  it('clearDismissedGuides 清空全部标记', () => {
    dismissGuide('a');
    dismissGuide('b');
    clearDismissedGuides();

    expect(isGuideDismissed('a')).toBe(false);
    expect(isGuideDismissed('b')).toBe(false);
  });

  it('屏蔽不同指引组', () => {
    dismissGuide('group-a');

    expect(isGuideDismissed('group-a')).toBe(true);
    expect(isGuideDismissed('group-b')).toBe(false);
  });
});

describe('存储内容异常时降级', () => {
  it('非法 JSON 视为没有任何标记', () => {
    window.localStorage.setItem(DEFAULT_STORAGE_KEY, '{not json');

    expect(isGuideDismissed('a')).toBe(false);
  });

  it('非数组内容视为没有任何标记', () => {
    window.localStorage.setItem(DEFAULT_STORAGE_KEY, '{"a":true}');

    expect(isGuideDismissed('a')).toBe(false);
  });

  it('数组中的非字符串项被忽略', () => {
    window.localStorage.setItem(DEFAULT_STORAGE_KEY, '["a",1,null]');

    expect(isGuideDismissed('a')).toBe(true);
  });
});

describe('自定义配置', () => {
  it('storageKey 决定写入位置', () => {
    configureGuide({ storageKey: 'my-app:guide' });
    dismissGuide('a');

    expect(window.localStorage.getItem('my-app:guide')).toBe('["a"]');
    expect(window.localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
  });

  it('注入自定义适配器后不再触碰 localStorage', () => {
    const store = new Map<string, string>();
    const adapter: GuideStorageAdapter = {
      read: (key) => store.get(key) ?? null,
      write: (key, value) => {
        store.set(key, value);
      },
    };
    configureGuide({ storageKey: 'custom', storageAdapter: adapter });

    dismissGuide('a');

    expect(isGuideDismissed('a')).toBe(true);
    expect(store.get('custom')).toBe('["a"]');
    expect(window.localStorage.getItem('custom')).toBeNull();
  });

  it('适配器抛错时静默降级，不影响指引可用性', () => {
    const adapter: GuideStorageAdapter = {
      read: () => {
        throw new Error('read failed');
      },
      write: () => {
        throw new Error('write failed');
      },
    };
    configureGuide({ storageAdapter: adapter });

    expect(isGuideDismissed('a')).toBe(false);
    expect(() => dismissGuide('a')).not.toThrow();
    expect(() => restoreGuide('a')).not.toThrow();
    expect(() => clearDismissedGuides()).not.toThrow();
  });

  it('removeItem 探针失败时退化为内存实现', () => {
    const removeItem = vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(isGuideDismissed('a')).toBe(false);

    removeItem.mockRestore();
  });
});