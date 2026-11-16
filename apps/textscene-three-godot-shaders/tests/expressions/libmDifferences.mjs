// Both answers kept: the list fails once V8 and Godot's glibc agree or differ otherwise.
export const LIBM_DIFFERENCES = {
  'utility tan 1': {
    godot: 'f79ea3ee1e6e2eb3f',
    port: 'f78ea3ee1e6e2eb3f',
    reason: 'tan(7): glibc gives 0.8714479827243188, V8 the double one unit in the last place below',
  },
  'member-edge 79 "Color(0.3, 0.1, 0.8).ok_hsl_h"': {
    godot: 'f000000206b29e93f',
    port: 'f000000406b29e93f',
    reason:
      'atan2f in srgb_to_okhsl: glibc gives the float 0.786305964, V8 atan2 rounded to float the one above',
  },
};
