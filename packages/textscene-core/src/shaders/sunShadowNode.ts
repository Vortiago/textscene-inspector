/**
 * The shadow of a directional light, sampled from Godot's directional atlas with the light's split
 * layout in its pooled rows (`sunRows.ts`): the split pick, the PCF and the blend between splits
 * (`scene_forward_clustered.glsl:2399-2478`), the blocker search of a light with an angular size
 * (`:2310-2398`), and the fade at the end of the last split (`:2491`). The functions are those of
 * `r3f/directionalShadow/splitShadowChunk.ts` and `r3f/shadowFilter/softShadowFilter.ts`, whose
 * layout `directionalShadow.md` documents. Each is one GLSL function that every light calls with
 * its first row.
 */

import {
  cameraPosition,
  cameraViewMatrix,
  float,
  floor,
  Fn,
  fract,
  If,
  int,
  ivec2,
  max,
  mix,
  normalLocal,
  positionView,
  positionWorld,
  screenCoordinate,
  select,
  smoothstep,
  texture,
  textureLoad,
  textureSize,
  transformNormalToView,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  SOFT_LOW_PENUMBRA_SAMPLES,
  SOFT_LOW_SHADOW_SAMPLES,
  vogelDisk,
} from '../godot/rendering/lights/softShadowKernel.js';
import { quickHash } from './lightFunctions.js';
import type { LightRows } from './lightRows.js';
import type { SunShadowInputs } from './pipelineInputs.js';
import type { FloatNode, IntNode, IVec2Node, Vec2Node, Vec3Node, Vec4Node } from './nodeTypes.js';
import { BLENDS_ABOVE, SLOT_MATRIX_ROWS, SPLIT_SLOTS, SUN_PANCAKE, SUN_ROW } from './sunRows.js';

/** Soft Low, Godot's default quality (`rendering_server.cpp:3706`, `:3710`). */
const PCF_KERNEL = vogelDisk(SOFT_LOW_SHADOW_SAMPLES);
const PENUMBRA_KERNEL = vogelDisk(SOFT_LOW_PENUMBRA_SAMPLES);

/**
 * What the lookup reads of the fragment. The caller reads it and passes it in: three builds a layout
 * function in a flow whose vars it drops (r187 `NodeBuilder.js:3068-3098`), so a varying first read
 * there leaves its vertex vars undeclared.
 */
interface ShadowFragment {
  /** The world position. */
  position: Vec3Node;
  /** The world normal the normal bias moves along, as three's shadow chunk takes it. */
  normal: Vec3Node;
  /** The camera depth, which picks the split. */
  depth: FloatNode;
}

/** The layout inputs of a `ShadowFragment`, in its order. */
const FRAGMENT_INPUTS = [
  { name: 'position', type: 'vec3' },
  { name: 'normal', type: 'vec3' },
  { name: 'depth', type: 'float' },
] as const;

/** A `ShadowFragment` as a layout function's trailing arguments. */
type FragmentArgs = [position: Vec3Node, normal: Vec3Node, depth: FloatNode];

/** The inputs of a function that takes the light's first row and the fragment. */
const FIRST_AND_FRAGMENT = [{ name: 'first', type: 'int' }, ...FRAGMENT_INPUTS];

function shadowFragment(): ShadowFragment {
  const normal = varying(
    transformNormalToView(normalLocal).transformNormalByInverseViewMatrix(cameraViewMatrix),
    'vGodotSunShadowWorldNormal'
  );
  return { position: positionWorld, normal, depth: positionView.z.negate() };
}

/** The fragment's kernel rotation, from its screen hash (`scene_forward_lights_inc.glsl:292-298`). */
interface Rotation {
  sin: FloatNode;
  cos: FloatNode;
}

function fragmentRotation(): Rotation {
  const turn = quickHash(screenCoordinate)
    .mul(2 * Math.PI)
    .toVar();
  return { sin: turn.sin().toVar(), cos: turn.cos().toVar() };
}

/** A kernel tap turned by the fragment's rotation. */
function turned({ sin, cos }: Rotation, [x, y]: [number, number]): Vec2Node {
  return vec2(cos.mul(x).add(sin.mul(y)), sin.negate().mul(x).add(cos.mul(y)));
}

/** The lookup of one renderer's atlas in one program, its functions built once for every light of the program. */
export class SunShadow {
  constructor(
    private readonly rows: LightRows,
    private readonly atlas: SunShadowInputs
  ) {}

  /** The shadow of the light whose rows start at `first`, faded out at the end of its last split. */
  shadow(first: number): FloatNode {
    const { position, normal, depth } = shadowFragment();
    return this.fadedShadow(int(first), position, normal, depth);
  }

