import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-bold uppercase tracking-[0.12em] transition-[transform,background-color,box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97]",
  { variants: { variant: {
    default: "bg-primary text-primary-foreground shadow-neon hover:bg-primary/90",
    outline: "border border-border bg-secondary/55 text-foreground hover:bg-accent",
    ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
    danger: "bg-destructive text-destructive-foreground shadow-danger hover:bg-destructive/90",
    destructive: "bg-destructive text-destructive-foreground shadow-danger hover:bg-destructive/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    link: "text-primary underline-offset-4 hover:underline",
  }, size: {
    default: "h-10 px-5 py-2",
    sm: "h-9 px-3",
    lg: "h-11 px-8",
    icon: "size-10 p-0",
    "icon-sm": "size-8 p-0",
    "icon-lg": "size-12 p-0",
  } }, defaultVariants: { variant: "default", size: "default" } },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Component = asChild ? Slot : "button";
  return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
