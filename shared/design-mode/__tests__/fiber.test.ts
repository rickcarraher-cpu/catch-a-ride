import { beforeEach, describe, expect, it } from 'vitest';
import {
  findElementBySource,
  getComponentName,
  getDebugSource,
  getFiberFromElement,
  resolveElement,
} from '../fiber';

function attachFiber(el: Element, fiber: Record<string, unknown>) {
  const key = `__reactFiber$test123`;
  (el as any)[key] = fiber;
}

describe('getFiberFromElement', () => {
  it('returns the fiber when present', () => {
    const el = document.createElement('div');
    const fiber = { tag: 5 };
    attachFiber(el, fiber);

    expect(getFiberFromElement(el)).toBe(fiber);
  });

  it('returns null when no fiber is attached', () => {
    const el = document.createElement('div');
    expect(getFiberFromElement(el)).toBeNull();
  });
});

describe('getDebugSource', () => {
  it('returns source from the fiber itself', () => {
    const source = { fileName: 'App.tsx', lineNumber: 10, columnNumber: 5 };
    const fiber = { _debugSource: source, return: null };

    expect(getDebugSource(fiber)).toBe(source);
  });

  it('walks up the fiber tree to find source', () => {
    const source = { fileName: 'App.tsx', lineNumber: 10, columnNumber: 5 };
    const parent = { _debugSource: source, return: null };
    const child = { return: parent };

    expect(getDebugSource(child)).toBe(source);
  });

  it('returns null when no source exists', () => {
    const fiber = { return: { return: null } };
    expect(getDebugSource(fiber)).toBeNull();
  });
});

describe('getComponentName', () => {
  it('returns the component name from a parent fiber', () => {
    function MyComponent() {}
    const parent = { type: MyComponent, return: null };
    const fiber = { return: parent };

    expect(getComponentName(fiber)).toBe('MyComponent');
  });

  it('returns displayName when available', () => {
    const Component = () => {};
    Component.displayName = 'CustomName';
    const parent = { type: Component, return: null };
    const fiber = { return: parent };

    expect(getComponentName(fiber)).toBe('CustomName');
  });

  it('skips Fragment and underscore-prefixed names', () => {
    const Fragment = () => {};
    Fragment.displayName = 'Fragment';
    function RealComponent() {}
    const grandparent = { type: RealComponent, return: null };
    const parent = { type: Fragment, return: grandparent };
    const fiber = { return: parent };

    expect(getComponentName(fiber)).toBe('RealComponent');
  });

  it('returns null when no named component is found', () => {
    const fiber = { return: { type: 'div', return: null } };
    expect(getComponentName(fiber)).toBeNull();
  });
});

describe('resolveElement', () => {
  it('resolves an element with a fiber and source', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const source = { fileName: 'App.tsx', lineNumber: 10, columnNumber: 5 };
    function MyComponent() {}
    const parentFiber = { type: MyComponent, return: null };
    const fiber = { _debugSource: source, return: parentFiber };
    attachFiber(el, fiber);

    const result = resolveElement(el);
    expect(result).not.toBeNull();
    expect(result!.source).toBe(source);
    expect(result!.element).toBe(el);
    expect(result!.componentName).toBe('MyComponent');

    el.remove();
  });

  it('walks up the DOM to find a fiber', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const source = { fileName: 'App.tsx', lineNumber: 5, columnNumber: 0 };
    attachFiber(parent, { _debugSource: source, return: null });

    const result = resolveElement(child);
    expect(result).not.toBeNull();
    expect(result!.element).toBe(parent);
    expect(result!.source).toEqual(source);

    parent.remove();
  });

  it('returns null for elements without fibers', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    expect(resolveElement(el)).toBeNull();

    el.remove();
  });

  it('returns null for null target', () => {
    expect(resolveElement(null)).toBeNull();
  });
});

describe('findElementBySource', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds an element matching the source location', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const source = { fileName: 'Page.tsx', lineNumber: 42, columnNumber: 8 };
    attachFiber(el, { _debugSource: source, return: null });

    const result = findElementBySource(source);
    expect(result).not.toBeNull();
    expect(result!.element).toBe(el);
    expect(result!.source).toEqual(source);
  });

  it('returns null when no element matches', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    attachFiber(el, {
      _debugSource: { fileName: 'A.tsx', lineNumber: 1, columnNumber: 0 },
      return: null,
    });

    const result = findElementBySource({
      fileName: 'B.tsx',
      lineNumber: 99,
      columnNumber: 0,
    });
    expect(result).toBeNull();
  });

  it('finds the correct element among siblings', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('span');
    document.body.appendChild(el1);
    document.body.appendChild(el2);

    const source1 = { fileName: 'A.tsx', lineNumber: 1, columnNumber: 0 };
    const source2 = { fileName: 'A.tsx', lineNumber: 2, columnNumber: 0 };
    attachFiber(el1, { _debugSource: source1, return: null });
    attachFiber(el2, { _debugSource: source2, return: null });

    const result = findElementBySource(source2);
    expect(result).not.toBeNull();
    expect(result!.element).toBe(el2);
  });
});
