import * as React from "react";
import { cn } from "@/lib/utils";

function Pagination({ className, ...props }) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("flex w-full justify-center", className)}
      {...props}
    />
  );
}

const PaginationContent = React.forwardRef(function PaginationContent(
  { className, ...props },
  ref
) {
  return (
    <ul
      ref={ref}
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
});

const PaginationItem = React.forwardRef(function PaginationItem(
  { className, ...props },
  ref
) {
  return <li ref={ref} className={cn("", className)} {...props} />;
});

function PaginationLink({ className, isActive, ...props }) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-brand-brown px-3 text-sm font-semibold text-brand-blue transition hover:bg-brand-orange/10",
        isActive && "bg-brand-blue text-brand-cream",
        className
      )}
      {...props}
    />
  );
}

function PaginationEllipsis({ className, ...props }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex h-9 min-w-9 items-center justify-center", className)}
      {...props}
    >
      …
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
};
