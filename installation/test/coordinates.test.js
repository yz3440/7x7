import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('every submitted bit maps to the centered rendered pattern, including 49-bit limits and origin shifts', async () => {
  const context = vm.createContext({ console });
  for (const filename of ['../../libs/BinaryPatternUniverse.js', '../public/InstallationUniverse.js']) {
    vm.runInContext(await readFile(new URL(filename, import.meta.url), 'utf8'), context);
  }
  const u = vm.runInContext('Object.create(InstallationUniverse.prototype)', context);
  Object.assign(u, { GRID_ROWS: 2 ** 24, GRID_COLS: 2 ** 25, PATTERN_SIZE: 20, STROKE_WIDTH: 0.1,
    canvas: { width: 1440, height: 900 }, scale: 15 });
  const max = (1n << 49n) - 1n;
  const ids = [0n, max, 1n << 48n, (1n << 25n) - 1n, 1n << 25n];
  for (let bit = 0n; bit < 49n; bit++) ids.push(1n << bit, max ^ (1n << bit));
  for (const id of ids) {
    const pattern = Array.from({ length: 7 }, (_, row) => Array.from({ length: 7 }, (_, col) => Number((id >> BigInt(row * 7 + col)) & 1n)));
    u.cameraWorldPosition = u.findPatternWorldPosition(pattern);
    const size = u.PATTERN_SIZE + u.STROKE_WIDTH;
    for (const shift of [{ x: 0, y: 0 }, u.cameraWorldPosition, { x: -12345678, y: -87654321 }]) {
      u.originShift = shift;
      u.translation = { x: u.cameraWorldPosition.x - shift.x, y: u.cameraWorldPosition.y - shift.y };
      const visible = u.getVisiblePatterns();
      let centered = 0;
      for (let i = 0; i < visible.count; i++) {
        const x = visible.offsets[i * 2] + u.translation.x + size / 2;
        const y = visible.offsets[i * 2 + 1] + u.translation.y + size / 2;
        if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) {
          centered++;
          for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
            assert.equal((visible.patternComponents[row][i] >> col) & 1, pattern[row][col], `id ${id}, cell ${row},${col}`);
          }
        }
      }
      assert.equal(centered, 1, `exactly one centered tile for ${id}`);
    }
  }
});

test('solid patterns sit near the origin with neighbors on every side and signed pan limits', async () => {
  const context = vm.createContext({ console });
  for (const filename of ['../../libs/BinaryPatternUniverse.js', '../public/InstallationUniverse.js']) {
    vm.runInContext(await readFile(new URL(filename, import.meta.url), 'utf8'), context);
  }
  const u = vm.runInContext('Object.create(InstallationUniverse.prototype)', context);
  Object.assign(u, {
    GRID_ROWS: 2 ** 24, GRID_COLS: 2 ** 25, PATTERN_SIZE: 20, STROKE_WIDTH: 0.1,
    canvas: { width: 1440, height: 900 }, scale: 15,
  });
  const size = u.PATTERN_SIZE + u.STROKE_WIDTH;
  for (const [bit, coordinate] of [[0, 0], [1, -1]]) {
    const pattern = Array.from({ length: 7 }, () => Array(7).fill(bit));
    const camera = u.findPatternWorldPosition(pattern);
    assert.equal(camera.x, -(coordinate + 0.5) * size);
    assert.equal(camera.y, -(coordinate + 0.5) * size);
    u.cameraWorldPosition = camera;
    u.originShift = camera;
    u.translation = { x: 0, y: 0 };
    const { offsets } = u.getVisiblePatterns();
    const centers = Array.from({ length: offsets.length / 2 }, (_, i) => ({
      x: offsets[i * 2] + size / 2, y: offsets[i * 2 + 1] + size / 2,
    }));
    assert.ok(centers.some(p => p.x < -size / 2));
    assert.ok(centers.some(p => p.x > size / 2));
    assert.ok(centers.some(p => p.y < -size / 2));
    assert.ok(centers.some(p => p.y > size / 2));
    assert.equal(u.clampView({ ...camera, zoom: 15 }).x, camera.x);
  }
  const max = u.clampView({ x: Infinity, y: Infinity, zoom: 1 });
  const min = u.clampView({ x: -Infinity, y: -Infinity, zoom: 1 });
  assert.equal(max.x, (u.GRID_COLS / 2 - 0.5) * size);
  assert.equal(min.x, -max.x);
  assert.equal(max.y, (u.GRID_ROWS / 2 - 0.5) * size);
  assert.equal(min.y, -max.y);
});
