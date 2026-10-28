import { beforeEach, describe, expect, it } from 'vitest';
import { hideOverlay, positionOverlay, removeOverlay } from '../overlay';

function getOverlay() {
  return document.getElementById(
    '__design-mode-overlay'
  ) as HTMLDivElement | null;
}

function getLabel() {
  return document.getElementById(
    '__design-mode-label'
  ) as HTMLDivElement | null;
}

function makeDOMRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 100,
    left: 200,
    width: 300,
    height: 50,
    right: 500,
    bottom: 150,
    x: 200,
    y: 100,
    toJSON: () => {},
    ...overrides,
  };
}

describe('overlay', () => {
  beforeEach(() => {
    removeOverlay();
  });

  describe('positionOverlay', () => {
    it('creates overlay and label elements on first call', () => {
      expect(getOverlay()).toBeNull();
      expect(getLabel()).toBeNull();

      positionOverlay(makeDOMRect(), 'DIV', '');

      expect(getOverlay()).not.toBeNull();
      expect(getLabel()).not.toBeNull();
    });

    it('positions the overlay at the element rect', () => {
      positionOverlay(
        makeDOMRect({ top: 50, left: 75, width: 200, height: 40 }),
        'DIV',
        ''
      );

      const overlay = getOverlay()!;
      expect(overlay.style.top).toBe('50px');
      expect(overlay.style.left).toBe('75px');
      expect(overlay.style.width).toBe('200px');
      expect(overlay.style.height).toBe('40px');
      expect(overlay.style.display).toBe('block');
    });

    it('shows tag name in the label when no class is set', () => {
      positionOverlay(makeDOMRect(), 'BUTTON', '');

      const label = getLabel()!;
      expect(label.textContent).toBe('<button>');
    });

    it('shows tag plus first class when className is set', () => {
      positionOverlay(makeDOMRect(), 'DIV', 'card primary large');

      const label = getLabel()!;
      expect(label.textContent).toBe('div.card');
    });

    it('positions label above the element when there is room', () => {
      positionOverlay(makeDOMRect({ top: 100 }), 'DIV', null);

      const label = getLabel()!;
      // Label should be above: top - labelHeight(20) - 2
      expect(label.style.top).toBe('78px');
    });

    it('positions label below the element when too close to top', () => {
      positionOverlay(makeDOMRect({ top: 10, bottom: 60 }), 'DIV', null);

      const label = getLabel()!;
      // Label should be below: bottom + 2
      expect(label.style.top).toBe('62px');
    });
  });

  describe('hideOverlay', () => {
    it('hides both overlay and label', () => {
      positionOverlay(makeDOMRect(), 'DIV', '');
      expect(getOverlay()!.style.display).toBe('block');
      expect(getLabel()!.style.display).toBe('inline-flex');

      hideOverlay();
      expect(getOverlay()!.style.display).toBe('none');
      expect(getLabel()!.style.display).toBe('none');
    });

    it('does nothing when elements do not exist', () => {
      expect(() => hideOverlay()).not.toThrow();
    });
  });

  describe('removeOverlay', () => {
    it('removes overlay and label from the DOM', () => {
      positionOverlay(makeDOMRect(), 'DIV', '');
      expect(getOverlay()).not.toBeNull();

      removeOverlay();
      expect(getOverlay()).toBeNull();
      expect(getLabel()).toBeNull();
    });

    it('can be called multiple times safely', () => {
      removeOverlay();
      expect(() => removeOverlay()).not.toThrow();
    });
  });
});
