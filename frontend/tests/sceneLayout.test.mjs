import assert from "node:assert/strict";
import test from "node:test";
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  beatRevealAlpha,
  containsRect,
  frameLayout,
  layoutMultilineText,
  normalizeText,
  pageForProgress,
  resolveBeat,
  resolveTransition,
} from "../src/lib/sceneLayout.ts";

function fakeMeasure(text, font) {
  const size = Number.parseFloat((font.match(/(\d+(?:\.\d+)?)px/) ?? [null, "12"])[1]);
  return text.length * size * 0.55;
}

test("long narration is wrapped and paginated without dropping words", () => {
  const text =
    "On smoggy mornings, the air itself looks tired and grey. " +
    "Factories and traffic pump smoke and gases into the air we breathe every day. " +
    "Cleaner choices like cycles, buses, and feet clear the air street by street.";
  const block = layoutMultilineText(
    text,
    { maxWidth: 420, maxLines: 3, maxFontSize: 20, minFontSize: 12, preferredPages: 4 },
    fakeMeasure,
  );
  const allLines = block.pages.flatMap((page) => page.lines);
  assert.equal(allLines.join(" "), normalizeText(text));
  for (const line of allLines) {
    assert.ok(fakeMeasure(line, block.font) <= 420 + 0.5, `line too wide: ${line}`);
  }
  for (const page of block.pages) {
    assert.ok(page.lines.length <= 3, `page exceeded max lines: ${page.lines.join(" | ")}`);
  }
});

test("font shrinks to keep a heading on one line", () => {
  const block = layoutMultilineText(
    "Protecting Wildlife for Future Generations",
    { maxWidth: 300, maxLines: 1, maxFontSize: 40, minFontSize: 12, preferredPages: 1 },
    fakeMeasure,
  );
  assert.equal(block.pages.length, 1);
  assert.ok(block.fontSize < 40);
  assert.equal(block.pages[0].lines.length, 1);
});

test("single very long words are broken, not truncated", () => {
  const text = "A".repeat(240);
  const block = layoutMultilineText(
    text,
    { maxWidth: 180, maxLines: 4, maxFontSize: 20, minFontSize: 20, preferredPages: 1 },
    fakeMeasure,
  );
  assert.equal(block.pages.flatMap((page) => page.lines).join(""), text);
});

test("page pagination reaches first and last pages", () => {
  const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
  const block = layoutMultilineText(
    words,
    { maxWidth: 200, maxLines: 1, maxFontSize: 14, minFontSize: 14, preferredPages: 8 },
    fakeMeasure,
  );
  assert.ok(block.pages.length > 2);
  assert.deepEqual(pageForProgress(block, 0).lines, block.pages[0].lines);
  assert.deepEqual(
    pageForProgress(block, 1).lines,
    block.pages[block.pages.length - 1].lines,
  );
});

test("safe frame regions stay inside the 960x540 frame", () => {
  const layout = frameLayout(FRAME_WIDTH, FRAME_HEIGHT);
  assert.ok(containsRect({ x: 0, y: 0, width: FRAME_WIDTH, height: FRAME_HEIGHT }, layout.safe));
  assert.ok(layout.caption.y + layout.caption.height <= FRAME_HEIGHT);
  assert.ok(layout.header.x >= 0);
});

test("beat and transition timing is deterministic", () => {
  const bounds = [4, 8, 10];
  assert.equal(resolveBeat(bounds, 0).index, 0);
  assert.equal(resolveBeat(bounds, 4).index, 1);
  assert.equal(resolveBeat(bounds, 10).index, 2);

  const before = resolveTransition(bounds, 3.4, 0.7);
  assert.equal(before.active, true);
  assert.equal(before.beatIndex, 0);
  assert.equal(before.nextIndex, 1);
  assert.ok(before.progress > 0 && before.progress < 1);

  const atCut = resolveTransition(bounds, 4, 0.7);
  assert.equal(atCut.active, false);
  assert.equal(atCut.beatIndex, 1);
});

test("caption reveal fades in with the incoming beat", () => {
  assert.equal(beatRevealAlpha(0, 0, 0), 0);
  assert.equal(beatRevealAlpha(1, 0, 0), 1);
  assert.equal(beatRevealAlpha(3.3, 4, 0.7), 0);
  assert.equal(beatRevealAlpha(3.8, 4, 0.7), 1);
});
