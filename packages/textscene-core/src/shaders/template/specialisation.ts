import { bool, float, int, uint } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** The TSL literal of each type a specialisation constant can have (GLSL 4.60 §4.11). */
const LITERALS: Record<string, (value: number | boolean) => unknown> = { bool, float, int, uint } as never;

/** A specialisation constant, folded as a literal: as a uniform, SwiftShader compiles for minutes. */
export class Specialisation {
  /** Each material that reads the constant, told when a binding writes a new value. */
  readonly readers = new Set<() => void>();

  constructor(
    private readonly type: string,
    private current: number | boolean
  ) {}

  get value(): number | boolean {
    return this.current;
  }

  /** A new value tells each reader to emit its stages again, with the new literal. */
  set value(value: number | boolean) {
    if (value === this.current) return;
    this.current = value;
    for (const reader of this.readers) reader();
  }

  /** The value now, as a literal of the constant's type. */
  literal(): Node {
    const literal = LITERALS[this.type];
    if (!literal)
      throw new Error(`expected a bool, int, uint or float specialisation constant, got ${this.type}`);
    return literal(this.current) as Node;
  }
}
