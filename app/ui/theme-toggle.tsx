"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "", inverted = false }: { className?: string; inverted?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  const label = mounted ? `Switch to ${dark ? "light" : "dark"} mode` : "Toggle color theme";

  return (
    <button
      type="button"
      className={`${inverted ? "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-[#403a44] dark:bg-[#211e24] dark:text-[#ede9ef] dark:hover:bg-[#2c2730]"} inline-flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#80628d] ${className}`}
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
