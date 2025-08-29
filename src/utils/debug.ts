/**
 * Outline full-screen blocking elements for debugging.
 * @returns nothing
 */
export function outlineBlockers(): void {
  const els = Array.from(document.querySelectorAll<HTMLElement>('body *'));
  els.forEach((el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.pointerEvents === 'none') return;
    if (style.position === 'fixed' || style.position === 'absolute') {
      const rect = el.getBoundingClientRect();
      if (rect.width >= window.innerWidth && rect.height >= window.innerHeight) {
        el.style.outline = '2px dashed red';
      }
    }
  });
}
