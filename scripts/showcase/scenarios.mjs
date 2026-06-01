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

/** 2D-canvas scene: a static front-on poster (no orbit — 2D content is flat). */
function flatScene(label, caption) {
  return {
    label,
    caption,
    run: async (page, h) => {
      await h.poster();
      await page.waitForTimeout(1500); // hold on the flat 2D render
    },
  };
}

export const scenarios = {
  'all-primitives': orbitScene(
    'All Primitives',
    'A green ground plane holds primitive meshes (prism, torus, capsule), each with its own material, orbited as solid 3D geometry.'
  ),

  // 2D canvas — real Godot demo scenes, rendered front-on by the flat-2D camera.
  pong: flatScene(
    'Pong',
    'The Godot "Pong" demo rendered from its real .tscn: cyan and magenta paddles, the ball, and the dashed centre separator — Sprite2D quads positioned by their Area2D parents, with hierarchical CanvasItem modulate tinting the paddles.'
  ),
  'dodge-player': flatScene(
    'Dodge Player',
    'The "Dodge the Creeps" player from its real .tscn: an AnimatedSprite2D draws the current animation frame (resolved from a SpriteFrames resource) as a 2D sprite.'
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
    "The unfurnished ld-58 hallway geometry with its actual wall/wood textures (PlaneMesh walls + instanced WallSection/CornerColumn components) — the architectural shell the full scene is furnished into.",
    { dx: 320, dy: 20, steps: 70 }
  ),

  // The full furnished ld-58 murder scene — geometry + instanced GLB props +
  // portrait frames + the crime-scene tableau (286 nodes). The marquee clip:
  // the entire res:// dependency closure rendered end to end.
  'hallway-full': orbitScene(
    'Hallway',
    'The complete ld-58 "Hallway Murder" scene (286 nodes): textured walls and floor, instanced GLB portrait frames carrying their painted portraits, doors, roof lamps, and the full crime-scene tableau — corner table, body, and evidence props. The entire res:// dependency closure rendered end to end.',
    { dx: 300, dy: 22, steps: 64 }
  ),

  // Layout tour: the 3-column DCC chrome + the 2D Control overlay. Opens on the
  // textured hallway (3D), orbits, then switches to a rich ld-58 dialog scene
  // and flips to 2D mode so the overlay renders its Control UI.
  'dcc-layout': {
    label: 'Hallway',
    caption:
      'The 3-column DCC chrome — Scene outliner (left), viewport (center), Inspector (right). Orbits the fully furnished ld-58 murder scene, then switches to the EndGameDialog scene and flips to 2D mode, where the Control overlay renders the dialog UI faithfully.',
    run: async (page, h) => {
      await h.poster();
      await h.orbit(page, { dx: 280, dy: 18, steps: 48 });
      await h.selectScene(page, 'End Game Dialog');
      const btn2d = page.getByRole('button', { name: '2D' });
      if (await btn2d.count()) await btn2d.first().click();
      await page.waitForSelector('[data-control-overlay="true"]', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2200); // hold on the rendered 2D UI
    },
  },

  // The 2D-UI discoverability hint (ADR-0006): a Control-only scene opens in
  // the default 3D viewport, the "switch to 2D" hint floats over it, and a
  // click flips to the 2D overlay that renders the dialog.
  'ui-hint': {
    label: 'End Game Dialog',
    caption:
      'A 2D-UI scene (EndGameDialog) opens in the default 3D viewport; since it carries Control nodes, the shell floats a "switch to 2D" hint. Clicking the hint flips to the 2D overlay, which renders the dialog faithfully.',
    run: async (page, h) => {
      await page.waitForTimeout(700); // let the hint appear over the empty 3D viewport
      await h.poster(); // capture the hint
      const hint = page.getByRole('button', { name: /switch to 2D/i });
      if (await hint.count()) await hint.first().click();
      await page.waitForSelector('[data-control-overlay="true"]', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1800); // hold on the rendered 2D dialog
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