  private field(first: IntNode, field: number, offset: IntNode | number = 0): Vec4Node {
    return this.rows.at(first.add(field).add(offset));
  }

  /** An atlas position as the texture node must receive it. */
  private sampled(uv: Vec2Node): Vec2Node {
    return this.atlas.rowsFromBottom ? uv.flipY() : uv;
  }

  /** The depth compare at `uv` against `depth`. */
  private compare(uv: Vec2Node, depth: FloatNode): FloatNode {
    // A depth texture samples a float (r187 `TextureNode.js` `getNodeType`), which three's types leave a vec4.
    return texture(this.atlas.depth, this.sampled(uv)).compare(depth) as unknown as FloatNode;
  }

  /** The raw depth of texel `texel`, a whole texel position, from the two bytes the atlas's colour holds it in. */
  private rawDepthAt(texel: Vec2Node, size: Vec2Node): FloatNode {
    // The texture node turns the row of a render target it loads, so the row is turned first.
    const row = this.atlas.rowsFromBottom ? size.y.sub(1).sub(texel.y) : texel.y;
    const bytes = floor(
      textureLoad(this.atlas.colour, ivec2(vec2(texel.x, row)))
        .rg.mul(255)
        .add(0.5)
    );
    return bytes.dot(vec2(256, 1)).div(65535);
  }

  /**
   * The raw depth at `uv` as Godot's linear sampler filters it (`scene_forward_lights_inc.glsl:398`):
   * the uv clamps to the atlas, and the four nearest texels filter.
   */
  private readonly rawDepth = Fn(([uv]: [Vec2Node]) => {
    // A texture's size is an ivec2 (r187 `TextureSizeNode.js`), which three's types leave a bare node.
    const texels = textureSize(texture(this.atlas.colour), int(0)) as unknown as IVec2Node;
    const size = vec2(texels).toVar();
    const last = size.sub(1).toVar();
    const position = uv.clamp(0, 1).mul(size).sub(0.5).toVar();
    const corner = floor(position).toVar();
    const weight = fract(position).toVar();
    const texel = (x: number, y: number) =>
      this.rawDepthAt(corner.add(vec2(x, y)).clamp(vec2(0), last), size);
    const bottom = mix(texel(0, 0), texel(1, 0), weight.x);
    const top = mix(texel(0, 1), texel(1, 1), weight.x);
    return mix(bottom, top, weight.y);
  }).setLayout({ name: 'godotSunRawDepth', type: 'float', inputs: [{ name: 'uv', type: 'vec2' }] });

  /** A slot's atlas position and depth: three rows of its matrix against the world position. */
  private coordOf(first: IntNode, slot: IntNode, position: Vec3Node): Vec3Node {
    const row = slot.mul(SLOT_MATRIX_ROWS).toVar();
    const point = vec4(position, 1);
    const matrixRow = (r: number) => this.field(first, SUN_ROW.matrices, row.add(r)).dot(point);
    return vec3(matrixRow(0), matrixRow(1), matrixRow(2));
  }

  /** The length of row `r` of a slot's matrix: the slot's scale along that axis. */
  private scaleOf(first: IntNode, slot: IntNode, r: number): FloatNode {
    return this.field(first, SUN_ROW.matrices, slot.mul(SLOT_MATRIX_ROWS).add(r)).xyz.length();
  }

  /** A position past the atlas's edges or its far plane, which no split shadows. */
  private isInside(coord: Vec3Node) {
    return coord.x
      .greaterThanEqual(0)
      .and(coord.x.lessThanEqual(1))
      .and(coord.y.greaterThanEqual(0))
      .and(coord.y.lessThanEqual(1))
      .and(coord.z.lessThanEqual(1));
  }

  /** `sample_directional_pcf_shadow` (`scene_forward_lights_inc.glsl:283-308`) at Soft Low's taps. */
  private readonly pcf = Fn(([pixelSize, coord]: [Vec2Node, Vec3Node]) => {
    const rotation = fragmentRotation();
    const shadow = float(0).toVar();
    for (const tap of PCF_KERNEL) {
      shadow.addAssign(this.compare(coord.xy.add(pixelSize.mul(turned(rotation, tap))), coord.z));
    }
    return shadow.mul(1 / PCF_KERNEL.length);
  }).setLayout({
    name: 'godotSunPcf',
    type: 'float',
    inputs: [
      { name: 'pixelSize', type: 'vec2' },
      { name: 'coord', type: 'vec3' },
    ],
  });

