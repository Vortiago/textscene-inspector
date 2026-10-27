/**
 * What the decal gate requires of the pixels `page.mjs` reads back. Each check returns its failure
 * message, or nothing when the pixel passes. A pixel is linear RGB in 0..1, and a sample holds the
 * pixel drawn with the decals and the pixel the shading draws alone.
 */

/** How far a pixel may stray from the one the same shading draws alone. */
const SAME_PIXEL = 0.02;

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

/** A receiver under a decal takes it inside the box and nowhere else. */
function receiverFailures(name, { inside, outside }) {
  return [
    showsDecal(`${name} inside the box`, inside, 'red'),
    showsNoDecal(`${name} outside the box`, outside),
  ];
}

const RECEIVERS = ['lit', 'physical', 'unshaded', 'transparent', 'doubleSided'];

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
  ].filter((failure) => failure !== undefined);
}
