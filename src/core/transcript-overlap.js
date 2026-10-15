// Only use at an audio boundary that deliberately replays an overlapping tail.
function removeTranscriptOverlap(previous, current) {
  const words = text => [...text.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)];
  const before = words(previous).slice(-64), after = words(current);
  const normalize = word => word.normalize('NFKC').toLowerCase();
  for (let count = Math.min(before.length, after.length, 64); count > 0; count--) {
    if (count === 1 && after[0][0].length < 4) continue;
    if (after.slice(0, count).every((word, index) => normalize(word[0]) === normalize(before[before.length - count + index][0]))) {
      const end = after[count - 1].index + after[count - 1][0].length;
      return current.slice(end).replace(/^[\s,.;:!?—-]+/u, '');
    }
  }
  return current;
}

module.exports = { removeTranscriptOverlap };
