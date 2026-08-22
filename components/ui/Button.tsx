import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ComponentProps } from "react";

const buttonStyles = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "text-white hover:-translate-y-px active:translate-y-0 active:brightness-95",
        secondary: "border hover:bg-[var(--paper-sunken)] hover:-translate-y-px active:translate-y-0",
        ghost: "hover:bg-[var(--paper-sunken)]",
        outline: "border-2 hover:bg-[var(--oxblood-tint)] hover:-translate-y-px active:translate-y-0",
      },
      size: {
        sm: "text-xs px-2.5 py-1.5",
        md: "text-sm px-3.5 py-2",
        lg: "text-base px-5 py-2.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonStyles> {
  href?: string;
}

export function Button({ className, variant, size, href, style, ...props }: ButtonProps) {
  const computedStyle =
    variant === "primary"
      ? {
          backgroundImage: "linear-gradient(160deg, var(--oxblood) 0%, var(--oxblood-deep) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 2px rgba(33,28,22,0.15), 0 6px 16px color-mix(in srgb, var(--oxblood) 30%, transparent)",
          ...style,
        }
      : variant === "secondary"
        ? { borderColor: "var(--hairline)", color: "var(--ink)", boxShadow: "var(--shadow-card)", ...style }
        : variant === "outline"
          ? { borderColor: "var(--oxblood)", color: "var(--oxblood)", ...style }
          : style;

  if (href) {
    return (
      <Link href={href} className={cn(buttonStyles({ variant, size }), className)} style={computedStyle}>
        {props.children as React.ReactNode}
      </Link>
    );
  }
  return <button className={cn(buttonStyles({ variant, size }), className)} style={computedStyle} {...props} />;
}
