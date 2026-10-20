import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] font-micro text-[11px] uppercase tracking-[-0.02em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-emerald/40 bg-charcoal text-white shadow-[0_10px_30px_-18px_rgba(46,207,143,0.8)] hover:border-emerald/70 hover:bg-emerald/85 hover:shadow-[0_14px_34px_-16px_rgba(46,207,143,0.9)] hover:-translate-y-0.5 active:translate-y-0",
        outline:
          "border border-frost/30 bg-transparent text-bone hover:border-emerald/60 hover:bg-white/5 hover:-translate-y-0.5 active:translate-y-0",
        ghost: "bg-transparent px-3 py-2 text-ash hover:bg-white/5 hover:text-bone",
        link: "normal-case text-emerald underline-offset-4 hover:underline",
        gold: "border border-gold/50 bg-gold/15 text-gold hover:bg-gold/25 hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        default: "min-h-10 px-5 py-2.5",
        sm: "min-h-8 px-3 text-[10px]",
        lg: "min-h-11 px-8 text-[12px]",
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
