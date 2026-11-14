/**
 * The names a statement sees as the emitter walks it: each block's variables, then the
 * function's arguments. TSL builds the body of an `If` or a `Loop` later than the emitter walks
 * it, so a body reads its names from a copy taken where it stands.
 */

import type { Value } from './emitValue.js';

export class EmitScope {
  private readonly names: Map<string, Value>;

  private constructor(names: ReadonlyMap<string, Value>) {
    this.names = new Map(names);
  }

  static of(names: ReadonlyMap<string, Value>): EmitScope {
    return new EmitScope(names);
  }

  /** A block inside this one, which sees every name this one sees now. */
  child(): EmitScope {
    return new EmitScope(this.names);
  }

  declare(name: string, value: Value): void {
    this.names.set(name, value);
  }

  find(name: string): Value {
    const value = this.names.get(name);
    if (value === undefined) throw new Error(`expected a variable ${name} in scope`);
    return value;
  }
}
