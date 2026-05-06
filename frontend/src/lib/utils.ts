import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Split job location for display (multi-site roles). Normalizes <br>, </br>, and newlines.
 */
export function splitLocationLines(location: string | null | undefined): string[] {
  if (!location?.trim()) return [];
  const normalized = location
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/\s*br\s*>/gi, "\n")
    .replace(/<\/?details>/gi, "")
    .replace(/<\/?summary>/gi, "")
    .trim();
  return normalized
    .split(/\n+/)
    .map((s) => s.replace(/^\s*,\s*/, "").trim())
    .filter((s) => s.length > 0);
}