  /** One split's PCF shadow (`:2443`), unshadowed outside the split's share of the atlas. */
  private readonly pcfSplit = Fn(
    ([first, slot, radiusScale, worldPosition, normal]: [
      IntNode,
      IntNode,
      FloatNode,
      Vec3Node,
      Vec3Node,
    ]) => {
      const split = this.field(first, SUN_ROW.splits, slot).toVar();
      const position = worldPosition.add(normal.mul(split.z));
      const coord = this.coordOf(first, slot, position).toVar();
      coord.z.addAssign(split.y);
      const result = float(1).toVar();
      If(this.isInside(coord), () => {
        const atlasRow = this.field(first, SUN_ROW.atlas).toVar();
        const shadowRow = this.field(first, SUN_ROW.shadow).toVar();
        const pixelSize = vec2(1).div(atlasRow.xy).mul(shadowRow.w.mul(radiusScale));
        result.assign(mix(1, this.pcf(pixelSize, coord), shadowRow.z));
      });
      return result;
    }
  ).setLayout({
    name: 'godotSunPcfSplit',
    type: 'float',
    inputs: [
      { name: 'first', type: 'int' },
      { name: 'slot', type: 'int' },
      { name: 'radiusScale', type: 'float' },
      FRAGMENT_INPUTS[0],
      FRAGMENT_INPUTS[1],
    ],
  });

  /**
   * The split by camera depth, its filter narrowed against the first split's, blended into the next
   * over its blend band (`:2399-2478`).
   */
  private readonly splitShadow = Fn(([first, position, normal, depth]: [IntNode, ...FragmentArgs]) => {
    const splitEnd = (slot: number) => this.field(first, SUN_ROW.splits, slot).x;
    const slot = int(SPLIT_SLOTS - 1).toVar();
    If(depth.lessThan(splitEnd(0)), () => {
      slot.assign(0);
    })
      .ElseIf(depth.lessThan(splitEnd(1)), () => {
        slot.assign(1);
      })
      .ElseIf(depth.lessThan(splitEnd(2)), () => {
        slot.assign(2);
      });
    const selected = this.field(first, SUN_ROW.splits, slot).toVar();
    const blendsSplits = this.field(first, SUN_ROW.splits).w.greaterThan(BLENDS_ABOVE);
    const radiusScale = select(blendsSplits, float(1), splitEnd(0).div(selected.x));
    const shadow = this.pcfSplit(first, slot, radiusScale, position, normal).toVar();
    const blendsHere = slot
      .lessThan(SPLIT_SLOTS - 1)
      .and(selected.w.greaterThan(BLENDS_ABOVE))
      .and(depth.greaterThan(selected.w));
    If(blendsHere, () => {
      const next = this.pcfSplit(first, slot.add(1), float(1), position, normal);
      shadow.assign(mix(shadow, next, smoothstep(selected.w, selected.x, depth)));
    });
    return shadow;
  }).setLayout({ name: 'godotSunSplitShadow', type: 'float', inputs: FIRST_AND_FRAGMENT });

  /**
   * `sample_directional_soft_shadow` (`scene_forward_lights_inc.glsl:381-424`): the blocker search,
   * then the penumbra filter it scales. `lightSide` is the depth of the light's side of the range.
   */
  private readonly blockerShadow = Fn(([coord, texScale, lightSide]: [Vec3Node, Vec2Node, FloatNode]) => {
    const rotation = fragmentRotation();
    const pancaked = lightSide.add(float(SUN_PANCAKE).mul(lightSide.oneMinus())).toVar();
    const blockerSum = float(0).toVar();
    const blockerCount = float(0).toVar();
    for (const tap of PENUMBRA_KERNEL) {
      const uv = coord.xy.add(turned(rotation, tap).mul(texScale));
      const blocker = max(this.rawDepth(uv), pancaked).toVar();
      If(blocker.lessThan(coord.z), () => {
        blockerSum.addAssign(blocker);
        blockerCount.addAssign(1);
      });
    }
    const shadow = float(1).toVar();
    If(blockerCount.greaterThan(0), () => {
      const blockerAverage = blockerSum.div(blockerCount).toVar();
      const penumbra = texScale.mul(coord.z.sub(blockerAverage).div(blockerAverage.sub(lightSide))).toVar();
      const sum = float(0).toVar();
      for (const tap of PENUMBRA_KERNEL) {
        sum.addAssign(this.compare(coord.xy.add(turned(rotation, tap).mul(penumbra)), coord.z));
      }
      shadow.assign(sum.div(PENUMBRA_KERNEL.length));
    });
    return shadow;
  }).setLayout({
    name: 'godotSunBlockerShadow',
    type: 'float',
    inputs: [
      { name: 'coord', type: 'vec3' },
      { name: 'texScale', type: 'vec2' },
      { name: 'lightSide', type: 'float' },
    ],
  });

