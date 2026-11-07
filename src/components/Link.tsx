import type { AnchorHTMLAttributes, ReactNode } from "react";

export function smoothScrollTo(element: HTMLElement | null) {
  if (!element) return;
  const navbarOffset = 88;
  const targetPosition = element.getBoundingClientRect().top + window.scrollY - navbarOffset;
  const startPosition = window.scrollY;
  const distance = targetPosition - startPosition;
  if (Math.abs(distance) < 2) return;

  const duration = Math.min(900, Math.max(450, Math.abs(distance) * 0.65));
  let startTime: number | null = null;

  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

  const step = (currentTime: number) => {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    const ease = easeInOutCubic(progress);
    window.scrollTo(0, startPosition + distance * ease);
    if (timeElapsed < duration) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

export function navigate(to: string) {
  if (to.startsWith("#/")) {
    window.location.hash = to;
    return;
  }
  if (to.startsWith("#")) {
    if (window.location.hash.startsWith("#/")) {
      window.location.hash = "";
      window.setTimeout(() => {
        const target = document.querySelector(to) as HTMLElement | null;
        if (target) {
          smoothScrollTo(target);
        }
      }, 90);
    } else {
      window.location.hash = to;
      const target = document.querySelector(to) as HTMLElement | null;
      if (target) {
        smoothScrollTo(target);
      }
    }
    return;
  }
  window.location.hash = to;
}

export function Link({
  href,
  children,
  className,
  onClick,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        navigate(href);
        onClick?.();
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
