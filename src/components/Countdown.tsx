import { Clock3 } from "lucide-react";
import { countdown } from "../lib/format";
import { useNow } from "../lib/store";

export function Countdown({
  to,
  prefix,
  compact = false,
}: {
  to: string;
  prefix?: string;
  compact?: boolean;
}) {
  const now = useNow(1000);
  const state = countdown(new Date(to).getTime() - now);
  return (
    <span className={`countdown ${state.urgent ? "is-urgent" : ""} ${compact ? "is-compact" : ""}`}>
      {!compact && <Clock3 size={13} />}
      {prefix && <em>{prefix}</em>}
      {state.label}
    </span>
  );
}
