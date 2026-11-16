// Both answers kept: the list fails once V8 and Godot's glibc agree or differ otherwise.
export const LIBM_DIFFERENCES = {
  'utility tan 1': {
    godot: 'f79ea3ee1e6e2eb3f',
    port: 'f78ea3ee1e6e2eb3f',
    reason: 'tan(7): glibc gives 0.8714479827243188, V8 the double one unit in the last place below',
  },
};
