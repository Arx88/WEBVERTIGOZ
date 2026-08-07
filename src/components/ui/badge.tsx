import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-caption font-semibold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-border-subtle bg-bg-hover text-text-secondary",
        gold:
          "border-gold/40 text-gold",
        accent:
          "border-accent/40 text-accent",
        danger:
          "border-danger/40 text-danger",
        success:
          "border-success/40 text-success",
        warning:
          "border-warning/40 text-warning",
        outline:
          "border-border-strong text-text-primary",
        // Estado "live" — sin glow masivo, solo punto rojo
        live:
          "border-danger/60 text-danger bg-danger/5",
      },
      size: {
        default: "px-2 py-0.5",
        sm: "px-1.5 py-0 text-[0.625rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

// Punto rojo "live" — sin glow, solo un punto animado sutil
function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-1.5 w-1.5", className)}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-60 animate-ping" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
    </span>
  );
}

export { Badge, LiveDot, badgeVariants };
