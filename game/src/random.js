// A seeded random source (xorshift32): the same seed gives the same stream,
// which is what makes the screenshot scenes repeatable frame for frame.
export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  }
  return {
    next,
    // A float in [min, max).
    range(min, max) { return min + next() * (max - min); },
    // An integer in [min, max].
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    // One element of an array, uniformly.
    pick(list) { return list[Math.floor(next() * list.length)]; },
  };
}
