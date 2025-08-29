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
            in float a_patternId0;
            in float a_patternId1;
            in float a_patternId2;
            in float a_patternId3;
            in float a_patternId4;
            in float a_patternId5;
            in float a_patternId6;
            
            uniform vec2 u_resolution;
            uniform vec2 u_translation;
            uniform float u_scale;
            uniform float u_patternSize;
            uniform float u_strokeWidth;
            
            out vec2 v_localPos;
            out float v_patternId0;
            out float v_patternId1;
            out float v_patternId2;
            out float v_patternId3;
            out float v_patternId4;
            out float v_patternId5;
            out float v_patternId6;
            
            void main() {
                v_patternId0 = a_patternId0;
                v_patternId1 = a_patternId1;
                v_patternId2 = a_patternId2;
                v_patternId3 = a_patternId3;
                v_patternId4 = a_patternId4;
                v_patternId5 = a_patternId5;
                v_patternId6 = a_patternId6;
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
            in float v_patternId0;
            in float v_patternId1;
            in float v_patternId2;
            in float v_patternId3;
            in float v_patternId4;
            in float v_patternId5;
            in float v_patternId6;
            
            uniform float u_patternSize;
            uniform float u_strokeWidth;
            
            out vec4 fragColor;
            
            // Get bit from one of the 7-bit components
            bool getBitFromComponent(float component, int localBitIndex) {
                int intComponent = int(component);
                int mask = 1 << localBitIndex;
                return (intComponent & mask) != 0;
            }
            
            // Get bit from the reconstructed 49-bit pattern
            bool getBit(int bitIndex) {
                // Each component holds 7 bits: component 0 = bits 0-6, component 1 = bits 7-13, etc.
                int componentIndex = bitIndex / 7;
                int localBitIndex = bitIndex % 7;
                
                if (componentIndex == 0) return getBitFromComponent(v_patternId0, localBitIndex);
                else if (componentIndex == 1) return getBitFromComponent(v_patternId1, localBitIndex);
                else if (componentIndex == 2) return getBitFromComponent(v_patternId2, localBitIndex);
                else if (componentIndex == 3) return getBitFromComponent(v_patternId3, localBitIndex);
                else if (componentIndex == 4) return getBitFromComponent(v_patternId4, localBitIndex);
                else if (componentIndex == 5) return getBitFromComponent(v_patternId5, localBitIndex);
                else if (componentIndex == 6) return getBitFromComponent(v_patternId6, localBitIndex);
                
                return false; // Should never reach here
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
                
                // Get the bit value from the appropriate component
                bool bitValue = getBit(bitIndex);
                
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
    this.instancePatternId0Buffer = this.gl.createBuffer();
    this.instancePatternId1Buffer = this.gl.createBuffer();
    this.instancePatternId2Buffer = this.gl.createBuffer();
    this.instancePatternId3Buffer = this.gl.createBuffer();
    this.instancePatternId4Buffer = this.gl.createBuffer();
    this.instancePatternId5Buffer = this.gl.createBuffer();
    this.instancePatternId6Buffer = this.gl.createBuffer();

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

    // Pattern ID component attributes
    const patternIdAttribs = [];
    const patternIdBuffers = [
      this.instancePatternId0Buffer,
      this.instancePatternId1Buffer,
      this.instancePatternId2Buffer,
      this.instancePatternId3Buffer,
      this.instancePatternId4Buffer,
      this.instancePatternId5Buffer,
      this.instancePatternId6Buffer,
    ];

    for (let i = 0; i < 7; i++) {
      const attribName = `a_patternId${i}`;
      const attrib = this.gl.getAttribLocation(this.program, attribName);
      if (attrib === -1) {
        this.showError(`Could not find ${attribName} attribute`);
        return;
      }

      patternIdAttribs.push(attrib);
      this.gl.enableVertexAttribArray(attrib);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, patternIdBuffers[i]);
      this.gl.vertexAttribPointer(attrib, 1, this.gl.FLOAT, false, 0, 0);
      this.gl.vertexAttribDivisor(attrib, 1);
    }

    // Store for later use
    this.patternIdAttribs = patternIdAttribs;
    this.patternIdBuffers = patternIdBuffers;

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
      this.scale = Math.max(0.2, Math.min(10, this.scale));
    });
  }

  getVisiblePatterns() {
    const patternSize = this.PATTERN_SIZE + this.STROKE_WIDTH;

    // Calculate the world space bounds of what's currently visible on screen
    // Screen coordinates (0,0) to (canvas.width, canvas.height) in world space
    const screenToWorld = (screenX, screenY) => {
      return {
        x: screenX / this.scale - this.translation.x,
        y: screenY / this.scale - this.translation.y,
      };
    };

    // Add padding to avoid popping when scrolling
    const padding = patternSize * 3;

    // Get world coordinates of screen bounds with padding
    const topLeft = screenToWorld(-padding, -padding);
    const bottomRight = screenToWorld(
      this.canvas.width + padding,
      this.canvas.height + padding
    );

    // Convert world coordinates to grid indices
    const startCol = Math.floor(topLeft.x / patternSize);
    const startRow = Math.floor(topLeft.y / patternSize);
    const endCol = Math.ceil(bottomRight.x / patternSize);
    const endRow = Math.ceil(bottomRight.y / patternSize);

    // Limit grid size to prevent memory issues
    const maxGridSize = 33554432;
    const clampedStartCol = Math.max(-maxGridSize, startCol);
    const clampedStartRow = Math.max(-maxGridSize, startRow);
    const clampedEndCol = Math.min(maxGridSize, endCol);
    const clampedEndRow = Math.min(maxGridSize, endRow);

    const offsets = [];
    const patternComponents = [[], [], [], [], [], [], []]; // 7 arrays for 7-bit components
    let count = 0;
    const maxPatterns = 1000000; // Reasonable limit

    // Helper function to break a large integer into 7-bit components
    const breakInto7BitComponents = (largeInt) => {
      const components = [];
      for (let i = 0; i < 7; i++) {
        components.push(largeInt & 0x7f); // Extract lowest 7 bits
        largeInt >>= 7; // Shift right by 7 bits
      }
      return components;
    };

    // Generate patterns for visible grid cells
    for (
      let row = clampedStartRow;
      row < clampedEndRow && count < maxPatterns;
      row++
    ) {
      for (
        let col = clampedStartCol;
        col < clampedEndCol && count < maxPatterns;
        col++
      ) {
        // Calculate world position for this grid cell
        const worldX = col * patternSize - this.canvas.width / 2 / this.scale;
        const worldY = row * patternSize - this.canvas.height / 2 / this.scale;

        // Create a unique pattern ID that works with negative coordinates
        // Map from [-maxGridSize, maxGridSize] to [0, 2*maxGridSize]
        const normalizedRow = row + maxGridSize;
        const normalizedCol = col + maxGridSize;
        const patternId = normalizedRow * (2 * maxGridSize) + normalizedCol;

        // Break the pattern ID into 7-bit components
        const components = breakInto7BitComponents(patternId);

        // Add components to respective arrays
        for (let i = 0; i < 7; i++) {
          patternComponents[i].push(components[i]);
        }

        offsets.push(worldX, worldY);
        count++;
      }
    }

    // Update debug info
    document.getElementById('bounds').textContent =
      `Grid: (${clampedStartCol},${clampedStartRow}) to (${clampedEndCol},${clampedEndRow}) | ` +
      `Patterns: ${count} | Translation: (${Math.round(
        this.translation.x
      )}, ${Math.round(this.translation.y)}) | ` +
      `Scale: ${this.scale.toFixed(2)}x`;

    return { patternComponents, offsets, count };
  }

  render() {
    // Clear the canvas
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    const { patternComponents, offsets, count } = this.getVisiblePatterns();

    if (count === 0) {
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

    // Update all 7 pattern ID component buffers
    for (let i = 0; i < 7; i++) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.patternIdBuffers[i]);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array(patternComponents[i]),
        this.gl.DYNAMIC_DRAW
      );
    }

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
      count
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
