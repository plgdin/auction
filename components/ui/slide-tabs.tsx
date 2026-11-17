import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";

export interface SlideTabsProps {
  tabs?: string[];
  defaultTab?: number;
  onTabChange?: (index: number, tab: string) => void;
  className?: string;
}

export const SlideTabs: React.FC<SlideTabsProps> = ({
  tabs = ["Home", "Pricing", "Features", "Docs", "Blog"],
  defaultTab = 0,
  onTabChange,
  className = "",
}) => {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const [selected, setSelected] = useState(defaultTab);
  const tabsRef = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    setSelected(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    const selectedTab = tabsRef.current[selected];
    if (selectedTab) {
      const { width } = selectedTab.getBoundingClientRect();
      setPosition({
        left: selectedTab.offsetLeft,
        width,
        opacity: 1,
      });
    }
  }, [selected]);

  const updateCursorToSelected = () => {
    const selectedTab = tabsRef.current[selected];
    if (selectedTab) {
      const { width } = selectedTab.getBoundingClientRect();
      setPosition({
        left: selectedTab.offsetLeft,
        width,
        opacity: 1,
      });
    }
  };

  return (
    <ul
      onMouseLeave={updateCursorToSelected}
      style={{ fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      className={`relative mx-auto flex w-fit rounded-full border border-[#493022]/20 bg-[#FAF7F2] p-1 shadow-sm ${className}`}
    >
      {tabs.map((tab, i) => (
        <Tab
          key={tab}
          ref={(el) => {
            tabsRef.current[i] = el;
          }}
          setPosition={setPosition}
          onClick={() => {
            setSelected(i);
            onTabChange?.(i, tab);
          }}
        >
          {tab}
        </Tab>
      ))}

      <Cursor position={position} />
    </ul>
  );
};

interface TabProps {
  children: React.ReactNode;
  setPosition: React.Dispatch<
    React.SetStateAction<{ left: number; width: number; opacity: number }>
  >;
  onClick: () => void;
}

const Tab = React.forwardRef<HTMLLIElement, TabProps>(
  ({ children, setPosition, onClick }, ref) => {
    return (
      <li
        ref={ref}
        onClick={onClick}
        onMouseEnter={(e) => {
          const target = e.currentTarget;
          const { width } = target.getBoundingClientRect();
          setPosition({
            left: target.offsetLeft,
            width,
            opacity: 1,
          });
        }}
        style={{ fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
        className="relative z-10 block cursor-pointer px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#493022] transition-colors md:px-5 md:py-2.5 md:text-sm"
      >
        {children}
      </li>
    );
  }
);
Tab.displayName = "Tab";

interface CursorProps {
  position: {
    left: number;
    width: number;
    opacity: number;
  };
}

const Cursor: React.FC<CursorProps> = ({ position }) => {
  return (
    <motion.li
      animate={{
        ...position,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      className="absolute z-0 h-7 rounded-full bg-[#EBE1D0] md:h-10"
    />
  );
};

export default SlideTabs;
