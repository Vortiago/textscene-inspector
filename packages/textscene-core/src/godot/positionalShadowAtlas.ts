/**
 * Godot's positional shadow atlas: the slot an omni or spot light's shadow takes in its viewport's
 * atlas, which decides the map's resolution, and the PCF kernel an omni light samples in that slot.
 * Each viewport owns one atlas (`servers/rendering/renderer_viewport.cpp:961`).
 */

/**
 * The root viewport's atlas side: `rendering/lights_and_shadows/positional_shadow/atlas_size`
 * defaults to 4096 (`scene/main/scene_tree.cpp:2130`, applied at `:2138`). A `.tscn` does not record
 * the project settings, so the default stands. The editor's 3D viewport takes the same setting
 * (`editor/scene/3d/node_3d_editor_plugin.cpp:3157`).
 */
export const POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT = 4096;

/** A `Viewport`'s own atlas side, which a SubViewport keeps (`scene/main/viewport.h:305`). */
export const VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT = 2048;

/**
 * The shadow count of each `PositionalShadowAtlasQuadrantSubdiv` value, from Disabled to 1024
 * Shadows (`scene/main/viewport.cpp:1420`).
 */
export const POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS = [0, 1, 4, 16, 64, 256, 1024] as const;

/**
 * The quadrant subdivisions, as `PositionalShadowAtlasQuadrantSubdiv` values: 4, 4, 16 and 64
 * shadows. The root takes them from the project settings (`scene_tree.cpp:2133-2136`), and a
 * `Viewport` sets the same values itself (`viewport.cpp:5363-5366`).
 */
export const POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT = [2, 2, 3, 4] as const;

/**
 * How long, in milliseconds, a slot stays with its light before the atlas may move the light or
 * give the slot to another light (`servers/rendering/renderer_rd/storage_rd/light_storage.h:383`).
 */
export const POSITIONAL_SHADOW_REALLOC_TOLERANCE_MSEC = 500;

/** A viewport's atlas: its side in texels and each quadrant's shadow count. */
export interface PositionalShadowAtlasSettings {
  size: number;
  quadrantShadows: readonly number[];
}

/** The root viewport's atlas at the project defaults. */
export const ROOT_POSITIONAL_SHADOW_ATLAS: PositionalShadowAtlasSettings = {
  size: POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
  quadrantShadows: POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT.map(
    (subdiv) => POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS[subdiv]
  ),
};

/**
 * A viewport's atlas from its `positional_shadow_atlas_size` and `positional_shadow_atlas_quad_0` to
 * `_3`, each absent where the `.tscn` leaves the default. The server refuses a negative size
 * (`light_storage.cpp:2158`), and the setter a subdivision outside the enum
 * (`viewport.cpp:1412-1413`), so either keeps the default.
 */
export function viewportPositionalShadowAtlas(
  size: number | undefined,
  quadrantSubdivs: readonly (number | undefined)[]
): PositionalShadowAtlasSettings {
  const quadrantShadows = POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT.map((fallback, quadrant) => {
    const subdiv = quadrantSubdivs[quadrant];
    const shadows =
      subdiv !== undefined && Number.isInteger(subdiv)
        ? POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS[subdiv]
        : undefined;
    return shadows ?? POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS[fallback];
  });
  const isServerSize = size !== undefined && Number.isFinite(size) && size >= 0;
  return { size: isServerSize ? size : VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT, quadrantShadows };
}

/**
 * `next_power_of_2` (`core/typedefs.h:179-192`) on a `uint32_t`: zero stays zero, and a fraction
 * truncates first.
 */
function nextPowerOfTwo(value: number): number {
  const whole = Math.trunc(value);
  if (whole <= 0) return 0;
  let power = 1;
  while (power < whole) power *= 2;
  return power;
}

/**
 * A quadrant's slots per axis: the shadow count rounded up to a power of two with an integer square
 * root (`servers/rendering/renderer_rd/storage_rd/light_storage.cpp:2196-2201`). Zero leaves the
 * quadrant unused.
 */
export function positionalShadowQuadrantSubdivision(shadows: number): number {
  let count = nextPowerOfTwo(shadows);
  // `0xaaaaaaaa` holds the odd bit positions: an odd power of two has no integer square root.
  if (Math.log2(count) % 2 === 1) count *= 2;
  return Math.trunc(Math.sqrt(count));
}

/**
 * The atlas stores 16-bit depth: `rendering/lights_and_shadows/positional_shadow/atlas_16_bits`
 * defaults to true (`servers/rendering/rendering_server.cpp:3712`), as does a `Viewport`'s own
 * setting (`scene/main/viewport.h:306`), and that picks `DATA_FORMAT_D16_UNORM`
 * (`light_storage.cpp:2531-2533`).
 */
