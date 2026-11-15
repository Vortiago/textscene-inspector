/**
 * The shader options a probe runs with on the transpiler's side: Godot's harness writes the
 * probe's shader and its includes into the project's root, so an include resolves the same way.
 * It sits in the probe page's folder, the only folder the page is served from.
 */

const ROOT = 'res://';

/** The options for a probe whose `.gdshaderinc` files are `includes`, by file name. */
export function probeShaderOptions(includes = {}) {
  return {
    file: `${ROOT}probe.gdshader`,
    readInclude: (path) => {
      const name = path.startsWith(ROOT) ? path.slice(ROOT.length) : path;
      return Object.hasOwn(includes, name) ? { path: ROOT + name, code: includes[name] } : undefined;
    },
  };
}
