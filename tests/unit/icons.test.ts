import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const iconsDir = resolve(import.meta.dirname, '../../public/icons');

const EXPECTED_SIZES = [16, 32, 48, 128];

/**
 * Read the width and height from a PNG file's IHDR chunk. PNG dimensions are
 * stored as two big-endian 32-bit integers at bytes 16-23.
 */
function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  // PNG signature: 8 bytes, then IHDR chunk length (4) + type "IHDR" (4).
  expect(buffer.subarray(0, 8)).toStrictEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe('extension icons', () => {
  it.each(EXPECTED_SIZES)('provides a non-empty %ipx icon', (size) => {
    const file = resolve(iconsDir, `icon${size}.png`);

    expect(existsSync(file), `${file} should exist`).toBe(true);

    const bytes = readFileSync(file);
    expect(bytes.length, `${file} should not be empty`).toBeGreaterThan(0);

    const { width, height } = readPngDimensions(bytes);
    expect(width).toBe(size);
    expect(height).toBe(size);
  });

  it('provides icons for every size referenced by the manifest', () => {
    EXPECTED_SIZES.forEach((size) => {
      expect(existsSync(resolve(iconsDir, `icon${size}.png`))).toBe(true);
    });
  });
});