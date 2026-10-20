/** How a scene file spells a resource property that holds no resource. */

/** Whether a resource property holds a resource: Godot's `null` literal and a blank value clear it, as absence does. */
export function holdsResource(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return !!trimmed && trimmed !== 'null';
}
