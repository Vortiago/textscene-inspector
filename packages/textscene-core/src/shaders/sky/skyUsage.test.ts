import { describe, expect, it } from 'vitest';
import { parsedShader } from '../language/parseShader.js';
import { skyUsage as usageOfTree } from './skyUsage.js';

const skyUsage = (source: string) => usageOfTree(parsedShader(source).tree);

const skyOf = (body: string) => `shader_type sky;\nvoid sky() {\n\t${body}\n}\n`;

describe('skyUsage', () => {
  it('reads no built-in of a sky that writes only COLOR', () => {
    expect(skyUsage(skyOf('COLOR = vec3(1.0);'))).toEqual({
      light: false,
      time: false,
      position: false,
      hasBufferUniforms: false,
      passColors: [],
      samplers: {},
    });
  });

  it('reads the lights of a sky that reads any LIGHTn built-in', () => {
    expect(skyUsage(skyOf('COLOR = LIGHT3_COLOR;')).light).toBe(true);
  });

  it('reads a built-in in a function nothing calls, as Godot compiles every function', () => {
    const source =
      'shader_type sky;\nvec3 l() { return LIGHT0_COLOR; }\nvoid sky() {\n\tCOLOR = vec3(0.0);\n}\n';
    expect(skyUsage(source).light).toBe(true);
  });

  it("reads no built-in of a sky that draws Godot's default sky (edge case)", () => {
    expect(usageOfTree(null)).toEqual({
      light: false,
      time: false,
      position: false,
      hasBufferUniforms: false,
      passColors: [],
      samplers: {},
    });
  });

  it('reads TIME of a sky that reads it, and not POSITION', () => {
    expect(skyUsage(skyOf('COLOR = vec3(TIME);'))).toMatchObject({ time: true, position: false });
  });

  it('reads the pass colours a sky reads', () => {
    const body = 'COLOR = HALF_RES_COLOR.rgb + QUARTER_RES_COLOR.rgb;';
    expect(skyUsage(skyOf(body)).passColors).toEqual(['half', 'quarter']);
  });

  it('reads no pass colour of a sky that reads neither', () => {
    expect(skyUsage(skyOf('COLOR = vec3(TIME);')).passColors).toEqual([]);
  });

  it('reads POSITION of a sky that reads it, and not TIME', () => {
    expect(skyUsage(skyOf('COLOR = vec3(POSITION.x);'))).toMatchObject({ time: false, position: true });
  });

  it('holds a buffer for a uniform that is not a sampler', () => {
    const source = 'shader_type sky;\nuniform float tint;\nvoid sky() {}\n';
    expect(skyUsage(source).hasBufferUniforms).toBe(true);
  });

  it('holds no buffer for samplers alone, as Godot binds them apart (edge case)', () => {
    const source = 'shader_type sky;\nuniform sampler2D stars;\nvoid sky() {}\n';
    expect(skyUsage(source).hasBufferUniforms).toBe(false);
  });

  it('names the samplers marked source_color', () => {
    const source =
      'shader_type sky;\nuniform sampler2D stars : source_color;\nuniform sampler2D noise;\nvoid sky() {}\n';
    expect(skyUsage(source).samplers).toEqual({
      stars: { kind: 'flat', isColor: true },
      noise: { kind: 'flat', isColor: false },
    });
  });

  it('names the texture each sampler reads, and leaves out a uniform that is no sampler', () => {
    const source =
      'shader_type sky;\nuniform samplerCube sky_box;\nuniform sampler3D clouds;\nuniform float tint;\nvoid sky() {}\n';
    expect(skyUsage(source).samplers).toEqual({
      sky_box: { kind: 'cube', isColor: false },
      clouds: { kind: 'volume', isColor: false },
    });
  });
});
