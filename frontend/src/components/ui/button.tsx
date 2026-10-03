import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] font-micro text-[11px] uppercase tracking-[-0.02em] transition-opacity transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-frost focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-frost bg-charcoal px-5 py-2.5 text-white hover:opacity-85",
        outline: "border border-frost/40 bg-transparent px-5 py-2.5 text-white hover:border-frost",
        ghost: "px-3 py-2 text-white/80 hover:text-white hover:bg-white/5",
        link: "text-white underline-offset-4 hover:underline normal-case",
      },
      size: {
        default: "min-h-10",
        sm: "min-h-8 px-3 text-[10px]",
        lg: "min-h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
