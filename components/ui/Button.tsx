import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ComponentProps } from "react";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "text-white shadow-sm hover:brightness-110 active:brightness-95",
        secondary: "border hover:bg-[var(--paper-sunken)]",
        ghost: "hover:bg-[var(--paper-sunken)]",
        outline: "border-2 hover:bg-[var(--oxblood-tint)]",
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
      ? { background: "var(--oxblood)", ...style }
      : variant === "secondary"
        ? { borderColor: "var(--hairline)", color: "var(--ink)", ...style }
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
