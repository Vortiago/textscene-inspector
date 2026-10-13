/**
 * Uniform arrays that hold a Godot term for each of three's lights of a kind, by the light's slot,
 * for every lit program. They grow with the scene's lights, and a program keeps the arrays it
 * compiled with, so each write reaches every set handed out.
 */

import { installedUniformValue, installLitUniform } from './litUniform.js';

/** One array per uniform name. */
export type LightArrays<Name extends string> = Record<Name, Float32Array>;

/** Room for this many lights before the first growth. */
const INITIAL_CAPACITY = 4;

export class LightUniformArrays<Name extends string> {
  /**
   * Every set handed to the lit materials, oldest first. A material clones the newest set when it
   * compiles a program, and growth comes before any program with more lights, so each program reads
   * no further than its set holds. Written only by `growTo`.
   */
  private readonly sets: LightArrays<Name>[];

  /** `floatsPerLight` names each uniform and the floats it holds for one light. */
  constructor(private readonly floatsPerLight: Readonly<Record<Name, number>>) {
    this.sets = [this.installedSet() ?? this.createSet(INITIAL_CAPACITY)];
  }

  /** The arrays the next program to compile reads. */
  newest(): LightArrays<Name> {
    return this.sets[this.sets.length - 1]!;
  }

  /** Gives the newest arrays to every built-in lit material, for every material created after the call. */
  install(): void {
    for (const [name, array] of this.entries(this.newest())) installLitUniform(name, array);
  }

  /**
   * Grows the arrays to hold `count` lights, lets `fill` write the newest set, then copies the
   * first `count` lights into each older set as far as it holds.
   */
  write(count: number, fill: (arrays: LightArrays<Name>) => void): void {
    this.growTo(count);
    const newest = this.newest();
    fill(newest);
    for (const set of this.sets) {
      if (set === newest) continue;
      for (const [name, array] of this.entries(set)) {
        const length = Math.min(count * this.floatsPerLight[name], array.length);
        array.set(newest[name].subarray(0, length));
      }
    }
  }

  private growTo(count: number): void {
    const [name, array] = this.entries(this.newest())[0]!;
    const capacity = array.length / this.floatsPerLight[name];
    if (count <= capacity) return;
    this.sets.push(this.createSet(Math.max(count, capacity * 2)));
    this.install();
  }

  private createSet(capacity: number): LightArrays<Name> {
    const set = {} as LightArrays<Name>;
    for (const name of this.names()) set[name] = new Float32Array(capacity * this.floatsPerLight[name]);
    return set;
  }

  /** The arrays an earlier evaluation of the caller gave the lit materials, as after a dev server reloads it. */
  private installedSet(): LightArrays<Name> | null {
    const set = {} as LightArrays<Name>;
    for (const name of this.names()) {
      const array = installedUniformValue(name);
      if (!(array instanceof Float32Array)) return null;
      set[name] = array;
    }
    return set;
  }

  private names(): Name[] {
    return Object.keys(this.floatsPerLight) as Name[];
  }

  private entries(set: LightArrays<Name>): [Name, Float32Array][] {
    return this.names().map((name) => [name, set[name]]);
  }
}
