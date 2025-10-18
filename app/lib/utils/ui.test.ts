import { describe, it, expect, vi } from 'vitest';
import {
  createUIClickHandlers,
  shouldCloseCreditsInfo,
  createScrollToContentHandler,
} from 'app/lib/utils/ui';

describe('ui utils', () => {
  describe('createUIClickHandlers', () => {
    it('should create handlers that toggle credits info', () => {
      const setShowCreditsInfo = vi.fn();
      const setShowInstruction = vi.fn();

      const handlers = createUIClickHandlers(setShowCreditsInfo, setShowInstruction);

      handlers.handleCreditsClick();
      expect(setShowCreditsInfo).toHaveBeenCalledWith(expect.any(Function));

      // Test the function passed to setShowCreditsInfo
      const toggleFunction = setShowCreditsInfo.mock.calls[0][0];
      expect(toggleFunction(true)).toBe(false);
      expect(toggleFunction(false)).toBe(true);
    });

    it('should create handlers that close instruction', () => {
      const setShowCreditsInfo = vi.fn();
      const setShowInstruction = vi.fn();

      const handlers = createUIClickHandlers(setShowCreditsInfo, setShowInstruction);

      handlers.handleCloseInstruction();
      expect(setShowInstruction).toHaveBeenCalledWith(false);
    });
  });

  describe('shouldCloseCreditsInfo', () => {
    it('should return false when credits info is not shown', () => {
      const event = new MouseEvent('click');
      const result = shouldCloseCreditsInfo(event, false);
      expect(result).toBe(false);
    });

    it('should return true when clicking outside credits elements', () => {
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', {
        value: document.createElement('div'),
        writable: false,
      });

      // Mock closest to return null (not inside credits elements)
      vi.spyOn(event.target as HTMLElement, 'closest').mockReturnValue(null);

      const result = shouldCloseCreditsInfo(event, true);
      expect(result).toBe(true);
    });

    it('should return false when clicking inside credits display', () => {
      const event = new MouseEvent('click');
      const mockElement = document.createElement('div');
      Object.defineProperty(event, 'target', {
        value: mockElement,
        writable: false,
      });

      // Mock closest to return element (inside credits display)
      vi.spyOn(mockElement, 'closest').mockImplementation((selector) => {
        if (selector === '[data-testid="hover-credits-display"]') {
          return mockElement;
        }
        return null;
      });

      const result = shouldCloseCreditsInfo(event, true);
      expect(result).toBe(false);
    });

    it('should return false when clicking inside credits info panel', () => {
      const event = new MouseEvent('click');
      const mockElement = document.createElement('div');
      Object.defineProperty(event, 'target', {
        value: mockElement,
        writable: false,
      });

      // Mock closest to return element (inside credits info panel)
      vi.spyOn(mockElement, 'closest').mockImplementation((selector) => {
        if (selector === '.credits-info-panel') {
          return mockElement;
        }
        return null;
      });

      const result = shouldCloseCreditsInfo(event, true);
      expect(result).toBe(false);
    });
  });

  describe('createScrollToContentHandler', () => {
    it('should create handler that scrolls to content', () => {
      const mockElement = {
        scrollIntoView: vi.fn(),
      };
      const contentContainerRef = {
        current: mockElement,
      } as unknown as React.RefObject<HTMLDivElement>;

      const handler = createScrollToContentHandler(contentContainerRef);
      handler();

      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    it('should handle null ref gracefully', () => {
      const contentContainerRef = {
        current: null,
      } as unknown as React.RefObject<HTMLDivElement>;

      const handler = createScrollToContentHandler(contentContainerRef);

      // Should not throw
      expect(() => {
        handler();
      }).not.toThrow();
    });
  });
});
