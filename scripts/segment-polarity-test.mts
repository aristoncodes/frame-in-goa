/** Proves the mask-polarity heuristic on both label conventions. */
import { subjectLabelIsNonZero } from "../lib/segment";

const W = 200, H = 260;
/** Centre blob = person, border = background. */
const build = (subjectValue: number, backgroundValue: number) => {
  const m = new Uint8Array(W * H).fill(backgroundValue);
  for (let y = 40; y < H - 20; y++)
    for (let x = 50; x < W - 50; x++) m[y * W + x] = subjectValue;
  return m;
};

const cases: [string, Uint8Array, boolean][] = [
  ["subject=1, background=0", build(1, 0), true],
  ["subject=0, background=255 (the convention that broke it)", build(0, 255), false],
  ["subject=255, background=0", build(255, 0), true],
];

let bad = 0;
for (const [label, mask, expected] of cases) {
  const got = subjectLabelIsNonZero(mask, W, H);
  const ok = got === expected;
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} → subjectIsNonZero=${got}`);
}
console.log(bad ? `\n${bad} failed` : "\nPASS  polarity detected from the image, not assumed");
process.exit(bad ? 1 : 0);
