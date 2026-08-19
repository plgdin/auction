import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, checked, id, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          id={id}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only opacity-0 absolute w-0 h-0"
          {...props}
        />
        <div
          onClick={() => onCheckedChange?.(!checked)}
          className={cn(
            "w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-all cursor-pointer select-none",
            checked
              ? "bg-blue-600 border-blue-600 text-white shadow-sm"
              : "bg-white border-slate-300 hover:border-blue-400 text-transparent",
            className
          )}
        >
          <Check className={cn("w-3.5 h-3.5 stroke-[3] text-white transition-transform", checked ? "scale-100 opacity-100" : "scale-50 opacity-0")} />
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
