/**
 * Linter entry point - imports all lint rules and validators to trigger registration
 *
 * IMPORTANT: Uses index.linter.ts for all nodes to keep bundle size minimal.
 * This pattern prevents bundling THREE.js and renderer code in the linter CLI.
 */

// Import linter registration for all nodes via index.linter.ts
// This pattern is consistent for ALL nodes (with or without renderers)
//
// The base Control slice (nodes/2d/ui/control) registers the layout/anchor/
// offset + theme-override validators shared by the whole 2D UI family; every
// Control subclass inherits them through the ValidatorRegistry base-walk (#143,
// see linter/nodeBaseTypes.ts). The individual Control subclass slices remain
// render-only (ADR-0003) — they carry no index.linter.ts of their own unless
// they gain type-specific validators or semantic rules.
import '../nodes/node/index.linter.js';
import '../nodes/canvasitem/shared/index.linter.js';
import '../nodes/2d/ui/canvaslayer/index.linter.js';
import '../nodes/2d/ui/control/index.linter.js';
import '../nodes/2d/ui/container/index.linter.js';
import '../nodes/2d/ui/subviewportcontainer/index.linter.js';
import '../nodes/2d/ui/basebutton/index.linter.js';
import '../nodes/2d/ui/button/index.linter.js';
import '../nodes/2d/ui/range/index.linter.js';
import '../nodes/2d/ui/hslider/index.linter.js';
import '../nodes/2d/ui/vslider/index.linter.js';
import '../nodes/2d/ui/textedit/index.linter.js';
import '../nodes/2d/ui/boxcontainer/index.linter.js';
import '../nodes/2d/ui/splitcontainer/index.linter.js';
import '../nodes/2d/ui/hboxcontainer/index.linter.js';
import '../nodes/2d/ui/vboxcontainer/index.linter.js';
import '../nodes/2d/ui/hsplitcontainer/index.linter.js';
import '../nodes/2d/ui/vsplitcontainer/index.linter.js';
import '../nodes/2d/ui/flowcontainer/index.linter.js';
import '../nodes/2d/ui/graphelement/index.linter.js';
import '../nodes/2d/ui/checkbutton/index.linter.js';
import '../nodes/2d/ui/aspectratiocontainer/index.linter.js';
import '../nodes/2d/ui/foldablecontainer/index.linter.js';
import '../nodes/2d/ui/tabcontainer/index.linter.js';
import '../nodes/2d/ui/hflowcontainer/index.linter.js';
import '../nodes/2d/ui/vflowcontainer/index.linter.js';
import '../nodes/2d/ui/colorpicker/index.linter.js';
import '../nodes/2d/ui/graphframe/index.linter.js';
import '../nodes/2d/ui/graphnode/index.linter.js';
import '../nodes/2d/ui/openxrbindingmodifiereditor/index.linter.js';
import '../nodes/2d/ui/openxrinteractionprofileeditor/index.linter.js';
import '../nodes/2d/ui/hscrollbar/index.linter.js';
import '../nodes/2d/ui/vscrollbar/index.linter.js';
import '../nodes/2d/ui/hseparator/index.linter.js';
import '../nodes/2d/ui/vseparator/index.linter.js';
import '../nodes/2d/ui/spinbox/index.linter.js';
import '../nodes/2d/ui/progressbar/index.linter.js';
import '../nodes/2d/ui/textureprogressbar/index.linter.js';
import '../nodes/2d/ui/colorpickerbutton/index.linter.js';
import '../nodes/2d/ui/menubutton/index.linter.js';
import '../nodes/2d/ui/optionbutton/index.linter.js';
import '../nodes/2d/ui/linkbutton/index.linter.js';
import '../nodes/2d/ui/texturebutton/index.linter.js';
import '../nodes/2d/ui/colorrect/index.linter.js';
import '../nodes/2d/ui/texturerect/index.linter.js';
import '../nodes/2d/ui/centercontainer/index.linter.js';
import '../nodes/2d/ui/label/index.linter.js';
import '../nodes/2d/ui/lineedit/index.linter.js';
import '../nodes/2d/ui/richtextlabel/index.linter.js';
import '../nodes/2d/ui/scrollcontainer/index.linter.js';
import '../nodes/2d/ui/gridcontainer/index.linter.js';
import '../nodes/2d/ui/ninepatchrect/index.linter.js';
import '../nodes/2d/ui/referencerect/index.linter.js';
import '../nodes/2d/ui/codeedit/index.linter.js';
import '../nodes/2d/ui/graphedit/index.linter.js';
import '../nodes/2d/ui/itemlist/index.linter.js';
import '../nodes/2d/ui/menubar/index.linter.js';
import '../nodes/2d/ui/tabbar/index.linter.js';
import '../nodes/2d/ui/tree/index.linter.js';
import '../nodes/2d/ui/videostreamplayer/index.linter.js';
import '../nodes/viewport/shared/index.linter.js';
import '../nodes/viewport/subviewport/index.linter.js';
import '../nodes/base/node3d/index.linter.js';
import '../nodes/base/node2d/index.linter.js';
import '../nodes/3d/meshinstance3d/index.linter.js';
import '../nodes/3d/csg/csgbox3d/index.linter.js';
import '../nodes/3d/csg/csgcylinder3d/index.linter.js';
import '../nodes/3d/csg/csgsphere3d/index.linter.js';
import '../nodes/3d/csg/csgtorus3d/index.linter.js';
import '../nodes/3d/csg/csgcombiner3d/index.linter.js';
import '../nodes/3d/csg/csgmesh3d/index.linter.js';
import '../nodes/3d/csg/csgpolygon3d/index.linter.js';
import '../nodes/3d/csg/index.linter.js';
import '../nodes/3d/lights/omnilight3d/index.linter.js';
import '../nodes/3d/lights/directionallight3d/index.linter.js';
import '../nodes/3d/lights/spotlight3d/index.linter.js';
import '../nodes/3d/lights/arealight3d/index.linter.js';
import '../nodes/3d/lights/shared/index.linter.js';
import '../nodes/3d/camera3d/index.linter.js';
import '../nodes/3d/label3d/index.linter.js';
import '../nodes/3d/particles/gpuparticles3d/index.linter.js';
import '../nodes/3d/sprite3d/index.linter.js';
import '../nodes/3d/worldenvironment/index.linter.js';
import '../nodes/3d/skeleton3d/index.linter.js';
import '../nodes/3d/decal/index.linter.js';
import '../nodes/3d/navigationregion3d/index.linter.js';
import '../nodes/3d/gridmap/index.linter.js';
import '../nodes/2d/camera2d/index.linter.js';
import '../nodes/2d/navigationregion2d/index.linter.js';
import '../nodes/2d/sprite2d/index.linter.js';
import '../nodes/2d/polygon2d/index.linter.js';
import '../nodes/2d/animatedsprite2d/index.linter.js';
import '../nodes/2d/marker2d/index.linter.js';
import '../nodes/2d/path2d/index.linter.js';
import '../nodes/2d/line2d/index.linter.js';
import '../nodes/2d/pathfollow2d/index.linter.js';
import '../nodes/2d/canvasmodulate/index.linter.js';
import '../nodes/2d/lightoccluder2d/index.linter.js';
import '../nodes/2d/pointlight2d/index.linter.js';
import '../nodes/2d/cpuparticles2d/index.linter.js';

