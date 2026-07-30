"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  smoothCorners,
  smoothCornersCSS,
} from "@qiuyedx/smooth-corners";
import { observe, unobserve } from "@qiuyedx/smooth-corners/observer";

import { cn } from "@/lib/utils";

type SmoothCornerVars = Record<"--sc-r" | "--sc-i" | "--sc-s", string>;
type SmoothCornerStyle = React.CSSProperties & Partial<SmoothCornerVars>;

const STYLE_ID = "qiuye-ui-smooth-corners-style";

export const smoothCornersBaseCSS = smoothCornersCSS;

function ensureSmoothCornersStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = smoothCornersCSS;
  document.head.append(style);
}

function useSmoothCornersStyles() {
  React.useInsertionEffect(() => {
    ensureSmoothCornersStyles();
  }, []);
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref && "current" in ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T | null) => {
    for (const ref of refs) {
      assignRef(ref, value);
    }
  };
}

function normalizeNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export interface SmoothCornersProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "style"> {
  radius?: number;
  smoothing?: number;
  observeSize?: boolean;
  asChild?: boolean;
  disabled?: boolean;
  style?: SmoothCornerStyle;
}

export const SmoothCorners = React.forwardRef<HTMLElement, SmoothCornersProps>(
  (
    {
      radius = 16,
      smoothing = 0.6,
      observeSize = false,
      asChild = false,
      disabled = false,
      className,
      style,
      ...props
    },
    forwardedRef
  ) => {
    useSmoothCornersStyles();

    const localRef = React.useRef<HTMLElement | null>(null);
    const normalizedRadius = normalizeNumber(radius, 16);
    const normalizedSmoothing = normalizeNumber(smoothing, 0.6);

    const vars = React.useMemo<SmoothCornerStyle>(() => {
      if (disabled) return {};
      return smoothCorners(
        normalizedRadius,
        normalizedSmoothing
      ) as SmoothCornerStyle;
    }, [disabled, normalizedRadius, normalizedSmoothing]);

    React.useEffect(() => {
      const element = localRef.current;
      if (!element || disabled || !observeSize) return;

      observe(element, {
        radius: normalizedRadius,
        smoothing: normalizedSmoothing,
      });

      return () => {
        unobserve(element);
      };
    }, [disabled, normalizedRadius, normalizedSmoothing, observeSize]);

    const Component = asChild ? Slot : "div";

    return (
      <Component
        ref={composeRefs(localRef, forwardedRef)}
        className={cn(!disabled && "smooth-corners", className)}
        style={{ ...style, ...vars }}
        {...props}
      />
    );
  }
);

SmoothCorners.displayName = "SmoothCorners";
