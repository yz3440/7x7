// Use the original centered coordinates with precise camera and tile alignment.
class InstallationUniverse extends BinaryPatternUniverse {
  setupEventListeners() {
    // The monitor is output-only. Only iPad messages can move its camera.
  }

  setView(view) {
    this.animationManager.stop();
    this.cameraWorldPosition = { x: view.x, y: view.y };
    this.originShift = { x: view.x, y: view.y };
    this.translation = { x: 0, y: 0 };
    this.scale = view.zoom;
  }

  findPatternWorldPosition(pattern) {
    const id = BinaryPatternUniverse.componentsToPatternId(
      BinaryPatternUniverse.binaryPatternTo7BitComponents(pattern));
    const { row, col } = this.patternIdToRowCol(id);
    const size = this.PATTERN_SIZE + this.STROKE_WIDTH;
    // The vertex shader adds the camera translation to world coordinates.
    return { x: -(col + 0.5) * size, y: -(row + 0.5) * size };
  }

  clampView({ x, y, zoom }) {
    const size = this.PATTERN_SIZE + this.STROKE_WIDTH;
    const clamp = (value, count) => Math.max(-(count / 2 - 0.5) * size, Math.min((count / 2 - 0.5) * size, value));
    return { x: clamp(x, this.GRID_COLS), y: clamp(y, this.GRID_ROWS), zoom };
  }

  getVisiblePatterns() {
    const size = this.PATTERN_SIZE + this.STROKE_WIDTH;
    const halfWidth = this.canvas.width / (2 * this.scale);
    const halfHeight = this.canvas.height / (2 * this.scale);
    const centerX = -this.cameraWorldPosition.x;
    const centerY = -this.cameraWorldPosition.y;
    const startCol = Math.max(-this.GRID_COLS / 2, Math.floor((centerX - halfWidth) / size) - 1);
    const endCol = Math.min(this.GRID_COLS / 2, Math.ceil((centerX + halfWidth) / size) + 1);
    const startRow = Math.max(-this.GRID_ROWS / 2, Math.floor((centerY - halfHeight) / size) - 1);
    const endRow = Math.min(this.GRID_ROWS / 2, Math.ceil((centerY + halfHeight) / size) + 1);
    const offsets = [];
    const patternComponents = Array.from({ length: 7 }, () => []);
    let count = 0;
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const normalizedRow = (row + this.GRID_ROWS) % this.GRID_ROWS;
        const normalizedCol = (col + this.GRID_COLS) % this.GRID_COLS;
        const id = normalizedRow * this.GRID_COLS + normalizedCol;
        const components = BinaryPatternUniverse.breakLargeIndexInto7BitComponents(id);
        for (let i = 0; i < 7; i++) patternComponents[i].push(components[i]);
        // Offsets + translation must equal world + camera. Adding originShift
        // cancels the subtraction in the inherited translation calculation.
        offsets.push(col * size + this.originShift.x, row * size + this.originShift.y);
        count++;
      }
    }
    return { patternComponents, offsets, count };
  }
}
