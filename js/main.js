/* ============================================
   LearnVerseKids — Main Application (AR Mode)
   System Integrator: connects all engines.
   Finger must physically reach the balloon
   before it pops. Optimised for responsiveness.
   ============================================ */

import { MODULES, THEMES } from './config.js';
import { SceneEngine } from './scene.js';
import { HandTracker } from './handtracker.js';
import { AudioEngine } from './audio.js';
import { GameEngine } from './game.js';

class LearnVerseApp {
  constructor() {
    // Engines
    this.sceneEngine = null;
    this.handTracker = null;
    this.audioEngine = null;
    this.gameEngine = null;

    // State
    this.currentScreen = 'loading';
    this.currentTheme = 'rainbow';
    this.isRunning = false;

    // DOM refs
    this.dom = {};

    // Finger cursor position (screen space)
    this._fingerScreenPos = null;

    // Parent control long-press
    this._parentPressTimer = null;
    this._parentPressStart = 0;

    // Animation frame ID for cancellation
    this._rafId = null;

    // Throttle hand tracking processing
    this._lastHandProcess = 0;
    this._handProcessInterval = 33; // ~30fps for hand processing
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async init() {
    this._cacheDom();
    this._setupUI();

    // Step 1: Initialize audio
    this._updateLoading(10, 'Setting up audio...');
    this.audioEngine = new AudioEngine();

    // Step 2: Initialize 3D scene
    this._updateLoading(30, 'Building AR world...');
    this.sceneEngine = new SceneEngine(this.dom.canvas);
    this.sceneEngine.init();
    this.sceneEngine.setTheme(this.currentTheme);

    // Step 3: Initialize hand tracker
    this._updateLoading(60, 'Preparing hand tracking...');
    this.handTracker = new HandTracker();
    await this.handTracker.init(this.dom.video);

    // Step 4: Set up game engine
    this._updateLoading(80, 'Loading learning modules...');
    this.gameEngine = new GameEngine(this.sceneEngine, this.audioEngine);
    this._connectGameCallbacks();

    // Step 5: Ready
    this._updateLoading(100, 'Ready to learn!');

    // Load voices
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }

    // Transition to camera permission
    setTimeout(() => {
      this._showScreen('camera-permission');
    }, 800);
  }

  _cacheDom() {
    this.dom = {
      loadingScreen: document.getElementById('loading-screen'),
      loaderBar: document.getElementById('loader-bar'),
      loaderStatus: document.getElementById('loader-status'),
      cameraScreen: document.getElementById('camera-permission-screen'),
      enableCameraBtn: document.getElementById('enable-camera-btn'),
      welcomeScreen: document.getElementById('welcome-screen'),
      moduleGrid: document.getElementById('module-grid'),
      themeSelector: document.getElementById('theme-selector'),
      gameContainer: document.getElementById('game-container'),
      canvas: document.getElementById('three-canvas'),
      video: document.getElementById('camera-feed'),
      hudBack: document.getElementById('hud-back'),
      hudModuleName: document.getElementById('hud-module-name'),
      starCount: document.getElementById('star-count'),
      hudPrompt: document.getElementById('hud-prompt'),
      hudProgressBar: document.getElementById('hud-progress-bar'),
      handStatus: document.getElementById('hand-status'),
      handIndicator: document.getElementById('hud-hand-indicator'),
      rewardOverlay: document.getElementById('reward-overlay'),
      rewardContent: document.getElementById('reward-content'),
      fingerCursor: document.getElementById('finger-cursor'),
      parentTrigger: document.getElementById('parent-control-trigger'),
      parentPanel: document.getElementById('parent-panel'),
      parentCloseBtn: document.getElementById('parent-close-btn'),
      difficultySelect: document.getElementById('difficulty-select'),
      soundToggle: document.getElementById('sound-toggle'),
      musicToggle: document.getElementById('music-toggle'),
      themeSelect: document.getElementById('theme-select')
    };
  }

