/** A material's class: ORMMaterial3D sets the `orm` bit of Godot's material key. */
export type MaterialClass = 'StandardMaterial3D' | 'ORMMaterial3D';

/** The material properties that differ from Godot's defaults, under Godot's names. */
export type MaterialSettings = Readonly<Record<string, boolean | number>>;

/** The shading language text `BaseMaterial3D::_update_shader` writes for a material (`material.cpp:685`). */
export function baseMaterialShader(_materialClass: MaterialClass, _settings: MaterialSettings): string {
  return '';
}
