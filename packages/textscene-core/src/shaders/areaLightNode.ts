/**
 * The light node of every rect area light until Godot's area light has a port: nothing for a Godot
 * lit material, three's own area light for a material of three's own. three's node reads LTC tables
 * a caller installs first (r187 `RectAreaLightNode.js` `setLTC`), which a Godot material never needs.
 */

import { RectAreaLightNode, type NodeBuilder } from 'three/webgpu';
import { litPipelineOf } from './litPipeline.js';

export class GodotAreaLightNode extends RectAreaLightNode {
  static get type(): string {
    return 'GodotAreaLightNode';
  }

  override setup(builder: NodeBuilder): undefined {
    if (litPipelineOf(builder.material)) return undefined;
    super.setup(builder);
    return undefined;
  }
}
