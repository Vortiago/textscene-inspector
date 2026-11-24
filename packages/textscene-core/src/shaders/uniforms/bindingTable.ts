/** One template uniform and how a frame gives its value. */
export interface Binding<Scene> {
  readonly uniform: string;
  /** Where Godot's C++ writes the value. */
  readonly godot: string;
  readonly value: (scene: Scene) => unknown;
}

/**
 * Writes each value of `uniforms` that `table` names, from `scene`. A template stage may read none.
 * @canonical write a template's uniforms from a binding table
 */
export function writeBindings<Scene>(
  table: readonly Binding<Scene>[],
  uniforms: ReadonlyMap<string, { value: unknown }>,
  scene: Scene
): void {
  for (const binding of table) {
    const node = uniforms.get(binding.uniform) as { value: unknown; array?: unknown[] } | undefined;
    if (!node) continue;
    const value = binding.value(scene);
    if (Array.isArray(value)) node.array!.splice(0, value.length, ...value);
    else node.value = value;
  }
}
