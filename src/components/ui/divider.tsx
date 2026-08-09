import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Ornamento: divisor dorado sutil (línea horizontal con centro decorativo)
const dividerVariants = cva("flex items-center justify-center w-full", {
  variants: {
    variant: {
      gold: "text-gold/40",
      subtle: "text-border-strong",
    },
    size: {
      default: "py-4",
      sm: "py-2",
      lg: "py-8",
    },
  },
  defaultVariants: {
    variant: "gold",
    size: "default",
  },
});

interface DividerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dividerVariants> {
  withOrnament?: boolean;
}

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, variant, size, withOrnament = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(dividerVariants({ variant, size }), className)}
        {...props}
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-40" />
        {withOrnament && (
          <div className="px-4 flex items-center justify-center">
            {/* Ornamento: diamante dorado pequeño */}
            <div className="w-1.5 h-1.5 rotate-45 border border-current" />
          </div>
        )}
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-40" />
      </div>
    );
  }
);
Divider.displayName = "Divider";

export { Divider, dividerVariants };
