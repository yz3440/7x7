class ImageGrid {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.gl = this.canvas.getContext('webgl2');

    if (!this.gl) {
      alert('WebGL2 not supported');
      return;
    }

    // State
    this.translation = [0, 0];
    this.scale = 1.0;
    this.strokeWidth = 0.1; // Thin red stroke between patterns
    this.isDragging = false;
    this.lastMousePos = [0, 0];

    // Initialize
    this.setupCanvas();
    this.setupShaders();
    this.setupBuffers();
    this.setupEventListeners();
    this.updateDisplay();

    // Start render loop
    this.render();
  }

  setupCanvas() {
    const resizeCanvas = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  setupShaders() {
    // Vertex shader - creates a fullscreen quad
    const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            out vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_position * 0.5 + 0.5;
            }
        `;

    // Fragment shader - generates 7x7 images procedurally
    const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in vec2 v_texCoord;
            out vec4 fragColor;
            
            uniform vec2 u_resolution;
            uniform vec2 u_translation;
            uniform float u_scale;
            uniform float u_strokeWidth;
            
            // Convert 2D grid coordinates to a linear binary index
            // This properly orders patterns by their binary values
            float coordsToIndex(vec2 imageCoord) {
                // We need to map 2D coordinates to a 49-bit index
                // Since we can't handle full 2^49 in float precision,
                // we'll use a subset but maintain proper binary ordering
                
                // Use row-major ordering: index = y * width + x
                // For demo, we'll use a reasonable grid size
                float gridWidth = 1000.0; // Adjust as needed
                return imageCoord.y * gridWidth + imageCoord.x;
            }
            
            // Extract a specific bit from a number
            float getBit(float number, int bitIndex) {
                // Use bit manipulation to extract the bit
                float divisor = pow(2.0, float(bitIndex));
                return mod(floor(abs(number) / divisor), 2.0);
            }
            
            // Generate a 7x7 image from a binary index
            vec3 generateImageFromIndex(float imageIndex, vec2 pixelPos) {
                // pixelPos is in range [0,1] within the image
                int x = int(floor(pixelPos.x * 7.0));
                int y = int(floor(pixelPos.y * 7.0));
                
                // Calculate bit index (0-48 for 7x7 = 49 pixels)
                // We read from left to right, top to bottom
                int bitIndex = y * 7 + x;
                
                // Get the bit value for this pixel from the binary representation
                float bit = getBit(imageIndex, bitIndex);
                
                return vec3(bit);
            }
            
            // Create a representative color for an image when zoomed out
            vec3 getImageSummary(float imageIndex) {
                // Sample key bits to create a representative pattern
                float bit0 = getBit(imageIndex, 0);   // Top-left
                float bit6 = getBit(imageIndex, 6);   // Top-right
                float bit24 = getBit(imageIndex, 24); // Center
                float bit42 = getBit(imageIndex, 42); // Bottom-left
                float bit48 = getBit(imageIndex, 48); // Bottom-right
                
                // Create a density value based on how many bits are set
                float density = (bit0 + bit6 + bit24 + bit42 + bit48) / 5.0;
                return vec3(density);
            }
            
            void main() {
                vec2 screenPos = v_texCoord * u_resolution;
                
                // Apply transformation
                vec2 worldPos = (screenPos - u_translation) / u_scale;
                
                // Each image is represented by one pixel at scale 1.0
                // At higher scales, we show the actual 7x7 pattern
                float imageSize = max(1.0, u_scale);
                
                // Calculate which image we're looking at
                vec2 imageCoord = floor(worldPos / imageSize);
                
                // Convert to linear index for proper binary ordering
                float imageIndex = coordsToIndex(imageCoord);
                
                // Calculate position within the image
                vec2 pixelInImage = mod(worldPos, imageSize) / imageSize;
                
                // Check if we're in the border/stroke area
                vec2 imageGrid = fract(worldPos / imageSize);
                float borderWidth = u_strokeWidth / imageSize;
                bool isInBorder = (imageGrid.x < borderWidth || imageGrid.y < borderWidth);
                
                vec3 color;
                
                if (isInBorder) {
                    // Red stroke between patterns
                    color = vec3(1.0, 0.0, 0.0);
                } else {
                    if (u_scale < 4.0) {
                        // At very low zoom, show a summary of each image
                        color = getImageSummary(imageIndex);
                    } else {
                        // At higher zoom, show the full 7x7 pattern
                        color = generateImageFromIndex(imageIndex, pixelInImage);
                    }
                }
                
                fragColor = vec4(color, 1.0);
            }
        `;

    // Compile shaders
    const vertexShader = this.compileShader(
      vertexShaderSource,
      this.gl.VERTEX_SHADER
    );
    const fragmentShader = this.compileShader(
      fragmentShaderSource,
      this.gl.FRAGMENT_SHADER
    );

    // Create program
    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error(
        'Program link error:',
        this.gl.getProgramInfoLog(this.program)
      );
    }

    // Get uniform locations
    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
      translation: this.gl.getUniformLocation(this.program, 'u_translation'),
      scale: this.gl.getUniformLocation(this.program, 'u_scale'),
      strokeWidth: this.gl.getUniformLocation(this.program, 'u_strokeWidth'),
    };

    // Get attribute location
    this.attributes = {
      position: this.gl.getAttribLocation(this.program, 'a_position'),
    };
  }

  compileShader(source, type) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  setupBuffers() {
    // Create fullscreen quad
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    // Create VAO
    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);
    this.gl.enableVertexAttribArray(this.attributes.position);
    this.gl.vertexAttribPointer(
      this.attributes.position,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );
  }

  setupEventListeners() {
    // Mouse events for dragging
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMousePos = [e.clientX, e.clientY];
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMousePos[0];
        const dy = e.clientY - this.lastMousePos[1];

        this.translation[0] += dx;
        this.translation[1] -= dy; // Flip Y axis

        this.lastMousePos = [e.clientX, e.clientY];
        this.updateDisplay();
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });

    // Mouse wheel for zooming
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = this.scale * zoomFactor;

      // Limit zoom range
      this.scale = Math.max(0.28, Math.min(22.2, newScale));

      this.updateDisplay();
    });

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMousePos = [e.touches[0].clientX, e.touches[0].clientY];
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - this.lastMousePos[0];
        const dy = e.touches[0].clientY - this.lastMousePos[1];

        this.translation[0] += dx;
        this.translation[1] -= dy;

        this.lastMousePos = [e.touches[0].clientX, e.touches[0].clientY];
        this.updateDisplay();
      }
    });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  updateDisplay() {
    // Update info panel
    document.getElementById('scale-display').textContent =
      this.scale.toFixed(2);
    document.getElementById('pos-x').textContent = Math.round(
      this.translation[0]
    );
    document.getElementById('pos-y').textContent = Math.round(
      this.translation[1]
    );

    // Calculate visible images (rough estimate)
    const imageSize = Math.max(1.0, this.scale);
    const visibleWidth = this.canvas.width / imageSize;
    const visibleHeight = this.canvas.height / imageSize;
    const visibleCount = Math.round(visibleWidth * visibleHeight);
    document.getElementById('visible-count').textContent =
      visibleCount.toLocaleString();

    // Calculate current world position for center of screen
    const centerX = (this.canvas.width / 2 - this.translation[0]) / this.scale;
    const centerY = (this.canvas.height / 2 - this.translation[1]) / this.scale;
    const imageCoordX = Math.floor(centerX / imageSize);
    const imageCoordY = Math.floor(centerY / imageSize);

    // Update position display to show image coordinates
    document.getElementById('pos-x').textContent = imageCoordX.toString();
    document.getElementById('pos-y').textContent = imageCoordY.toString();
  }

  render() {
    this.gl.useProgram(this.program);

    // Set uniforms
    this.gl.uniform2f(
      this.uniforms.resolution,
      this.canvas.width,
      this.canvas.height
    );
    this.gl.uniform2f(
      this.uniforms.translation,
      this.translation[0],
      this.translation[1]
    );
    this.gl.uniform1f(this.uniforms.scale, this.scale);
    this.gl.uniform1f(this.uniforms.strokeWidth, this.strokeWidth);

    // Clear and draw
    this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(() => this.render());
  }
}

// Initialize when page loads
window.addEventListener('load', () => {
  new ImageGrid();
});
