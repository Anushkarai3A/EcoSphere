import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("font-micro text-[10px] uppercase leading-none tracking-[0.16em] text-ash peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  );
}
