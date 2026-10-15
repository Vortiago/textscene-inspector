/** A 3D root with no Environment clears to the project clear colour (`renderer_viewport.cpp:371`). */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { NoEnvironmentLayer } from './NoEnvironmentLayer';
import { withProject } from '../testing/ProjectFixture';

/** Hands out the canvas's renderer, which the test renderer does not expose. */
function CaptureRenderer({ captured }: { captured: { current: THREE.WebGLRenderer | null } }) {
  captured.current = useThree((state) => state.gl);
  return null;
}

describe('<NoEnvironmentLayer>', () => {
  it("clears to Godot's default sRGB 0.3 grey, opaque, where no Environment draws a background", async () => {
    const ProjectFixture = withProject(null);
    const captured: { current: THREE.WebGLRenderer | null } = { current: null };
    await ReactThreeTestRenderer.create(
      <ProjectFixture>
        <NoEnvironmentLayer />
        <CaptureRenderer captured={captured} />
      </ProjectFixture>
    );
    const gl = captured.current!;
    expect(gl.getClearColor(new THREE.Color()).getStyle(THREE.SRGBColorSpace)).toBe('rgb(77,77,77)');
    expect(gl.getClearAlpha()).toBe(1);
  });
});