  _setupUI() {
    // Camera button
    this.dom.enableCameraBtn.addEventListener('click', () => this._onCameraPermission());

    // Module grid
    this._renderModules();

    // Theme selector
    this._renderThemes();

    // HUD back
    this.dom.hudBack.addEventListener('click', () => this._backToMenu());

    // Parent controls
    this.dom.parentTrigger.addEventListener('pointerdown', (e) => this._parentPressDown(e));
    this.dom.parentTrigger.addEventListener('pointerup', () => this._parentPressUp());
    this.dom.parentTrigger.addEventListener('pointerleave', () => this._parentPressUp());

    this.dom.parentCloseBtn.addEventListener('click', () => {
      this.dom.parentPanel.classList.add('hidden');
    });

    this.dom.difficultySelect.addEventListener('change', (e) => {
      this.gameEngine.setDifficulty(e.target.value);
    });

    this.dom.soundToggle.addEventListener('change', (e) => {
      this.audioEngine.setSoundEnabled(e.target.checked);
    });

    this.dom.musicToggle.addEventListener('change', (e) => {
      this.audioEngine.setMusicEnabled(e.target.checked);
    });

    this.dom.themeSelect.addEventListener('change', (e) => {
      this._setTheme(e.target.value);
    });
  }

  _renderModules() {
    this.dom.moduleGrid.innerHTML = '';
    MODULES.forEach(mod => {
      const card = document.createElement('div');
      card.className = 'module-card';
      card.style.setProperty('--card-glow', mod.color + '66');
      card.innerHTML = `
        <div class="module-icon">${mod.icon}</div>
        <div class="module-name">${mod.name}</div>
      `;
      card.addEventListener('click', () => this._startModule(mod));
      this.dom.moduleGrid.appendChild(card);
    });
  }

  _renderThemes() {
    this.dom.themeSelector.innerHTML = '';
    THEMES.forEach(theme => {
      const btn = document.createElement('button');
      btn.className = 'theme-btn' + (theme.id === this.currentTheme ? ' active' : '');
      btn.textContent = theme.icon;
      btn.title = theme.name;
      btn.addEventListener('click', () => this._setTheme(theme.id));
      this.dom.themeSelector.appendChild(btn);
    });
  }

  // ============================================
  // SCREEN MANAGEMENT
  // ============================================

  _showScreen(screen) {
    this.currentScreen = screen;

    this.dom.loadingScreen.classList.toggle('hidden', screen !== 'loading');
    this.dom.cameraScreen.classList.toggle('hidden', screen !== 'camera-permission');
    this.dom.welcomeScreen.classList.toggle('hidden', screen !== 'welcome');
    this.dom.gameContainer.classList.toggle('hidden', screen !== 'game');
  }

  _updateLoading(percent, text) {
    this.dom.loaderBar.style.width = percent + '%';
    this.dom.loaderStatus.textContent = text;
  }

  // ============================================
  // CAMERA
  // ============================================

  async _onCameraPermission() {
    this.audioEngine.init();
    this.audioEngine.resume();

    try {
      await this.handTracker.startCamera();
      this._cameraAvailable = true;

      // Set up hand tracking results handler
      this.handTracker.onResults = (data) => this._onHandData(data);
    } catch (err) {
      console.error('Camera not available, using mouse/touch fallback:', err);
      this._cameraAvailable = false;
      // Hide camera feed if no camera
      this.dom.video.style.display = 'none';
    }

    // Set up mouse/touch fallback regardless
    this._setupMouseFallback();

    this._showScreen('welcome');
    this.audioEngine.speak('Welcome to LearnVerse Kids!', 0.85, 1.2);
  }

