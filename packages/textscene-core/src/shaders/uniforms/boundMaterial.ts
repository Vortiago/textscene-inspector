import { NodeMaterial } from 'three/webgpu';
import type { TranspiledUniform } from './transpiledUniform.js';

/**
 * A node material three draws only while the caller shows it and every uniform of its shader can draw.
 * @canonical Draw a transpiled material only while Godot can build its uniform set
 */
export class BoundNodeMaterial extends NodeMaterial {
  /** Written only by the `visible` setter and `copy`: whether the caller shows the material. */
  private isShown = true;

  constructor(private parameters: readonly TranspiledUniform[] = []) {
    super();
    // three reads `visible` before it draws (`WebGLRenderer.js:1969`), so the gate holds for each mesh.
    Object.defineProperty(this, 'visible', {
      get: () => this.isShown && this.parameters.every((parameter) => parameter.isDrawable),
      set: (isShown: boolean) => {
        this.isShown = isShown;
      },
    });
  }

  override copy(source: BoundNodeMaterial): this {
    super.copy(source);
    this.parameters = source.parameters;
    this.isShown = source.isShown;
    return this;
  }
}
