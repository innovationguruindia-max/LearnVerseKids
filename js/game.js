/* ============================================
   LearnVerseKids — Game Logic Engine
   Manages learning loops, spawning, progression,
   scoring, and reward systems.
   Optimised with shorter cooldowns for
   responsive interaction.
   ============================================ */

import {
  ALPHABET_DATA, ANIMAL_DATA, FRUIT_DATA,
  VEGETABLE_DATA, OBJECT_DATA, NUMBER_WORDS,
  DIFFICULTY
} from './config.js';

export class GameEngine {
  constructor(sceneEngine, audioEngine) {
    this.scene = sceneEngine;
    this.audio = audioEngine;

    // State
    this.currentModule = null;
    this.currentData = [];
    this.currentIndex = 0;
    this.stars = 0;
    this.totalItems = 0;
    this.isActive = false;
    this.isTransitioning = false;
    this.difficulty = 'normal';

    // Collision cooldown — reduced for responsiveness
    this._lastHitTime = 0;
    this._hitCooldown = 800; // ms

    // Callbacks
    this.onStarChange = null;
    this.onProgressChange = null;
    this.onPrompt = null;
    this.onReward = null;
    this.onModuleComplete = null;
  }

  // ============================================
  // MODULE SETUP
  // ============================================

  startModule(moduleId) {
    this.currentModule = moduleId;
    this.currentIndex = 0;
    this.stars = 0;
    this.isActive = true;
    this.isTransitioning = false;

    switch (moduleId) {
      case 'alphabets':
        this.currentData = [...ALPHABET_DATA];
        break;
      case 'numbers':
        this.currentData = this._generateNumbers();
        break;
      case 'animals':
        this.currentData = [...ANIMAL_DATA];
        break;
      case 'fruits':
        this.currentData = [...FRUIT_DATA];
        break;
      case 'vegetables':
        this.currentData = [...VEGETABLE_DATA];
        break;
      case 'objects':
        this.currentData = [...OBJECT_DATA];
        break;
      default:
        this.currentData = [...ALPHABET_DATA];
    }

    this.totalItems = this.currentData.length;

    if (this.onStarChange) this.onStarChange(this.stars);
    if (this.onProgressChange) this.onProgressChange(0, this.totalItems);

    this.spawnNext();
  }

  _generateNumbers() {
    const nums = [];
    // Show numbers 1-20 initially, then every 5th up to 100 for manageability
    for (let i = 1; i <= 20; i++) {
      nums.push({
        number: i,
        text: i.toString(),
        word: NUMBER_WORDS[i],
        color: this._numberColor(i)
      });
    }
    for (let i = 25; i <= 100; i += 5) {
      nums.push({
        number: i,
        text: i.toString(),
        word: NUMBER_WORDS[i],
        color: this._numberColor(i)
      });
    }
    return nums;
  }

  _numberColor(n) {
    const hue = (n * 15) % 360;
    return `hsl(${hue}, 80%, 55%)`;
  }

  // ============================================
  // SPAWNING
  // ============================================

  spawnNext() {
    if (!this.isActive || this.currentIndex >= this.currentData.length) {
      this._completeModule();
      return;
    }

    this.isTransitioning = false;
    const item = this.currentData[this.currentIndex];
    const settings = DIFFICULTY[this.difficulty];

    setTimeout(() => {
      switch (this.currentModule) {
        case 'alphabets':
          this._spawnAlphabet(item, settings);
          break;
        case 'numbers':
          this._spawnNumber(item, settings);
          break;
        case 'animals':
          this._spawnAnimal(item, settings);
          break;
        case 'fruits':
        case 'vegetables':
        case 'objects':
          this._spawnGeneric(item, settings);
          break;
      }
    }, settings.spawnDelay);
  }

  _spawnAlphabet(item, settings) {
    this.scene.createTextObject(item.letter, item.color, settings.objectScale);
    if (this.onPrompt) {
      this.onPrompt(`Touch the letter ${item.letter}!`);
    }
  }

  _spawnNumber(item, settings) {
    this.scene.createTextObject(item.text, item.color, settings.objectScale);
    if (this.onPrompt) {
      this.onPrompt(`Touch number ${item.text}!`);
    }
  }

  _spawnAnimal(item, settings) {
    this.scene.createEmojiObject(item.emoji, item.name, item.color, settings.objectScale);
    if (this.onPrompt) {
      this.onPrompt(`Find the ${item.name}!`);
    }
  }

  _spawnGeneric(item, settings) {
    this.scene.createEmojiObject(item.emoji, item.name, item.color, settings.objectScale);
    if (this.onPrompt) {
      this.onPrompt(`Touch the ${item.name}!`);
    }
  }

  // ============================================
  // HIT / INTERACTION
  // ============================================

  handleHit() {
    const now = Date.now();
    if (now - this._lastHitTime < this._hitCooldown) return;
    if (this.isTransitioning) return;
    if (!this.isActive) return;

    this._lastHitTime = now;
    this.isTransitioning = true;

    const item = this.currentData[this.currentIndex];

    // Play success
    this.audio.playSuccess();

    // Specific audio feedback
    switch (this.currentModule) {
      case 'alphabets':
        this.audio.speakAlphabet(item.letter, item.word);
        break;
      case 'numbers':
        this.audio.speakNumber(item.word);
        break;
      case 'animals':
        this.audio.speakItem(item.name);
        break;
      default:
        this.audio.speakItem(item.name);
    }

    // Explode object
    this.scene.explodeObject(() => {
      // For alphabets, show the associated word/object
      if (this.currentModule === 'alphabets') {
        this._showAlphabetAssociation(item);
      } else {
        this._advanceToNext();
      }
    });

    // Add star
    this.stars++;
    if (this.onStarChange) this.onStarChange(this.stars);

    // Show reward if milestone
    if (this.stars % 5 === 0) {
      this.audio.playReward();
      this.audio.speakPraise();
      if (this.onReward) this.onReward(this.stars);
    }
  }

  _showAlphabetAssociation(item) {
    const settings = DIFFICULTY[this.difficulty];
    this.scene.createEmojiObject(item.emoji, item.word, item.color, settings.objectScale);

    if (this.onPrompt) {
      this.onPrompt(`${item.letter} for ${item.word}! ${item.emoji}`);
    }

    // Auto-advance after delay
    setTimeout(() => {
      this.scene.explodeObject(() => {
        this._advanceToNext();
      });
    }, settings.promptDuration);
  }

  _advanceToNext() {
    this.currentIndex++;
    if (this.onProgressChange) {
      this.onProgressChange(this.currentIndex, this.totalItems);
    }
    this.spawnNext();
  }

  _completeModule() {
    this.isActive = false;
    this.audio.playReward();
    this.audio.speak('You finished! Amazing job!', 0.85, 1.3);
    if (this.onModuleComplete) {
      this.onModuleComplete(this.currentModule, this.stars);
    }
  }

  // ============================================
  // MISS HANDLING
  // ============================================

  handleMiss() {
    this.scene.highlightObject(true);
    this.audio.playMiss();
  }

  // ============================================
  // SETTINGS
  // ============================================

  setDifficulty(level) {
    this.difficulty = level;
  }

  stop() {
    this.isActive = false;
    this.scene.clearActiveObject();
  }
}
