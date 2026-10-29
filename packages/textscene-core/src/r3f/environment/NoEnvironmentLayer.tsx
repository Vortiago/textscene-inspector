/**
 * `<NoEnvironmentLayer>`: a 3D root that has no Environment. Godot clears it to the project's clear
 * colour, multisamples and blends it in its HDR buffer, then tonemaps it with the pass defaults:
 * LINEAR, exposure 1 and white 1 (`tone_mapper.h:177-180`, kept with no Environment by
 * `renderer_scene_render_rd.cpp:724-731`). The root's compositor tonemaps it with those defaults.
 */

import { ProjectClearColor } from '../ProjectClearColor';

export function NoEnvironmentLayer() {
  return <ProjectClearColor />;
}
