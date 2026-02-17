import React from "react";
import { cn } from "@/lib/utils";

interface PageTitleProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared page title component — ensures consistent font size across all pages.
 * Matches the header "People's Foundation ERP" size (text-lg / 18px).
 */
export function PageTitle({ children, className }: PageTitleProps) {
  return (
    <h1 className={cn("text-lg font-bold tracking-tight", className)}>
      {children}
    </h1>
  );
}