import '../nodes/animation/animationmixer/index.linter.js';
import '../nodes/animation/animationplayer/index.linter.js';
import '../nodes/animation/animationtree/index.linter.js';
import '../nodes/audio/audiostreamplayer/index.linter.js';
import '../nodes/audio/audiostreamplayer2d/index.linter.js';
import '../nodes/audio/audiostreamplayer3d/index.linter.js';
import '../nodes/physics/2d/area2d/index.linter.js';
import '../nodes/physics/2d/characterbody2d/index.linter.js';
import '../nodes/physics/2d/collisionshape2d/index.linter.js';
import '../nodes/physics/2d/rigidbody2d/index.linter.js';
import '../nodes/physics/2d/staticbody2d/index.linter.js';
import '../nodes/physics/2d/raycast2d/index.linter.js';
import '../nodes/physics/2d/shapecast2d/index.linter.js';
import '../nodes/physics/2d/animatablebody2d/index.linter.js';
import '../nodes/physics/2d/physicalbone2d/index.linter.js';
import '../nodes/physics/2d/pinjoint2d/index.linter.js';
import '../nodes/physics/2d/groovejoint2d/index.linter.js';
import '../nodes/physics/2d/dampedspringjoint2d/index.linter.js';
import '../nodes/physics/2d/collisionpolygon2d/index.linter.js';
import '../nodes/physics/3d/area3d/index.linter.js';
import '../nodes/physics/3d/characterbody3d/index.linter.js';
import '../nodes/physics/3d/collisionshape3d/index.linter.js';
import '../nodes/physics/3d/rigidbody3d/index.linter.js';
import '../nodes/physics/3d/staticbody3d/index.linter.js';
import '../nodes/physics/3d/raycast3d/index.linter.js';
import '../nodes/physics/3d/shapecast3d/index.linter.js';
import '../nodes/physics/3d/springarm3d/index.linter.js';
import '../nodes/physics/3d/animatablebody3d/index.linter.js';
import '../nodes/physics/3d/physicalbone3d/index.linter.js';
import '../nodes/physics/3d/vehiclebody3d/index.linter.js';
import '../nodes/physics/3d/pinjoint3d/index.linter.js';
import '../nodes/physics/joints/shared/index.linter.js';
import '../nodes/physics/3d/hingejoint3d/index.linter.js';
import '../nodes/physics/3d/softbody3d/index.linter.js';
import '../nodes/physics/3d/vehiclewheel3d/index.linter.js';
import '../nodes/physics/3d/conetwistjoint3d/index.linter.js';
import '../nodes/physics/3d/generic6dofjoint3d/index.linter.js';
import '../nodes/physics/3d/sliderjoint3d/index.linter.js';
import '../nodes/physics/3d/collisionpolygon3d/index.linter.js';
import '../nodes/3d/marker3d/index.linter.js';
import '../nodes/3d/remotetransform3d/index.linter.js';
import '../nodes/3d/navigationagent3d/index.linter.js';
import '../nodes/3d/navigationobstacle3d/index.linter.js';
import '../nodes/paths/path3d/index.linter.js';
import '../nodes/paths/pathfollow3d/index.linter.js';

