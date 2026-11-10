/**
 * Godot's `RandomPCG`, ported bit-exactly: a stream that differs by one draw gives a different
 * result, so a uniform substitute is wrong. Shared by the CPU particle emitters and the scene tile
 * placeholder colours.
 *
 * Derived from Godot Engine (`core/math/random_pcg.h` and `thirdparty/misc/pcg.cpp`). The Godot
 * portions are used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * The PCG algorithm itself (`pcg32_random_r` / `pcg32_srandom_r`) originates
 * with pcg-random.org and is Apache-2.0 licensed; Godot vendors it under
 * `thirdparty/misc/`. See THIRD-PARTY-NOTICES.md.
 */

const PCG_MULTIPLIER = 6364136223846793005n;
/** `PCG_DEFAULT_INC_64`, the stream selector `RandomPCG` never changes. */
const PCG_DEFAULT_INC_64 = 1442695040888963407n;
const UINT64_MASK = 0xffffffffffffffffn;

/**
 * Godot's `RandomPCG` over the vendored minimal PCG32 (XSH-RR, 64-bit state, 32-bit output),
 * exposing only `seed`, `rand` and `randf`. The particle emitters re-seed it per particle at birth
 * (`cpu_particles_2d.cpp:922`, `cpu_particles_3d.cpp:832`).
 */
export class GodotRandomPCG {
  private state = 0n;
  /** `pcg.inc`, fixed by `pcg32_srandom_r` to `(DEFAULT_INC << 1) | 1`. */
  private readonly inc = ((PCG_DEFAULT_INC_64 << 1n) | 1n) & UINT64_MASK;

  constructor(seed: number | bigint = 0) {
    this.seed(seed);
  }

  /**
   * `pcg32_srandom_r(&pcg, seed, DEFAULT_INC)`: start from zero state, step once,
   * add the seed, step again. The two warm-up steps stop a small seed (a particle
   * index) from giving neighbouring particles a near-identical first draw.
   */
  seed(seed: number | bigint): void {
    this.state = 0n;
    this.step();
    this.state = (this.state + (BigInt(seed) & UINT64_MASK)) & UINT64_MASK;
    this.step();
  }

  /** `RandomPCG::rand()`: one `pcg32_random_r` output word, a `uint32`. */
  rand(): number {
    return this.step();
  }

  /**
   * `RandomPCG::randf()`, not `rand() / 2^32`: Godot builds the float from two
   * draws, the first giving a binary exponent through its leading-zero count and
   * the second the mantissa. One draw would desynchronise every later value.
   */
  randf(): number {
    const protoExponent = this.step();
    if (protoExponent === 0) return 0;
    const significand = (this.step() | 0x80000001) >>> 0;
    // `std::ldexp((float)significand, -32 - CLZ32(proto))`. The float32 cast is
    // observable: the significand carries 32 bits and a float keeps 24.
    return Math.fround(significand) * 2 ** (-32 - Math.clz32(protoExponent));
  }

  /** `pcg32_random_r`: advance the state, return the XSH-RR output word. */
  private step(): number {
    const old = this.state;
    this.state = (old * PCG_MULTIPLIER + (this.inc | 1n)) & UINT64_MASK;
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn) >>> 0;
    const rot = Number((old >> 59n) & 31n);
    return ((xorshifted >>> rot) | (xorshifted << ((0 - rot) & 31))) >>> 0;
  }
}
