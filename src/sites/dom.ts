const EDITABLE_SELECTOR = 'textarea, input[type="text"], [contenteditable="true"], [role="textbox"], .ql-editor';

/** Sites wrap their composer, so descend to the element that actually holds text. */
export const findEditableInside = (element: HTMLElement): HTMLElement => {
  if (element.matches(EDITABLE_SELECTOR)) return element;
  const nested = element.querySelector(EDITABLE_SELECTOR);
  return nested instanceof HTMLElement ? nested : element;
};

const isVisible = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
};

/** For a site with a single, unambiguous composer. */
export const queryEditable = (selector: string, doc = document): HTMLElement | null => {
  const candidate = doc.querySelector(selector);
  return candidate instanceof HTMLElement ? findEditableInside(candidate) : null;
};

/** For a site that keeps stale or hidden editors in the DOM alongside the live one. */
export const findVisibleEditable = (selectors: string[], doc = document): HTMLElement | null => {
  for (const selector of selectors) {
    const candidates = Array.from(doc.querySelectorAll(selector))
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .map(findEditableInside);
    const visible = candidates.find(isVisible);
    if (visible) return visible;
  }
  return null;
};
