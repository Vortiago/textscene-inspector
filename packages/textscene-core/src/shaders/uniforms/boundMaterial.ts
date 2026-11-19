import { NodeMaterial } from 'three/webgpu';
import type { ShaderSource, TranslatorFault } from '../fault/translatorFault.js';
import type { Specialisation } from '../template/specialisation.js';
import type { TranspiledUniform } from './transpiledUniform.js';

/** The shader a transpiled material draws: its uniforms and the Godot text it comes from. */
export interface MaterialShader {
  readonly parameters: readonly TranspiledUniform[];
  readonly source: ShaderSource;
  /** The specialisation constants its programs fold, one program for each set of values. */
  readonly specialisations?: ReadonlyMap<string, Specialisation>;
}

const NO_SHADER: MaterialShader = { parameters: [], source: { text: '', file: '' } };

/** Written by the constructor and `dispose`: each transpiled material a refused program is matched to. */
const liveMaterials = new Set<WeakRef<BoundNodeMaterial>>();

/** Each transpiled material not yet disposed or collected. */
export function* boundMaterials(): Generator<BoundNodeMaterial> {
  for (const ref of liveMaterials) {
    const material = ref.deref();
    if (material) yield material;
    else liveMaterials.delete(ref);
  }
}

/**
 * A node material three draws only while the caller shows it and every uniform of its shader can draw.
 * @canonical Draw a transpiled material only while Godot can build its uniform set
 */
export class BoundNodeMaterial extends NodeMaterial {
  /** Written only by the `visible` setter and `copy`: whether the caller shows the material. */
  private isShown = true;

  private readonly ref = new WeakRef(this);

  /** Takes each program the GPU refuses for this material. Null logs the fault to the console. */
  onTranslatorFault: ((fault: TranslatorFault) => void) | null = null;

  /** Written only by `stageWith`: emits the stages again, as three keeps a function's first build. */
  private stage: (() => void) | null = null;

  private readonly respecialise = () => {
    this.stage?.();
    this.needsUpdate = true;
  };

  constructor(private shader: MaterialShader = NO_SHADER) {
    super();
    liveMaterials.add(this.ref);
    // three reads `visible` before it draws (`WebGLRenderer.js:1969`), so the gate holds for each mesh.
    Object.defineProperty(this, 'visible', {
      get: () => this.isShown && this.shader.parameters.every((parameter) => parameter.isDrawable),
      set: (isShown: boolean) => {
        this.isShown = isShown;
      },
    });
  }

  get source(): ShaderSource {
    return this.shader.source;
  }

  /** Emits the material's stages with `stage` now, and again at each new specialisation value. */
  stageWith(stage: () => void): void {
    this.stage = stage;
    stage();
    for (const constant of this.specialisations) constant.readers.add(this.respecialise);
  }

  private get specialisations(): Iterable<Specialisation> {
    return this.shader.specialisations?.values() ?? [];
  }

  /** Hands `fault` to `onTranslatorFault`, or logs it. */
  reportFault(fault: TranslatorFault): void {
    if (this.onTranslatorFault) this.onTranslatorFault(fault);
    else console.error(fault);
  }

  /** three keeps one program for each key, so a draw with other specialisation values gets its own. */
  override customProgramCacheKey(): string {
    const values = [...this.specialisations].map((constant) => constant.value);
    return `${super.customProgramCacheKey()}|${values.join(',')}`;
  }

  override dispose(): void {
    liveMaterials.delete(this.ref);
    for (const constant of this.specialisations) constant.readers.delete(this.respecialise);
    super.dispose();
  }

  override copy(source: BoundNodeMaterial): this {
    super.copy(source);
    this.shader = source.shader;
    this.isShown = source.isShown;
    this.onTranslatorFault = source.onTranslatorFault;
    return this;
  }
}
