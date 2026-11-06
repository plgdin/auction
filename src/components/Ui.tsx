import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "./Link";
import { conditionLabel } from "../lib/format";

export function StatusPill({
  status,
  tone,
}: {
  status: string;
  tone?: "live" | "muted" | "warm" | "good" | "bad" | "neutral";
}) {
  const resolved =
    tone ??
    (["active", "paid", "delivered", "completed", "accepted", "captured"].includes(status)
      ? "good"
      : ["pending", "pending_payment", "processing", "scheduled", "awaiting_pickup"].includes(status)
        ? "warm"
        : ["cancelled", "rejected", "expired", "failed", "sold", "removed", "blocked", "returned"].includes(status)
          ? "bad"
          : status === "live"
            ? "live"
            : "neutral");
  return (
    <span className={`status-pill status-${resolved}`}>
      {resolved === "live" && <i />}
      {conditionLabel(status)}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  actionHref,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <div className="empty-state page-empty">
      {icon}
      <h2>{title}</h2>
      <p>{body}</p>
      {action && actionHref && (
        <Link href={actionHref} className="button button-olive">
          {action}
        </Link>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <div className="segmented-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={active === tab.id ? activeRef : undefined}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? "is-active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {typeof tab.count === "number" && <span>{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
