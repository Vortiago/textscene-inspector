/**
 * What the decal gate requires of the pixels `page.mjs` reads back. Each check returns its failure
 * message, or nothing when the pixel passes. A pixel is linear RGB in 0..1, and a sample holds the
 * pixel drawn with the decals and the pixel the shading draws alone.
 */

/** How far a pixel may stray from the one the same shading draws alone. */
const SAME_PIXEL = 0.02;

/**
 * How far a pixel may stray from the one an equal texel draws. The tilt of a filter in decoded
 * values moves a pixel by 5 bytes of 255, which the tolerance of `SAME_PIXEL` hides.
 */
const MATCHING_PIXEL = 0.008;

/** How many times the other two channels a channel must beat to dominate. */
const DOMINANCE = 2;

const show = (pixel) => `(${pixel.map((channel) => channel.toFixed(3)).join(', ')})`;

function dominantChannel([r, g, b]) {
  if (r > DOMINANCE * Math.max(g, b)) return 'red';
  if (g > DOMINANCE * Math.max(r, b)) return 'green';
  if (b > DOMINANCE * Math.max(r, g)) return 'blue';
  return 'none';
}

/** The decal's colour shows in the pixel drawn. */
export function showsDecal(name, { drawn }, colour) {
  const found = dominantChannel(drawn);
  return found === colour ? undefined : `${name}: expected a ${colour} pixel, found ${found} ${show(drawn)}`;
}

/** The pixel drawn is the one the shading draws alone. */
export function showsNoDecal(name, { drawn, bare }) {
  return drawn.every((channel, index) => Math.abs(channel - bare[index]) <= SAME_PIXEL)
    ? undefined
    : `${name}: expected the pixel ${show(bare)} that the shading draws alone, found ${show(drawn)}`;
}

/** The pixel drawn is the pixel `expected` draws. */
export function matchesPixel(name, { drawn }, { drawn: expected }) {
  return drawn.every((channel, index) => Math.abs(channel - expected[index]) <= MATCHING_PIXEL)
    ? undefined
    : `${name}: expected the pixel ${show(expected)}, found ${show(drawn)}`;
}

/** A pixel under this share of the one the shading draws alone counts as dimmed by a map. */
const DIMMED_BELOW = 0.7;

const brightness = (pixel) => pixel.reduce((sum, channel) => sum + channel, 0) / pixel.length;

/** The pixel drawn is dimmer than the one the shading draws alone. */
export function dimsPixel(name, { drawn, bare }) {
  return brightness(drawn) < DIMMED_BELOW * brightness(bare)
    ? undefined
    : `${name}: expected a pixel dimmer than ${show(bare)}, found ${show(drawn)}`;
}

/** A receiver under a decal takes it inside the box and nowhere else. */
function receiverFailures(name, { inside, outside }) {
  return [
    showsDecal(`${name} inside the box`, inside, 'red'),
    showsNoDecal(`${name} outside the box`, outside),
  ];
}

const RECEIVERS = ['lit', 'physical', 'unshaded', 'transparent', 'doubleSided'];

/**
 * The checks of the decal's maps (`scene_forward_clustered.glsl:1612-1650`). An emission-only decal
 * draws, and a normal-only or ORM-only one does not, as both sit inside the albedo branch. An
 * unshaded surface keeps the albedo alone (`:2958-2960`), so its emission, normal and ORM change
 * nothing.
 */
function mapFailures({ emission, normalOnly, ormOnly, normalMap, magnifiedNormal, ormMap }) {
  return [
    showsDecal('emission on a lit receiver', emission.lit.inside, 'red'),
    showsNoDecal('emission outside the box', emission.lit.outside),
    showsDecal('emission on a physical receiver', emission.physical.inside, 'red'),
    showsNoDecal('emission on an unshaded receiver', emission.unshaded.inside),
    showsDecal('emission beside an albedo', emission.withAlbedo.inside, 'red'),
    showsNoDecal('emission at an energy of 0', emission.noEnergy.inside),
    showsNoDecal('a normal map with no albedo', normalOnly.inside),
    showsNoDecal('an ORM map with no albedo', ormOnly.inside),
    dimsPixel('a normal map that lies along the surface', normalMap.lit.inside),
    showsNoDecal('a normal map outside the box', normalMap.lit.outside),
    showsNoDecal('a normal map on an unshaded receiver', normalMap.unshaded.inside),
    matchesPixel(
      'a magnified normal map between two texels, which Godot filters as bytes',
      magnifiedNormal.between.inside,
      magnifiedNormal.flat.inside
    ),
    dimsPixel('a metallic ORM map', ormMap.metallic.inside),
    dimsPixel('an ORM map that occludes the ambient light', ormMap.occlusion.inside),
    dimsPixel('an ORM map that occludes a receiver with an AO map', ormMap.occlusionOfAoMap.inside),
    showsNoDecal('an ORM map on an unshaded receiver', ormMap.unshaded.inside),
  ];
}

/** Every failure of the gate's scenes. */
export function decalFailures(samples) {
  const { motion, receiverMoves, skinnedReceiver, editorChrome } = samples;
  return [
    ...RECEIVERS.flatMap((name) => receiverFailures(name, samples[name])),
    showsDecal('motion, before the move, at the old place', motion.before.oldPlace, 'red'),
    showsNoDecal('motion, before the move, at the new place', motion.before.newPlace),
    showsDecal('motion, after the move, at the new place', motion.after.newPlace, 'red'),
    showsNoDecal('motion, after the move, at the old place', motion.after.oldPlace),
    showsNoDecal('a receiver outside the box', receiverMoves.before),
    showsDecal('a receiver that moved into the box', receiverMoves.after, 'red'),
    showsNoDecal('a skinned receiver outside the box', skinnedReceiver.before),
    showsDecal('a skinned receiver that a bone moved into the box', skinnedReceiver.after, 'red'),
    showsNoDecal('editor chrome in the box', editorChrome.chrome),
    showsDecal('a surface beside editor chrome', editorChrome.surface, 'red'),
    showsNoDecal('a receiver that the cull mask clears', samples.maskCleared),
    showsDecal('a receiver that the cull mask keeps', samples.maskKept, 'red'),
    showsDecal('the nearer of two decals', samples.nearestOnTop, 'green'),
    showsDecal('the decal that a sorting offset moves nearer', samples.sortingOffset, 'red'),
    showsDecal('the 33rd decal in the order, which mixes last', samples.groupsOf32, 'green'),
    showsDecal('the decals within the limit, without the one past it', samples.limit, 'red'),
    ...mapFailures(samples),
  ].filter((failure) => failure !== undefined);
}
