export function animateProductPageToCart(onComplete: () => void) {
  const page = document.querySelector<HTMLElement>(".product-detail-page");
  const cart = document.querySelector<HTMLElement>(".lelam-bid-btn");

  if (!page || !cart || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    onComplete();
    return;
  }

  const pageRect = page.getBoundingClientRect();
  const cartRect = cart.getBoundingClientRect();
  const clone = page.cloneNode(true) as HTMLElement;
  const originalVisibility = page.style.visibility;
  clone.style.position = "fixed";
  clone.style.inset = "auto";
  clone.style.top = `${pageRect.top}px`;
  clone.style.left = `${pageRect.left}px`;
  clone.style.width = `${pageRect.width}px`;
  clone.style.height = `${pageRect.height}px`;
  clone.style.margin = "0";
  clone.style.zIndex = "120";
  clone.style.pointerEvents = "none";
  clone.style.transformOrigin = `${cartRect.left + cartRect.width / 2 - pageRect.left}px ${cartRect.top + cartRect.height / 2 - pageRect.top}px`;
  document.body.appendChild(clone);
  page.style.visibility = "hidden";

  const animation = clone.animate(
    [
      { transform: "scale(1)", opacity: 1, filter: "blur(0)" },
      { transform: "scale(.012)", opacity: 0.35, filter: "blur(2px)" },
    ],
    { duration: 520, easing: "cubic-bezier(.65, 0, .85, .35)", fill: "forwards" },
  );
  animation.onfinish = () => {
    clone.remove();
    page.style.visibility = originalVisibility;
    onComplete();
  };
  animation.oncancel = () => {
    clone.remove();
    page.style.visibility = originalVisibility;
    onComplete();
  };
}
