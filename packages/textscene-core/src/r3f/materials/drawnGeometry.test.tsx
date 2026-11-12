/** The read-back contract of `useDrawnGeometry`: the geometry in place across re-parses, and no render loop. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useRef } from 'react';
import { useDrawnGeometry } from './drawnGeometry';

describe('useDrawnGeometry', () => {
  it('reads the geometry off the base draw, and a re-parsed one in its place', async () => {
    const first = new THREE.BufferGeometry();
    const reparsed = new THREE.BufferGeometry();
    const seen: Array<THREE.BufferGeometry | null> = [];

    /** A ref'd mesh, reporting what the hook read, per render. */
    function Harness({ geometry }: { geometry: THREE.BufferGeometry }) {
      const ref = useRef<THREE.Mesh>(null);
      seen.push(useDrawnGeometry(ref));
      return <mesh ref={ref} geometry={geometry} />;
    }

    const renderer = await ReactThreeTestRenderer.create(<Harness geometry={first} />);
    expect(seen.includes(first)).toBe(true);

    await renderer.update(<Harness geometry={reparsed} />);
    expect(seen.at(-1)).toBe(reparsed);
  });

  it("settles the geometry after the layout pass's null read, so the pair cannot loop", async () => {
    // The layout pass reads before the ref lands, and the passive pass reads the
    // geometry. The updater answers the settled value with itself, so the read-back
    // pair stops there instead of re-rendering forever.
    const geometry = new THREE.BufferGeometry();
    const seen: Array<THREE.BufferGeometry | null> = [];

    /** A ref'd mesh, reporting what the hook read, per render. */
    function Harness({ geometry: drawn }: { geometry: THREE.BufferGeometry }) {
      const ref = useRef<THREE.Mesh>(null);
      seen.push(useDrawnGeometry(ref));
      return <mesh ref={ref} geometry={drawn} />;
    }

    await ReactThreeTestRenderer.create(<Harness geometry={geometry} />);
    expect(seen[0]).toBeNull();
    expect(seen.at(-1)).toBe(geometry);
    expect(seen.at(-2)).toBe(geometry);
    expect(seen.slice(1).every((read) => read === geometry)).toBe(true);
  });
});
