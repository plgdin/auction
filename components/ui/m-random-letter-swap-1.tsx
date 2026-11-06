"use client";

import { RandomLetterSwap } from "@/components/ui/random-letter-swap";

export interface NavItem {
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
}

const defaultLinks: string[] = ["Home", "Work", "About", "Blog", "Contact"];

export interface RandomLetterSwapNavProps {
  links?: (string | NavItem)[];
  className?: string;
  navClassName?: string;
  itemClassName?: string;
}

export default function RandomLetterSwapNav({
  links = defaultLinks,
  className = "flex min-h-50 items-center justify-center px-6",
  navClassName = "flex items-center gap-8",
  itemClassName = "cursor-pointer font-medium text-muted-foreground text-sm hover:text-foreground",
}: RandomLetterSwapNavProps = {}) {
  return (
    <div className={className}>
      <nav className={navClassName}>
        {links.map((item) => {
          const isObject = typeof item === "object";
          const label = isObject ? item.label : item;
          const href = isObject ? item.href : undefined;
          const onClick = isObject ? item.onClick : undefined;
          const badge = isObject ? item.badge : undefined;

          const content = (
            <>
              <RandomLetterSwap
                className={itemClassName}
                label={label}
                staggerDuration={0.025}
                transition={{ duration: 0.6, type: "spring" }}
                onClick={!href ? onClick : undefined}
              />
              {badge}
            </>
          );

          if (href) {
            return (
              <a key={label} href={href} onClick={onClick} className="inline-flex items-center gap-2">
                {content}
              </a>
            );
          }

          return (
            <div key={label} className="inline-flex items-center gap-2">
              {content}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

