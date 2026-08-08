// Parses the admin "active range" text into numeric ranges.
// Accepts flexible input, e.g.:
//   "KB-0001-KB-0650"  |  "1-650"  |  "KB-0001 – KB-0650, KB-0801-KB-0810"
// Comma-separated parts; each part is a range "A-B" or a single number.

export type NumRange = { from: number; to: number };

export function parseRanges(text: string): NumRange[] {
  const ranges: NumRange[] = [];
  for (const rawPart of text.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    // Pull out every number in the part ("KB-0001-KB-0650" -> [1, 650])
    const nums = (part.match(/\d+/g) ?? []).map((n) => parseInt(n, 10));
    if (nums.length === 0) continue;
    if (nums.length === 1) {
      ranges.push({ from: nums[0], to: nums[0] });
    } else {
      const from = Math.min(nums[0], nums[nums.length - 1]);
      const to = Math.max(nums[0], nums[nums.length - 1]);
      ranges.push({ from, to });
    }
  }
  return ranges;
}

export function codeNumber(displayCode: string): number | null {
  const m = displayCode.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

export function inRanges(displayCode: string, ranges: NumRange[]): boolean {
  const n = codeNumber(displayCode);
  if (n === null) return false;
  return ranges.some((r) => n >= r.from && n <= r.to);
}
