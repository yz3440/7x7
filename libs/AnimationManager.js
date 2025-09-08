const MIDDLE_SCALE = 5.0;

// Animation Manager Class for smooth transitions
class AnimationManager {
  constructor() {
    this.isAnimating = false;
    this.startTime = 0;
    this.duration = 2000; // 2 seconds default
    this.startPosition = { x: 0, y: 0 };
    this.endPosition = { x: 0, y: 0 };
    this.startScale = 1.0;
    this.endScale = 1.0;
    this.onUpdate = null;
    this.onComplete = null;
  }

  // Ease-in-out cubic function
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  easeInOutQuint(t) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  }

  // Two-phase scale animation: zoom to middle scale, then zoom to target
  getTwoPhaseScale(progress, startScale, endScale, middleScale = MIDDLE_SCALE) {
    if (progress <= 0.5) {
      // First half: zoom to middle scale
      const phase1Progress = progress * 2; // 0 to 1
      const easedProgress = this.easeInOutCubic(phase1Progress);
      return startScale + (middleScale - startScale) * easedProgress;
    } else {
      // Second half: zoom from middle scale to target
      const phase2Progress = (progress - 0.5) * 2; // 0 to 1
      const easedProgress = this.easeInOutCubic(phase2Progress);
      return middleScale + (endScale - middleScale) * easedProgress;
    }
  }

  // Start a new animation
  start(startPos, endPos, startScale, endScale, duration = 2000) {
    this.isAnimating = true;
    this.startTime = performance.now();
    this.duration = duration;
    this.startPosition = { x: startPos.x, y: startPos.y };
    this.endPosition = { x: endPos.x, y: endPos.y };
    this.startScale = startScale;
    this.endScale = endScale;
  }

  // Update animation and return current values
  update() {
    if (!this.isAnimating) {
      return null;
    }

    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1.0);

    // Apply ease-in-out easing
    const easedProgress = this.easeInOutCubic(progress);

    // Interpolate position
    const currentPosition = {
      x:
        this.startPosition.x +
        (this.endPosition.x - this.startPosition.x) * easedProgress,
      y:
        this.startPosition.y +
        (this.endPosition.y - this.startPosition.y) * easedProgress,
    };

    // Two-phase scale interpolation: zoom out to 1, then zoom in to target
    const currentScale = this.getTwoPhaseScale(
      progress,
      this.startScale,
      this.endScale
    );

    // Check if animation is complete
    if (progress >= 1.0) {
      this.isAnimating = false;
      if (this.onComplete) {
        this.onComplete();
      }
    }

    // Call update callback
    if (this.onUpdate) {
      this.onUpdate(currentPosition, currentScale);
    }

    return {
      position: currentPosition,
      scale: currentScale,
      progress: progress,
      isComplete: progress >= 1.0,
    };
  }

  // Stop animation
  stop() {
    this.isAnimating = false;
  }

  // Check if currently animating
  isRunning() {
    return this.isAnimating;
  }
}
