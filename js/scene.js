/* ============================================
   LearnVerseKids — 3D Scene Engine
   Three.js scene setup, object creation,
   particle effects, and animations
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
    this.bgParticles = null;

    // Animation mixins
    this._animCallbacks = [];

    // Theme
    this._theme = 'rainbow';
  }

  init() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 8);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lighting
    this._setupLighting();

    // Background particles
    this._createBackgroundParticles();

    // Finger indicator
    this._createFingerSphere();

    // Resize handler
    window.addEventListener('resize', () => this._onResize());
  }

  _setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 7);
    this.scene.add(mainLight);

    const fillA = new THREE.PointLight(0xff6b9d, 0.6, 25);
    fillA.position.set(-5, 3, 2);
    this.scene.add(fillA);

    const fillB = new THREE.PointLight(0x4dc9ff, 0.6, 25);
    fillB.position.set(5, -2, 3);
    this.scene.add(fillB);

    const fillC = new THREE.PointLight(0x51e898, 0.4, 25);
    fillC.position.set(0, 5, -2);
    this.scene.add(fillC);
  }

  _createBackgroundParticles() {
    const count = 250;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color('#ff6b9d'),
      new THREE.Color('#c44dff'),
      new THREE.Color('#4dc9ff'),
      new THREE.Color('#51e898'),
      new THREE.Color('#ffd84d'),
      new THREE.Color('#ff884d')
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 35;
      positions[i3 + 1] = (Math.random() - 0.5) * 25;
      positions[i3 + 2] = (Math.random() - 0.5) * 25 - 5;

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.bgParticles = new THREE.Points(geometry, material);
    this.scene.add(this.bgParticles);
  }

  _createFingerSphere() {
    const geo = new THREE.SphereGeometry(0.2, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd84d,
      emissive: 0xffd84d,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7
    });
    this.fingerSphere = new THREE.Mesh(geo, mat);
    this.fingerSphere.visible = false;
    this.scene.add(this.fingerSphere);

    // Glow ring around finger
    const ringGeo = new THREE.RingGeometry(0.25, 0.35, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4dc9ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this._fingerRing = new THREE.Mesh(ringGeo, ringMat);
    this.fingerSphere.add(this._fingerRing);
  }

  // ============================================
  // COLOR HELPERS
  // ============================================

  /**
   * Convert any CSS color to an {r,g,b} object (0-255)
   */
  _parseColor(color) {
    const c = new THREE.Color(color);
    return {
      r: Math.round(c.r * 255),
      g: Math.round(c.g * 255),
      b: Math.round(c.b * 255)
    };
  }

  _lightenColor(color, amount) {
    const c = this._parseColor(color);
    const r = Math.min(255, c.r + amount);
    const g = Math.min(255, c.g + amount);
    const b = Math.min(255, c.b + amount);
    return `rgb(${r},${g},${b})`;
  }

  _colorToRGBA(color, alpha) {
    const c = this._parseColor(color);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  }

  // ============================================
  // OBJECT CREATION
  // ============================================

  /**
   * Create the main text/letter sprite from a canvas
   */
  _createTextSprite(text, color, scale) {
    // Use high-DPI canvas for crisp rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const half = size / 2;

    // Fully transparent canvas
    ctx.clearRect(0, 0, size, size);

    // Colored glow behind text (subtle, tight)
    ctx.shadowColor = color;
    ctx.shadowBlur = 50;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw circle to create glow
    ctx.beginPath();
    ctx.arc(half, half, 70, 0, Math.PI * 2);
    ctx.fillStyle = this._colorToRGBA(color, 0.25);
    ctx.fill();

    // Reset shadow for text
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // Main text - big bold white
    const fontSize = text.length > 2 ? 120 : text.length > 1 ? 160 : 240;
    ctx.font = `900 ${fontSize}px "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, half, half);

    // Colored outline
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.strokeText(text, half, half);
    ctx.globalAlpha = 1.0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.premultiplyAlpha = false;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(4 * scale, 4 * scale, 1);
    return sprite;
  }

  /**
   * Create an emoji sprite from a canvas
   */
  _createEmojiSprite(emoji, label, color, scale) {
    // Use high-DPI canvas for crisp rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const half = size / 2;

    // Fully transparent canvas
    ctx.clearRect(0, 0, size, size);

    // Colored glow behind emoji
    ctx.shadowColor = color;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Subtle glow circle
    ctx.beginPath();
    ctx.arc(half, half, 60, 0, Math.PI * 2);
    ctx.fillStyle = this._colorToRGBA(color, 0.2);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Emoji — draw large to fill center
    const emojiY = label ? half - 25 : half;
    const emojiSize = label ? 180 : 220;
    ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, half, emojiY);

    // Label text below emoji
    if (label) {
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.font = `700 52px "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, half, half + 110);

      // Colored text outline
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.strokeText(label, half, half + 110);
      ctx.globalAlpha = 1.0;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.premultiplyAlpha = false;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(4 * scale, 4 * scale, 1);
    return sprite;
  }

  /**
   * Create a 3D learning object for a letter/number
   */
  createTextObject(text, color, scale = 1.2) {
    this.clearActiveObject();

    const group = new THREE.Group();

    // Background 3D shape (icosahedron wireframe behind the sprite)
    const bgGeo = new THREE.IcosahedronGeometry(1.6 * scale, 1);
    const bgMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.3,
      roughness: 0.4,
      metalness: 0.3,
      wireframe: true,
      depthTest: true
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.renderOrder = 0;
    group.add(bgMesh);

    // Main text sprite (always faces camera, transparent background)
    const textSprite = this._createTextSprite(text, color, scale);
    textSprite.renderOrder = 2;
    group.add(textSprite);

    // Orbiting decorative spheres
    this._addOrbitingSpheres(group, color, scale, 4);

    // Position in view
    group.position.set(
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 2,
      -4
    );

    group.userData = { type: 'learning-object', hitRadius: 2.0 * scale };
    this.scene.add(group);
    this.activeObject = group;
    this._addFloatAnimation(group);
    return group;
  }

  /**
   * Create an emoji-based 3D learning object
   */
  createEmojiObject(emoji, label, color, scale = 1.2) {
    this.clearActiveObject();

    const group = new THREE.Group();

    // Background 3D shape
    const bgGeo = new THREE.IcosahedronGeometry(1.6 * scale, 1);
    const bgMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.25,
      roughness: 0.4,
      metalness: 0.3,
      wireframe: true,
      depthTest: true
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.renderOrder = 0;
    group.add(bgMesh);

    // Main emoji sprite
    const emojiSprite = this._createEmojiSprite(emoji, label, color, scale);
    emojiSprite.renderOrder = 2;
    group.add(emojiSprite);

    // Orbiting decorative spheres
    this._addOrbitingSpheres(group, color, scale, 3);

    group.position.set(
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 2,
      -4
    );

    group.userData = { type: 'learning-object', hitRadius: 2.0 * scale };
    this.scene.add(group);
    this.activeObject = group;
    this._addFloatAnimation(group);
    return group;
  }

  _addOrbitingSpheres(group, color, scale, count) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const orbGeo = new THREE.SphereGeometry(0.1 * scale, 12, 12);
      const orbMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.9
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(
        Math.cos(angle) * 1.8 * scale,
        Math.sin(angle) * 1.8 * scale,
        0
      );
      orb.userData._orbitAngleOffset = angle;
      group.add(orb);
    }
  }

  // ============================================
  // EFFECTS
  // ============================================

  burstParticles(position, color, count = 40) {
    const colorObj = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.06 + Math.random() * 0.08, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: colorObj,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.copy(position);

      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.35,
        (Math.random() - 0.5) * 0.35,
        (Math.random() - 0.5) * 0.35
      );
      particle.userData.life = 1.0;
      particle.userData.decay = 0.012 + Math.random() * 0.02;

      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  starBurst(position) {
    const colors = ['#ffd84d', '#ff6b9d', '#51e898', '#4dc9ff', '#c44dff', '#ff884d'];
    colors.forEach(c => {
      this.burstParticles(position, c, 12);
    });
  }

  highlightObject(highlight) {
    if (!this.activeObject) return;

    const target = highlight ? 1.2 : 1.0;
    const current = this.activeObject.scale.x;
    const newScale = current + (target - current) * 0.12;
    this.activeObject.scale.setScalar(newScale);

    // Increase glow on bg wireframe mesh (first child)
    const children = this.activeObject.children;
    if (children[0] && children[0].material) {
      children[0].material.emissiveIntensity = highlight ? 0.7 : 0.4;
      children[0].material.opacity = highlight ? 0.5 : 0.3;
    }
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
      scale -= 0.06;
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
    const amplitude = 0.25 + Math.random() * 0.2;
    const rotSpeed = 0.3 + Math.random() * 0.3;
    const phase = Math.random() * Math.PI * 2;

    const cb = (time) => {
      // Gentle floating motion
      obj.position.y = startY + Math.sin(time * speed + phase) * amplitude;

      // Rotate the wireframe icosahedron (first child)
      const bgMesh = obj.children[0];
      if (bgMesh && bgMesh.isMesh) {
        bgMesh.rotation.y += rotSpeed * 0.016;
        bgMesh.rotation.x += rotSpeed * 0.008;
        bgMesh.rotation.z = Math.sin(time * 0.4 + phase) * 0.15;
      }

      // Orbit the small spheres
      obj.children.forEach(child => {
        if (child.userData._orbitAngleOffset !== undefined) {
          const angle = child.userData._orbitAngleOffset + time * 0.7;
          const r = 1.8 * (obj.userData.hitRadius ? obj.userData.hitRadius / 2 : 1);
          child.position.x = Math.cos(angle) * r;
          child.position.y = Math.sin(angle) * r;
          child.position.z = Math.sin(angle * 0.5) * 0.4;
        }
      });
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
      this.fingerSphere.visible = false;
      return;
    }
    this.fingerSphere.visible = true;
    this.fingerSphere.position.set(pos3D.x, pos3D.y, pos3D.z);

    if (this._fingerRing) {
      this._fingerRing.rotation.z += 0.03;
    }
  }

  checkCollision(fingerPos3D) {
    if (!this.activeObject || !fingerPos3D) return false;

    const objPos = this.activeObject.position;
    const hitRadius = this.activeObject.userData.hitRadius || 1.5;

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
    for (const cb of this._animCallbacks) {
      cb(time);
    }

    // Animate background particles
    if (this.bgParticles) {
      this.bgParticles.rotation.y = time * 0.02;
      this.bgParticles.rotation.x = Math.sin(time * 0.01) * 0.1;
    }

    // Update particles (explosions)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.position.add(p.userData.velocity);
      p.userData.velocity.y -= 0.002;
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
    const themes = {
      rainbow: { bg: 0x0a0a2e },
      space: { bg: 0x05051a },
      ocean: { bg: 0x021b36 },
      forest: { bg: 0x0a1f0a }
    };
    const t = themes[theme] || themes.rainbow;
    this.scene.background = new THREE.Color(t.bg);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
