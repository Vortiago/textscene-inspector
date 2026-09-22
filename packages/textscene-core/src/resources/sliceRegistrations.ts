/**
 * Aggregation barrel for resource-slice registrations (ADR-0031) — the
 * resource-side sibling of `parser/TscnParser.ts` / `linter/index.ts` /
 * `r3f/nodes/index.ts`. Importing it populates `resourceSliceRegistry` with
 * every slice's claims; `ResourceLoader` (and the routing conformance guards)
 * import it for that side effect.
 *
 * One import per slice `index.ts`, `./…/index.js` specifiers throughout: a
 * second specifier spelling would give the bundler a second module instance
 * whose re-registration lands as a silent duplicate in `all()`.
 */

// Materials
import './materials/standardmaterial3d/index.js';
import './materials/canvasitemmaterial/index.js';

// Styles
import './styles/stylebox/index.js';
import './styles/theme/index.js';
import './styles/codehighlighter/index.js';
import './styles/labelsettings/index.js';

// Fonts
import './fonts/font/index.js';

// Environment + sky
import './environment/index.js';
import './sky/index.js';

// Meshes
import './meshes/arraymesh/index.js';
import './meshes/boxmesh/index.js';
import './meshes/spheremesh/index.js';
import './meshes/planemesh/index.js';
import './meshes/quadmesh/index.js';
import './meshes/cylindermesh/index.js';
import './meshes/capsulemesh/index.js';
import './meshes/torusmesh/index.js';
import './meshes/prismmesh/index.js';

// Collision shapes
import './shapes/boxshape3d/index.js';
import './shapes/sphereshape3d/index.js';
import './shapes/capsuleshape3d/index.js';
import './shapes/cylindershape3d/index.js';
import './shapes/convexpolygonshape3d/index.js';
import './shapes/concavepolygonshape3d/index.js';
import './shapes/rectangleshape2d/index.js';
import './shapes/circleshape2d/index.js';
import './shapes/capsuleshape2d/index.js';

// Curves + navigation
import './curves/curve/index.js';
import './curves/curve2d/index.js';
import './curves/curve3d/index.js';
import './navigation/navigationpolygon/index.js';
import './navigation/navigationmesh/index.js';

// Textures
import './textures/gradienttexture2d/index.js';
import './textures/spriteframes/index.js';
import './textures/atlastexture/index.js';
import './textures/viewporttexture/index.js';
import './textures/noisetexture2d/index.js';

// Noise
import './noise/fastnoiselite/index.js';

// Collections
import './tileset/index.js';
import './meshlibrary/index.js';

// Foreign formats
import './formats/glb/index.js';
import './formats/image/index.js';
import './formats/packedscene/index.js';
import './formats/dynamicfont/index.js';
