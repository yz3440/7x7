class BinaryPatternUniverse {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.errorLog = document.getElementById('error-log');

    // Check WebGL2 support
    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      this.showError('WebGL2 not supported');
      return;
    }

    console.log('WebGL2 initialized successfully');

    // Grid dimensions - for the full universe
    this.GRID_ROWS = Math.pow(2, 24); // 16,777,216
    this.GRID_COLS = Math.pow(2, 25); // 33,554,432
    this.PATTERN_SIZE = 20; // Size of each 7x7 pattern in pixels
    this.STROKE_WIDTH = 0.1; // Border width between patterns

    // Camera state - start at origin for debugging
    this.translation = {
      x: 0,
      y: 0,
    };
    this.scale = 1.0;

    // Mouse state
    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };

    this.init();
  }

  showError(message) {
    console.error(message);
    this.errorLog.innerHTML += `<div class="error">${message}</div>`;
  }

  init() {
    try {
      this.resizeCanvas();
      this.setupWebGL();
      this.setupShaders();
      this.setupGeometry();
      this.setupEventListeners();
      this.startRenderLoop();

      console.log('Initialization complete');

      window.addEventListener('resize', () => this.resizeCanvas());
    } catch (error) {
      this.showError(`Initialization failed: ${error.message}`);
    }
  }

  setupWebGL() {
    // Set clear color to dark gray so we can see if anything renders
    this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    console.log(`Canvas resized to ${this.canvas.width}x${this.canvas.height}`);
  }

  setupShaders() {
    const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            in vec2 a_instanceOffset;
            in float a_patternId;
            
            uniform vec2 u_resolution;
            uniform vec2 u_translation;
            uniform float u_scale;
            uniform float u_patternSize;
            uniform float u_strokeWidth;
            
            out vec2 v_localPos;
            out float v_patternId;
            
            void main() {
                v_patternId = a_patternId;
                v_localPos = a_position;
                
                // Calculate world position
                vec2 worldPos = a_instanceOffset + a_position;
                
                // Apply camera transform
                worldPos = (worldPos + u_translation) * u_scale;
                
                // Convert to normalized device coordinates
                vec2 ndc = worldPos / (u_resolution * 0.5);
                ndc.y = -ndc.y; // Flip Y axis
                
                gl_Position = vec4(ndc, 0.0, 1.0);
            }
        `;

    const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in vec2 v_localPos;
            in float v_patternId;
            
            uniform float u_patternSize;
            uniform float u_strokeWidth;
            
            out vec4 fragColor;
            
            // Extract bit using integer operations for better precision
            bool getBit(float patternId, int bitIndex) {
                // Use modular arithmetic to extract bits
                float divisor = pow(2.0, float(bitIndex));
                float quotient = floor(patternId / divisor);
                return mod(quotient, 2.0) > 0.5;
            }
            
            void main() {
                float totalSize = u_patternSize + u_strokeWidth;
                
                // Check if we're in stroke area
                if (v_localPos.x < u_strokeWidth * 0.5 || 
                    v_localPos.x > totalSize - u_strokeWidth * 0.5 ||
                    v_localPos.y < u_strokeWidth * 0.5 || 
                    v_localPos.y > totalSize - u_strokeWidth * 0.5) {
                    fragColor = vec4(1.0, 0.2, 0.2, 1.0); // Red stroke
                    return;
                }
                
                // Calculate which pixel within the 7x7 pattern
                vec2 patternPos = v_localPos - vec2(u_strokeWidth * 0.5);
                float pixelSize = (u_patternSize - u_strokeWidth) / 7.0;
                
                int pixelX = int(floor(patternPos.x / pixelSize));
                int pixelY = int(floor(patternPos.y / pixelSize));
                
                // Ensure we're within bounds
                if (pixelX < 0 || pixelX >= 7 || pixelY < 0 || pixelY >= 7) {
                    fragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red for out of bounds
                    return;
                }
                
                // Calculate bit index (0-48)
                int bitIndex = pixelY * 7 + pixelX;
                
                // Get the bit value
                bool bitValue = getBit(v_patternId, bitIndex);
                
                // Color: false = black, true = white
                float color = bitValue ? 1.0 : 0.0;
                fragColor = vec4(color, color, color, 1.0);
            }
        `;

    console.log('Compiling shaders...');
    this.program = this.createShaderProgram(
      vertexShaderSource,
      fragmentShaderSource
    );

    if (!this.program) {
      throw new Error('Failed to create shader program');
    }

    this.gl.useProgram(this.program);

    // Get uniform locations
    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
      translation: this.gl.getUniformLocation(this.program, 'u_translation'),
      scale: this.gl.getUniformLocation(this.program, 'u_scale'),
      patternSize: this.gl.getUniformLocation(this.program, 'u_patternSize'),
      strokeWidth: this.gl.getUniformLocation(this.program, 'u_strokeWidth'),
    };

    console.log('Shaders compiled successfully');
  }

  createShaderProgram(vertexSource, fragmentSource) {
    const vertexShader = this.compileShader(
      this.gl.VERTEX_SHADER,
      vertexSource
    );
    const fragmentShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      fragmentSource
    );

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      this.showError(`Program link error: ${error}`);
      return null;
    }

    return program;
  }

  compileShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      const shaderType = type === this.gl.VERTEX_SHADER ? 'vertex' : 'fragment';
      this.showError(`${shaderType} shader compile error: ${error}`);
      return null;
    }

    return shader;
  }

  setupGeometry() {
    console.log('Setting up geometry...');

    // Create a rectangle for each pattern (including stroke)
    const size = this.PATTERN_SIZE + this.STROKE_WIDTH;
    const vertices = [
      0,
      0, // bottom-left
      size,
      0, // bottom-right
      0,
      size, // top-left
      size,
      size, // top-right
    ];

    const indices = [0, 1, 2, 1, 2, 3];

    // Create VAO
    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    // Vertex buffer
    this.vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(vertices),
      this.gl.STATIC_DRAW
    );

    // Index buffer
    this.indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      this.gl.STATIC_DRAW
    );

    // Position attribute
    const positionAttrib = this.gl.getAttribLocation(
      this.program,
      'a_position'
    );
    if (positionAttrib === -1) {
      this.showError('Could not find a_position attribute');
      return;
    }

    this.gl.enableVertexAttribArray(positionAttrib);
    this.gl.vertexAttribPointer(positionAttrib, 2, this.gl.FLOAT, false, 0, 0);

    // Create instance buffers
    this.instanceOffsetBuffer = this.gl.createBuffer();
    this.instancePatternIdBuffer = this.gl.createBuffer();

    // Instance offset attribute
    const offsetAttrib = this.gl.getAttribLocation(
      this.program,
      'a_instanceOffset'
    );
    if (offsetAttrib === -1) {
      this.showError('Could not find a_instanceOffset attribute');
      return;
    }

    this.gl.enableVertexAttribArray(offsetAttrib);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceOffsetBuffer);
    this.gl.vertexAttribPointer(offsetAttrib, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.vertexAttribDivisor(offsetAttrib, 1);

    // Pattern ID attribute
    const patternIdAttrib = this.gl.getAttribLocation(
      this.program,
      'a_patternId'
    );
    if (patternIdAttrib === -1) {
      this.showError('Could not find a_patternId attribute');
      return;
    }

    this.gl.enableVertexAttribArray(patternIdAttrib);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instancePatternIdBuffer);
    this.gl.vertexAttribPointer(patternIdAttrib, 1, this.gl.FLOAT, false, 0, 0);
    this.gl.vertexAttribDivisor(patternIdAttrib, 1);

    console.log('Geometry setup complete');
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;

        this.translation.x += dx / this.scale;
        this.translation.y += dy / this.scale;

        this.lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale *= zoomFactor;
      this.scale = Math.max(0.01, Math.min(10, this.scale));
    });
  }

  getVisiblePatterns() {
    const patternSize = this.PATTERN_SIZE + this.STROKE_WIDTH;
    const visibleWidth = this.canvas.width / this.scale;
    const visibleHeight = this.canvas.height / this.scale;

    // Add some padding to reduce popping
    const padding = patternSize * 2;

    // Calculate world coordinates of the visible area
    // The visible area in world coordinates starts at -translation and extends by visible dimensions
    const worldLeft = -this.translation.x - padding;
    const worldTop = -this.translation.y - padding;
    const worldRight = -this.translation.x + visibleWidth + padding;
    const worldBottom = -this.translation.y + visibleHeight + padding;

    // Convert world coordinates to grid coordinates
    const left = Math.floor(worldLeft / patternSize);
    const top = Math.floor(worldTop / patternSize);
    const right = Math.ceil(worldRight / patternSize);
    const bottom = Math.ceil(worldBottom / patternSize);

    const patterns = [];
    const offsets = [];

    // Limit the number of patterns to prevent overwhelming the GPU
    let count = 0;
    const maxPatterns = 50000000;

    // Use a more reasonable grid size for now - we can expand later
    const maxGridSize = 1000; // This gives us 1M patterns to work with

    for (
      let row = Math.max(-maxGridSize, top);
      row < Math.min(maxGridSize, bottom) && count < maxPatterns;
      row++
    ) {
      for (
        let col = Math.max(-maxGridSize, left);
        col < Math.min(maxGridSize, right) && count < maxPatterns;
        col++
      ) {
        // Convert grid position to pattern ID
        // For now, use a simple mapping that works with negative coordinates
        const gridRow = row + maxGridSize; // Shift to make positive
        const gridCol = col + maxGridSize;
        const patternId = gridRow * (maxGridSize * 2) + gridCol;

        patterns.push(patternId);
        offsets.push(col * patternSize, row * patternSize);
        count++;
      }
    }

    // Update debug info
    document.getElementById(
      'bounds'
    ).textContent = `Bounds: (${left}, ${top}) to (${right}, ${bottom}) | Grid: ${
      right - left
    }x${bottom - top} | Translation: (${Math.round(
      this.translation.x
    )}, ${Math.round(this.translation.y)})`;

    return { patterns, offsets, count };
  }

  render() {
    // Clear the canvas
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    const { patterns, offsets, count } = this.getVisiblePatterns();

    if (patterns.length === 0) {
      document.getElementById('debug').textContent = 'No patterns to render';
      return;
    }

    // Update instance buffers
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceOffsetBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(offsets),
      this.gl.DYNAMIC_DRAW
    );

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instancePatternIdBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(patterns),
      this.gl.DYNAMIC_DRAW
    );

    // Set uniforms
    this.gl.uniform2f(
      this.uniforms.resolution,
      this.canvas.width,
      this.canvas.height
    );
    this.gl.uniform2f(
      this.uniforms.translation,
      this.translation.x,
      this.translation.y
    );
    this.gl.uniform1f(this.uniforms.scale, this.scale);
    this.gl.uniform1f(this.uniforms.patternSize, this.PATTERN_SIZE);
    this.gl.uniform1f(this.uniforms.strokeWidth, this.STROKE_WIDTH);

    // Draw
    this.gl.bindVertexArray(this.vao);
    this.gl.drawElementsInstanced(
      this.gl.TRIANGLES,
      6,
      this.gl.UNSIGNED_SHORT,
      0,
      patterns.length
    );

    // Update debug info
    document.getElementById(
      'debug'
    ).textContent = `Rendering: ${count} patterns`;
  }

  updateInfo() {
    const coords = document.getElementById('coords');
    coords.textContent = `Position: (${Math.round(
      this.translation.x
    )}, ${Math.round(this.translation.y)}) | Zoom: ${this.scale.toFixed(3)}x`;
  }

  startRenderLoop() {
    const renderFrame = () => {
      this.render();
      this.updateInfo();
      requestAnimationFrame(renderFrame);
    };
    renderFrame();
  }
}

// Initialize when page loads
window.addEventListener('load', () => {
  try {
    new BinaryPatternUniverse();
  } catch (error) {
    console.error('Failed to initialize:', error);
    document.getElementById(
      'error-log'
    ).innerHTML = `<div class="error">Failed to initialize: ${error.message}</div>`;
  }
});
