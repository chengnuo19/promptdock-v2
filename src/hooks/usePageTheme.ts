import { useEffect, useState } from 'react';

export type PageTheme = 'light' | 'dark';

const parseRgb = (value: string): [number, number, number, number] | null => {
  const match = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+))?/i);
  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])]
    : null;
};

const detectTheme = (): PageTheme => {
  const candidates = [document.body, document.documentElement];
  for (const element of candidates) {
    const rgb = parseRgb(getComputedStyle(element).backgroundColor);
    if (!rgb || rgb[3] === 0) continue;
    const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    return luminance < 0.45 ? 'dark' : 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const usePageTheme = (): PageTheme => {
  const [theme, setTheme] = useState<PageTheme>(() => detectTheme());

  useEffect(() => {
    const update = () => setTheme(detectTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
    };
  }, []);

  return theme;
};
