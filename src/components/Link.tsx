import type { AnchorHTMLAttributes, ReactNode } from "react";

export function navigate(to: string) {
  if (to.startsWith("#/")) {
    window.location.hash = to;
    return;
  }
  if (to.startsWith("#")) {
    if (window.location.hash.startsWith("#/")) {
      window.location.hash = "";
      window.setTimeout(() => document.querySelector(to)?.scrollIntoView(), 90);
    } else {
      window.location.hash = to;
      document.querySelector(to)?.scrollIntoView();
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
