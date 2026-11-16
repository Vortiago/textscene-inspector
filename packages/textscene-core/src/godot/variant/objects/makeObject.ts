/** Thrown where Godot makes a real object, which the transpiler does not model yet. */
export class UnsupportedObject extends Error {}

/** The one place an expression makes an object; `origin` names the function and the class or path. */
export function makeObject(origin: string): never {
  throw new UnsupportedObject(`${origin} makes a Godot object, which the transpiler does not support yet`);
}
