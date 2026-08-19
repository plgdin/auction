import * as React from "react"
import { cn } from "@/lib/utils"

export function Select({ value, onValueChange, children }: any) {
  const trigger = React.Children.toArray(children).find(
    (c: any) => c.type === SelectTrigger || c.type?.displayName === "SelectTrigger"
  ) as any;
  const content = React.Children.toArray(children).find(
    (c: any) => c.type === SelectContent || c.type?.displayName === "SelectContent"
  ) as any;

  const options = content ? React.Children.toArray(content.props.children) : [];

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        className={cn(
          "w-full px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-semibold text-slate-700 appearance-none cursor-pointer pr-10",
          trigger?.props?.className
        )}
      >
        {options.map((opt: any) => (
          <option key={opt.props.value} value={opt.props.value}>
            {opt.props.children}
          </option>
        ))}
      </select>
      <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 text-xs">
        ▼
      </span>
    </div>
  )
}

export function SelectTrigger(_props: any) {
  return null;
}
SelectTrigger.displayName = "SelectTrigger"

export function SelectValue(_props: any) {
  return null;
}
SelectValue.displayName = "SelectValue"

export function SelectContent({ children }: any) {
  return <>{children}</>;
}
SelectContent.displayName = "SelectContent"

export function SelectItem({ value, children }: any) {
  return <option value={value}>{children}</option>;
}
SelectItem.displayName = "SelectItem"
