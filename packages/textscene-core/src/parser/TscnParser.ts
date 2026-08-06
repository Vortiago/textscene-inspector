/**
 * Parses Godot TSCN text files into a structured format.
 *
 * Uses TscnParserCore + NodeRegistry-based node creation. Each node
 * type's `index.ts` self-registers its parser + property formatter on
 * import; this file imports each one for its side effect so the parser
 * sees the full set of registrations.
 */

// Side-effect imports: each module registers its parser + formatter on load.
import '../nodes/node/index.js';
import '../nodes/base/node3d/index.js';
import '../nodes/3d/meshinstance3d/index.js';
import '../nodes/3d/csg/csgbox3d/index.js';
import '../nodes/3d/csg/csgcylinder3d/index.js';
import '../nodes/3d/csg/csgsphere3d/index.js';
import '../nodes/3d/csg/csgtorus3d/index.js';
import '../nodes/3d/csg/csgcombiner3d/index.js';
import '../nodes/3d/csg/csgmesh3d/index.js';
import '../nodes/3d/csg/csgpolygon3d/index.js';
import '../nodes/3d/camera3d/index.js';
import '../nodes/3d/label3d/index.js';
import '../nodes/3d/sprite3d/index.js';
import '../nodes/audio/audiostreamplayer3d/index.js';
import '../nodes/animation/animationplayer/index.js';
import '../nodes/animation/animationtree/index.js';
import '../nodes/3d/lights/spotlight3d/index.js';
import '../nodes/3d/lights/directionallight3d/index.js';
import '../nodes/3d/lights/omnilight3d/index.js';
import '../nodes/3d/lights/arealight3d/index.js';
import '../nodes/3d/worldenvironment/index.js';
import '../nodes/physics/3d/staticbody3d/index.js';
import '../nodes/physics/3d/area3d/index.js';
import '../nodes/physics/3d/collisionshape3d/index.js';
// Non-visual nodes — transform-only groups, no own geometry (ADR-0008).
import '../nodes/physics/3d/characterbody3d/index.js';
import '../nodes/physics/3d/rigidbody3d/index.js';
import '../nodes/physics/3d/raycast3d/index.js';
import '../nodes/physics/3d/shapecast3d/index.js';
import '../nodes/physics/3d/springarm3d/index.js';
import '../nodes/physics/3d/animatablebody3d/index.js';
import '../nodes/physics/3d/physicalbone3d/index.js';
import '../nodes/physics/3d/vehiclebody3d/index.js';
import '../nodes/physics/3d/pinjoint3d/index.js';
import '../nodes/physics/3d/hingejoint3d/index.js';
import '../nodes/physics/3d/softbody3d/index.js';
import '../nodes/physics/3d/vehiclewheel3d/index.js';
import '../nodes/physics/3d/conetwistjoint3d/index.js';
import '../nodes/physics/3d/generic6dofjoint3d/index.js';
import '../nodes/physics/3d/sliderjoint3d/index.js';
import '../nodes/3d/skeleton3d/index.js';
import '../nodes/3d/particles/gpuparticles3d/index.js';
import '../nodes/3d/marker3d/index.js';
import '../nodes/3d/gridmap/index.js';
import '../nodes/3d/navigationregion3d/index.js';
import '../nodes/3d/decal/index.js';
import '../nodes/3d/remotetransform3d/index.js';
import '../nodes/3d/navigationagent3d/index.js';
import '../nodes/3d/navigationobstacle3d/index.js';
import '../nodes/paths/path3d/index.js';
import '../nodes/paths/pathfollow3d/index.js';
import '../nodes/audio/audiostreamplayer/index.js';
import '../nodes/audio/audiostreamplayer2d/index.js';
import '../nodes/2d/ui/control/index.js';
import '../nodes/2d/ui/colorrect/index.js';
import '../nodes/2d/ui/label/index.js';
import '../nodes/2d/ui/vboxcontainer/index.js';
import '../nodes/2d/ui/hboxcontainer/index.js';
import '../nodes/2d/ui/hsplitcontainer/index.js';
import '../nodes/2d/ui/vsplitcontainer/index.js';
import '../nodes/2d/ui/gridcontainer/index.js';
import '../nodes/2d/ui/centercontainer/index.js';
import '../nodes/2d/ui/margincontainer/index.js';
import '../nodes/2d/ui/scrollcontainer/index.js';
import '../nodes/2d/ui/panel/index.js';
import '../nodes/2d/ui/panelcontainer/index.js';
import '../nodes/2d/ui/subviewportcontainer/index.js';
import '../nodes/2d/ui/button/index.js';
import '../nodes/2d/ui/checkbox/index.js';
import '../nodes/2d/ui/optionbutton/index.js';
import '../nodes/2d/ui/lineedit/index.js';
import '../nodes/2d/ui/hslider/index.js';
import '../nodes/2d/ui/vslider/index.js';
import '../nodes/2d/ui/texturerect/index.js';
import '../nodes/2d/ui/richtextlabel/index.js';
import '../nodes/2d/ui/canvaslayer/index.js';
import '../nodes/2d/ui/basebutton/index.js';
import '../nodes/2d/ui/container/index.js';
import '../nodes/2d/ui/range/index.js';
import '../nodes/2d/ui/textedit/index.js';
import '../nodes/2d/ui/boxcontainer/index.js';
import '../nodes/2d/ui/splitcontainer/index.js';
import '../nodes/2d/ui/flowcontainer/index.js';
import '../nodes/2d/ui/graphelement/index.js';
import '../nodes/2d/ui/checkbutton/index.js';
import '../nodes/2d/ui/aspectratiocontainer/index.js';
import '../nodes/2d/ui/foldablecontainer/index.js';
import '../nodes/2d/ui/tabcontainer/index.js';
import '../nodes/2d/ui/hflowcontainer/index.js';
import '../nodes/2d/ui/vflowcontainer/index.js';
import '../nodes/2d/ui/colorpicker/index.js';
import '../nodes/2d/ui/graphframe/index.js';
import '../nodes/2d/ui/graphnode/index.js';
import '../nodes/2d/ui/openxrbindingmodifiereditor/index.js';
import '../nodes/2d/ui/openxrinteractionprofileeditor/index.js';
import '../nodes/2d/ui/hscrollbar/index.js';
import '../nodes/2d/ui/vscrollbar/index.js';
import '../nodes/2d/ui/hseparator/index.js';
import '../nodes/2d/ui/vseparator/index.js';
import '../nodes/2d/ui/spinbox/index.js';
import '../nodes/2d/ui/progressbar/index.js';
import '../nodes/2d/ui/textureprogressbar/index.js';
import '../nodes/2d/ui/colorpickerbutton/index.js';
import '../nodes/2d/ui/menubutton/index.js';
import '../nodes/2d/ui/linkbutton/index.js';
import '../nodes/2d/ui/texturebutton/index.js';
import '../nodes/2d/ui/ninepatchrect/index.js';
import '../nodes/2d/ui/referencerect/index.js';
import '../nodes/2d/ui/codeedit/index.js';
import '../nodes/2d/ui/graphedit/index.js';
import '../nodes/2d/ui/itemlist/index.js';
import '../nodes/2d/ui/menubar/index.js';
import '../nodes/2d/ui/tabbar/index.js';
import '../nodes/2d/ui/tree/index.js';
import '../nodes/2d/ui/videostreamplayer/index.js';
import '../nodes/base/node2d/index.js';
import '../nodes/2d/sprite2d/index.js';
import '../nodes/2d/polygon2d/index.js';
import '../nodes/2d/camera2d/index.js';
import '../nodes/2d/animatedsprite2d/index.js';
import '../nodes/physics/2d/index.js';
import '../nodes/physics/2d/area2d/index.js';
import '../nodes/physics/2d/collisionshape2d/index.js';
import '../nodes/physics/2d/raycast2d/index.js';
import '../nodes/physics/2d/shapecast2d/index.js';
import '../nodes/physics/2d/animatablebody2d/index.js';
import '../nodes/physics/2d/physicalbone2d/index.js';
import '../nodes/physics/2d/pinjoint2d/index.js';
import '../nodes/physics/2d/groovejoint2d/index.js';
import '../nodes/physics/2d/dampedspringjoint2d/index.js';
import '../nodes/2d/tiles/tilemaplayer/index.js';
import '../nodes/2d/tiles/tilemap/index.js';
import '../nodes/2d/navigationregion2d/index.js';
import '../nodes/2d/marker2d/index.js';
import '../nodes/2d/path2d/index.js';
import '../nodes/2d/pathfollow2d/index.js';
import '../nodes/2d/line2d/index.js';
import '../nodes/2d/remotetransform2d/index.js';
import '../nodes/2d/canvasmodulate/index.js';
import '../nodes/2d/lightoccluder2d/index.js';
import '../nodes/2d/pointlight2d/index.js';
import '../nodes/2d/parallaxlayer/index.js';
import '../nodes/2d/parallaxbackground/index.js';
import '../nodes/2d/cpuparticles2d/index.js';
import '../nodes/2d/visibleonscreennotifier2d/index.js';
import '../nodes/timers/timer/index.js';
import '../nodes/viewport/subviewport/index.js';
import '../nodes/3d/skeleton/skeletonmodifier3d/index.js';
import '../nodes/3d/skeleton/springbonecollision3d/index.js';
import '../nodes/3d/skeleton/boneconstraint3d/index.js';
import '../nodes/3d/skeleton/twoboneik3d/index.js';
import '../nodes/3d/skeleton/splineik3d/index.js';
import '../nodes/3d/skeleton/ccdik3d/index.js';
import '../nodes/3d/skeleton/fabrik3d/index.js';
import '../nodes/3d/skeleton/jacobianik3d/index.js';
import '../nodes/3d/skeleton/aimmodifier3d/index.js';
import '../nodes/3d/skeleton/copytransformmodifier3d/index.js';
import '../nodes/3d/skeleton/converttransformmodifier3d/index.js';
import '../nodes/3d/skeleton/boneattachment3d/index.js';
import '../nodes/3d/skeleton/bonetwistdisperser3d/index.js';
import '../nodes/3d/skeleton/limitangularvelocitymodifier3d/index.js';
import '../nodes/3d/skeleton/lookatmodifier3d/index.js';
import '../nodes/3d/skeleton/modifierbonetarget3d/index.js';
import '../nodes/3d/skeleton/retargetmodifier3d/index.js';
import '../nodes/3d/skeleton/springbonesimulator3d/index.js';
import '../nodes/3d/skeleton/physicalbonesimulator3d/index.js';
import '../nodes/3d/visualinstance3d/index.js';
import '../nodes/3d/xr/xrnode3d/index.js';
import '../nodes/3d/geometryinstance3d/index.js';
import '../nodes/3d/visibleonscreennotifier3d/index.js';
import '../nodes/windows/window/index.js';
import '../nodes/windows/acceptdialog/index.js';
import '../nodes/windows/popup/index.js';
import '../nodes/windows/confirmationdialog/index.js';
import '../nodes/windows/filedialog/index.js';
import '../nodes/windows/popupmenu/index.js';
import '../nodes/windows/popuppanel/index.js';
import '../nodes/windows/scriptcreatedialog/index.js';
import '../nodes/3d/particles/attractors/gpuparticlesattractorbox3d/index.js';
import '../nodes/3d/particles/attractors/gpuparticlesattractorsphere3d/index.js';
import '../nodes/3d/particles/attractors/gpuparticlesattractorvectorfield3d/index.js';
import '../nodes/3d/particles/collisions/gpuparticlescollisionbox3d/index.js';
import '../nodes/3d/particles/collisions/gpuparticlescollisionsphere3d/index.js';
import '../nodes/3d/particles/collisions/gpuparticlescollisionheightfield3d/index.js';
import '../nodes/3d/particles/collisions/gpuparticlescollisionsdf3d/index.js';
import '../nodes/3d/particles/cpuparticles3d/index.js';
import '../nodes/2d/particles/gpuparticles2d/index.js';
import '../nodes/2d/bone2d/index.js';
import '../nodes/2d/skeleton2d/index.js';

import type { TscnScene } from './types.js';
import { TscnParserCore } from './TscnParserCore.js';
import { parseNodeWithRegistry } from '../core/NodeRegistry.js';

/**
 * Lenient TSCN parser used for rendering.
 *
 * Strategy: recover from minor errors, log warnings, and keep rendering
 * whatever it can. For strict validation use `linter/StrictTscnParser`.
 */
export class TscnParser {
  private core = new TscnParserCore();

  /**
   * Parse TSCN content. Returns a scene with nodes whose `.properties`
   * have been converted from raw snake_case strings to the strongly-typed
   * shape declared by the relevant node-type module.
   */
  parse(content: string): TscnScene {
    return this.core.parse(content, parseNodeWithRegistry);
  }
}
