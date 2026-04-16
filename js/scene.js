/* ============================================
   LearnVerseKids — 3D Scene Engine (AR Mode)
   Three.js scene with transparent background
   for AR camera passthrough. Objects spawn at
   random positions. Optimised for performance.
   ============================================ */

import * as THREE from 'three';

export class SceneEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // Active 3D learning object
    this.activeObject = null;
    this.activeObjectData = null;

    // Finger cursor in 3D
    this.fingerSphere = null;

    // Particles
    this.particles = [];

    // Animation mixins
    this._animCallbacks = [];

    // Theme
    this._theme = 'rainbow';
  }

  init() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Scene — no background (transparent for AR camera)
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 8);

    // Renderer — transparent background so camera feed shows through
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // disabled for performance
      alpha: true
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0); // fully transparent
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lighting
    this._setupLighting();

    // Finger indicator
    this._createFingerSphere();

    // Resize handler
    this._onResizeBound = () => this._onResize();
    window.addEventListener('resize', this._onResizeBound);
  }

  _setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 10, 7);
    this.scene.add(mainLight);

    const fillA = new THREE.PointLight(0xff6b9d, 0.5, 20);
    fillA.position.set(-5, 3, 2);
    this.scene.add(fillA);

    const fillB = new THREE.PointLight(0x4dc9ff, 0.5, 20);
    fillB.position.set(5, -2, 3);
    this.scene.add(fillB);
  }

  _createFingerSphere() {
    // Invisible 3D collision point (no visible green sphere)
    // Only the yellow CSS cursor is shown to the user
    const geo = new THREE.SphereGeometry(0.1, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      visible: false
    });
    this.fingerSphere = new THREE.Mesh(geo, mat);
    this.fingerSphere.visible = false;
    this.scene.add(this.fingerSphere);
    this._fingerRing = null;
  }

  // ============================================
  // COLOR HELPERS
  // ============================================

  _parseColor(color) {
    const c = new THREE.Color(color);
    return {
      r: Math.round(c.r * 255),
      g: Math.round(c.g * 255),
      b: Math.round(c.b * 255)
    };
  }

  _colorToRGBA(color, alpha) {
    const c = this._parseColor(color);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  }

  // ============================================
  // RANDOM POSITION GENERATION
  // ============================================

  /**
   * Generate a random position across the visible screen area.
   * Uses camera FOV to calculate world-space bounds at z = -4.
   */
  _getRandomPosition() {
    const depth = 4;
    const fov = this.camera.fov * Math.PI / 180;
    const aspect = this.camera.aspect;
    const halfH = Math.tan(fov / 2) * depth;
    const halfW = halfH * aspect;

    // Keep objects within 75% of screen edges so they stay visible
    const margin = 0.75;
    const x = (Math.random() * 2 - 1) * halfW * margin;
    const y = (Math.random() * 2 - 1) * halfH * margin;

    return { x, y, z: -depth };
  }

  // ============================================
  // OBJECT CREATION — Smaller balloon-style objects
  // ============================================

  _createTextSprite(text, color, scale) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 256; // smaller canvas for performance
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const half = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Semi-transparent balloon background circle
    ctx.beginPath();
    ctx.arc(half, half, half * 0.7, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(half, half * 0.8, 0, half, half, half * 0.7);
    grad.addColorStop(0, this._colorToRGBA(color, 0.7));
    grad.addColorStop(1, this._colorToRGBA(color, 0.3));
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle shine on top-left
    ctx.beginPath();
    ctx.arc(half * 0.7, half * 0.6, half * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();

    // Main text
    const fontSize = text.length > 2 ? 60 : text.length > 1 ? 80 : 110;
    ctx.font = `900 ${fontSize}px "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, half, half);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.5 * scale, 3.5 * scale, 1);
    return sprite;
  }

  _createEmojiSprite(emoji, label, color, scale) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const half = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Semi-transparent balloon background
    ctx.beginPath();
    ctx.arc(half, half, half * 0.7, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(half, half * 0.8, 0, half, half, half * 0.7);
    grad.addColorStop(0, this._colorToRGBA(color, 0.7));
    grad.addColorStop(1, this._colorToRGBA(color, 0.3));
    ctx.fillStyle = grad;
    ctx.fill();

    // Shine
    ctx.beginPath();
    ctx.arc(half * 0.7, half * 0.6, half * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();

    // Emoji
    const emojiY = label ? half - 15 : half;
    const emojiSize = label ? 80 : 100;
    ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, half, emojiY);

    // Label text below emoji
    if (label) {
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      ctx.font = `700 28px "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, half, half + 50);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.5 * scale, 3.5 * scale, 1);
    return sprite;
  }

  /**
   * Create a 3D learning object for a letter/number
   * Spawns at a RANDOM position on screen
   */
  createTextObject(text, color, scale = 0.65) {
    this.clearActiveObject();

    const group = new THREE.Group();

    // Main text sprite (balloon style — no wireframe icosahedron)
    const textSprite = this._createTextSprite(text, color, scale);
    textSprite.renderOrder = 2;
    group.add(textSprite);

    // Spawn at random position
    const pos = this._getRandomPosition();
    group.position.set(pos.x, pos.y, pos.z);

    group.userData = { type: 'learning-object', hitRadius: 1.0 * scale };
    this.scene.add(group);
    this.activeObject = group;
    this._addFloatAnimation(group);
    return group;
  }

  /**
   * Create an emoji-based 3D learning object
   * Spawns at a RANDOM position on screen
   */
  createEmojiObject(emoji, label, color, scale = 0.65) {
    this.clearActiveObject();

    const group = new THREE.Group();

    // Main emoji sprite (balloon style)
    const emojiSprite = this._createEmojiSprite(emoji, label, color, scale);
    emojiSprite.renderOrder = 2;
    group.add(emojiSprite);

    // Spawn at random position
    const pos = this._getRandomPosition();
    group.position.set(pos.x, pos.y, pos.z);

    group.userData = { type: 'learning-object', hitRadius: 1.0 * scale };
    this.scene.add(group);
    this.activeObject = group;
    this._addFloatAnimation(group);
    return group;
  }

  // ============================================
  // EFFECTS
  // ============================================

  burstParticles(position, color, count = 20) {
    const colorObj = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.04 + Math.random() * 0.06, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: colorObj,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.copy(position);

      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3
      );
      particle.userData.life = 1.0;
      particle.userData.decay = 0.02 + Math.random() * 0.03;

      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  starBurst(position) {
    const colors = ['#ffd84d', '#ff6b9d', '#51e898', '#4dc9ff'];
    colors.forEach(c => {
      this.burstParticles(position, c, 8);
    });
  }

  highlightObject(highlight) {
    if (!this.activeObject) return;

    const target = highlight ? 1.15 : 1.0;
    const current = this.activeObject.scale.x;
    const newScale = current + (target - current) * 0.15;
    this.activeObject.scale.setScalar(newScale);
  }

  explodeObject(callback) {
    if (!this.activeObject) {
      if (callback) callback();
      return;
    }

    const obj = this.activeObject;
    const pos = obj.position.clone();

    // Burst particles
    this.starBurst(pos);

    // Shrink and remove
    let scale = obj.scale.x;
    const shrink = () => {
      scale -= 0.08;
      if (scale <= 0) {
        this.scene.remove(obj);
        this._removeFloatAnimation(obj);
        if (this.activeObject === obj) this.activeObject = null;
        if (callback) callback();
        return;
      }
      obj.scale.setScalar(scale);
      requestAnimationFrame(shrink);
    };
    shrink();
  }

  clearActiveObject() {
    if (this.activeObject) {
      this._removeFloatAnimation(this.activeObject);
      this.scene.remove(this.activeObject);
      this.activeObject = null;
    }
  }

  // ============================================
  // ANIMATION SYSTEM
  // ============================================

  _addFloatAnimation(obj) {
    const startY = obj.position.y;
    const speed = 0.5 + Math.random() * 0.4;
    const amplitude = 0.15 + Math.random() * 0.1;
    const phase = Math.random() * Math.PI * 2;

    const cb = (time) => {
      // Gentle floating motion
      obj.position.y = startY + Math.sin(time * speed + phase) * amplitude;
    };

    obj.userData._floatCb = cb;
    this._animCallbacks.push(cb);
  }

  _removeFloatAnimation(obj) {
    if (obj.userData._floatCb) {
      const idx = this._animCallbacks.indexOf(obj.userData._floatCb);
      if (idx >= 0) this._animCallbacks.splice(idx, 1);
    }
  }

  // ============================================
  // UPDATE
  // ============================================

  updateFingerPosition(pos3D) {
    if (!pos3D) {
      return;
    }
    // Update invisible collision point position
    this.fingerSphere.position.set(pos3D.x, pos3D.y, pos3D.z);
  }

  checkCollision(fingerPos3D) {
    if (!this.activeObject || !fingerPos3D) return false;

    const objPos = this.activeObject.position;
    const hitRadius = this.activeObject.userData.hitRadius || 0.8;

    const dx = fingerPos3D.x - objPos.x;
    const dy = fingerPos3D.y - objPos.y;
    const dz = fingerPos3D.z - objPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return dist < hitRadius;
  }

  distanceToObject(fingerPos3D) {
    if (!this.activeObject || !fingerPos3D) return Infinity;
    const objPos = this.activeObject.position;
    const dx = fingerPos3D.x - objPos.x;
    const dy = fingerPos3D.y - objPos.y;
    const dz = fingerPos3D.z - objPos.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  update() {
    const time = this.clock.getElapsedTime();

    // Run animation callbacks
    for (let i = 0; i < this._animCallbacks.length; i++) {
      this._animCallbacks[i](time);
    }

    // Update particles (explosions)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.position.add(p.userData.velocity);
      p.userData.velocity.y -= 0.003;
      p.userData.life -= p.userData.decay;
      p.material.opacity = Math.max(0, p.userData.life);
      p.scale.setScalar(p.userData.life);

      if (p.userData.life <= 0) {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  setTheme(theme) {
    this._theme = theme;
    // No background color in AR mode — camera feed is the background
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