export const POSITIONAL_SHADOW_ATLAS_DEPTH_BITS = 16;

/**
 * The side of each cube face an omni light renders before Godot copies the cube into its two slots,
 * one paraboloid per slot (`render_forward_clustered.cpp:2680`, `:2732-2734`). The default
 * `omni_shadow_mode` is Cube (`scene/3d/light_3d.cpp:647-650`). A paraboloid's texel at the pole
 * spans the same angle as a cube face's at its centre.
 */
export function omniShadowCubeSize(slotSize: number): number {
  return slotSize / 2;
}

/** A light that asks the atlas for a slot in one render. */
export interface PositionalShadowRequest<Owner> {
  owner: Owner;
  /** An omni light takes two neighbouring slots, one per paraboloid (`light_storage.cpp:2480-2490`). */
  isOmni: boolean;
  /** The share of the screen the light covers (`renderer_scene_cull.cpp:3405-3467`). */
  coverage: number;
}

interface Slot<Owner> {
  owner: Owner | null;
  allocTick: number;
}

interface Quadrant<Owner> {
  subdivision: number;
  slots: Slot<Owner>[];
}

/** Where a light's shadow lies in its viewport's atlas, in texels. The atlas shares it unchanged. */
export interface PositionalShadowSlot {
  /** The slot's corner nearest the atlas's origin. */
  readonly x: number;
  readonly y: number;
  /** The slot's side. */
  readonly size: number;
  /**
   * For an omni light, the step in slots from the slot of its first paraboloid to that of its
   * second: the next slot, or the first of the next row after a row's last slot
   * (`light_storage.h:683-691`). Null for a spot light.
   */
  readonly paraboloidStep: readonly [number, number] | null;
}

/** The slots a light claims: the first one's quadrant and index, and its neighbour for an omni light. */
interface Claim {
  quadrant: number;
  slot: number;
  isOmni: boolean;
}

/** A claim and where it lies, laid out once when the light claims it and dropped when it is freed. */
interface Ownership extends Claim {
  layout: PositionalShadowSlot;
}

/** The quadrant and first slot a search found. */
interface Found {
  quadrant: number;
  slot: number;
}

/**
 * One viewport's atlas and the slots its lights own, kept from render to render as Godot keeps them
 * (`light_storage.cpp:2155-2509`). An owner is any value that names one light.
 */
export class PositionalShadowAtlas<Owner> {
  /** The atlas's side in texels, a power of two (`light_storage.cpp:2159`). */
  readonly size: number;
  private readonly quadrants: Quadrant<Owner>[] = [0, 1, 2, 3].map(() => ({ subdivision: 0, slots: [] }));
  private readonly sizeOrder = [0, 1, 2, 3];
  private smallestSubdiv = 0;
  private readonly owners = new Map<Owner, Ownership>();
  /** The scene pass that last saw each light, Godot's `last_scene_pass`. */
  private readonly lastScenePass = new Map<Owner, number>();
  private scenePass = 0;

  constructor(settings: PositionalShadowAtlasSettings) {
    this.size = nextPowerOfTwo(settings.size);
    settings.quadrantShadows.forEach((shadows, quadrant) => this.setQuadrantShadows(quadrant, shadows));
  }

  /**
   * One render, Godot's scene pass: every requesting light is marked seen first, as the cull does
   * (`renderer_scene_cull.cpp:2856-2860`), and then each asks for a slot in order
   * (`:3392-3498`). `tickMsec` is the render's clock, which the reallocation tolerance reads.
   */
  allocate(requests: readonly PositionalShadowRequest<Owner>[], tickMsec: number): void {
    this.scenePass++;
    // Only a slot's owner is ever asked when it was last seen.
    for (const owner of this.lastScenePass.keys())
      if (!this.owners.has(owner)) this.lastScenePass.delete(owner);
    for (const { owner } of requests) this.lastScenePass.set(owner, this.scenePass);
    for (const request of requests) this.updateLight(request, tickMsec);
  }

  /** The slot `owner` holds, or null when it holds none. */
  slot(owner: Owner): PositionalShadowSlot | null {
    return this.owners.get(owner)?.layout ?? null;
  }

  /** Frees a light's slots, as freeing the light instance does. */
  release(owner: Owner): void {
    this.lastScenePass.delete(owner);
    this.evict(owner);
  }