  _setupMouseFallback() {
    this._mousePos = null;

    const updateMouse = (x, y) => {
      this._mousePos = { x, y };
      // Update finger cursor
      this.dom.fingerCursor.classList.remove('hidden');
      this.dom.fingerCursor.style.left = x + 'px';
      this.dom.fingerCursor.style.top = y + 'px';

      // If in game, simulate hand tracking — finger must reach the balloon
      if (this.isRunning) {
        const pos3D = this._screenTo3D(x, y);
        this.sceneEngine.updateFingerPosition(pos3D);

        // Check proximity for highlight
        const dist = this.sceneEngine.distanceToObject(pos3D);
        const hitRadius = this.sceneEngine.activeObject?.userData.hitRadius || 0.8;
        this.sceneEngine.highlightObject(dist < hitRadius * 1.8);
      }
    };

    // Mouse events
    document.addEventListener('mousemove', (e) => updateMouse(e.clientX, e.clientY));
    document.addEventListener('click', (e) => {
      if (!this.isRunning) return;
      if (this._mousePos) {
        const pos3D = this._screenTo3D(this._mousePos.x, this._mousePos.y);
        // Finger/mouse must actually be touching the balloon to pop it
        if (this.sceneEngine.checkCollision(pos3D)) {
          this.gameEngine.handleHit();
        }
      }
    });

    // Touch events
    document.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      updateMouse(t.clientX, t.clientY);
    }, { passive: true });

    document.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      updateMouse(t.clientX, t.clientY);
    }, { passive: true });
  }

  /**
   * Convert screen coordinates to 3D world position
   */
  _screenTo3D(x, y) {
    const nx = x / window.innerWidth;
    const ny = y / window.innerHeight;

    const fov = this.sceneEngine.camera.fov * Math.PI / 180;
    const aspect = this.sceneEngine.camera.aspect;
    const depth = 4; // match spawn depth
    const halfH = Math.tan(fov / 2) * depth;
    const halfW = halfH * aspect;

    return {
      x: ((nx * 2) - 1) * halfW,
      y: (-(ny * 2) + 1) * halfH,
      z: -depth
    };
  }

  // ============================================
  // MODULE START
  // ============================================

  _startModule(mod) {
    this._showScreen('game');
    this.dom.hudModuleName.textContent = mod.name;

    this.audioEngine.startBackgroundMusic();
    this.audioEngine.speak(`Let's learn ${mod.name}!`, 0.85, 1.3);

    this.gameEngine.startModule(mod.id);
    this.isRunning = true;

    // Start render loop
    this._animate();
  }

  _backToMenu() {
    this.isRunning = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.gameEngine.stop();
    this.audioEngine.stopBackgroundMusic();
    this.sceneEngine.clearActiveObject();
    this._showScreen('welcome');
  }

  // ============================================
  // GAME CALLBACKS
  // ============================================

  _connectGameCallbacks() {
    this.gameEngine.onStarChange = (stars) => {
      this.dom.starCount.textContent = stars;
      const el = this.dom.starCount.parentElement;
      el.classList.remove('hud-star-pop');
      void el.offsetWidth;
      el.classList.add('hud-star-pop');
    };

    this.gameEngine.onProgressChange = (current, total) => {
      const percent = (current / total) * 100;
      this.dom.hudProgressBar.style.width = percent + '%';
    };

    this.gameEngine.onPrompt = (text) => {
      this.dom.hudPrompt.textContent = text;
      this.dom.hudPrompt.classList.add('visible');
      clearTimeout(this._promptTimer);
      this._promptTimer = setTimeout(() => {
        this.dom.hudPrompt.classList.remove('visible');
      }, 4000);
    };

    this.gameEngine.onReward = (stars) => {
      this._showReward(stars);
    };

    this.gameEngine.onModuleComplete = (moduleId, stars) => {
      this._showModuleComplete(moduleId, stars);
    };
  }

  _showReward(stars) {
    this.dom.rewardOverlay.classList.remove('hidden');
    this.dom.rewardContent.innerHTML = `
      <div class="reward-stars">⭐✨⭐</div>
      <div class="reward-text">${stars} Stars!</div>
    `;

    setTimeout(() => {
      this.dom.rewardOverlay.classList.add('hidden');
    }, 2000);
  }

  _showModuleComplete(moduleId, stars) {
    this.dom.rewardOverlay.classList.remove('hidden');
    this.dom.rewardContent.innerHTML = `
      <div class="reward-stars">🎉🌟🎉</div>
      <div class="reward-text">Amazing!</div>
      <div style="font-size:24px;margin-top:12px;color:rgba(255,255,255,0.8);">
        You earned ${stars} stars!
      </div>
    `;

    setTimeout(() => {
      this.dom.rewardOverlay.classList.add('hidden');
      this._backToMenu();
    }, 4000);
  }

  // ============================================
  // HAND DATA PROCESSING
  // ============================================

  _onHandData(data) {
    // Throttle processing for performance
    const now = performance.now();
    if (now - this._lastHandProcess < this._handProcessInterval) return;
    this._lastHandProcess = now;

    // Update hand indicator
    if (data.handDetected) {
      this.dom.handStatus.textContent = 'Hand detected!';
      this.dom.handIndicator.classList.add('detected');
    } else {
      this.dom.handStatus.textContent = 'Looking for hand...';
      this.dom.handIndicator.classList.remove('detected');
    }

    // Update finger cursor on screen
    if (data.fingerTip) {
      // Mirror X for display
      const screenX = (1 - data.fingerTip.x) * window.innerWidth;
      const screenY = data.fingerTip.y * window.innerHeight;

      this.dom.fingerCursor.classList.remove('hidden');
      this.dom.fingerCursor.style.left = screenX + 'px';
      this.dom.fingerCursor.style.top = screenY + 'px';

      this._fingerScreenPos = { x: screenX, y: screenY };
    } else {
      this.dom.fingerCursor.classList.add('hidden');
      this._fingerScreenPos = null;
    }

    // 3D finger position & collision check
    // IMPORTANT: Finger must PHYSICALLY REACH the balloon - no instant pop
    if (this.isRunning && data.handDetected && data.fingerTip) {
      const pos3D = this.handTracker.fingerTo3D(
        window.innerWidth,
        window.innerHeight,
        this.sceneEngine.camera
      );

      this.sceneEngine.updateFingerPosition(pos3D);

      // Check proximity for visual highlight
      const dist = this.sceneEngine.distanceToObject(pos3D);
      const hitRadius = this.sceneEngine.activeObject?.userData.hitRadius || 0.8;

      if (dist < hitRadius * 1.8) {
        this.sceneEngine.highlightObject(true);
      } else {
        this.sceneEngine.highlightObject(false);
      }

      // ONLY pop when finger is actually touching the balloon
      if (this.sceneEngine.checkCollision(pos3D)) {
        this.gameEngine.handleHit();
      }
    } else if (this.isRunning) {
      this.sceneEngine.updateFingerPosition(null);
    }
  }

  // ============================================
  // ANIMATION LOOP
  // ============================================

  _animate() {
    if (!this.isRunning) return;

    this.sceneEngine.update();
    this._rafId = requestAnimationFrame(() => this._animate());
  }

  // ============================================
  // THEME
  // ============================================

  _setTheme(themeId) {
    this.currentTheme = themeId;
    document.body.setAttribute('data-theme', themeId);
    this.sceneEngine.setTheme(themeId);

    document.querySelectorAll('.theme-btn').forEach((btn, i) => {
      btn.classList.toggle('active', THEMES[i]?.id === themeId);
    });

    this.dom.themeSelect.value = themeId;
  }

  // ============================================
  // PARENT CONTROLS
  // ============================================

  _parentPressDown(e) {
    this._parentPressStart = Date.now();
    this._parentPressTimer = setTimeout(() => {
      this.dom.parentPanel.classList.remove('hidden');
    }, 2000);
  }

  _parentPressUp() {
    clearTimeout(this._parentPressTimer);
  }
}

// ============================================
// BOOTSTRAP
// ============================================

const app = new LearnVerseApp();
app.init().catch(err => {
  console.error('Failed to initialize LearnVerseKids:', err);
});