// Import resource validators
import '../resources/materials/basematerial3d/linterValidators.js';
import '../resources/environment/index.linter.js';
import '../resources/meshlibrary/index.linter.js';
import '../resources/tileset/index.linter.js';
import '../resources/meshes/planemesh/linterValidators.js';
import '../resources/meshes/mesh/linterValidators.js';
import '../resources/meshes/primitivemesh/linterValidators.js';
import '../resources/materials/material/linterValidators.js';
import '../resources/resource/linterValidators.js';
import '../nodes/2d/tiles/tilemaplayer/index.linter.js';
import '../nodes/2d/tiles/tilemap/index.linter.js';
import '../nodes/2d/remotetransform2d/index.linter.js';
import '../nodes/2d/parallaxlayer/index.linter.js';
import '../nodes/2d/parallaxbackground/index.linter.js';
import '../nodes/2d/visibleonscreennotifier2d/index.linter.js';
import '../nodes/timers/timer/index.linter.js';
import '../nodes/3d/skeleton/skeletonmodifier3d/index.linter.js';
import '../nodes/3d/skeleton/springbonecollision3d/index.linter.js';
import '../nodes/3d/skeleton/twoboneik3d/index.linter.js';
import '../nodes/3d/skeleton/splineik3d/index.linter.js';
import '../nodes/3d/skeleton/ccdik3d/index.linter.js';
import '../nodes/3d/skeleton/fabrik3d/index.linter.js';
import '../nodes/3d/skeleton/jacobianik3d/index.linter.js';
import '../nodes/3d/skeleton/aimmodifier3d/index.linter.js';
import '../nodes/3d/skeleton/copytransformmodifier3d/index.linter.js';
import '../nodes/3d/skeleton/converttransformmodifier3d/index.linter.js';
import '../nodes/3d/skeleton/boneattachment3d/index.linter.js';
import '../nodes/3d/skeleton/bonetwistdisperser3d/index.linter.js';
import '../nodes/3d/skeleton/limitangularvelocitymodifier3d/index.linter.js';
import '../nodes/3d/skeleton/lookatmodifier3d/index.linter.js';
import '../nodes/3d/skeleton/modifierbonetarget3d/index.linter.js';
import '../nodes/3d/skeleton/retargetmodifier3d/index.linter.js';
import '../nodes/3d/skeleton/springbonesimulator3d/index.linter.js';
import '../nodes/3d/skeleton/physicalbonesimulator3d/index.linter.js';
import '../nodes/3d/skeleton/skeletonik3d/index.linter.js';
import '../nodes/3d/skeleton/springbonecollisioncapsule3d/index.linter.js';
import '../nodes/3d/skeleton/springbonecollisionplane3d/index.linter.js';
import '../nodes/3d/skeleton/springbonecollisionsphere3d/index.linter.js';
import '../nodes/3d/skeleton/xrbodymodifier3d/index.linter.js';
import '../nodes/3d/skeleton/xrhandmodifier3d/index.linter.js';
import '../nodes/3d/visualinstance3d/index.linter.js';
import '../nodes/3d/xr/xrnode3d/index.linter.js';
import '../nodes/3d/xr/openxrvisibilitymask/index.linter.js';
import '../nodes/3d/geometryinstance3d/index.linter.js';
import '../nodes/3d/visibleonscreennotifier3d/index.linter.js';
import '../nodes/windows/window/index.linter.js';
import '../nodes/windows/acceptdialog/index.linter.js';
import '../nodes/windows/confirmationdialog/index.linter.js';
import '../nodes/windows/filedialog/index.linter.js';
import '../nodes/windows/popupmenu/index.linter.js';
import '../nodes/windows/popuppanel/index.linter.js';
import '../nodes/windows/scriptcreatedialog/index.linter.js';
import '../nodes/3d/particles/attractors/gpuparticlesattractorbox3d/index.linter.js';
import '../nodes/3d/particles/attractors/gpuparticlesattractorsphere3d/index.linter.js';
import '../nodes/3d/particles/attractors/gpuparticlesattractorvectorfield3d/index.linter.js';
import '../nodes/3d/particles/collisions/gpuparticlescollisionbox3d/index.linter.js';
import '../nodes/3d/particles/collisions/gpuparticlescollisionsphere3d/index.linter.js';
import '../nodes/3d/particles/collisions/gpuparticlescollisionheightfield3d/index.linter.js';
import '../nodes/3d/particles/collisions/gpuparticlescollisionsdf3d/index.linter.js';
import '../nodes/3d/particles/cpuparticles3d/index.linter.js';
import '../nodes/3d/fogvolume/index.linter.js';
import '../nodes/3d/lightmapgi/index.linter.js';
import '../nodes/3d/lightmapprobe/index.linter.js';
import '../nodes/3d/reflectionprobe/index.linter.js';
import '../nodes/3d/voxelgi/index.linter.js';
import '../nodes/3d/multimeshinstance3d/index.linter.js';
import '../nodes/3d/animatedsprite3d/index.linter.js';
import '../nodes/3d/occluderinstance3d/index.linter.js';
import '../nodes/3d/rootmotionview/index.linter.js';
import '../nodes/3d/navigationlink3d/index.linter.js';
import '../nodes/3d/visibleonscreenenabler3d/index.linter.js';
import '../nodes/3d/audiolistener3d/index.linter.js';
// Registered by hand, both scaffolded without --linter on the belief that they
// declare nothing. XRCamera3D genuinely does, and its lint surface is a rule
// alone; AudioListener2D serialises `current` through _get_property_list, which
// neither its class reference nor an ADD_PROPERTY grep shows.
import '../nodes/3d/xr/xrcamera3d/index.linter.js';
import '../nodes/3d/xr/shared/index.linter.js';
import '../nodes/3d/xr/openxrcompositionlayerquad/index.linter.js';
import '../nodes/3d/xr/openxrcompositionlayercylinder/index.linter.js';
import '../nodes/3d/xr/openxrcompositionlayerequirect/index.linter.js';
import '../nodes/3d/xr/openxrhand/index.linter.js';
import '../nodes/3d/xr/openxrrendermodel/index.linter.js';
import '../nodes/3d/xr/openxrrendermodelmanager/index.linter.js';
import '../nodes/3d/xr/xranchor3d/index.linter.js';
import '../nodes/3d/xr/xrcontroller3d/index.linter.js';
import '../nodes/3d/xr/xrorigin3d/index.linter.js';
import '../nodes/3d/xr/xrfacemodifier3d/index.linter.js';
import '../nodes/3d/importermeshinstance3d/index.linter.js';
import '../nodes/2d/audiolistener2d/index.linter.js';
import '../nodes/2d/particles/gpuparticles2d/index.linter.js';
import '../nodes/2d/bone2d/index.linter.js';
import '../nodes/2d/skeleton2d/index.linter.js';
import '../nodes/2d/navigationagent2d/index.linter.js';
import '../nodes/2d/navigationlink2d/index.linter.js';
import '../nodes/2d/navigationobstacle2d/index.linter.js';
import '../nodes/2d/visibleonscreenenabler2d/index.linter.js';
import '../nodes/2d/directionallight2d/index.linter.js';
import '../nodes/2d/meshinstance2d/index.linter.js';
import '../nodes/2d/multimeshinstance2d/index.linter.js';
import '../nodes/2d/backbuffercopy/index.linter.js';
import '../nodes/2d/canvasgroup/index.linter.js';
import '../nodes/2d/parallax2d/index.linter.js';
import '../nodes/2d/touchscreenbutton/index.linter.js';
import '../nodes/networking/httprequest/index.linter.js';
import '../nodes/networking/multiplayerspawner/index.linter.js';
import '../nodes/networking/multiplayersynchronizer/index.linter.js';
import '../nodes/rendering/shaderglobalsoverride/index.linter.js';
import '../nodes/resources/resourcepreloader/index.linter.js';
import '../nodes/os/statusindicator/index.linter.js';

// Re-export core linter classes
export { Linter } from './Linter.js';
export { StrictTscnParser } from './StrictTscnParser.js';
export { validatorRegistry } from './ValidatorRegistry.js';
export { ruleRegistry } from './RuleRegistry.js';
export { SEVERITY_ORDER } from './types.js';

// Re-export types
export type {
  Diagnostic,
  Severity,
  LintRule,
  RuleContext,
  RuleMeta,
  ParseError,
  StrictParseResult,
} from './types.js';
export type { PropertyValidator } from './ValidatorRegistry.js';