  /**
   * Every light that holds a slot, read live from the atlas. A `Map` iterator survives the deletion
   * of the entry it stands on, so the caller may release each light it visits.
   */
  ownersHoldingSlots(): IterableIterator<Owner> {
    return this.owners.keys();
  }

  /** `light_instance_get_shadow_atlas_rect` (`light_storage.h:663-697`) in texels. */
  private layoutOf({ quadrant, slot, isOmni }: Claim): PositionalShadowSlot {
    const { subdivision } = this.quadrants[quadrant]!;
    const quadSize = this.quadSize();
    const size = Math.trunc(quadSize / subdivision);
    const isRowEnd = (slot + 1) % subdivision === 0;
    return {
      x: (quadrant & 1) * quadSize + (slot % subdivision) * size,
      y: (quadrant >> 1) * quadSize + Math.trunc(slot / subdivision) * size,
      size,
      paraboloidStep: isOmni ? (isRowEnd ? [1 - subdivision, 1] : [1, 0]) : null,
    };
  }

  /** `shadow_atlas->size >> 1` (`light_storage.cpp:2382`): integer division, as every slot size. */
  private quadSize(): number {
    return Math.trunc(this.size / 2);
  }

  /** `shadow_atlas_set_quadrant_subdivision` (`light_storage.cpp:2189-2253`) on an empty atlas. */
  private setQuadrantShadows(quadrant: number, shadows: number): void {
    const subdivision = positionalShadowQuadrantSubdivision(shadows);
    const target = this.quadrants[quadrant];
    if (!target || target.subdivision === subdivision) return;
    target.subdivision = subdivision;
    target.slots = Array.from({ length: subdivision * subdivision }, () => ({ owner: null, allocTick: 0 }));
    const used = this.quadrants.map((q) => q.subdivision).filter((s) => s > 0);
    this.smallestSubdiv = used.length > 0 ? Math.min(...used) : 0;
    this.sortSizeOrder();
  }

  /** The bubble sort at `light_storage.cpp:2240-2252`: most subdivided, so smallest slots, first. */
  private sortSizeOrder(): void {
    let swaps;
    do {
      swaps = 0;
      for (let i = 0; i < 3; i++) {
        const here = this.sizeOrder[i]!;
        const next = this.sizeOrder[i + 1]!;
        if (this.quadrants[here]!.subdivision < this.quadrants[next]!.subdivision) {
          this.sizeOrder[i] = next;
          this.sizeOrder[i + 1] = here;
          swaps++;
        }
      }
    } while (swaps > 0);
  }

  /** `shadow_atlas_update_light` (`light_storage.cpp:2373-2499`). */
  private updateLight({ owner, isOmni, coverage }: PositionalShadowRequest<Owner>, tick: number): void {
    if (this.size === 0 || this.smallestSubdiv === 0) return;
    const quadSize = this.quadSize();
    const { validQuadrants, bestSubdiv } = this.fittingQuadrants(
      this.desiredFit(quadSize, coverage),
      quadSize
    );

    const old = this.owners.get(owner);
    let oldSubdivision = -1;
    if (old) {
      const oldSlot = this.quadrants[old.quadrant]!.slots[old.slot]!;
      const shouldRealloc =
        this.quadrants[old.quadrant]!.subdivision !== bestSubdiv &&
        tick - oldSlot.allocTick > POSITIONAL_SHADOW_REALLOC_TOLERANCE_MSEC;
      if (!shouldRealloc) return;
      oldSubdivision = this.quadrants[old.quadrant]!.subdivision;
    }

    const found = isOmni
      ? this.findOmniSlots(validQuadrants, oldSubdivision, tick)
      : this.findSlot(validQuadrants, oldSubdivision, tick);
    if (!found) return;
    if (old) this.freeSlots(old);
    this.claim(owner, { ...found, isOmni }, tick);
  }

  /**
   * `light_storage.cpp:2384`: the coverage of a quadrant, rounded up to a power of two and capped at
   * the largest slot. Zero, a negative coverage or NaN asks for nothing. The cap is a power of two,
   * so capping before the rounding gives the same answer and keeps an infinite coverage finite.
   */
  private desiredFit(quadSize: number, coverage: number): number {
    const largestSlot = Math.trunc(quadSize / this.smallestSubdiv);
    return nextPowerOfTwo(coverage > 0 ? Math.min(quadSize * coverage, largestSlot) : 0);
  }

