// Configuration
const SHOW_DEBUG_PANEL = false; // Set to true to show the floating debug panel

const PATTERN_EMPTY = [
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
];

const PATTERN_TEST = [
  [0, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
];

const PATTERN_EMPTY_INV = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
];

const PATTERN_PLUS = [
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];

const PATTERN_DIAGONAL = [
  [1, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 1],
];

const PATTERN_ML = [
  [0, 0, 0, 0, 1, 1, 1],
  [1, 1, 1, 0, 1, 1, 1],
  [1, 1, 1, 0, 1, 1, 1],
  [0, 1, 1, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 1, 1, 0],
];

const PATTERN_ML_INV = [
  [1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [1, 0, 0, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 0, 0, 1],
];

const PATTERN_FS = [
  [1, 0, 1, 1, 1, 1, 1],
  [1, 0, 1, 0, 0, 0, 0],
  [1, 0, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 0, 1, 1],
  [1, 0, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1],
];

const PATTERN_FS_INV = [
  [0, 1, 0, 0, 0, 0, 0],
  [0, 1, 0, 1, 1, 1, 1],
  [0, 1, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 1, 0, 1, 1, 0, 0],
  [0, 1, 0, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0],
];

class BinaryPatternUniverse {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.errorLog = document.getElementById('error-log');

    // Show debug panel if configured
    if (SHOW_DEBUG_PANEL) {
      const debugPanel = document.querySelector('.debug-info');
      if (debugPanel) {
        debugPanel.hidden = false;
      }
    }

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
    this.SCALE_RANGE = [0.3, 20]; // Range of zoom levels

    // Camera state - start at origin for debugging
    // We track the true world position in double precision
    this.cameraWorldPosition = {
      x: 0.0,
      y: 0.0,
    };

    // The origin shift offset - this gets subtracted from all world positions
    // to keep values near zero for the shader
    this.originShift = {
      x: 0.0,
      y: 0.0,
    };

    // The relative camera position (cameraWorldPosition - originShift)
    // This is what we pass to the shader
    this.translation = {
      x: 0,
      y: 0,
    };

    this.scale = 1.0;

    // Mouse state
    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };

    // Touch state for pinch-to-zoom
    this.touchState = {
      lastDistance: 0,
      lastCenter: { x: 0, y: 0 },
      isPinching: false,
    };

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
    // Set clear color to pure black
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
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
            precision highp float;
            precision highp int;
            
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
            precision highp int;
            
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
            uniform float u_scale;
            
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
                
                float strokeAlpha = clamp(u_scale * 0.8 + 0.2, 0.2, 1.0);

                // Check if we're in stroke area
                if (v_localPos.x < u_strokeWidth * 0.5 || 
                    v_localPos.x > totalSize - u_strokeWidth * 0.5 ||
                    v_localPos.y < u_strokeWidth * 0.5 || 
                    v_localPos.y > totalSize - u_strokeWidth * 0.5) {
                    // Calculate alpha based on scale - more transparent when zoomed out (low scale)
                    // At scale 1.0, alpha = 1.0 (fully opaque)
                    // At scale 0.2, alpha = 0.2 (very transparent)
                    fragColor = vec4(1.0, 0.2, 0.2, strokeAlpha); // Red stroke with variable transparency
                    return;
                }
                
                // Calculate which pixel within the 7x7 pattern
                vec2 patternPos = v_localPos - vec2(u_strokeWidth * 0.5);
                float pixelSize = (u_patternSize - u_strokeWidth) / 7.0;
                
                int pixelX = int(floor(patternPos.x / pixelSize));
                int pixelY = int(floor(patternPos.y / pixelSize));
                
                // Ensure we're within bounds
                if (pixelX < 0 || pixelX >= 7 || pixelY < 0 || pixelY >= 7) {
                    fragColor = vec4(1.0, 0.2, 0.2, strokeAlpha); // Red for out of bounds
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

  /**
   * Updates the origin shift to keep camera near origin
   * This prevents floating point precision issues in the shader
   */
  updateOriginShift() {
    // Threshold for shifting - when camera is more than this distance from origin
    const SHIFT_THRESHOLD = 10000.0;

    // Check if we need to shift the origin
    const distFromOrigin = Math.sqrt(
      this.translation.x * this.translation.x +
        this.translation.y * this.translation.y
    );

    if (distFromOrigin > SHIFT_THRESHOLD) {
      // Shift the origin to the current camera position
      // Round to pattern size to avoid sub-pixel shifting artifacts
      const patternSize = this.PATTERN_SIZE + this.STROKE_WIDTH;
      const shiftX = Math.round(this.translation.x / patternSize) * patternSize;
      const shiftY = Math.round(this.translation.y / patternSize) * patternSize;

      // Update origin shift (in double precision)
      this.originShift.x += shiftX;
      this.originShift.y += shiftY;

      // Update relative translation (camera position relative to new origin)
      this.translation.x -= shiftX;
      this.translation.y -= shiftY;

      console.log(
        `Origin shifted by (${shiftX}, ${shiftY}). New origin: (${this.originShift.x}, ${this.originShift.y})`
      );
    }
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

        // Update camera world position in double precision
        // When we drag right, we want to see content to the left (camera moves left)
        // When we drag down, we want to see content above (camera moves up)
        this.cameraWorldPosition.x += dx / this.scale;
        this.cameraWorldPosition.y += dy / this.scale;

        // Update relative translation
        this.translation.x = this.cameraWorldPosition.x - this.originShift.x;
        this.translation.y = this.cameraWorldPosition.y - this.originShift.y;

        // Check if we need to shift the origin
        this.updateOriginShift();

        this.lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevent scrolling and other default touch behaviors

      if (e.touches.length === 1) {
        // Single finger - start dragging
        const touch = e.touches[0];
        this.isDragging = true;
        this.touchState.isPinching = false;
        this.lastMousePos = { x: touch.clientX, y: touch.clientY };
      } else if (e.touches.length === 2) {
        // Two fingers - start pinching
        this.isDragging = false;
        this.touchState.isPinching = true;

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Calculate initial distance and center point
        this.touchState.lastDistance = this.getTouchDistance(touch1, touch2);
        this.touchState.lastCenter = this.getTouchCenter(touch1, touch2);
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault(); // Prevent scrolling and other default touch behaviors

      if (
        e.touches.length === 1 &&
        this.isDragging &&
        !this.touchState.isPinching
      ) {
        // Single finger dragging
        const touch = e.touches[0];
        const dx = touch.clientX - this.lastMousePos.x;
        const dy = touch.clientY - this.lastMousePos.y;

        // Update camera world position in double precision
        // When we drag right, we want to see content to the left (camera moves left)
        // When we drag down, we want to see content above (camera moves up)
        this.cameraWorldPosition.x += dx / this.scale;
        this.cameraWorldPosition.y += dy / this.scale;

        // Update relative translation
        this.translation.x = this.cameraWorldPosition.x - this.originShift.x;
        this.translation.y = this.cameraWorldPosition.y - this.originShift.y;

        // Check if we need to shift the origin
        this.updateOriginShift();

        this.lastMousePos = { x: touch.clientX, y: touch.clientY };
      } else if (e.touches.length === 2 && this.touchState.isPinching) {
        // Two finger pinch-to-zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const currentDistance = this.getTouchDistance(touch1, touch2);
        const currentCenter = this.getTouchCenter(touch1, touch2);

        if (this.touchState.lastDistance > 0) {
          // Calculate zoom factor based on distance change
          const zoomFactor = currentDistance / this.touchState.lastDistance;

          // Convert center point to canvas coordinates
          const rect = this.canvas.getBoundingClientRect();
          const canvasX = currentCenter.x - rect.left;
          const canvasY = currentCenter.y - rect.top;

          // Apply zoom with center point (similar to wheel zoom logic)
          this.handleZoom(zoomFactor, canvasX, canvasY);
        }

        this.touchState.lastDistance = currentDistance;
        this.touchState.lastCenter = currentCenter;
      }
    });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault(); // Prevent scrolling and other default touch behaviors

      if (e.touches.length === 0) {
        // All fingers lifted
        this.isDragging = false;
        this.touchState.isPinching = false;
        this.touchState.lastDistance = 0;
      } else if (e.touches.length === 1 && this.touchState.isPinching) {
        // Went from pinch to single finger - switch to dragging
        this.touchState.isPinching = false;
        this.isDragging = true;
        const touch = e.touches[0];
        this.lastMousePos = { x: touch.clientX, y: touch.clientY };
      }
    });

    this.canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault(); // Prevent scrolling and other default touch behaviors
      this.isDragging = false;
      this.touchState.isPinching = false;
      this.touchState.lastDistance = 0;
    });

    // Wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

      // Get cursor position in screen coordinates
      const rect = this.canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      this.handleZoom(zoomFactor, cursorX, cursorY);
    });
  }

  // Helper method to calculate distance between two touch points
  getTouchDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Helper method to calculate center point between two touches
  getTouchCenter(touch1, touch2) {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }

  // Extracted zoom handling method for both wheel and pinch zoom
  handleZoom(zoomFactor, canvasX, canvasY) {
    // Convert screen to NDC, accounting for the Y flip in the shader
    const ndcX = canvasX / (this.canvas.width * 0.5) - 1.0;
    const ndcY = canvasY / (this.canvas.height * 0.5) - 1.0; // Apply Y flip to match shader

    // Convert NDC to world coordinates before zoom (relative to shifted origin)
    const relWorldPosBeforeZoom = {
      x: (ndcX * this.canvas.width * 0.5) / this.scale - this.translation.x,
      y: (ndcY * this.canvas.height * 0.5) / this.scale - this.translation.y,
    };

    // Get absolute world position (add back the origin shift)
    const absWorldPosBeforeZoom = {
      x: relWorldPosBeforeZoom.x + this.originShift.x,
      y: relWorldPosBeforeZoom.y + this.originShift.y,
    };

    // Apply zoom
    const oldScale = this.scale;
    this.scale *= zoomFactor;
    this.scale = Math.max(
      this.SCALE_RANGE[0],
      Math.min(this.SCALE_RANGE[1], this.scale)
    );

    // Convert NDC to world coordinates after zoom (relative to shifted origin)
    const relWorldPosAfterZoom = {
      x: (ndcX * this.canvas.width * 0.5) / this.scale - this.translation.x,
      y: (ndcY * this.canvas.height * 0.5) / this.scale - this.translation.y,
    };

    // Get absolute world position after zoom
    const absWorldPosAfterZoom = {
      x: relWorldPosAfterZoom.x + this.originShift.x,
      y: relWorldPosAfterZoom.y + this.originShift.y,
    };

    // Calculate the difference in absolute world positions
    const deltaX = absWorldPosAfterZoom.x - absWorldPosBeforeZoom.x;
    const deltaY = absWorldPosAfterZoom.y - absWorldPosBeforeZoom.y;

    // Update camera world position to compensate
    this.cameraWorldPosition.x += deltaX;
    this.cameraWorldPosition.y += deltaY;

    // Update relative translation
    this.translation.x = this.cameraWorldPosition.x - this.originShift.x;
    this.translation.y = this.cameraWorldPosition.y - this.originShift.y;

    // Check if we need to shift the origin
    this.updateOriginShift();
  }

  getVisiblePatterns() {
    const patternSize = this.PATTERN_SIZE + this.STROKE_WIDTH;

    // Calculate the world space bounds of what's currently visible on screen
    // We work in relative coordinates (relative to shifted origin)
    const screenToRelativeWorld = (screenX, screenY) => {
      return {
        x: screenX / this.scale - this.translation.x,
        y: screenY / this.scale - this.translation.y,
      };
    };

    // Add padding to avoid popping when scrolling
    const padding = patternSize * 3;

    // Get relative world coordinates of screen bounds with padding
    const relTopLeft = screenToRelativeWorld(-padding, -padding);
    const relBottomRight = screenToRelativeWorld(
      this.canvas.width + padding,
      this.canvas.height + padding
    );

    // Convert to absolute world coordinates by adding origin shift
    const absTopLeft = {
      x: relTopLeft.x + this.originShift.x,
      y: relTopLeft.y + this.originShift.y,
    };
    const absBottomRight = {
      x: relBottomRight.x + this.originShift.x,
      y: relBottomRight.y + this.originShift.y,
    };

    // Convert absolute world coordinates to grid indices
    const startCol = Math.floor(absTopLeft.x / patternSize);
    const startRow = Math.floor(absTopLeft.y / patternSize);
    const endCol = Math.ceil(absBottomRight.x / patternSize);
    const endRow = Math.ceil(absBottomRight.y / patternSize);

    // Limit grid size to prevent memory issues
    const maxGridSize = Math.max(this.GRID_COLS, this.GRID_ROWS);
    let clampedStartCol = Math.max(-maxGridSize, startCol);
    let clampedStartRow = Math.max(-maxGridSize, startRow);
    let clampedEndCol = Math.min(maxGridSize, endCol);
    let clampedEndRow = Math.min(maxGridSize, endRow);

    const rowSpan = clampedEndRow - clampedStartRow;
    const colSpan = clampedEndCol - clampedStartCol;

    clampedStartCol -= Math.ceil(colSpan / 2);
    clampedStartRow -= Math.ceil(rowSpan / 2);
    clampedEndCol += Math.ceil(colSpan / 2);
    clampedEndRow += Math.ceil(rowSpan / 2);

    const offsets = [];
    const patternComponents = [[], [], [], [], [], [], []]; // 7 arrays for 7-bit components
    let count = 0;
    const maxPatterns = 1000000; // Reasonable limit

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
        // Calculate absolute world position for this grid cell
        const absWorldX = col * patternSize;
        const absWorldY = row * patternSize;

        // Convert to relative position (subtract origin shift)
        const relWorldX = absWorldX - this.originShift.x;
        const relWorldY = absWorldY - this.originShift.y;

        // Create a unique pattern ID that works with negative coordinates
        // Map from [-maxGridSize, maxGridSize] to [0, maxGridSize]
        let normalizedRow = row + maxGridSize;
        let normalizedCol = col + maxGridSize;
        if (col < 0) {
          normalizedRow += 1;
        }

        const patternId = normalizedRow * maxGridSize + normalizedCol;

        // Break the pattern ID into 7-bit components
        const components =
          BinaryPatternUniverse.breakLargeIndexInto7BitComponents(patternId);

        // Add components to respective arrays
        for (let i = 0; i < 7; i++) {
          patternComponents[i].push(components[i]);
        }

        // Use relative positions for the shader
        offsets.push(relWorldX, relWorldY);

        count++;
      }
    }

    // Update debug info
    if (SHOW_DEBUG_PANEL) {
      document.getElementById('bounds').textContent =
        `Grid: (${clampedStartCol},${clampedStartRow}) to (${clampedEndCol},${clampedEndRow}) | ` +
        `Patterns: ${count} | World Pos: (${Math.round(
          this.cameraWorldPosition.x
        )}, ${Math.round(this.cameraWorldPosition.y)}) | ` +
        `Scale: ${this.scale.toFixed(2)}x`;
    }

    return { patternComponents, offsets, count };
  }

  render() {
    // Clear the canvas
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    const { patternComponents, offsets, count } = this.getVisiblePatterns();

    if (count === 0) {
      if (SHOW_DEBUG_PANEL) {
        document.getElementById('debug').textContent = 'No patterns to render';
      }
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
    if (SHOW_DEBUG_PANEL) {
      document.getElementById(
        'debug'
      ).textContent = `Rendering: ${count} patterns`;
    }
  }

  updateInfo() {
    // Always update user info panel
    const userX = document.getElementById('user-x');
    const userY = document.getElementById('user-y');
    const userZoom = document.getElementById('user-zoom');

    if (userX) {
      userX.textContent = `x: ${-Math.round(this.cameraWorldPosition.x)}`;
    }
    if (userY) {
      userY.textContent = `y: ${-Math.round(this.cameraWorldPosition.y)}`;
    }
    if (userZoom) {
      userZoom.textContent = `zoom: ${this.scale.toFixed(2)}x`;
    }

    // Update debug info panel only if enabled
    if (SHOW_DEBUG_PANEL) {
      const coords = document.getElementById('coords');
      coords.textContent = `Position: (${Math.round(
        this.cameraWorldPosition.x
      )}, ${Math.round(
        this.cameraWorldPosition.y
      )}) | Zoom: ${this.scale.toFixed(3)}x | Origin Shift: (${Math.round(
        this.originShift.x
      )}, ${Math.round(this.originShift.y)})`;
    }
  }

  startRenderLoop() {
    const renderFrame = () => {
      this.render();
      this.updateInfo();
      requestAnimationFrame(renderFrame);
    };
    renderFrame();
  }

  /**
   * Reverse engineers 7-bit components back to a big pattern index
   * @param {number[]} components - Array of 7 numbers representing 7-bit components
   * @returns {number} The reconstructed pattern index
   */
  static componentsToPatternId(components) {
    if (!Array.isArray(components) || components.length !== 7) {
      throw new Error('Input must be an array of 7 components');
    }

    let patternId = 0n; // Use BigInt for large numbers
    for (let i = 0; i < 7; i++) {
      const component = BigInt(components[i] & 0x7f); // Convert to BigInt and mask to 7 bits
      const shift = BigInt(i * 7); // Convert shift to BigInt
      patternId |= component << shift; // Each component contributes 7 bits
    }
    return Number(patternId); // Convert back to regular number for compatibility
  }

  /**
   * Converts a pattern index back to row and column coordinates
   * @param {number} patternId - The pattern index
   * @returns {object} Object with row and col properties
   */
  patternIdToRowCol(patternId) {
    const maxGridSize = Math.max(this.GRID_COLS, this.GRID_ROWS);

    // Reverse the calculation: patternId = normalizedRow * maxGridSize + normalizedCol
    let normalizedRow = Math.floor(patternId / maxGridSize);
    let normalizedCol = patternId % maxGridSize;
    // if (normalizedCol > maxGridSize / 2) {
    //   normalizedCol -= maxGridSize;
    // }

    // Reverse the normalization: normalizedRow = row + maxGridSize
    const row = normalizedRow;
    const col = normalizedCol;

    return { row, col };
  }

  /**
   * Converts row and column to world coordinates
   * @param {number} row - Grid row
   * @param {number} col - Grid column
   * @returns {object} Object with x and y world coordinates
   */
  rowColToWorldPos(row, col) {
    const patternSize = this.PATTERN_SIZE + this.STROKE_WIDTH;
    return {
      x: (col + 0.5) * patternSize,
      y: (row - 0.5) * patternSize,
    };
  }

  /**
   * Finds the world position of a specific 7x7 pattern
   * @param {number[][]} binaryPattern - 7x7 array containing only 0s and 1s
   * @returns {object} Object with x and y world coordinates
   */
  findPatternWorldPosition(binaryPattern) {
    // Convert pattern to components

    // Print the pattern
    let patternString = '';
    for (let row = 0; row < 7; row++) {
      patternString += `${binaryPattern[row].join(', ')}\n`;
    }
    console.log(`Target pattern:\n${patternString}`);

    const components =
      BinaryPatternUniverse.binaryPatternTo7BitComponents(binaryPattern);
    console.log(`Pattern components ${components}`);
    // Convert components to pattern ID
    const patternId = BinaryPatternUniverse.componentsToPatternId(components);
    console.log(`Pattern ID ${patternId}`);
    // Convert pattern ID to row/col
    const { row, col } = this.patternIdToRowCol(patternId);
    console.log(`Pattern at row ${row}, col ${col}`);
    // Convert row/col to world position
    return this.rowColToWorldPos(row, col);
  }

  /**
   * Fly to a specific pattern with zoom level 10
   * @param {number[][]} binaryPattern - 7x7 array containing only 0s and 1s
   */
  flyToPattern(binaryPattern) {
    // Set zoom level to 15
    this.scale = 15;
    const worldPos = this.findPatternWorldPosition(binaryPattern);

    // Update camera world position to center the pattern
    this.cameraWorldPosition.x = worldPos.x;
    this.cameraWorldPosition.y = worldPos.y;

    // Reset origin shift to camera position to maximize precision
    this.originShift.x = worldPos.x;
    this.originShift.y = worldPos.y;

    // Relative translation is now zero since camera is at origin
    this.translation.x = 0;
    this.translation.y = 0;

    console.log(
      `Flew to pattern at world position (${worldPos.x}, ${worldPos.y})`
    );
  }

  // Helper function to break a large integer into 7-bit components
  static breakLargeIndexInto7BitComponents(largeIdx) {
    let bigIdx = BigInt(largeIdx); // Convert to BigInt for large number operations
    const components = [];
    const mask = BigInt(0x7f); // 7-bit mask as BigInt
    const shift = BigInt(7); // Shift amount as BigInt

    for (let i = 0; i < 7; i++) {
      components.push(Number(bigIdx & mask)); // Extract lowest 7 bits and convert back to number
      bigIdx >>= shift; // Shift right by 7 bits
    }
    return components;
  }

  /**
   * Converts a 7x7 binary pattern to 7-bit components
   * @param {number[][]} binaryPattern - 7x7 array containing only 0s and 1s
   * @returns {number[]} Array of 7 numbers, each representing 7 bits of the pattern
   */
  static binaryPatternTo7BitComponents(binaryPattern) {
    if (!Array.isArray(binaryPattern) || binaryPattern.length !== 7) {
      throw new Error('Input must be a 7x7 array');
    }

    for (let row = 0; row < 7; row++) {
      if (
        !Array.isArray(binaryPattern[row]) ||
        binaryPattern[row].length !== 7
      ) {
        throw new Error('Each row must be an array of length 7');
      }
      for (let col = 0; col < 7; col++) {
        const value = binaryPattern[row][col];
        if (value !== 0 && value !== 1) {
          throw new Error(
            `All values must be 0 or 1, found ${value} at position [${row}][${col}]`
          );
        }
      }
    }

    // Convert 7x7 pattern to 49-bit integer, then split into 7-bit components
    const components = [];

    // Process each 7-bit component
    for (let componentIndex = 0; componentIndex < 7; componentIndex++) {
      let componentValue = 0;

      // Each component handles 7 bits of the pattern
      for (let bitIndex = 0; bitIndex < 7; bitIndex++) {
        const globalBitIndex = componentIndex * 7 + bitIndex;
        const row = Math.floor(globalBitIndex / 7);
        const col = globalBitIndex % 7;

        if (binaryPattern[row][col] === 1) {
          componentValue |= 1 << bitIndex;
        }
      }

      components.push(componentValue);
    }

    return components;
  }
}

// Drawing Canvas Class
class DrawingCanvas {
  constructor() {
    this.canvas = document.getElementById('drawing-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.gridSize = 7;
    this.cellSize = Math.floor(320 / 7); // Each cell is ~45x45 pixels (320/7 ≈ 45.7)

    // Initialize pattern data structure - 7x7 array with 0s and 1s
    // Start with PATTERN_FS as the initial pattern
    this.pattern = PATTERN_ML_INV.map((row) => [...row]);

    // Mouse state
    this.isDrawing = false;
    this.currentDrawValue = 1; // What value to draw (0 or 1)

    this.init();
  }

  init() {
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
      window.universe.flyToPattern(this.pattern);
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

// Initialize when page loads
window.addEventListener('load', () => {
  try {
    window.universe = new BinaryPatternUniverse();
    window.drawingCanvas = new DrawingCanvas();
    // window.universe.flyToPattern(PATTERN_DIAGONAL);
  } catch (error) {
    console.error('Failed to initialize:', error);
    document.getElementById(
      'error-log'
    ).innerHTML = `<div class="error">Failed to initialize: ${error.message}</div>`;
  }
});
