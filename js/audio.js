/* ============================================
   LearnVerseKids — Audio Engine
   Voice narration, sound effects, background music
   Uses Web Audio API + SpeechSynthesis
   ============================================ */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.musicGain = null;
    this.musicOsc = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext not available:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ---------- Speech Synthesis ----------
  speak(text, rate = 0.85, pitch = 1.2) {
    if (!this.soundEnabled) return;
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;
    utterance.lang = 'en-US';

    // Try to pick a friendly voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Samantha') ||
      v.name.includes('Karen') ||
      v.name.includes('Google') ||
      v.name.includes('Female')
    );
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  }

  speakAlphabet(letter, word) {
    this.speak(`${letter} for ${word}`, 0.8, 1.3);
  }

  speakNumber(numberWord) {
    this.speak(numberWord, 0.85, 1.2);
  }

  speakItem(name) {
    this.speak(name, 0.85, 1.2);
  }

  speakPraise() {
    const praises = [
      'Great job!',
      'Awesome!',
      'You did it!',
      'Super star!',
      'Wonderful!',
      'Amazing!',
      'Fantastic!',
      'Well done!',
      'Brilliant!',
      'Keep going!'
    ];
    const praise = praises[Math.floor(Math.random() * praises.length)];
    setTimeout(() => this.speak(praise, 0.9, 1.4), 800);
  }

  // ---------- Sound Effects (synthesized) ----------
  playSuccess() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);       // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1);  // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2);  // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  playReward() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;

    // Sparkly arpeggio
    const notes = [784, 988, 1175, 1319, 1568, 1760];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.15, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
  }

  playHover() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playMiss() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.3);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // ---------- Background Music (ambient) ----------
  startBackgroundMusic() {
    if (!this.musicEnabled || !this.ctx) return;
    if (this.musicOsc) return;
    this.resume();

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.03, this.ctx.currentTime);
    this.musicGain.connect(this.ctx.destination);

    // Simple dreamy pad using multiple detuned oscillators
    this._musicOscs = [];
    const baseFreqs = [261.63, 329.63, 392.00]; // C4, E4, G4
    baseFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.detune.setValueAtTime(Math.random() * 10 - 5, this.ctx.currentTime);
      osc.connect(this.musicGain);
      osc.start();
      this._musicOscs.push(osc);
    });

    // Slowly modulate volume for a breathing effect
    this._musicInterval = setInterval(() => {
      if (!this.musicGain) return;
      const now = this.ctx.currentTime;
      this.musicGain.gain.linearRampToValueAtTime(0.05, now + 2);
      this.musicGain.gain.linearRampToValueAtTime(0.02, now + 4);
    }, 4000);
  }

  stopBackgroundMusic() {
    if (this._musicOscs) {
      this._musicOscs.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      this._musicOscs = null;
    }
    if (this._musicInterval) {
      clearInterval(this._musicInterval);
      this._musicInterval = null;
    }
    this.musicGain = null;
    this.musicOsc = null;
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.startBackgroundMusic();
    } else {
      this.stopBackgroundMusic();
    }
  }
}
