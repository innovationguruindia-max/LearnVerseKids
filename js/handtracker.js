/* ============================================
   LearnVerseKids — Hand Tracking Engine
   MediaPipe Hands integration for real-time
   gesture detection and finger tracking.
   Optimised for performance with throttled
   processing and lighter model.
   ============================================ */

export class HandTracker {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.videoElement = null;
    this.onResults = null;
    this.isRunning = false;

    // Tracking state
    this.fingerTip = null;       // {x, y} normalized 0-1
    this.handCenter = null;      // {x, y} normalized 0-1
    this.handDetected = false;
    this.isPinching = false;

    // Smoothing — faster response
    this._smoothFinger = { x: 0.5, y: 0.5 };
    this._smoothCenter = { x: 0.5, y: 0.5 };
    this._smoothFactor = 0.5; // higher = more responsive
  }

  async init(videoElement) {
    this.videoElement = videoElement;

    try {
      if (!window.Hands) {
        console.warn('MediaPipe Hands not loaded yet, waiting...');
        await new Promise((resolve, reject) => {
          let waited = 0;
          const check = setInterval(() => {
            if (window.Hands) { clearInterval(check); resolve(); }
            waited += 200;
            if (waited > 5000) { clearInterval(check); reject(new Error('MediaPipe Hands timeout')); }
          }, 200);
        });
      }

      this.hands = new window.Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
        }
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, // lightest model for speed
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.4
      });

      this.hands.onResults((results) => this._processResults(results));
    } catch (err) {
      console.warn('MediaPipe Hands init failed, hand tracking disabled:', err);
      this.hands = null;
    }
  }

  async startCamera() {
    if (this.isRunning) return;

    // This triggers the browser camera permission dialog
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });

    this.videoElement.srcObject = stream;

    // Only set up MediaPipe camera loop if Hands is available
    if (this.hands && window.Camera) {
      this.camera = new window.Camera(this.videoElement, {
        onFrame: async () => {
          if (this.hands) {
            try {
              await this.hands.send({ image: this.videoElement });
            } catch (e) {
              // Ignore frame processing errors
            }
          }
        },
        width: 640,
        height: 480
      });

      await this.camera.start();
    } else {
      // Camera is available but MediaPipe isn't — just show the feed
      await this.videoElement.play();
    }

    this.isRunning = true;
  }

  _processResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      this.handDetected = true;

      // Index finger tip (landmark 8)
      const indexTip = landmarks[8];
      // Thumb tip (landmark 4)
      const thumbTip = landmarks[4];
      // Middle finger base (landmark 9) -> hand center approx
      const palmCenter = landmarks[9];

      // Smooth the finger position
      this._smoothFinger.x += (indexTip.x - this._smoothFinger.x) * this._smoothFactor;
      this._smoothFinger.y += (indexTip.y - this._smoothFinger.y) * this._smoothFactor;

      this.fingerTip = {
        x: this._smoothFinger.x,
        y: this._smoothFinger.y,
        z: indexTip.z
      };

      this._smoothCenter.x += (palmCenter.x - this._smoothCenter.x) * this._smoothFactor;
      this._smoothCenter.y += (palmCenter.y - this._smoothCenter.y) * this._smoothFactor;

      this.handCenter = {
        x: this._smoothCenter.x,
        y: this._smoothCenter.y
      };

      // Pinch detection
      const dx = thumbTip.x - indexTip.x;
      const dy = thumbTip.y - indexTip.y;
      const pinchDist = Math.sqrt(dx * dx + dy * dy);
      this.isPinching = pinchDist < 0.06;

    } else {
      this.handDetected = false;
      this.fingerTip = null;
      this.handCenter = null;
      this.isPinching = false;
    }

    if (this.onResults) {
      this.onResults({
        handDetected: this.handDetected,
        fingerTip: this.fingerTip,
        handCenter: this.handCenter,
        isPinching: this.isPinching
      });
    }
  }

  /**
   * Convert normalized hand coordinates to 3D world position
   * Uses depth = 4 to match the spawn depth of objects
   */
  fingerTo3D(width, height, camera3D) {
    if (!this.fingerTip) return null;

    // Mirror x (camera is mirrored)
    const nx = 1 - this.fingerTip.x;
    const ny = this.fingerTip.y;

    // Map to NDC (-1 to 1)
    const ndcX = (nx * 2) - 1;
    const ndcY = -(ny * 2) + 1;

    // Match spawn depth
    const depth = 4;

    const fov = camera3D.fov * Math.PI / 180;
    const aspect = camera3D.aspect;
    const halfH = Math.tan(fov / 2) * depth;
    const halfW = halfH * aspect;

    return {
      x: ndcX * halfW,
      y: ndcY * halfH,
      z: -depth
    };
  }

  stop() {
    if (this.camera) {
      this.camera.stop();
    }
    this.isRunning = false;
  }
}
