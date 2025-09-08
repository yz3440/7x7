// Drawing Canvas Class
class DrawingCanvas {
  constructor() {
    this.canvas = document.getElementById('drawing-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.gridSize = 7;
    this.cellSize = Math.floor(320 / 7); // Each cell is ~45x45 pixels (320/7 ≈ 45.7)

    // Initialize pattern data structure - 7x7 array with 0s and 1s
    this.pattern = PATTERN_ML.map((row) => [...row]);

    // Mouse state
    this.isDrawing = false;
    this.currentDrawValue = 1; // What value to draw (0 or 1)

    this.init();
  }

  init() {
    // Show animation controls only if developer mode is enabled
    if (SHOW_ANIMATION_CONTROLS) {
      const animationControls = document.querySelector('.animation-controls');
      if (animationControls) {
        animationControls.style.display = 'flex';
      }
    }

    this.setupEventListeners();
    this.draw();
  }

  setupEventListeners() {
    // Mouse events for drawing
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

    // Button events
    document
      .getElementById('clear-pattern')
      .addEventListener('click', () => this.clearPattern());
    document
      .getElementById('invert-pattern')
      .addEventListener('click', () => this.invertPattern());
    document
      .getElementById('find-pattern')
      .addEventListener('click', () => this.findPattern());

    // Animation control events (only if developer mode is enabled)
    if (SHOW_ANIMATION_CONTROLS) {
      const durationInput = document.getElementById('animation-duration');
      const speedSelect = document.getElementById('animation-speed');

      if (durationInput && speedSelect) {
        // Sync speed selector with duration input
        speedSelect.addEventListener('change', () => {
          durationInput.value = speedSelect.value;
        });

        // Update speed selector when duration input changes (if it matches a preset)
        durationInput.addEventListener('input', () => {
          const value = durationInput.value;
          if (speedSelect.querySelector(`option[value="${value}"]`)) {
            speedSelect.value = value;
          } else {
            speedSelect.value = ''; // Clear selection if custom value
          }
        });
      }
    }
  }

  getCanvasPosition(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  getCellFromPosition(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);

    return {
      row: Math.max(0, Math.min(6, row)),
      col: Math.max(0, Math.min(6, col)),
    };
  }

  handleMouseDown(e) {
    e.preventDefault();
    this.isDrawing = true;

    const pos = this.getCanvasPosition(e.clientX, e.clientY);
    const cell = this.getCellFromPosition(pos.x, pos.y);

    // Determine what value to draw based on current cell state
    this.currentDrawValue = this.pattern[cell.row][cell.col] === 0 ? 1 : 0;

    this.setCell(cell.row, cell.col, this.currentDrawValue);
  }

  handleMouseMove(e) {
    if (!this.isDrawing) return;

    e.preventDefault();
    const pos = this.getCanvasPosition(e.clientX, e.clientY);
    const cell = this.getCellFromPosition(pos.x, pos.y);

    this.setCell(cell.row, cell.col, this.currentDrawValue);
  }

  handleMouseUp() {
    this.isDrawing = false;
  }

  handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.handleMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => {},
      });
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && this.isDrawing) {
      const touch = e.touches[0];
      this.handleMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => {},
      });
    }
  }

  handleTouchEnd(e) {
    e.preventDefault();
    this.handleMouseUp();
  }

  setCell(row, col, value) {
    if (row >= 0 && row < 7 && col >= 0 && col < 7) {
      this.pattern[row][col] = value;
      this.draw();
    }
  }

  clearPattern() {
    this.pattern = Array(7)
      .fill()
      .map(() => Array(7).fill(0));
    this.draw();
  }

  invertPattern() {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        this.pattern[row][col] = this.pattern[row][col] === 0 ? 1 : 0;
      }
    }
    this.draw();
  }

  findPattern() {
    if (window.universe) {
      let duration = 2000; // Default duration

      // Get duration from the UI control only if animation controls are enabled
      if (SHOW_ANIMATION_CONTROLS) {
        const durationInput = document.getElementById('animation-duration');
        if (durationInput) {
          duration = parseInt(durationInput.value) || 2000;
          // Ensure duration is within reasonable bounds
          duration = Math.max(100, Math.min(10000, duration));
          console.log(
            `Flying to pattern with ${duration}ms duration (developer mode)`
          );
        }
      }

      window.universe.flyToPattern(this.pattern, duration);
    }
  }

  draw() {
    // Clear canvas
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid and pattern
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;

        // Fill cell based on pattern value
        this.ctx.fillStyle = this.pattern[row][col] === 1 ? 'white' : 'black';
        this.ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);

        // Draw cell border
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
      }
    }

    // Draw outer border
    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Get the current pattern as a 7x7 array
  getPattern() {
    return this.pattern.map((row) => [...row]); // Return a deep copy
  }

  // Set the pattern from a 7x7 array
  setPattern(newPattern) {
    if (Array.isArray(newPattern) && newPattern.length === 7) {
      for (let row = 0; row < 7; row++) {
        if (Array.isArray(newPattern[row]) && newPattern[row].length === 7) {
          for (let col = 0; col < 7; col++) {
            this.pattern[row][col] = newPattern[row][col] === 1 ? 1 : 0;
          }
        }
      }
      this.draw();
    }
  }
}
