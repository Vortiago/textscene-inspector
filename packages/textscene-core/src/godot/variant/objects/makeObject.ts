import { NotPortable } from '../../notPortable.js';
/** Thrown where Godot makes an object or reads the project's uid cache, which the port does not model. */
export class UnsupportedObject extends NotPortable {
  constructor(message: string, owner: string) {
    super(message, owner);
  }
}

/** The one place an expression makes an object; `origin` names the function and the class or path. */
export function makeObject(origin: string): never {
  throw new UnsupportedObject(`${origin} makes a Godot object`, '#1953');
}

/** A uid with no file found by its path: the project's uid cache decides between null and an object. */
export function readUidCache(origin: string): never {
  throw new UnsupportedObject(`${origin} reads the project's uid cache`, '#1815');
}
