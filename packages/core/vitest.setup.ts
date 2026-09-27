/**
 * 测试环境补丁。
 *
 * jsdom 未实现 `ResizeObserver`，而真实运行环境（Chrome / Firefox / Safari / Edge）
 * 均已原生支持，因此这里提供一个空实现，避免追踪逻辑在测试中抛错。
 */

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      /* noop */
    }
    unobserve(): void {
      /* noop */
    }
    disconnect(): void {
      /* noop */
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

export {};