/**
 * The corpus shaders on which the transpiler disagrees with Godot now, each with the issue that
 * owns the fault. The list only shrinks: a mismatch not listed here fails the test, and a listed
 * shader that agrees with Godot fails it too, so the pull request that fixes it removes it.
 */

const PREPROCESSOR_IN_TOKENIZER = {
  owner: '#1823',
  cause:
    "the tokenizer refuses `#` with Godot's message for an unknown character, before any row can name the preprocessor's owner (#1828)",
};

export const KNOWN_MISMATCHES = Object.fromEntries(
  [
    'demos/xr/openxr_spectator_view/shaders/eye_output.gdshader',
    'docs/tutorials/shaders/shader_reference/shader_preprocessor.rst#1',
    'docs/tutorials/shaders/shader_reference/shader_preprocessor.rst#13',
    'docs/tutorials/shaders/shader_reference/shader_preprocessor.rst#18',
    'rejected/demos/xr/openxr_spectator_view/shaders/eye_output.gdshader',
    'rejected/docs/tutorials/shaders/shader_reference/shader_preprocessor.rst#1',
    'rejected/docs/tutorials/shaders/shader_reference/shader_preprocessor.rst#13',
    'rejected/docs/tutorials/shaders/shader_reference/shader_preprocessor.rst#18',
  ].map((id) => [id, PREPROCESSOR_IN_TOKENIZER])
);
