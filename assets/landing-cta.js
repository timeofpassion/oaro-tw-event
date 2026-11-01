(() => {
  const floating = document.querySelector('.fab');
  if (!floating) return;

  const targets = document.querySelectorAll(
    '.hero .btns, .steps-cta, .info a[href^="tel:"]',
  );
  const visible = new Set();
  const sync = () => {
    // 키보드 사용 중인 상담 버튼의 포커스를 갑자기 숨기지 않는다.
    floating.classList.toggle(
      'inline-cta-visible',
      visible.size > 0 && !floating.contains(document.activeElement),
    );
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      sync();
    }, { rootMargin: '-64px 0px -16px 0px' });
    targets.forEach((target) => observer.observe(target));
  } else {
    const update = () => {
      visible.clear();
      targets.forEach((target) => {
        const rect = target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.bottom > 64 && rect.top < innerHeight - 16)
          visible.add(target);
      });
      sync();
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }
  floating.addEventListener('focusin', sync);
  floating.addEventListener('focusout', () => requestAnimationFrame(sync));
})();
