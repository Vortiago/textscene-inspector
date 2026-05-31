/**
 * Showcase scenario registry. Each entry maps a clip name to the fixture's
 * dropdown label, a caption, and a `run(page, helpers)` that demonstrates the
 * feature. The recorder opens the app DIRECTLY on the fixture via `?fixture=`
 * (no default-scene detour), so `run` is FEATURE-ONLY — the scene is already
 * loaded and auto-framed when it starts. Capture the poster early (h.poster())
 * so the thumbnail shows the feature, not a transitional frame.
 *
 * Add a clip by adding an entry here, then: node scripts/showcase/run.mjs <name>
 */

/** Static-geometry showcase: poster immediately, then a tight orbit. */
function orbitScene(label, caption, orbitOpts = {}) {
  return {
    label,
    caption,
    run: async (page, h) => {
      await h.poster();
      await h.orbit(page, { dx: 230, dy: 32, steps: 48, ...orbitOpts });
    },
  };
}

export const scenarios = {
  'all-primitives': orbitScene(
    'All Primitives',
    'A green ground plane holds primitive meshes (prism, torus, capsule), each with its own material, orbited as solid 3D geometry.'
  ),
  'all-meshes': orbitScene(
    'All Meshes',
    'Every primitive mesh type — cube, sphere, cylinder, capsule, plane, torus, prism — rendered together with distinct materials.'
  ),
  'csg-box': orbitScene('Csg Box', 'CSGBox3D shapes render as solid lit geometry with materials (not placeholders).'),
  'csg-cylinder': orbitScene('Csg Cylinder', 'CSGCylinder3D renders as a solid cylinder, including the tapered cone form.'),
  'material-metallic': orbitScene(
    'Material Metallic',
    'A high-metallic, low-roughness StandardMaterial3D sphere with a tight specular highlight under the directional light.'
  ),
  'material-emissive': orbitScene(
    'Material Emissive',
    'An emissive material self-illuminates uniformly regardless of light direction.'
  ),
  'world-environment': orbitScene(
    'World Environment Basic',
    'WorldEnvironment fills the background with its color and ambient-lights the scene.'
  ),
  label3d: orbitScene(
    'Label3d',
    'Label3D billboarded 3D text nodes with color and outline variations, facing the camera.'
  ),
  'mixed-nodes': orbitScene(
    'Mixed Nodes',
    'A mixed node hierarchy of multiple mesh instances rendered together with correct lighting.'
  ),
  'physics-bodies': orbitScene(
    'Physics Bodies',
    'StaticBody3D / Area3D render as transform groups positioning their child meshes; AudioStreamPlayer renders nothing visible.'
  ),

  // CSG hallway mockup — self-contained, renders fully today.
  hallway: orbitScene(
    'Hallway Mockup',
    'The ld-58 hallway mockup: CSG corridor (floor / walls / ceiling), portrait frames, and Label3D name plates — self-contained, tracks 3D-rendering progress.',
    { dx: 320, dy: 20, steps: 70 }
  ),

  // Full ld-58 hallway GEOMETRY — real textured walls/columns via the res://
  // dependency closure (WallSection / CornerColumn + OpenGameArt textures).
  'hallway-ld58': orbitScene(
    'Hallway Geometry',
    "The real ld-58 hallway geometry with its actual wall/wood textures (PlaneMesh walls + instanced WallSection/CornerColumn components). Tracks progress toward the full furnished hallway — triplanar tiling is approximate for now.",
    { dx: 320, dy: 20, steps: 70 }
  ),

  // Layout tour: the 3-column DCC chrome + the 2D Control overlay. Opens on the
  // textured hallway (3D), orbits, then switches to a rich ld-58 dialog scene
  // and flips to 2D mode so the overlay renders its Control UI.
  'dcc-layout': {
    label: 'Hallway Geometry',
    caption:
      'The 3-column DCC chrome — Scene outliner (left), viewport (center), Inspector (right). Orbits the textured ld-58 hallway, then switches to the EndGameDialog scene and flips to 2D mode, where the Control overlay renders the dialog UI faithfully.',
    run: async (page, h) => {
      await h.poster();
      await h.orbit(page, { dx: 280, dy: 18, steps: 48 });
      await h.selectScene(page, 'EndGameDialog');
      const btn2d = page.getByRole('button', { name: '2D' });
      if (await btn2d.count()) await btn2d.first().click();
      await page.waitForSelector('[data-control-overlay="true"]', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2200); // hold on the rendered 2D UI
    },
  },

  // Interactive: actually switch the active render camera between Camera3D nodes.
  'multi-camera': {
    label: 'Multi Camera',
    caption:
      'Selecting each Camera3D node and clicking "Use This Camera" switches the viewport between the cameras’ points of view (perspective, top-down, side, orthographic) in the video, then resets to free orbit.',
    run: async (page, h) => {
      await h.orbit(page, { dx: 130, dy: 22, steps: 28 }); // overview of the camera setup
      await h.poster();
      await h.expandTree(page);
      const cams = await h.cameraNodePaths(page);
      for (let i = 0; i < cams.length; i++) {
        await h.clickNode(page, { path: cams[i] });
        await h.useThisCamera(page);
      }
      await h.resetCamera(page);
    },
  },
};
