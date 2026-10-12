import { useEffect, useState } from 'react';
import type { SiteAdapter } from '../types';
import { calculateButtonPosition, type ButtonPosition } from '../positioning';

const BUTTON_SIZE = { width: 36, height: 36 };

export type AnchorPosition = ButtonPosition & { anchorTop: number };

export const useAnchorPosition = (adapter: SiteAdapter, initialComposer: HTMLElement): AnchorPosition => {
  const [position, setPosition] = useState<AnchorPosition>({
    left: 8,
    top: 8,
    placement: 'right',
    anchorTop: window.innerHeight,
  });

  useEffect(() => {
    let frame = 0;
    let observedAnchor: HTMLElement | null = null;
    const resizeObserver = new ResizeObserver(() => schedule());

    const update = () => {
      const composer = adapter.findComposer() ?? initialComposer;
      const anchor = adapter.findAnchor(composer);
      if (anchor !== observedAnchor) {
        resizeObserver.disconnect();
        resizeObserver.observe(composer);
        if (anchor !== composer) resizeObserver.observe(anchor);
        observedAnchor = anchor;
      }
      const rect = anchor.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const visualViewport = window.visualViewport;
      setPosition({ ...calculateButtonPosition(rect, {
        width: visualViewport?.width ?? window.innerWidth,
        height: visualViewport?.height ?? window.innerHeight,
      }, BUTTON_SIZE), anchorTop: Math.round(rect.top) });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [adapter, initialComposer]);

  return position;
};
