import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-[2px] border border-frost/30 bg-void px-3 py-2 text-sm text-white ring-offset-void placeholder:text-ash/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-frost disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
