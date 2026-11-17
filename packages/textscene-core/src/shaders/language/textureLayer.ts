import * as TSL from 'three/tsl';
import type { Node } from 'three/webgpu';
import { compositeOf } from './builtInComposites.js';

/** A sampled layer rounds half to even, as Godot's Vulkan driver does: three would truncate it. */
export const roundedLayer = (layer: Node): Node =>
  TSL.int(compositeOf('roundEven', ['float'])!([layer], ['float']) as never) as unknown as Node;
