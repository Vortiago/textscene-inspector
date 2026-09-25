/**
 * The showcase scenarios: each clip name maps to the fixture's label, a caption and a
 * `run(page, helpers)`. The recorder opens the fixture through `?fixture=`, so the scene is loaded
 * and framed when `run` starts. Capture the poster early (h.poster()), so the thumbnail shows the
 * feature. To add a clip, add an entry and run `node scripts/showcase/run.mjs <name>`.
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

/** 2D-canvas scene: a static front-on poster, with no orbit, since 2D content is flat. */
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

  // 2D canvas: real Godot demo scenes, rendered front-on by the flat-2D camera.
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

  // The self-contained CSG hallway mockup, which renders fully.
  hallway: orbitScene(
    'Hallway Mockup',
    'A self-contained CSG hallway mockup: corridor (floor / walls / ceiling), portrait frames, and Label3D name plates — tracks 3D-rendering progress.',
    { dx: 320, dy: 20, steps: 70 }
  ),

  // Layout tour of the Split Dock shell (ADR-0007) and the 2D Control overlay: it orbits the CSG
  // hallway mockup, switches to a Control dialog scene in the command palette, then flips to 2D.
  'dcc-layout': {
    label: 'Hallway Mockup',
    caption:
      'The Split Dock shell (ADR-0007): a large viewport beside one right master-detail dock — scene tree on top, a tabbed Inspector / Resources / Cameras pane below that follows the selection. Orbits the self-contained CSG hallway mockup, switches to the UI Dialog scene via the ⌘K command palette, then flips to 2D mode, where the Control overlay renders the dialog UI faithfully.',
    run: async (page, h) => {
      await h.poster();
      await h.orbit(page, { dx: 280, dy: 18, steps: 48 });
      await h.selectScene(page, 'Ui Dialog');
      const btn2d = page.getByRole('button', { name: '2D' });
      if (await btn2d.count()) await btn2d.first().click();
      await page.waitForSelector('[data-control-overlay="true"]', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2200); // hold on the rendered 2D UI
    },
  },

  // The 2D-UI discoverability hint (ADR-0006): a Control-carrying scene opens in
  // the default 3D viewport, the "switch to 2D" hint floats over it, and a
  // click flips to the 2D overlay that renders the dialog.
  'ui-hint': {
    label: 'Ui Dialog',
    caption:
      'A 2D-UI scene (a field-journal dialog) opens in the default 3D viewport; since it carries Control nodes, the shell floats a "switch to 2D" hint. Clicking the hint flips to the 2D overlay, which renders the dialog faithfully.',
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

  // The room's floor, walls and crate reference three textures that are not bundled
  // (res://demo/missing/*), so it loads flat-shaded and the Resources tab lists them as missing.
  // An upload for each path drives the late-arrival pipeline, and the surfaces gain textures live.
  'missing-upload': {
    label: 'Missing Resources',
    caption:
      'A lit room whose floor, walls, and crate reference textures that are not bundled — it loads flat-shaded and the shell’s Resources tab lists all three paths as missing (⚠). Uploading a file for each path drives the late-arrival pipeline (provideFile → useResource → re-render): the rows flip to uploaded (✓) and the surfaces gain their textures live, on camera — proving the request-missing-then-upload-and-use flow end to end.',
    run: async (page, h) => {
      await h.poster('missing-upload-before'); // flat-shaded "before"
      await h.orbit(page, { dx: 120, dy: 14, steps: 26 }); // show the untextured room
      await h.openDetailTab(page, 'Resources'); // reveal the missing list
      await page.waitForTimeout(700);
      await h.uploadResource(
        page,
        'res://demo/missing/floor_albedo.png',
        'scenes/demos/2d/role_playing_game/grid_movement/grid/tiles/ground_grass.png'
      );
      await h.uploadResource(
        page,
        'res://demo/missing/wall_albedo.png',
        'scenes/demos/2d/role_playing_game/theme/images/background.png'
      );
      await h.uploadResource(
        page,
        'res://demo/missing/crate_albedo.png',
        'scenes/demos/2d/physics_platformer/background/plank.png'
      );
      await page.waitForTimeout(700);
      await h.poster(); // The textured "after", which is the thumbnail.
      await h.orbit(page, { dx: 300, dy: 18, steps: 58 }); // orbit the now-textured room
    },
  },
};
