import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, expect } from 'vitest';

// Architecture guard: the offscreen inference module must load Transformers.js
// lazily through `transformersLoader.ts` (dynamic import) instead of a static
// top-level import. This is what lets Rollup code-split the ~800 kB
// @xenova/transformers + onnxruntime-web bundle into its own lazy chunk and
// keeps the offscreen entry chunk small.

const INFERENCE_SOURCE = readFileSync(
  join(__dirname, '../../src/offscreen/inference.ts'),
  'utf8'
);

describe('offscreen inference module boundaries (lazy transformers loading)', () => {
  test('does not statically import @xenova/transformers', () => {
    expect(INFERENCE_SOURCE).not.toMatch(
      /import\s+(type\s+)?\{[^}]*\}\s+from\s+['"]@xenova\/transformers['"]/
    );
    expect(INFERENCE_SOURCE).not.toMatch(
      /import\s+\*\s+as\s+\w+\s+from\s+['"]@xenova\/transformers['"]/
    );
  });

  test('reaches Transformers.js only through the transformersLoader seam', () => {
    expect(INFERENCE_SOURCE).toMatch(
      /from\s+['"]\.\/transformersLoader['"]/
    );
  });
});
