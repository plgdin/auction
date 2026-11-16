import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
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

export type SelectOption = { value: string; label: string };

export function SelectMenu({
  value,
  options,
  onChange,
  placeholder = "Choose an option",
  ariaLabel,
  className = "",
  disabled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const chooseByOffset = (offset: number) => {
    if (!options.length) return;
    const current = Math.max(0, options.findIndex((option) => option.value === value));
    const next = options[(current + offset + options.length) % options.length];
    onChange(next.value);
  };

  return (
    <div className={`select-menu ${className}`} ref={root}>
      <button
        ref={trigger}
        type="button"
        className="select-menu-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) setOpen(true);
            else chooseByOffset(event.key === "ArrowDown" ? 1 : -1);
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((current) => !current);
          }
        }}
      >
        <span className={selected ? "" : "is-placeholder"}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="select-menu-popover" role="listbox" aria-label={ariaLabel ?? placeholder}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={value === option.value ? "is-selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span>{option.label}</span>
              {value === option.value && <span className="select-menu-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const pad2 = (value: number) => String(value).padStart(2, "0");
const dateValue = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export function ScheduleDateTime({
  value,
  onChange,
  label = "Choose date and time",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const selectedDate = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    selectedDate && !Number.isNaN(selectedDate.getTime())
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const root = useRef<HTMLDivElement>(null);
  const today = new Date();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const datePart = selectedDate && !Number.isNaN(selectedDate.getTime())
    ? dateValue(selectedDate)
    : "";
  const timePart = datePart
    ? `${pad2(selectedDate!.getHours())}:${pad2(selectedDate!.getMinutes())}`
    : "";
  const effectiveDate = datePart || dateValue(today);
  const times = Array.from({ length: 48 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 ? "30" : "00";
    return `${pad2(hour)}:${minute}`;
  }).filter((time) => new Date(`${effectiveDate}T${time}`).getTime() > Date.now());

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const setDate = (nextDate: string) => {
    const nextTime = timePart && new Date(`${nextDate}T${timePart}`).getTime() > Date.now()
      ? timePart
      : nextDate === dateValue(today)
        ? times[0] ?? "23:30"
        : "18:00";
    onChange(`${nextDate}T${nextTime}`);
  };

  return (
    <div className="schedule-picker" ref={root}>
      <button
        type="button"
        className="schedule-picker-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarDays size={17} aria-hidden="true" />
        <span>
          {selectedDate && !Number.isNaN(selectedDate.getTime())
            ? selectedDate.toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "Select a date and time"}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="schedule-picker-popover" role="dialog" aria-label="Choose auction start">
          <div className="schedule-calendar">
            <div className="schedule-calendar-head">
              <strong>{month.toLocaleString(undefined, { month: "long", year: "numeric" })}</strong>
              <div>
                <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={17} /></button>
                <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={17} /></button>
              </div>
            </div>
            <div className="schedule-calendar-grid" role="grid" aria-label="Calendar">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span className="schedule-calendar-weekday" key={day}>{day}</span>
              ))}
              {Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const date = new Date(month.getFullYear(), month.getMonth(), day);
                const iso = dateValue(date);
                const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                return (
                  <button
                    type="button"
                    role="gridcell"
                    key={iso}
                    aria-label={date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    aria-selected={datePart === iso}
                    disabled={isPast}
                    className={`${datePart === iso ? "is-selected" : ""} ${dateValue(today) === iso ? "is-today" : ""}`}
                    onClick={() => setDate(iso)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="schedule-time-row">
              <Clock3 size={16} aria-hidden="true" />
              <span>Start time</span>
              <SelectMenu
                value={timePart}
                options={times.map((time) => ({
                  value: time,
                  label: new Date(`2000-01-01T${time}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                }))}
                placeholder="Choose time"
                ariaLabel="Auction start time"
                onChange={(time) => onChange(`${datePart || dateValue(today)}T${time}`)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
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
    <div className="segmented-tabs">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            aria-pressed={isActive}
            className={isActive ? "is-active" : ""}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {typeof tab.count === "number" && <span>{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
