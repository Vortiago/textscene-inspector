/**
 * Sprite3D is a GeometryInstance3D, so its `visibility_range_*` culls and fades the quad. The
 * distance is to its AABB centre, which a billboard moves onto the origin
 * (`sprite_3d.cpp:252-273`). Driven by one scene render from 11 units in front of the sprite's origin.
 */
import { describe, expect, it } from 'vitest';
import { drawsColour } from '../../../r3f/testing/threePasses';
import { spriteMesh } from './testing/spriteMesh';

describe('<Sprite3D> visibility range', () => {
  it('draws a sprite inside its range', async () => {
    expect(drawsColour(await spriteMesh({ visibility_range_end: '20.0' }))).toBe(true);
  });

  it('draws nothing of a sprite past its end', async () => {
    expect(drawsColour(await spriteMesh({ visibility_range_end: '10.0' }))).toBe(false);
  });

  it('blends a SELF sprite at the eased alpha across its end margin', async () => {
    // smoothstep(1 - (11 - 8) / 4) = 0.15625, and 0.15625 × 255 = 39.84 truncates to 39.
    const mesh = await spriteMesh({
      visibility_range_end: '10.0',
      visibility_range_end_margin: '2.0',
      visibility_range_fade_mode: '1',
    });
    expect(mesh.material).toMatchObject({ transparent: true, opacity: 39 / 255 });
  });

  it("measures an uncentred quad to its box's centre", async () => {
    // The quad's centre is (1.28, 1.28, 0), √(2 × 1.28² + 11²) ≈ 11.148 away, past an end of 11.1.
    expect(drawsColour(await spriteMesh({ centered: 'false', visibility_range_end: '11.1' }))).toBe(false);
  });

  it('measures a billboard to its origin, 11 away, inside an end of 11.1', async () => {
    const mesh = await spriteMesh({ centered: 'false', billboard: '1', visibility_range_end: '11.1' });
    expect(drawsColour(mesh)).toBe(true);
  });

  it('measures a quad on the XZ plane to its own box', async () => {
    // AXIS_Y lays the quad flat, centre (1.28, 0, -1.28), √(1.28² + 12.28²) ≈ 12.35 away.
    expect(
      drawsColour(await spriteMesh({ centered: 'false', axis: '1', visibility_range_end: '12.3' }))
    ).toBe(false);
  });
});
