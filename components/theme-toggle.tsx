"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/providers";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "claro" : "oscuro";

  return (
    <button
      className="theme-toggle"
      type="button"
      role="switch"
      aria-checked={theme === "dark"}
      aria-label={`Cambiar a modo ${nextTheme}`}
      title={`Cambiar a modo ${nextTheme}`}
      onClick={toggleTheme}
    >
      {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{theme === "dark" ? "Oscuro" : "Claro"}</span>
    </button>
  );
}