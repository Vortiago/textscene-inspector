import { describe, expect, it } from 'vitest';
import { LuminanceMaterial } from 'postprocessing';
import { gateBloomOnPeakChannel, LUMINANCE_EXPR } from './bloomPeakChannel';

describe('gateBloomOnPeakChannel', () => {
  it('rewrites the luminance bright-pass to a peak-channel gate', () => {
    const material = {
      fragmentShader: 'void main(){float l=luminance(texel.rgb);gl_FragColor=vec4(l);}',
      needsUpdate: false,
    };
    expect(gateBloomOnPeakChannel(material)).toBe(true);
    expect(material.fragmentShader).toContain('max(max(texel.r, texel.g), texel.b)');
    expect(material.fragmentShader).not.toContain('luminance(texel.rgb)');
    // three recompiles the shader only when the material is marked dirty.
    expect(material.needsUpdate).toBe(true);
  });

  it('is a no-op that reports failure when the luminance expression is absent', () => {
    const material = { fragmentShader: 'void main(){gl_FragColor=texel;}', needsUpdate: false };
    expect(gateBloomOnPeakChannel(material)).toBe(false);
    expect(material.needsUpdate).toBe(false);
    expect(material.fragmentShader).toBe('void main(){gl_FragColor=texel;}');
  });

  it("guards the installed postprocessing LuminanceMaterial still ships the expression it patches", () => {
    // The peak-channel gate reaches into a third-party shader by string. If a
    // `postprocessing` upgrade renames this expression the patch silently
    // becomes a no-op and glow reverts to Rec.709 luminance gating (saturated
    // emissives stop blooming). Fail loudly here instead — and confirm the
    // real material is actually rewritten, not just a hand-written sample.
    const material = new LuminanceMaterial(true);
    expect(material.fragmentShader).toMatch(LUMINANCE_EXPR);
    expect(gateBloomOnPeakChannel(material)).toBe(true);
    expect(material.fragmentShader).toContain('max(max(texel.r, texel.g), texel.b)');
  });
});