  /** One split's soft shadow (`:2312-2324`), unshadowed outside the split's share of the atlas. */
  private readonly softSplit = Fn(
    ([first, slot, rangeBegin, worldPosition, normal]: [IntNode, IntNode, FloatNode, Vec3Node, Vec3Node]) => {
      const split = this.field(first, SUN_ROW.splits, slot).toVar();
      const toLight = this.field(first, SUN_ROW.worldDirection).xyz.toVar();
      const angle = this.field(first, SUN_ROW.atlas).z;
      const shadowRow = this.field(first, SUN_ROW.shadow).toVar();
      const position = worldPosition.add(normal.mul(split.z)).toVar();
      const coord = this.coordOf(first, slot, position).toVar();
      coord.z.addAssign(split.y);
      const result = float(1).toVar();
      If(this.isInside(coord), () => {
        const uvScale = vec2(this.scaleOf(first, slot, 0), this.scaleOf(first, slot, 1));
        const testRadius = toLight.dot(position.sub(cameraPosition)).sub(rangeBegin).mul(angle);
        const texScale = uvScale.mul(testRadius).mul(shadowRow.w);
        const lightSide = coord.z.sub(
          this.scaleOf(first, slot, 2).mul(rangeBegin.sub(toLight.dot(position)))
        );
        result.assign(mix(1, this.blockerShadow(coord, texScale, lightSide), shadowRow.z));
      });
      return result;
    }
  ).setLayout({
    name: 'godotSunSoftSplit',
    type: 'float',
    inputs: [
      { name: 'first', type: 'int' },
      { name: 'slot', type: 'int' },
      { name: 'rangeBegin', type: 'float' },
      FRAGMENT_INPUTS[0],
      FRAGMENT_INPUTS[1],
    ],
  });

  /**
   * The soft shadow of a light with an angular size (`:2310-2398`): the first split the depth lies
   * in, blended with the next one while the light blends its splits.
   */
  private readonly softShadow = Fn(([first, position, normal, depth]: [IntNode, ...FragmentArgs]) => {
    const splitRow = (slot: number) => this.field(first, SUN_ROW.splits, slot);
    const rangeBegins = this.field(first, SUN_ROW.rangeBegins).toVar();
    const blendMax = select(splitRow(0).w.greaterThan(BLENDS_ABOVE), int(2), int(1)).toVar();
    const blended = int(0).toVar();
    const shadow = float(1).toVar();
    const rangeBeginOf = [rangeBegins.x, rangeBegins.y, rangeBegins.z, rangeBegins.w];
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      const reachesSlot = slot < SPLIT_SLOTS - 1 ? depth.lessThan(splitRow(slot).x) : null;
      const takes = reachesSlot ? blended.lessThan(blendMax).and(reachesSlot) : blended.lessThan(blendMax);
      If(takes, () => {
        const splitShadow = this.softSplit(first, int(slot), rangeBeginOf[slot]!, position, normal).toVar();
        If(blended.equal(0), () => {
          shadow.assign(splitShadow);
        }).Else(() => {
          const blendFrom = slot > 1 ? splitRow(slot - 2).x : float(0);
          shadow.assign(mix(shadow, splitShadow, smoothstep(blendFrom, splitRow(slot - 1).x, depth)));
        });
        blended.addAssign(1);
      });
    }
    return shadow;
  }).setLayout({ name: 'godotSunSoftShadow', type: 'float', inputs: FIRST_AND_FRAGMENT });

  /**
   * The shadow, the soft one for a light with an angle, faded out between the fade's two depths
   * (`:2491`). Ends that do not ascend fade nothing, which covers a light no fit has placed.
   */
  private readonly fadedShadow = Fn(([first, position, normal, depth]: [IntNode, ...FragmentArgs]) => {
    const shadowRow = this.field(first, SUN_ROW.shadow).toVar();
    const fadeOut = select(
      shadowRow.y.greaterThan(shadowRow.x),
      smoothstep(shadowRow.x, shadowRow.y, depth),
      float(0)
    ).toVar();
    const shadow = float(1).toVar();
    If(fadeOut.lessThan(1), () => {
      const hasAngle = this.field(first, SUN_ROW.atlas).z.greaterThan(0);
      shadow.assign(
        select(
          hasAngle,
          this.softShadow(first, position, normal, depth),
          this.splitShadow(first, position, normal, depth)
        )
      );
    });
    return mix(shadow, 1, fadeOut);
  }).setLayout({ name: 'godotSunShadow', type: 'float', inputs: FIRST_AND_FRAGMENT });
}
