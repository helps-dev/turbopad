/* Premium polish: eased count-up reveals for stats, price and scores.
   Purely decorative — values end exactly at their original text. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;

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

  // Animate a formatted number inside the first text node of an element,
  // preserving prefix ("$"), grouping, decimals and any nested suffix element.
  function animateNumber(element, delay) {
    const node = [...element.childNodes].find(child => child.nodeType === 3 && /\d/.test(child.nodeValue));
    if (!node) return;
    const match = node.nodeValue.match(/^(\D*)([\d,.]+)/);
    if (!match) return;
    const [, prefix, digits] = match;
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
      });
    countUpTextNode(node, target, format, { delay });
  }

  document.querySelectorAll('.stats strong').forEach((strong, index) => animateNumber(strong, 200 + index * 130));
  animateNumber(document.querySelector('.overview-price strong') ?? document.createElement('span'), 500);
  document.querySelectorAll('.score-orbit strong, .large-score').forEach((score, index) => animateNumber(score, 650 + index * 150));
})();
