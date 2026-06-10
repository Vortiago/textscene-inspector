export const meta = {
  name: 'vendor-ld58-ui',
  description: 'Vendor the 7 ld-58 2D-UI scenes as script-stripped fixtures',
  phases: [{ title: 'Vendor UI scenes', detail: 'one agent per scene' }],
};

// Both paths are passed at invocation (Workflow scripts have no filesystem/
// process access): `src` is the external ld-58 Godot project that lives OUTSIDE
// this repo; `root` is this repo, under which scenes are vendored to scenes/ld58/.
//   Workflow({ name: 'vendor-ld58-ui', args: { src: '/abs/path/to/ld-58', root: '/abs/path/to/repo' } })
const SRC = args?.src;
const ROOT = args?.root;
if (!SRC || !ROOT) {
  throw new Error(
    "vendor-ld58-ui: pass { src, root } via args, e.g. Workflow({ name: 'vendor-ld58-ui', args: { src: '/abs/ld-58', root: '/abs/repo' } })"
  );
}
const DST = `${ROOT}/scenes/ld58`;

// res:// is rooted at the ld-58 project, mirrored under scenes/ld58/ preserving
// subpaths so each scene's `res://...` refs resolve to /fixtures/... at runtime.
const SCENES = [
  { rel: 'ClueContainer.tscn' },
  { rel: 'ClueItem.tscn' },
  { rel: 'Scenes/AboutDialog/AboutDialog.tscn' },
  { rel: 'Scenes/DialogSystem/DialogSystem.tscn' },
  { rel: 'Scenes/EndGameDialog/EndGameDialog.tscn' },
  { rel: 'Scenes/GameUI/GameUI.tscn' },
  { rel: 'Scenes/StartScreen/StartScreen.tscn' },
];

const SHARED = `
You are vendoring ONE Godot 4 scene from the ld-58 project into the TextScene
Inspector repo as a previewable fixture. This is a mechanical, faithful text
transform — preserve the scene's visual/structural content EXACTLY, only strip
what we can't render.

STRICT RULES:
- Read the ORIGINAL from its absolute source path (it lives OUTSIDE the worktree).
- Write the vendored copy with the Write tool to its absolute target path
  (create parent dirs as needed — Write does this).
- Do NOT touch any other file. Do NOT run builds/tests/git. You MAY read other
  files to understand the format.

THE TRANSFORM (apply to the copy, keep everything else byte-faithful):
1. REMOVE every C#/GDScript script dependency, because we don't execute scripts
   and the .cs/.gd files are not vendored:
   - Delete each line that is an '[ext_resource type="Script" ...]' header.
   - Delete each node property line of the form 'script = ExtResource("...")'.
   - Do NOT remove ext_resources of OTHER types (Texture2D, PackedScene,
     etc.) or any sub_resource — those are visual and MUST stay.
2. RECOMPUTE the header's load_steps. Godot's rule:
     load_steps = 1 + (number of [ext_resource] lines that REMAIN) + (number of [sub_resource] lines)
   Rewrite the '[gd_scene load_steps=N format=3 ...]' first line with the new N.
   (Keep format=3 and the uid="..." attribute if present, untouched.)
3. Keep ALL res:// reference paths EXACTLY as they are (do not rewrite them) —
   the repo mirrors the full res:// structure, so they resolve as-is.
4. Keep every [node], [sub_resource] (StyleBoxFlat/StyleBoxEmpty/etc.), node
   properties (anchors, offsets, theme_override_*, text, layout_mode, …),
   the remaining Texture2D/PackedScene ext_resources, and connections.

VERIFY before returning: the copy has zero 'type="Script"' and zero
'script = ExtResource' occurrences, the load_steps count is correct, and the
[node ...] / [sub_resource ...] counts are UNCHANGED from the original.
`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scene', 'targetPath', 'scriptsStripped', 'newLoadSteps', 'nodeCount', 'controlTypes', 'summary'],
  properties: {
    scene: { type: 'string' },
    targetPath: { type: 'string' },
    scriptsStripped: { type: 'number', description: 'count of Script ext_resources removed' },
    newLoadSteps: { type: 'number' },
    nodeCount: { type: 'number' },
    subResourceCount: { type: 'number' },
    remainingExtResources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { type: { type: 'string' }, path: { type: 'string' } },
        required: ['type', 'path'],
      },
    },
    controlTypes: { type: 'array', items: { type: 'string' }, description: 'distinct 2D-UI node types used' },
    summary: { type: 'string' },
  },
};

phase('Vendor UI scenes');
log(`Vendoring ${SCENES.length} ld-58 UI scenes (script-stripped) into scenes/ld58/`);

const results = await parallel(
  SCENES.map((s) => () =>
    agent(
      `${SHARED}

=================== YOUR SCENE: ${s.rel} ===================
SOURCE (read this):   ${SRC}/${s.rel}
TARGET (write here):  ${DST}/${s.rel}

Produce the script-stripped vendored copy at the target path, then return your
manifest (counts, new load_steps, remaining non-script ext_resources, the
distinct 2D-UI node types it uses).`,
      { label: `vendor:${s.rel}`, phase: 'Vendor UI scenes', schema: SCHEMA }
    )
  )
);

return { vendored: results.filter(Boolean), failed: SCENES.map((s) => s.rel).filter((_, i) => !results[i]) };
