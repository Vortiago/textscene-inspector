import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const IS_CONST = 1;
const IS_STATIC = 2;
const IS_VARARG = 4;

/** The `extension_api.json` that `godot --dump-extension-api` writes, as text. */
export function dumpExtensionApi() {
  const directory = mkdtempSync(join(tmpdir(), 'extension-api-'));
  try {
    const run = spawnSync('godot', ['--headless', '--dump-extension-api'], {
      cwd: directory,
      encoding: 'utf8',
    });
    if (run.error)
      throw new Error(`run godot --dump-extension-api: ${run.error.message}. Godot must be on the path`);
    if (run.status !== 0)
      throw new Error(`godot --dump-extension-api exited with ${run.status}:\n${run.stderr}`);
    return readFileSync(join(directory, 'extension_api.json'), 'utf8');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const methodFlags = (method) =>
  (method.is_const ? IS_CONST : 0) | (method.is_static ? IS_STATIC : 0) | (method.is_vararg ? IS_VARARG : 0);

const argumentRow = (argument) =>
  argument.default_value === undefined ? [argument.type] : [argument.type, argument.default_value];

/** Each builtin type of `api`, the parsed extension API: its members, indexing and methods. */
export function builtinTypes(api) {
  return api.builtin_classes.map((builtin) => ({
    name: builtin.name,
    members: (builtin.members ?? []).map((member) => [member.name, member.type]),
    indexing: builtin.indexing_return_type ?? '',
    isKeyed: builtin.is_keyed,
    methods: (builtin.methods ?? []).map((method) => [
      method.name,
      method.return_type ?? '',
      methodFlags(method),
      method.hash,
      (method.arguments ?? []).map(argumentRow),
    ]),
  }));
}
