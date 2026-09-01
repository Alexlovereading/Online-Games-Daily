import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide leading-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-subtle text-subtle-foreground",
        outline: "border-border text-foreground",
        brand: "border-transparent bg-primary text-primary-foreground shadow-sm",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
