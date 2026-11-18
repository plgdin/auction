import { useEffect, type AnchorHTMLAttributes, type ReactNode } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

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

/**
 * Maps legacy notification links onto clean React Router paths:
 * - strip a leading `#/` coming from old hash-based data
 * - rewrite singular `/order/<id>` to the canonical `/orders/<id>`
 * The strict `^\/order\/` pattern leaves `/order-confirmed/`, `/orders/`, etc. alone.
 */
export function normalizeHref(href: string): string {
  const clean = href.startsWith("#/") ? href.slice(1) : href;
  return clean.replace(/^\/order\//, "/orders/");
}

function isAnchorOnly(href: string): boolean {
  return href.startsWith("#") && !href.startsWith("#/");
}

let navigateAction: ((to: string) => void) | null = null;

/** Mounted once inside BrowserRouter so non-component callers can navigate. */
export function RouterNavigationBridge() {
  const routerNavigate = useNavigate();
  useEffect(() => {
    navigateAction = routerNavigate;
    return () => {
      navigateAction = null;
    };
  }, [routerNavigate]);
  return null;
}

/** Imperative navigation. Works from event handlers and non-React modules. */
export function navigate(to: string) {
  const target = normalizeHref(to);
  if (navigateAction) {
    navigateAction(target);
    return;
  }
  if (isAnchorOnly(target)) window.location.hash = target;
  else window.location.assign(target);
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
  if (isAnchorOnly(href)) {
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

  return (
    <RouterLink to={normalizeHref(href)} className={className} onClick={onClick} {...rest}>
      {children}
    </RouterLink>
  );
}
