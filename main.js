window.addEventListener('load', () => {
  try {
    window.universe = new BinaryPatternUniverse();
    window.drawingCanvas = new DrawingCanvas();
  } catch (error) {
    console.error('Failed to initialize:', error);
    document.getElementById(
      'error-log'
    ).innerHTML = `<div class="error">Failed to initialize: ${error.message}</div>`;
  }
});
