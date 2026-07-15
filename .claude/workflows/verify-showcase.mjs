export const meta = {
  name: 'verify-showcase',
  description: 'Vision-review every regenerated showcase poster vs its caption',
  phases: [{ title: 'Review posters', detail: 'one vision agent per clip' }],
};

// Repo root, passed at invocation (Workflow scripts have no filesystem/process
// access): Workflow({ name: 'verify-showcase', args: '/abs/path/to/repo' })
const ROOT = typeof args === 'string' ? args : args?.root;
if (!ROOT) {
  throw new Error(
    "verify-showcase: pass the repo root via args, e.g. Workflow({ name: 'verify-showcase', args: '/abs/path/to/repo' })"
  );
}
const WEB = `${ROOT}/docs/showcase/web`;

const CLIPS = [
  ['all-primitives', 'A green ground plane holds primitive meshes (prism, torus, capsule), each with its own material, as solid 3D geometry.'],
  ['all-meshes', 'Every primitive mesh type (cube, sphere, cylinder, capsule, plane, torus, prism) rendered together with distinct materials.'],
  ['csg-box', 'CSGBox3D shapes render as solid lit geometry with materials (not magenta placeholders).'],
  ['csg-cylinder', 'CSGCylinder3D renders as a solid cylinder, including a tapered cone form.'],
  ['material-metallic', 'A high-metallic, low-roughness sphere with a tight specular highlight.'],
  ['material-emissive', 'An emissive material sphere that self-illuminates uniformly.'],
  ['world-environment', 'WorldEnvironment fills the background with its color and ambient-lights the scene.'],
  ['label3d', 'Label3D billboarded 3D text nodes with color/outline variations, facing the camera.'],
  ['mixed-nodes', 'A mixed hierarchy of multiple mesh instances rendered with correct lighting.'],
  ['physics-bodies', 'StaticBody3D / Area3D transform groups positioning child meshes; AudioStreamPlayer renders nothing.'],
  ['hallway', 'A self-contained CSG hallway mockup: a corridor (floor/walls/ceiling) with portrait frames and Label3D name plates.'],
  ['dcc-layout', 'The 3-column DCC chrome showing the CSG hallway mockup in the center viewport.'],
  ['multi-camera', 'A multi-camera scene; the poster shows a free-orbit overview of the scene geometry.'],
];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clip', 'sceneRendered', 'chromeCorrect', 'matchesCaption', 'severity', 'issues'],
  properties: {
    clip: { type: 'string' },
    sceneRendered: { type: 'boolean', description: 'is the 3D scene/feature visibly rendered (NOT a blank/black/empty viewport)?' },
    chromeCorrect: { type: 'boolean', description: 'is the 3-column chrome present + correct (see prompt)?' },
    matchesCaption: { type: 'boolean' },
    severity: { type: 'string', description: "ok | minor | broken" },
    issues: { type: 'array', items: { type: 'string' } },
  },
};

const CHROME = `
Expected app chrome (TextScene Inspector — a Godot .tscn previewer), Split Dock layout:
- A TOP BAR: the brand text "TextScene Inspector", a "Hide Source"/"Show Source" toggle, an
  "Open .tscn" button, a scene chip showing the current scene name, a "3D"/"2D" segmented
  toggle, and "Collisions"/"Labels"/"Navigation"/"Grid" checkboxes.
- An optional LEFT source pane (raw .tscn text) when Source is shown.
- A CENTER viewport (dark) showing the 3D scene.
- A RIGHT dock: "SCENE TREE" (search + node tree) on top, a tabbed
  "Inspector / Resources / Cameras" detail pane below it.
chromeCorrect = true only if the top bar + right dock + center viewport are all present and not
visibly broken (no doubled titles, no full-width misplaced buttons, no overlapping panels).
`;

phase('Review posters');
log(`Vision-reviewing ${CLIPS.length} showcase posters`);

const results = await parallel(
  CLIPS.map(([name, caption]) => () =>
    agent(
      `You are reviewing a single showcase screenshot (poster frame) of the TextScene Inspector web app.
${CHROME}
This clip is "${name}". Its intended feature/content: ${caption}

Use the Read tool to view the image at:
  ${WEB}/${name}.png

Then judge:
- sceneRendered: is the scene/feature visibly rendered in the center viewport (NOT blank/black/empty)?
- chromeCorrect: is the 3-column chrome present and correct per the spec above?
- matchesCaption: does what you see plausibly match the intended feature?
- severity: "broken" if the viewport is blank/black or the chrome is badly wrong; "minor" for small
  cosmetic issues; "ok" otherwise.
- issues: concrete, specific visual problems (empty list if none).
Return ONLY the structured verdict.`,
      { label: `review:${name}`, phase: 'Review posters', schema: SCHEMA }
    )
  )
);

const verdicts = results.filter(Boolean);
return {
  total: verdicts.length,
  broken: verdicts.filter((v) => v.severity === 'broken'),
  minor: verdicts.filter((v) => v.severity === 'minor'),
  ok: verdicts.filter((v) => v.severity === 'ok').map((v) => v.clip),
};
