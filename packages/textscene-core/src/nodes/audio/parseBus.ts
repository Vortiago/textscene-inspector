/**
 * Shared audio bus parser — accepts both plain quoted string ("Master")
 * and Godot's StringName form (&"Master"). Strips the wrapper and returns
 * the inner value. Default: "Master" (Godot's default bus).
 */

export function parseBus(raw: string | undefined): string {
  if (!raw) return 'Master';
  const trimmed = raw.startsWith('&') ? raw.slice(1) : raw;
  const match = trimmed.match(/^"(.*)"$/);
  if (match && match[1] !== undefined) return match[1];
  return trimmed;
}
