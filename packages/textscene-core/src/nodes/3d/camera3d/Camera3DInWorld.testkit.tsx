/** A Camera3D in the root world, for a test that reads the camera and not the world. */
import type { ComponentProps } from 'react';
import { InWorld } from '../../../r3f/testing/InWorld';
import { Camera3D } from './Component';

export function Camera3DInWorld(props: ComponentProps<typeof Camera3D>) {
  return (
    <InWorld>
      <Camera3D {...props} />
    </InWorld>
  );
}
