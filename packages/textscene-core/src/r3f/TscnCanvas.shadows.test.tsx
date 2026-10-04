/**
 * The preview canvas asks for the shadow type three 0.186 draws. happy-dom lays no
 * element out, so a mounted `<Canvas>` never configures a renderer: the source
 * read pins what the JSX asks for, and the probe pins what that ask becomes, as
 * `World2DCanvas.test.tsx` pins its canvas flags.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';

const SOURCE = readFileSync(join(import.meta.dirname, 'TscnCanvas.tsx'), 'utf8');

/**
 * The `<Canvas>` opener in `source`, with both comment forms removed first: a `<Canvas …>`
 * quoted inside one would otherwise be read as the element. `<Canvas\s`, not `<Canvas\b`, so
 * a bare mention of the component name does not match.
 */
function canvasTag(source: string): string {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return /<Canvas\s[\s\S]*?>/.exec(code)?.[0] ?? '';
}

const CANVAS_TAG = canvasTag(SOURCE);

describe('the <Canvas> tag read', () => {
  it('reads the opener past a block comment that quotes <Canvas …>', () => {
    const source = '/**\n * The <Canvas shadows="soft"> this replaces.\n */\n<Canvas shadows="percentage" />';

    expect(canvasTag(source)).toContain('shadows="percentage"');
  });

  it('reads the opener past a line comment that quotes <Canvas …>', () => {
    const source = '// The <Canvas shadows="soft"> this replaces.\n<Canvas shadows="percentage" />';

    expect(canvasTag(source)).toContain('shadows="percentage"');
  });

  it('answers nothing for a source with no opener (edge case)', () => {
    expect(canvasTag('const element = 1;')).toBe('');
  });
});

/** Records the shadow map the renderer uses, as `WebGLShadowMap` reads it. */
function ShadowMapProbe({ seen }: { seen: { type: THREE.ShadowMapType; enabled: boolean } }) {
  const shadowMap = useThree((state) => state.gl.shadowMap);
  seen.type = shadowMap.type;
  seen.enabled = shadowMap.enabled;
  return null;
}

describe('<TscnCanvas> shadows', () => {
  it('asks the <Canvas> for the percentage preset', () => {
    expect(CANVAS_TAG).not.toBe('');
    expect(CANVAS_TAG).toMatch(/shadows="percentage"/);
  });

  it('lands the renderer on THREE.PCFShadowMap, so no shadow pass warns', async () => {
    const seen: { type: THREE.ShadowMapType; enabled: boolean } = {
      type: THREE.PCFShadowMap,
      enabled: false,
    };
    await ReactThreeTestRenderer.create(<ShadowMapProbe seen={seen} />, { shadows: 'percentage' });
    expect(seen.enabled).toBe(true);
    expect(seen.type).toBe(THREE.PCFShadowMap);
    // The removed type differs, so the assertion above proves a choice was made.
    expect(THREE.PCFSoftShadowMap).toBeDefined();
    expect(THREE.PCFSoftShadowMap).not.toBe(THREE.PCFShadowMap);
  });
});
