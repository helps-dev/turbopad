/* Premium polish: eased count-up reveals for live values.
   Exposed as window.TurboCountUp — callers animate a formatted number inside
   the first text node of an element, preserving prefix, grouping and decimals. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function countUpTextNode(node, target, format, { duration = 1500, delay = 0 } = {}) {
    const finalText = format(target);
    const start = performance.now() + delay;
    (function frame(now) {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      node.nodeValue = t >= 1 ? finalText : format(target * easeOut(t));
      if (t < 1) requestAnimationFrame(frame);
    })(performance.now());
    // Safety net: guarantee the final value even if rAF is throttled or frozen.
    setTimeout(() => {
      node.nodeValue = finalText;
    }, delay + duration + 250);
  }

  function animateNumber(element, delay = 0) {
    if (reduced.matches || !element) return;
    const node = [...element.childNodes].find(child => child.nodeType === 3 && /\d/.test(child.nodeValue));
    if (!node) return;
    const match = node.nodeValue.match(/^(\D*)([\d,.]+)([\s\S]*)$/);
    if (!match) return;
    const [, prefix, digits, suffix] = match;
    const target = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(target) || target === 0) return;
    const decimals = (digits.split('.')[1] || '').length;
    const grouped = digits.includes(',');
    const format = value =>
      prefix +
      value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: grouped,
      }) +
      suffix;
    countUpTextNode(node, target, format, { delay });
  }

  window.TurboCountUp = animateNumber;
})();
