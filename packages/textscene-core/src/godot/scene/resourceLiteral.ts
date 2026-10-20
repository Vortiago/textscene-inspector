/** How a scene file spells a resource property that holds no resource. */

/** Whether a resource property holds a resource: Godot's `null` literal clears it, as absence does. */
export function holdsResource(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed !== 'null';
}
