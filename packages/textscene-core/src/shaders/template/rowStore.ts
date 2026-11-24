import * as THREE from 'three';
import { add, ivec2, nodeObject, uniform } from 'three/tsl';
import { NodeUpdateType, TextureNode, type Node, type NodeFrame, type UniformNode } from 'three/webgpu';
import { intNode, tsl } from '../language/compositeParts.js';

/** The texels of one row. WebGL 2 promises 2048 texels a side, so a row stays inside it. */
export const ROW_TEXELS = 1024;

/** A texel holds 16 bytes: four 32-bit words. */
export const TEXEL_WORDS = 4;

const ROW_WORDS = ROW_TEXELS * TEXEL_WORDS;

/** The rows of one block: its words, and the uniform of its first row, which the store moves. */
export interface RowRegion {
  words: Uint32Array;
  rows: number;
  readonly firstRow: UniformNode<'int', number>;
}

/** Each fetch is a clone, which keeps the class and the shared writes. */
class RowsNode extends TextureNode {
  override updateType = NodeUpdateType.OBJECT;
  /** Written only by `RowStore.writeEachDraw`, once for each region a draw writes. */
  drawWrites: ((frame: NodeFrame) => void)[] = [];

  override update(frame: NodeFrame): undefined {
    for (const write of this.drawWrites) write(frame);
    return undefined;
  }

  override clone(): this {
    const node = super.clone();
    node.drawWrites = this.drawWrites;
    return node;
  }
}

/** The storage buffer blocks of a program in one `RGBA32UI` texture: WebGL 2 guarantees 16 samplers. */
export class RowStore {
  readonly texture = new THREE.DataTexture(
    new Uint32Array(ROW_WORDS),
    ROW_TEXELS,
    1,
    THREE.RGBAIntegerFormat,
    THREE.UnsignedIntType
  );
  readonly node: RowsNode;
  private readonly regions: RowRegion[] = [];

  constructor() {
    this.texture.internalFormat = 'RGBA32UI';
    // three binds a float texture for one never uploaded, and an integer sampler of it fails the draw.
    this.texture.needsUpdate = true;
    this.node = nodeObject(new RowsNode(this.texture)) as unknown as RowsNode;
  }

  /** A region after the others, one row of zeros until a write. */
  region(): RowRegion {
    const firstRow = uniform(0, 'int') as UniformNode<'int', number>;
    const region: RowRegion = { words: new Uint32Array(0), rows: 1, firstRow };
    this.regions.push(region);
    this.layOut();
    return region;
  }

  /** Writes a region's words from its first row, and moves the regions after it when it grows. */
  write(region: RowRegion, words: Uint32Array): void {
    const rows = Math.max(1, Math.ceil(words.length / ROW_WORDS));
    region.words = words;
    if (rows === region.rows) this.copy(region);
    else {
      region.rows = rows;
      this.layOut();
    }
    this.texture.needsUpdate = true;
  }

  /** Writes each drawn object's words: the node handler owns onBeforeRender (`WebGLNodesHandler.js:455`). */
  writeEachDraw(region: RowRegion, wordsOf: (object: THREE.Object3D) => Uint32Array): void {
    let writtenFor: number | undefined;
    this.node.drawWrites.push((frame) => {
      if (frame.renderId === writtenFor) return;
      // The handler counts one render for each draw of a node material (`WebGLNodesHandler.js:598`).
      const followsOwnDraw = frame.renderId === (writtenFor ?? Number.NaN) + 1;
      writtenFor = frame.renderId;
      this.write(region, wordsOf(frame.object!));
      if (followsOwnDraw) uploadBetweenDraws(frame.renderer as unknown as THREE.WebGLRenderer, this.texture);
    });
  }

  /** The texel at `x` of row `y` of `region`. */
  fetch(region: RowRegion, x: Node, y: Node): Node {
    const texel = tsl(ivec2)(x, tsl(add)(y, region.firstRow as unknown as Node));
    return this.node.load(texel as never).level(intNode(0) as never) as unknown as Node;
  }

  private layOut(): void {
    let firstRow = 0;
    for (const region of this.regions) {
      region.firstRow.value = firstRow;
      firstRow += region.rows;
    }
    // three allocates a texture's storage once, so a new height takes a new texture.
    this.texture.dispose();
    this.texture.image = { data: new Uint32Array(firstRow * ROW_WORDS), width: ROW_TEXELS, height: firstRow };
    for (const region of this.regions) this.copy(region);
  }

  private copy(region: RowRegion): void {
    const data = (this.texture.image as { data: Uint32Array }).data;
    const start = region.firstRow.value * ROW_WORDS;
    data.fill(0, start + region.words.length, start + region.rows * ROW_WORDS).set(region.words, start);
  }
}

/** The unpack state of a plain row upload, which three's last upload may have left otherwise. */
const UNPACK_PLAIN = [
  ['UNPACK_FLIP_Y_WEBGL', 0],
  ['UNPACK_PREMULTIPLY_ALPHA_WEBGL', 0],
  ['UNPACK_ALIGNMENT', 4],
  ['UNPACK_ROW_LENGTH', 0],
  ['UNPACK_SKIP_PIXELS', 0],
  ['UNPACK_SKIP_ROWS', 0],
] as const;

/** three uploads textures only after a draw of another material (`WebGLRenderer.js:2760`): this uploads. */
function uploadBetweenDraws(renderer: THREE.WebGLRenderer, texture: THREE.DataTexture): void {
  const properties = renderer.properties.get(texture) as {
    __webglTexture?: WebGLTexture;
    __version?: number;
  };
  // Not uploaded by this renderer yet: three allocates and uploads it as it binds it for this draw.
  if (!properties.__webglTexture || properties.__version === undefined) return;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const { data, width, height } = texture.image as { data: Uint32Array; width: number; height: number };
  const bound = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
  gl.bindTexture(gl.TEXTURE_2D, properties.__webglTexture);
  for (const [name, value] of UNPACK_PLAIN) renderer.state.pixelStorei(gl[name], value);
  // Every row, not the drawn region's: the version this marks covers the writes of every region.
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA_INTEGER, gl.UNSIGNED_INT, data);
  gl.bindTexture(gl.TEXTURE_2D, bound);
  properties.__version = texture.version;
}
