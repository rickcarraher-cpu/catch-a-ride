import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type GetStyleInfo, initDesignMode } from '../protocol';

function attachFiber(el: Element, fiber: Record<string, unknown>) {
  const key = `__reactFiber$test123`;
  (el as any)[key] = fiber;
}

function makeFiber(source: {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}) {
  return { _debugSource: source, return: null };
}

function sendMessage(data: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data }));
}

const mockGetStyleInfo: GetStyleInfo = (resolved) => ({
  className:
    resolved.element instanceof HTMLElement ? resolved.element.className : '',
  styles: null,
});

describe('protocol', () => {
  let parentMessages: unknown[];
  let originalPostMessage: typeof window.parent.postMessage;

  beforeEach(() => {
    document.body.innerHTML = '';
    parentMessages = [];

    // Intercept postMessage to parent
    originalPostMessage = window.parent.postMessage;
    window.parent.postMessage = ((message: unknown) => {
      parentMessages.push(message);
    }) as any;
  });

  afterEach(() => {
    sendMessage({ type: 'disable-design-mode' });
    window.parent.postMessage = originalPostMessage;
  });

  describe('initDesignMode', () => {
    it('returns a reselect function', () => {
      const reselect = initDesignMode(mockGetStyleInfo);
      expect(typeof reselect).toBe('function');
    });
  });

  describe('enable / disable', () => {
    it('sets crosshair cursor on enable', () => {
      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });

      expect(document.body.style.cursor).toBe('crosshair');
    });

    it('restores cursor on disable', () => {
      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });
      sendMessage({ type: 'disable-design-mode' });

      expect(document.body.style.cursor).toBe('');
    });

    it('removes overlay on disable', () => {
      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });
      sendMessage({ type: 'disable-design-mode' });

      expect(document.getElementById('__design-mode-overlay')).toBeNull();
    });
  });

  describe('element selection via click', () => {
    it('sends element-selected message on click', () => {
      const el = document.createElement('div');
      el.className = 'bg-red-500';
      document.body.appendChild(el);

      const source = { fileName: 'App.tsx', lineNumber: 10, columnNumber: 5 };
      attachFiber(el, makeFiber(source));

      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });
      el.click();

      const selectedMsg = parentMessages.find(
        (m: any) =>
          m.type === 'design-mode:element-selected' && m.element !== null
      ) as any;

      expect(selectedMsg).toBeDefined();
      expect(selectedMsg.element.source).toEqual(source);
      expect(selectedMsg.element.className).toBe('bg-red-500');
      expect(selectedMsg.element.tagName).toBe('div');
    });

    it('sends null element when clicking on non-fiber element', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      // No fiber attached

      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });
      el.click();

      const selectedMsg = parentMessages.find(
        (m: any) => m.type === 'design-mode:element-selected'
      ) as any;

      expect(selectedMsg).toBeDefined();
      expect(selectedMsg.element).toBeNull();
    });
  });

  describe('apply-inline-style', () => {
    it('applies inline styles to the selected element', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const source = { fileName: 'App.tsx', lineNumber: 10, columnNumber: 5 };
      attachFiber(el, makeFiber(source));

      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });
      el.click();

      sendMessage({
        type: 'design-mode:apply-inline-style',
        styles: { color: 'red', 'font-size': '16px' },
      });

      expect(el.style.color).toBe('red');
      expect(el.style.fontSize).toBe('16px');
    });

    it('ignores inline styles when nothing is selected', () => {
      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });

      // Should not throw
      sendMessage({
        type: 'design-mode:apply-inline-style',
        styles: { color: 'red' },
      });
    });
  });

  describe('reselect', () => {
    it('re-finds the element by source location after DOM replacement', () => {
      const source = { fileName: 'App.tsx', lineNumber: 10, columnNumber: 5 };

      // Initial element
      const el1 = document.createElement('div');
      el1.className = 'text-blue-500';
      document.body.appendChild(el1);
      attachFiber(el1, makeFiber(source));

      const reselect = initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });
      el1.click();

      // Simulate HMR: remove old element, add new one at same source
      el1.remove();
      const el2 = document.createElement('div');
      el2.className = 'text-red-500';
      document.body.appendChild(el2);
      attachFiber(el2, makeFiber(source));

      parentMessages = [];
      reselect();

      const reselectMsg = parentMessages.find(
        (m: any) =>
          m.type === 'design-mode:element-selected' && m.element !== null
      ) as any;

      expect(reselectMsg).toBeDefined();
      expect(reselectMsg.element.className).toBe('text-red-500');
      expect(reselectMsg.element.source).toEqual(source);
    });

    it('clears selection when element is no longer in DOM', () => {
      const source = { fileName: 'App.tsx', lineNumber: 10, columnNumber: 5 };
      const el = document.createElement('div');
      document.body.appendChild(el);
      attachFiber(el, makeFiber(source));

      const reselect = initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });
      el.click();

      el.remove();
      parentMessages = [];
      reselect();

      const clearMsg = parentMessages.find(
        (m: any) => m.type === 'design-mode:element-selected'
      ) as any;

      expect(clearMsg).toBeDefined();
      expect(clearMsg.element).toBeNull();
    });

    it('responds to design-mode:reselect message', () => {
      const source = { fileName: 'App.tsx', lineNumber: 10, columnNumber: 5 };
      const el = document.createElement('div');
      el.className = 'p-4';
      document.body.appendChild(el);
      attachFiber(el, makeFiber(source));

      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });
      el.click();

      parentMessages = [];
      sendMessage({ type: 'design-mode:reselect' });

      const reselectMsg = parentMessages.find(
        (m: any) =>
          m.type === 'design-mode:element-selected' && m.element !== null
      ) as any;

      expect(reselectMsg).toBeDefined();
      expect(reselectMsg.element.className).toBe('p-4');
    });

    it('does nothing when nothing was selected', () => {
      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });

      // Clear any selection from previous tests by clicking a non-fiber element
      const bare = document.createElement('div');
      document.body.appendChild(bare);
      bare.click();

      parentMessages = [];
      sendMessage({ type: 'design-mode:reselect' });

      const selectedMsgs = parentMessages.filter(
        (m: any) => m.type === 'design-mode:element-selected'
      );
      expect(selectedMsgs).toHaveLength(0);
    });
  });

  describe('wrapped messages from useIframe hook', () => {
    it('handles enable-design-mode wrapped in useIframeHook payload', () => {
      initDesignMode(mockGetStyleInfo);

      sendMessage({
        __fromUseIframeHook: true,
        payload: JSON.stringify({ type: 'enable-design-mode' }),
      });

      expect(document.body.style.cursor).toBe('crosshair');
    });

    it('handles disable-design-mode wrapped in useIframeHook payload', () => {
      initDesignMode(mockGetStyleInfo);
      sendMessage({ type: 'enable-design-mode' });

      sendMessage({
        __fromUseIframeHook: true,
        payload: JSON.stringify({ type: 'disable-design-mode' }),
      });

      expect(document.body.style.cursor).toBe('');
    });
  });
});
