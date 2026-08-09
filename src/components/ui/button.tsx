"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold uppercase tracking-wider text-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primario — fondo blanco roto, texto casi negro
        default:
          "bg-text-primary text-bg hover:bg-text-primary/90",
        // Secundario — borde dorado sutil
        secondary:
          "border border-gold/60 text-gold hover:border-gold hover:bg-gold/5",
        // Outline — borde fuerte
        outline:
          "border border-border-strong text-text-primary hover:border-text-secondary hover:bg-bg-hover",
        // Ghost — sin borde, solo hover
        ghost:
          "text-text-secondary hover:text-text-primary hover:bg-bg-hover",
        // Danger — alertas
        danger:
          "bg-danger text-white hover:bg-danger-hover",
        // Success — confirmaciones
        success:
          "bg-success text-bg hover:bg-success-hover",
        // Premium — dorado, para acciones únicas
        premium:
          "bg-gold text-bg hover:bg-gold-hover",
        // Link — sin estilo de botón
        link:
          "text-gold underline-offset-4 hover:underline tracking-normal normal-case font-normal",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        default: "h-11 px-6",
        lg: "h-12 px-8 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
