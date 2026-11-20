const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function readMuted() {
  try {
    return localStorage.getItem('dis-soest-muted') === '1';
  } catch {
    return false;
  }
}

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.engineBus = null;
    this.muted = readMuted();
    this.started = false;
    this.chordIndex = 0;
    this.musicTimer = null;
    this.engineOscA = null;
    this.engineOscB = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.windGain = null;
    this.delay = null;
    this.lastSfx = new Map();
  }

  async start() {
    if (this.started) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
      this.started = true;
      const master = this.ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.72;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(this.ctx.destination);
      this.master = master;

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.17;
      this.musicBus.connect(master);

      this.delay = this.ctx.createDelay(1);
      this.delay.delayTime.value = 0.38;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.28;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.24;
      this.delay.connect(feedback);
      feedback.connect(this.delay);
      this.delay.connect(wet);
      wet.connect(this.musicBus);

      this.engineBus = this.ctx.createGain();
      this.engineBus.gain.value = 0.16;
      this.engineBus.connect(master);

      this.buildEngine();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.startMusic();
    } catch (error) {
      console.warn('Audio unavailable', error);
    }
  }

  buildEngine() {
    if (!this.ctx) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 360;
    filter.Q.value = 2.2;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    filter.connect(gain);
    gain.connect(this.engineBus);

    const oscA = this.ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 52;
    const oscB = this.ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 78;
    oscA.connect(filter);
    oscB.connect(filter);
    oscA.start();
    oscB.start();

    this.engineOscA = oscA;
    this.engineOscB = oscB;
    this.engineGain = gain;
    this.engineFilter = filter;

    // wind / tyre noise
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 620;
    windFilter.Q.value = 0.4;
    const windGain = this.ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.engineBus);
    noise.start();
    this.windGain = windGain;
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const tick = () => this.playChord();
    tick();
    this.musicTimer = setInterval(tick, 4300);
  }

  playChord() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const chords = [
      [48, 55, 59, 64, 67],
      [45, 52, 55, 60, 64],
      [41, 48, 52, 57, 60],
      [43, 50, 53, 59, 62],
    ];
    const chord = chords[this.chordIndex++ % chords.length];
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(950, now);
    padFilter.frequency.linearRampToValueAtTime(1800, now + 3.6);
    padFilter.Q.value = 0.3;
    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0, now);
    padGain.gain.linearRampToValueAtTime(0.036, now + 0.7);
    padGain.gain.linearRampToValueAtTime(0.028, now + 2.8);
    padGain.gain.linearRampToValueAtTime(0, now + 4.3);
    padFilter.connect(padGain);
    padGain.connect(this.musicBus);

    chord.forEach((note, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = midi(note);
      osc.detune.value = (i % 2 === 0 ? -4 : 4) + Math.random() * 2;
      const voice = this.ctx.createGain();
      voice.gain.value = i === 0 ? 0.5 : 0.22;
      osc.connect(voice);
      voice.connect(padFilter);
      osc.start(now + i * 0.02);
      osc.stop(now + 4.4);
    });

    const bass = this.ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = midi(chord[0] - 12);
    const bassGain = this.ctx.createGain();
    bassGain.gain.setValueAtTime(0, now);
    bassGain.gain.linearRampToValueAtTime(0.07, now + 0.4);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 3.9);
    bass.connect(bassGain);
    bassGain.connect(this.musicBus);
    bass.start(now);
    bass.stop(now + 4.1);

    const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79];
    const melodyCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < melodyCount; i++) {
      if (Math.random() < 0.27) continue;
      const note = scale[Math.floor(Math.random() * scale.length)];
      const at = now + 0.4 + i * 0.62 + Math.random() * 0.2;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midi(note);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.026, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.8);
      osc.connect(gain);
      gain.connect(this.musicBus);
      gain.connect(this.delay);
      osc.start(at);
      osc.stop(at + 0.9);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem('dis-soest-muted', muted ? '1' : '0'); } catch {}
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.72, this.ctx.currentTime + 0.2);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  updateEngine(speedKmh, throttle, offroad) {
    if (!this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;
    const ratio = Math.min(1, speedKmh / 110);
    const idle = 0.018;
    const targetGain = idle + ratio * 0.05 + throttle * 0.025 + (offroad ? 0.012 : 0);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.12);
    const freq = 46 + speedKmh * 1.55 + throttle * 10;
    this.engineOscA.frequency.setTargetAtTime(freq, now, 0.08);
    this.engineOscB.frequency.setTargetAtTime(freq * 1.51, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(330 + ratio * 900 + throttle * 260, now, 0.1);
    if (this.windGain) this.windGain.gain.setTargetAtTime(ratio * ratio * 0.05 + (offroad ? 0.02 : 0), now, 0.25);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const last = this.lastSfx.get(name) || 0;
    if (now - last < 0.05) return;
    this.lastSfx.set(name, now);
    const out = this.ctx.createGain();
    out.gain.value = 0.12;
    out.connect(this.master);

    if (name === 'click') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.06);
      out.gain.setValueAtTime(0.05, now);
      out.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(out);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (name === 'pickup') {
      [659.25, 987.77].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, now + i * 0.11);
        g.gain.linearRampToValueAtTime(0.11, now + i * 0.11 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.75);
        osc.connect(g);
        g.connect(this.master);
        osc.start(now + i * 0.11);
        osc.stop(now + i * 0.11 + 0.8);
      });
    } else if (name === 'complete') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = this.ctx.createGain();
        const at = now + i * 0.09;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.09, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, at + 1.3);
        osc.connect(g);
        g.connect(this.master);
        g.connect(this.delay);
        osc.start(at);
        osc.stop(at + 1.35);
      });
    } else if (name === 'horn') {
      [311.13, 415.3].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.02, now);
        g.gain.setValueAtTime(0.035, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        osc.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.4);
      });
    } else if (name === 'bump') {
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.18, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 380;
      const g = this.ctx.createGain();
      g.gain.value = 0.18;
      noise.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      noise.start(now);
    } else if (name === 'arrive') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.06, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.5);
    }
    setTimeout(() => {
      try { out.disconnect(); } catch {}
    }, 2200);
  }
}
