// Tiny class-name joiner. Keeps component code free of ad-hoc string
// concatenation without pulling in an extra dependency.
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
