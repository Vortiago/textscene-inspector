const ROOT = 'res://';

// Godot's harness writes a probe's includes beside its shader in res://. Here, as the page is served alone.
export function probeShaderOptions(includes = {}) {
  return {
    file: `${ROOT}probe.gdshader`,
    readInclude: (path) => {
      const name = path.startsWith(ROOT) ? path.slice(ROOT.length) : path;
      return Object.hasOwn(includes, name) ? { path: ROOT + name, code: includes[name] } : undefined;
    },
  };
}
