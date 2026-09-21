/* Motion is decorative: all content and controls work without this file. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const seen = new WeakSet();
  let observer;
  let frame = 0;
  let activeCard;
  let pointerX = 0;
  let pointerY = 0;
  const enter = element => {
    element.classList.remove('motion-pending');
    element.classList.add('motion-enter');
    // Remove the fill transform after entry so hover can lift the card.
    element.addEventListener('animationend', event => {
      if (event.target === element && event.animationName === 'turbo-rise') {
        element.style.animationFillMode = 'backwards';
      }
    }, { once: true });
  };
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        enter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
  }
  function prepare() {
    if (reduced.matches) return;
    document.documentElement.classList.add('motion-ready');
    const elements = document.querySelectorAll('.page-title, .stats, .market-card, .radar-panel, .battle-panel, .studio-panel');
    let index = 0;
    elements.forEach(element => {
      if (seen.has(element)) return;
      seen.add(element);
      element.style.setProperty('--enter-delay', `${Math.min(index++ * 45, 225)}ms`);
      if (observer) {
        element.classList.add('motion-pending');
        observer.observe(element);
      } else enter(element);
    });
  }
  const mutations = new MutationObserver(prepare);
  mutations.observe(document.querySelector('.content-grid'), { childList: true, subtree: true });
  prepare();
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      document.querySelectorAll('.motion-pending').forEach(element => element.classList.remove('motion-pending'));
      observer?.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
    } else prepare();
  });
  let tiltCard;
  document.addEventListener('pointermove', event => {
    if (reduced.matches || !finePointer.matches) return;
    activeCard = event.target.closest('.market-card');
    if (tiltCard && tiltCard !== activeCard) {
      tiltCard.style.setProperty('--tilt-x', '0deg');
      tiltCard.style.setProperty('--tilt-y', '0deg');
      tiltCard = undefined;
    }
    if (!activeCard) return;
    tiltCard = activeCard;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!activeCard?.isConnected) return;
      const bounds = activeCard.getBoundingClientRect();
      const relX = pointerX - bounds.left;
      const relY = pointerY - bounds.top;
      activeCard.style.setProperty('--pointer-x', `${relX}px`);
      activeCard.style.setProperty('--pointer-y', `${relY}px`);
      // Subtle 3D tilt toward the pointer (max ~2.4deg).
      activeCard.style.setProperty('--tilt-y', `${((relX / bounds.width) - 0.5) * 4.8}deg`);
      activeCard.style.setProperty('--tilt-x', `${(0.5 - (relY / bounds.height)) * 4.8}deg`);
    });
  }, { passive: true });
  document.addEventListener('pointerleave', () => {
    if (!tiltCard) return;
    tiltCard.style.setProperty('--tilt-x', '0deg');
    tiltCard.style.setProperty('--tilt-y', '0deg');
    tiltCard = undefined;
  }, true);
})();
