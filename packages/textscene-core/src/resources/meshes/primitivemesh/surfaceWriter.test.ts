import { describe, expect, it } from 'vitest';
import { SurfaceWriter } from './surfaceWriter';

/** Two rows of two vertices: one quad between them. */
function writeQuad(writer: SurfaceWriter): void {
  for (let row = 0; row < 2; row++) {
    const start = writer.vertexCount;
    for (let i = 0; i < 2; i++) {
      writer.vertex([i, row, 0], [0, 0, 1], [1, 0, 0, 1], [i, row], [i / 2, row / 2]);
      if (i > 0 && row > 0) writer.quadBetweenRows(0, start, i);
    }
  }
}

describe('SurfaceWriter', () => {
  it('gathers every pushed array, one entry per vertex', () => {
    const writer = new SurfaceWriter(true);
    writeQuad(writer);
    const surface = writer.surface();

    expect(writer.vertexCount).toBe(4);
    expect(Array.from(surface.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]);
    expect(surface.tangents).toHaveLength(16);
    expect(Array.from(surface.uv2s!)).toEqual([0, 0, 0.5, 0, 0, 0.5, 0.5, 0.5]);
  });

  it("pushes a quad's two triangles in Godot's grid order", () => {
    const writer = new SurfaceWriter(false);
    writeQuad(writer);

    expect(Array.from(writer.surface().indices)).toEqual([0, 1, 2, 1, 3, 2]);
  });

  it('pushes the quads of two faces written a vertex apart, the even face first', () => {
    const writer = new SurfaceWriter(false);
    writer.quadPairBetweenRows(0, 4, 1);

    expect(Array.from(writer.surface().indices)).toEqual([0, 2, 4, 2, 6, 4, 1, 3, 5, 3, 7, 5]);
  });

  it('pushes one triangle as given', () => {
    const writer = new SurfaceWriter(false);
    writer.triangle(2, 0, 1);

    expect(Array.from(writer.surface().indices)).toEqual([2, 0, 1]);
  });

  it('drops the UV2 of a surface without add_uv2 (edge case)', () => {
    const writer = new SurfaceWriter(false);
    writeQuad(writer);

    expect(writer.surface().uv2s).toBeUndefined();
  });

  it('refuses bones written for fewer vertices than the surface has (edge case)', () => {
    const writer = new SurfaceWriter(false);
    writeQuad(writer);
    writer.bones([0, 0, 0, 0], [1, 0, 0, 0]);

    expect(() => writer.surface()).toThrow('expected bones for each of 4 vertices, got 1');
  });
});
