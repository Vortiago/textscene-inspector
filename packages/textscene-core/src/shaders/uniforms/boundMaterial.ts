import { NodeMaterial } from 'three/webgpu';
import type { ShaderSource, TranslatorFault } from '../fault/translatorFault.js';
import type { TranspiledUniform } from './transpiledUniform.js';

/** The shader a transpiled material draws: its uniforms and the Godot text it comes from. */
export interface MaterialShader {
  readonly parameters: readonly TranspiledUniform[];
  readonly source: ShaderSource;
}

const NO_SHADER: MaterialShader = { parameters: [], source: { text: '', file: '' } };

/**
 * A node material three draws only while the caller shows it and every uniform of its shader can draw.
 * @canonical Draw a transpiled material only while Godot can build its uniform set
 */
export class BoundNodeMaterial extends NodeMaterial {
  /** Written only by the `visible` setter and `copy`: whether the caller shows the material. */
  private isShown = true;

  /** Takes each program the GPU refuses for this material. Null logs the fault to the console. */
  onTranslatorFault: ((fault: TranslatorFault) => void) | null = null;

  constructor(private shader: MaterialShader = NO_SHADER) {
    super();
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

  /** Hands `fault` to `onTranslatorFault`, or logs it. */
  reportFault(fault: TranslatorFault): void {
    if (this.onTranslatorFault) this.onTranslatorFault(fault);
    else console.error(fault);
  }

  override copy(source: BoundNodeMaterial): this {
    super.copy(source);
    this.shader = source.shader;
    this.isShown = source.isShown;
    this.onTranslatorFault = source.onTranslatorFault;
    return this;
  }
}
