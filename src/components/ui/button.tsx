import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-display text-sm font-semibold tracking-tight transition-[transform,box-shadow,background-color,color] duration-75 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default:
          "border-2 border-ink bg-primary text-primary-foreground shadow-toy-sm hover:brightness-[1.03] active:translate-y-[2.5px] active:shadow-none",
        cobalt:
          "border-2 border-ink bg-[#2563EB] text-white shadow-toy-sm hover:bg-[#1D4ED8] active:translate-y-[2.5px] active:shadow-none dark:bg-[#3B82F6] dark:text-[#0B1220] dark:hover:bg-[#60A5FA]",
        destructive:
          "border-2 border-ink bg-destructive text-destructive-foreground shadow-toy-sm hover:brightness-105 active:translate-y-[2.5px] active:shadow-none",
        outline:
          "border-2 border-ink bg-card text-foreground shadow-toy-sm hover:bg-accent active:translate-y-[2.5px] active:shadow-none",
        secondary:
          "border-2 border-ink bg-secondary text-secondary-foreground shadow-toy-sm hover:brightness-95 dark:hover:brightness-110 active:translate-y-[2.5px] active:shadow-none",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
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
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
