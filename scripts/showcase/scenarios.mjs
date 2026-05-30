/**
 * Showcase scenario registry. Each entry maps a clip name to the fixture label,
 * a caption, and a `run(page, helpers)` that drives the previewer to demonstrate
 * the ACTUAL feature — static-geometry features orbit; interactive features
 * (camera switching) perform the real interaction.
 *
 * Add a clip by adding an entry here, then: node scripts/showcase/run.mjs <name>
 */

/** Static-geometry showcase: select, auto-fit, orbit, poster. */
function orbitScene(label, orbitOpts = {}) {
  return async (page, h) => {
    await h.selectScene(page, label);
    await h.orbit(page, orbitOpts);
    await page.waitForTimeout(300);
    await h.poster();
    await page.waitForTimeout(300);
  };
}

export const scenarios = {
  'all-primitives': {
    label: 'All Primitives',
    caption:
      'A green ground plane holds a cluster of primitive meshes (prism, torus, capsule), each with its own material, orbited to show them as solid 3D geometry.',
    run: orbitScene('All Primitives'),
  },
  'all-meshes': {
    label: 'All Meshes',
    caption:
      'Every primitive mesh type — cube, sphere, cylinder, capsule, plane, torus, prism — rendered together in a row with distinct materials.',
    run: orbitScene('All Meshes'),
  },
  'csg-box': {
    label: 'Csg Box',
    caption: 'CSGBox3D shapes render as solid lit geometry with materials (not placeholders).',
    run: orbitScene('Csg Box'),
  },
  'csg-cylinder': {
    label: 'Csg Cylinder',
    caption: 'CSGCylinder3D renders as a solid cylinder, including the tapered cone form.',
    run: orbitScene('Csg Cylinder'),
  },
  'material-metallic': {
    label: 'Material Metallic',
    caption:
      'A high-metallic, low-roughness StandardMaterial3D sphere with a tight specular highlight, orbited under the directional light.',
    run: orbitScene('Material Metallic'),
  },
  'material-emissive': {
    label: 'Material Emissive',
    caption: 'An emissive material self-illuminates uniformly regardless of light direction.',
    run: orbitScene('Material Emissive'),
  },
  'world-environment': {
    label: 'World Environment Basic',
    caption: 'WorldEnvironment fills the background with its color and ambient-lights the scene.',
    run: orbitScene('World Environment Basic'),
  },
  'label3d': {
    label: 'Label3d',
    caption: 'Label3D billboarded 3D text nodes with color and outline variations, facing the camera.',
    run: orbitScene('Label3d'),
  },
  'mixed-nodes': {
    label: 'Mixed Nodes',
    caption: 'A mixed node hierarchy of multiple mesh instances rendered together with correct lighting.',
    run: orbitScene('Mixed Nodes'),
  },
  'physics-bodies': {
    label: 'Physics Bodies',
    caption:
      'StaticBody3D / Area3D render as transform groups positioning their child meshes; AudioStreamPlayer renders nothing visible (no fallback cube).',
    run: orbitScene('Physics Bodies'),
  },

  // Always-current hallway progress clip — the self-contained CSG hallway mockup.
  hallway: {
    label: 'Hallway Mockup',
    caption:
      'The ld-58 hallway mockup: CSG corridor geometry (floor / walls / ceiling), portrait frames, and Label3D name plates — a self-contained scene that tracks 3D-rendering progress toward the full hallway.',
    run: async (page, h) => {
      await h.selectScene(page, 'Hallway Mockup');
      await h.orbit(page, { dx: 330, dy: 22, steps: 80 });
      await page.waitForTimeout(300);
      await h.poster();
      await page.waitForTimeout(300);
    },
  },

  // Interactive: actually switch the active render camera between Camera3D nodes.
  'multi-camera': {
    label: 'Multi Camera',
    caption:
      'Selecting each Camera3D node and clicking "Use This Camera" switches the viewport to that camera\'s point of view (perspective, top-down, side, orthographic), then resets to free orbit.',
    run: async (page, h) => {
      await h.selectScene(page, 'Multi Camera');
      // Free-orbit overview first — shows the test box + the four camera gizmos.
      // This is the poster (a clear thumbnail); the video then demonstrates the
      // actual switching between each camera's point of view.
      await h.orbit(page, { dx: 130, dy: 22, steps: 32 });
      await h.poster();
      await h.expandTree(page);
      const cams = await h.cameraNodePaths(page);
      for (let i = 0; i < cams.length; i++) {
        await h.clickNode(page, { path: cams[i] });
        await h.useThisCamera(page);
      }
      if (cams.length === 0) await h.orbit(page, {}); // no cameras → keep the clip non-empty
      await h.resetCamera(page);
    },
  },
};