  /**
   * `light_storage.cpp:2386-2412`: the quadrants from the smallest slots up to the smallest slot that
   * holds the desired fit, and that last quadrant's subdivision.
   */
  private fittingQuadrants(
    desiredFit: number,
    quadSize: number
  ): { validQuadrants: number[]; bestSubdiv: number } {
    const validQuadrants: number[] = [];
    let bestSize = -1;
    let bestSubdiv = -1;
    for (const quadrant of this.sizeOrder) {
      const subdivision = this.quadrants[quadrant]!.subdivision;
      if (subdivision === 0) continue;
      const maxFit = Math.trunc(quadSize / subdivision);
      if (bestSize !== -1 && maxFit > bestSize) break;
      validQuadrants.push(quadrant);
      bestSubdiv = subdivision;
      if (maxFit >= desiredFit) bestSize = maxFit;
    }
    return { validQuadrants, bestSubdiv };
  }

  /**
   * A slot a light that was not seen this pass gives up, once the tolerance has passed since it took
   * it. A slot a light took this pass is never taken.
   */
  private isStealable(slot: Slot<Owner>, tick: number): boolean {
    if (slot.owner === null) return true;
    if (this.lastScenePass.get(slot.owner) === this.scenePass) return false;
    return tick - slot.allocTick >= POSITIONAL_SHADOW_REALLOC_TOLERANCE_MSEC;
  }

  /**
   * `_shadow_atlas_find_shadow` (`light_storage.cpp:2255-2306`): the best quadrant first, a free slot
   * before the least recently seen light's. It stops at the quadrant the light already sits in.
   */
  private findSlot(validQuadrants: readonly number[], currentSubdiv: number, tick: number): Found | null {
    for (let i = validQuadrants.length - 1; i >= 0; i--) {
      const quadrant = validQuadrants[i]!;
      const { subdivision, slots } = this.quadrants[quadrant]!;
      if (subdivision === currentSubdiv) return null;
      const free = slots.findIndex((slot) => slot.owner === null);
      if (free !== -1) return { quadrant, slot: free };
      let used = -1;
      let minPass = 0;
      slots.forEach((slot, index) => {
        if (!this.isStealable(slot, tick)) return;
        const pass = this.ownerPass(slot);
        if (used === -1 || pass < minPass) {
          used = index;
          minPass = pass;
        }
      });
      if (used !== -1) return { quadrant, slot: used };
    }
    return null;
  }

  /**
   * `_shadow_atlas_find_omni_shadows` (`light_storage.cpp:2308-2371`): two neighbouring slots, the
   * pair whose lights were seen least recently, and the first free pair at once.
   */
  private findOmniSlots(
    validQuadrants: readonly number[],
    currentSubdiv: number,
    tick: number
  ): Found | null {
    for (let i = validQuadrants.length - 1; i >= 0; i--) {
      const quadrant = validQuadrants[i]!;
      const { subdivision, slots } = this.quadrants[quadrant]!;
      if (subdivision === currentSubdiv) return null;
      let found = -1;
      let minPass = 0;
      for (let j = 0; j < slots.length - 1; j++) {
        const pair = [slots[j]!, slots[j + 1]!];
        if (!pair.every((slot) => this.isStealable(slot, tick))) continue;
        const pass = pair.reduce((sum, slot) => sum + this.ownerPass(slot), 0);
        if (found === -1 || pass < minPass) {
          found = j;
          minPass = pass;
          if (pass === 0) break;
        }
      }
      if (found !== -1) return { quadrant, slot: found };
    }
    return null;
  }

  /** The pass that last saw a slot's light. A free slot counts as never seen. */
  private ownerPass(slot: Slot<Owner>): number {
    return slot.owner === null ? 0 : (this.lastScenePass.get(slot.owner) ?? 0);
  }

  /** Takes the slot, and its neighbour for an omni light, from whichever light held them. */
  private claim(owner: Owner, claim: Claim, tick: number): void {
    const count = claim.isOmni ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const slot = this.quadrants[claim.quadrant]!.slots[claim.slot + k]!;
      if (slot.owner !== null) this.evict(slot.owner);
      slot.owner = owner;
      slot.allocTick = tick;
    }
    this.owners.set(owner, { ...claim, layout: this.layoutOf(claim) });
  }

  /** `_shadow_atlas_invalidate_shadow` (`light_storage.cpp:2501-2522`): the old light loses every slot. */
  private evict(owner: Owner): void {
    const ownership = this.owners.get(owner);
    if (!ownership) return;
    this.freeSlots(ownership);
    this.owners.delete(owner);
  }

  private freeSlots({ quadrant, slot, isOmni }: Claim): void {
    const count = isOmni ? 2 : 1;
    for (let k = 0; k < count; k++) this.quadrants[quadrant]!.slots[slot + k]!.owner = null;
  }
}
