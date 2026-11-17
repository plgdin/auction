const animationTimers = new WeakMap<HTMLElement, number>();

export function animateCartAdded() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const isPhone = window.matchMedia("(max-width: 640px)").matches;
  const target = document.querySelector<HTMLElement>(
    isPhone ? ".lelam-account-btn" : ".lelam-bid-btn",
  );
  if (!target) return;

  const previousTimer = animationTimers.get(target);
  if (previousTimer) window.clearTimeout(previousTimer);
  target.classList.remove("is-cart-added");
  void target.offsetWidth;
  target.classList.add("is-cart-added");
  const timer = window.setTimeout(() => {
    target.classList.remove("is-cart-added");
    animationTimers.delete(target);
  }, 1100);
  animationTimers.set(target, timer);
}
