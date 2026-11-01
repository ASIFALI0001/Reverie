"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

const TabsContext = createContext<{ value: string; indicatorId: string } | null>(null);

type TabsProps = {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
};

export function Tabs({ defaultValue, value: controlled, onValueChange, children, className }: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const indicatorId = useId();

  return (
    <TabsContext.Provider value={{ value, indicatorId }}>
      <TabsPrimitive.Root
        value={value}
        onValueChange={(v) => {
          setUncontrolled(v);
          onValueChange?.(v);
        }}
        className={className}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <TabsPrimitive.List
      aria-label={label}
      className={cn("relative flex gap-6 overflow-x-auto border-b border-hairline [scrollbar-width:none]", className)}
    >
      {children}
    </TabsPrimitive.List>
  );
}

/** Trigger with an underline that glides between tabs (shared layoutId). */
export function TabsTrigger({ value, children, count }: { value: string; children: ReactNode; count?: number }) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative -mb-px flex h-11 shrink-0 items-center gap-2 text-[0.9375rem] transition-colors duration-150",
        active ? "text-text" : "text-muted hover:text-text",
      )}
    >
      {children}
      {count != null && <span className="numeral text-[0.75rem] text-muted">{count}</span>}
      {active && (
        <motion.span
          layoutId={`tab-indicator-${ctx?.indicatorId}`}
          className="absolute inset-x-0 bottom-0 h-px bg-text"
          transition={spring.snappy}
        />
      )}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.Content value={value} className={cn("focus-visible:outline-none", className)}>
      {children}
    </TabsPrimitive.Content>
  );
}
