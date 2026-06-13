// @ts-nocheck
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { Dropdown as AntdDropdown } from "antd";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  ...props
}: CalendarProps) {
  const defaultClassNames = {
    months: "relative flex flex-col sm:flex-row gap-4 p-3",
    month: "w-full",
    month_caption: "relative mx-10 mb-2 flex h-9 items-center justify-center z-20",
    caption_label: "text-sm font-semibold text-slate-800",
    dropdowns: "flex items-center gap-1.5 justify-center w-full my-1.5",
    dropdown: "absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10",
    dropdown_root: "relative inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-xs font-semibold px-2 py-1 select-none shadow-xs gap-1 cursor-pointer min-w-[70px] h-8",
    months_dropdown: "months-dropdown",
    years_dropdown: "years-dropdown",
    nav: "absolute top-3 left-3 right-3 flex justify-between z-10",
    button_previous: cn(
      buttonVariants({ variant: "ghost" }),
      "size-9 text-muted-foreground/80 hover:text-foreground p-0 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-xs cursor-pointer",
    ),
    button_next: cn(
      buttonVariants({ variant: "ghost" }),
      "size-9 text-muted-foreground/80 hover:text-foreground p-0 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-xs cursor-pointer",
    ),
    weekday: "size-9 p-0 text-xs font-semibold text-slate-400 text-center align-middle",
    day_button: cn(
      "relative flex size-9 items-center justify-center whitespace-nowrap rounded-lg p-0 text-slate-700 outline-offset-2 transition-all duration-150 focus:outline-none focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 cursor-pointer",
      // Hover state
      "hover:bg-slate-100 hover:text-slate-900",
      // Selected state (endpoints: start & end)
      "group-data-[selected]:bg-primary-100 group-data-[selected]:text-primary-900 group-data-[selected]:font-semibold",
      // Hover when selected
      "group-data-[selected]:hover:bg-primary-200 group-data-[selected]:hover:text-primary-950",
      // Range middle background & text
      "group-data-[selected]:group-[.range-middle]:bg-primary-50/60 group-data-[selected]:group-[.range-middle]:text-primary-800 group-data-[selected]:group-[.range-middle]:font-medium",
      // Range middle hover
      "group-data-[selected]:group-[.range-middle]:hover:bg-primary-100/70 group-data-[selected]:group-[.range-middle]:hover:text-primary-900",
      // Corner roundness adjustments for range
      "group-[.range-start:not(.range-end)]:rounded-r-none",
      "group-[.range-end:not(.range-start)]:rounded-l-none",
      "group-[.range-middle]:rounded-none"
    ),
    day: "group size-9 px-0 text-sm",
    range_start: "range-start",
    range_end: "range-end",
    range_middle: "range-middle",
    today: "relative [&_button]:after:absolute [&_button]:after:bottom-1 [&_button]:after:left-1/2 [&_button]:after:-translate-x-1/2 [&_button]:after:w-1 [&_button]:after:h-1 [&_button]:after:bg-primary [&_button]:after:rounded-full [&_button]:text-primary [&_button]:font-bold",
    outside: "text-muted-foreground/40",
    hidden: "invisible",
    week_number: "size-9 p-0 text-xs font-medium text-muted-foreground/80",
  };

  const mergedClassNames = Object.keys(defaultClassNames).reduce(
    (acc, key) => ({
      ...acc,
      [key]: classNames?.[key as keyof typeof classNames]
        ? cn(
            defaultClassNames[key as keyof typeof defaultClassNames],
            classNames[key as keyof typeof classNames],
          )
        : defaultClassNames[key as keyof typeof defaultClassNames],
    }),
    {}
  );

  const defaultComponents = {
    Chevron: ({ orientation, ...props }: any) => {
      if (orientation === "left") {
        return <ChevronLeft size={16} strokeWidth={2} {...props} aria-hidden="true" />;
      }
      if (orientation === "right") {
        return <ChevronRight size={16} strokeWidth={2} {...props} aria-hidden="true" />;
      }
      if (orientation === "down") {
        return <ChevronDown size={16} strokeWidth={2} {...props} aria-hidden="true" />;
      }
      if (orientation === "up") {
        return <ChevronUp size={16} strokeWidth={2} {...props} aria-hidden="true" />;
      }
      return <ChevronRight size={16} strokeWidth={2} {...props} aria-hidden="true" />;
    },
    Dropdown: ({ options, value, onChange, className, ...props }: any) => {
      const isYearDropdown = (options || []).some((opt: any) => /^\d{4}$/.test(String(opt.label)));

      if (isYearDropdown) {
        const [inputValue, setInputValue] = React.useState(String(value));

        React.useEffect(() => {
          setInputValue(String(value));
        }, [value]);

        // Generate a robust range of years from 2018 to 2038
        const customYears = [];
        for (let y = 2018; y <= 2038; y++) {
          customYears.push({ value: y, label: String(y) });
        }

        const isSearching = inputValue !== String(value);
        const filteredOptions = isSearching
          ? customYears.filter((opt: any) =>
              String(opt.label).toLowerCase().includes(inputValue.toLowerCase())
            )
          : customYears;

        const menu = {
          items: filteredOptions.map((opt: any) => ({
            key: String(opt.value),
            label: (
              <span className={cn(
                "block px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                String(value) === String(opt.value) 
                  ? "font-bold text-primary bg-primary-50/70" 
                  : "text-slate-700 hover:text-primary hover:bg-slate-50"
              )}>
                {opt.label}
              </span>
            ),
            disabled: opt.disabled,
            onClick: () => {
              onChange?.({ target: { value: opt.value } } as any);
            }
          }))
        };

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value;
          setInputValue(val);
          
          const numericYear = parseInt(val, 10);
          if (!isNaN(numericYear) && numericYear >= 1900 && numericYear <= 2100) {
            onChange?.({ target: { value: numericYear } } as any);
          }
        };

        const handleBlur = () => {
          setTimeout(() => {
            setInputValue(String(value));
          }, 200);
        };

        const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
          e.target.select();
        };

        return (
          <AntdDropdown 
            menu={menu} 
            trigger={['click']} 
            placement="bottomLeft"
            overlayClassName="calendar-dropdown-overlay"
            getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
            dropdownRender={(menu) => (
              <div className="max-h-60 overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200 custom-scrollbar z-50">
                {menu}
              </div>
            )}
          >
            <div className="relative inline-flex items-center w-20">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                className="w-full px-2 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/50 hover:border-slate-350 focus:bg-white focus:border-primary transition-all text-xs font-bold text-slate-700 shadow-2xs text-center h-9 pr-6 outline-none"
                placeholder="Year"
              />
              <ChevronDown size={14} className="text-slate-450 absolute right-2 pointer-events-none" />
            </div>
          </AntdDropdown>
        );
      }

      // Month dropdown or other
      const menu = {
        items: (options || []).map((opt: any) => ({
          key: String(opt.value),
          label: (
            <span className={cn(
              "block px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
              String(value) === String(opt.value) 
                ? "font-bold text-primary bg-primary-50/70" 
                : "text-slate-700 hover:text-primary hover:bg-slate-50"
            )}>
              {opt.label}
            </span>
          ),
          disabled: opt.disabled,
          onClick: () => {
            onChange?.({ target: { value: opt.value } } as any);
          }
        }))
      };

      const selectedOption = (options || []).find((opt: any) => String(opt.value) === String(value));

      return (
        <AntdDropdown 
          menu={menu} 
          trigger={['click']} 
          placement="bottomLeft"
          overlayClassName="calendar-dropdown-overlay"
          getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
          dropdownRender={(menu) => (
            <div className="max-h-60 overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200 custom-scrollbar z-50">
              {menu}
            </div>
          )}
        >
          <button
            type="button"
            className="inline-flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/50 hover:border-slate-350 transition-all text-xs font-bold text-slate-700 shadow-2xs cursor-pointer h-9 min-w-[85px] outline-none"
          >
            <span>{selectedOption?.label || value}</span>
            <ChevronDown size={14} className="text-slate-450 shrink-0" />
          </button>
        </AntdDropdown>
      );
    }
  };

  const mergedComponents = {
    ...defaultComponents,
    ...userComponents,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-fit", className)}
      classNames={mergedClassNames}
      components={mergedComponents}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
