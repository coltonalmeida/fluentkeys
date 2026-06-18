/** Join class names, dropping falsy values. Minimal stand-in for clsx — enough
 *  for our UI primitives (no conditional objects or Tailwind conflict merging). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
