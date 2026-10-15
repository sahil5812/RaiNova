"use client";

import React from "react";
import { clsx } from "clsx";

// ===== NeuCard =====
interface NeuCardProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  as?: "div" | "button" | "section";
}

export function NeuCard({ children, className, size = "md", onClick, as: Tag = "div" }: NeuCardProps) {
  const sizeClass = size === "sm" ? "nm-card-sm" : size === "lg" ? "nm-card-lg" : "nm-card";
  return (
    <Tag
      className={clsx(sizeClass, "p-4", onClick && "cursor-pointer active:scale-[0.98] transition-transform", className)}
      onClick={onClick}
    >
      {children}
    </Tag>
  );
}

// ===== NeuButton =====
interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "accent" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export function NeuButton({
  variant = "default",
  size = "md",
  icon,
  iconRight,
  fullWidth,
  children,
  className,
  ...props
}: NeuButtonProps) {
  const variantClass = {
    default: "nm-btn text-[var(--nm-text)]",
    accent: "nm-btn-accent text-white",
    danger: "nm-btn-danger text-white",
    ghost: "bg-transparent text-[var(--nm-text-muted)] hover:text-[var(--nm-accent)] transition-colors",
  }[variant];

  const sizeClass = {
    sm: "px-4 py-2 text-xs gap-1.5",
    md: "px-5 py-3 text-sm gap-2",
    lg: "px-6 py-3.5 text-sm gap-2",
  }[size];

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-semibold transition-all",
        "rounded-full select-none active:scale-[0.97]",
        variantClass,
        sizeClass,
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}

// ===== NeuIconButton =====
interface NeuIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: "sm" | "md";
}

export function NeuIconButton({ children, active, size = "md", className, ...props }: NeuIconButtonProps) {
  return (
    <button
      className={clsx(
        "nm-icon-btn transition-all select-none",
        size === "sm" ? "w-8 h-8 rounded-[8px]" : "w-10 h-10 rounded-[10px]",
        active && "active",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ===== NeuToggle =====
interface NeuToggleProps<T extends string> {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function NeuToggle<T extends string>({ options, value, onChange, className }: NeuToggleProps<T>) {
  return (
    <div className={clsx("nm-toggle", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={clsx("nm-toggle-opt flex items-center gap-1", value === opt.value && "active")}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ===== NeuInput =====
interface NeuInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  error?: string;
}

export function NeuInput({ label, icon, iconRight, error, className, ...props }: NeuInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="nm-caption font-semibold text-[var(--nm-text-muted)] pl-1">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--nm-text-subtle)]">
            {icon}
          </span>
        )}
        <input
          className={clsx(
            "nm-input",
            icon && "pl-10",
            iconRight && "pr-10",
            error && "border-[var(--nm-high)] focus:border-[var(--nm-high)]",
            className
          )}
          {...props}
        />
        {iconRight && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nm-text-subtle)]">
            {iconRight}
          </span>
        )}
      </div>
      {error && <p className="text-[11px] text-[var(--nm-high)] pl-1">{error}</p>}
    </div>
  );
}
