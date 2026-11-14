/**
 * The mode table of each shader type, read from the `DefaultIdentifierActions` that Godot's C++
 * fills before `ShaderCompiler::initialize`: the GLSL text of each built-in, the define each used
 * built-in and render mode adds, the samplers of built-in textures and the binding layout.
 */

import { lineAt } from '../godot-shader-language/cppText.mjs';

/** Where each shader type fills its actions, under `servers/rendering/`. */
export const MODE_TABLE_SOURCES = {
  sky: 'renderer_rd/environment/sky.cpp',
  fog: 'renderer_rd/environment/fog.cpp',
  particles: 'renderer_rd/storage_rd/particles_storage.cpp',
  spatial: 'renderer_rd/forward_clustered/scene_shader_forward_clustered.cpp',
  canvas_item: 'renderer_rd/renderer_canvas_render_rd.cpp',
};

/** `String::num` with no decimals given (`core/string/ustring.cpp:1405`): 14 decimals, trailing zeros cut. */
export function godotNum(value) {
  const decimals = Math.abs(value) > 10 ? 14 - Math.floor(Math.log10(Math.abs(value))) : 14;
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

const MATH_CONSTANTS = { 'Math::PI': Math.PI, 'Math::TAU': 2 * Math.PI, 'Math::E': Math.E };

/** The count of user data slots of a particle (`particles_storage.h`, `MAX_USERDATAS`). */
const MAX_USERDATAS = 6;

const MAPS = ['renames', 'usage_defines', 'render_mode_defines', 'custom_samplers'];

/** The value of a C++ expression of the actions: a string literal, `String::num` of a constant, a number or an enumerator. */
function valueOf(expression) {
  const text = expression.trim();
  const literal = /^"((?:[^"\\]|\\.)*)"$/.exec(text);
  if (literal) return JSON.parse(`"${literal[1]}"`);
  const num = /^String::num\((Math::\w+)\)$/.exec(text);
  if (num && num[1] in MATH_CONSTANTS) return godotNum(MATH_CONSTANTS[num[1]]);
  if (/^-?\d+$/.test(text)) return Number(text);
  if (text === 'true' || text === 'false') return text === 'true';
  const enumerator = /(?:^|::)(\w+)$/.exec(text);
  if (enumerator) return enumerator[1];
  throw new Error(`expected a literal, String::num or an enumerator in the actions, found ${text}`);
}

/**
 * The statements between `DefaultIdentifierActions actions;` and `compiler.initialize(actions)`,
 * each with its line. A loop over the particle user data is unrolled. A block under a project
 * setting is read as at its default, `false`, so a block under `!setting` is read.
 */
function statements(cpp, file) {
  const start = cpp.indexOf('ShaderCompiler::DefaultIdentifierActions actions;');
  const end = cpp.lastIndexOf('\n', cpp.indexOf('compiler.initialize(actions);', start));
  if (start < 0 || end < 0) throw new Error(`expected the actions of a shader type in ${file}, found none`);
  const firstLine = lineAt(cpp, start);
  const lines = cpp.slice(start, end).split('\n');
  const out = [];
  for (let index = 1; index < lines.length; index += 1) {
    const text = lines[index].replace(/\/\/.*$/, '').trim();
    const line = firstLine + index;
    if (text === '' || text === '}' || /^bool \w+ = GLOBAL_GET\(/.test(text)) continue;
    if (/^if \(!\w+\) \{$/.test(text)) continue;
    if (/^for \(int i = 0; i < ParticlesShader::MAX_USERDATAS; i\+\+\) \{$/.test(text)) {
      const body = [];
      while (!/^\}$/.test(lines[++index].trim())) body.push(lines[index].trim());
      for (let slot = 1; slot <= MAX_USERDATAS; slot += 1)
        for (const each of body) {
          if (each.startsWith('String udname')) continue;
          const unrolled = each
            .replaceAll('udname', `"USERDATA${slot}"`)
            .replaceAll('" + itos(i + 1) + "', `${slot}`)
            .replace(/" \+ itos\(i \+ 1\);$/, `${slot}";`);
          out.push({ text: unrolled, line });
        }
      continue;
    }
    out.push({ text, line });
  }
  return out;
}

/** The mode table of the shader type whose actions `cpp` fills. */
export function modeTable(cpp, file) {
  const table = Object.fromEntries(MAPS.map((map) => [map, {}]));
  for (const { text, line } of statements(cpp, file)) {
    const entry = /^actions\.(\w+)\["(\w+)"\] = (.+);$/.exec(text);
    if (entry && MAPS.includes(entry[1])) {
      table[entry[1]][entry[2]] = valueOf(entry[3]);
      continue;
    }
    const field = /^actions\.(\w+) = (.+);$/.exec(text);
    if (!field) throw new Error(`${file}:${line}: expected an assignment to the actions, found ${text}`);
    table[field[1]] = valueOf(field[2]);
  }
  return table;
}
