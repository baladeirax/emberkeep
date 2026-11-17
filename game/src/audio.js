// All sound is synthesised with WebAudio — no audio files, no network.
// Short oscillator blips for effects, and a quiet sequenced loop for music:
// a low bass line and a sparse plucked arpeggio, both driven by a step clock
// the main loop ticks. Audio only starts after a user gesture (the browser
// requires it); screenshot scenes never unlock it, so they stay silent.
export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let musicStep = 0;
  let nextNoteAt = 0;
  let unlocked = false;

  function ensure() {
    if (context) return context;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(master);
    return context;
  }

  function unlock() {
    if (unlocked) return;
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume();
    unlocked = true;
    nextNoteAt = context.currentTime + 0.1;
  }

  // One short tone: frequency slides from `from` to `to` over `seconds`.
  function blip(from, to, seconds, type, volume, when = 0) {
    if (!unlocked || !context) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  // A tiny noise burst for hits and explosions.
  function noise(seconds, volume, lowpass) {
    if (!unlocked || !context) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  // Am pentatonic-ish bass line, one note per beat, with a pluck above it.
  const BASS = [110, 0, 110, 130.81, 0, 98, 0, 110, 0, 82.41, 0, 98, 0, 110, 0, 146.83];
  const PLUCK = [440, 0, 523.25, 0, 659.25, 0, 523.25, 0, 440, 0, 392, 0, 523.25, 0, 659.25, 0];
  const BEAT = 0.24;

  function tickMusic() {
    if (!unlocked || !context) return;
    while (nextNoteAt < context.currentTime + 0.15) {
      const step = musicStep % 16;
      const bass = BASS[step];
      if (bass) blip(bass, bass, BEAT * 0.9, 'triangle', 0.5, nextNoteAt - context.currentTime);
      const pluck = PLUCK[step];
      if (pluck && step % 2 === 0) blip(pluck, pluck * 0.98, BEAT * 0.7, 'sine', 0.22, nextNoteAt - context.currentTime);
      musicStep += 1;
      nextNoteAt += BEAT;
    }
  }

  return {
    unlock,
    tickMusic,
    shoot() { blip(720, 240, 0.09, 'square', 0.12); },
    hit() { noise(0.08, 0.25, 900); blip(180, 90, 0.08, 'sawtooth', 0.15); },
    die() { noise(0.22, 0.3, 1400); blip(320, 60, 0.22, 'sawtooth', 0.2); },
    hurt() { blip(140, 55, 0.3, 'sawtooth', 0.3); noise(0.15, 0.2, 600); },
    pickup() { blip(660, 990, 0.12, 'sine', 0.2); },
    upgrade() { blip(523, 523, 0.1, 'sine', 0.2); blip(659, 659, 0.1, 'sine', 0.2, 0.09); blip(784, 784, 0.18, 'sine', 0.22, 0.18); },
    wave() { blip(196, 392, 0.4, 'triangle', 0.25); blip(294, 392, 0.4, 'triangle', 0.18, 0.12); },
    boss() { blip(98, 49, 0.7, 'sawtooth', 0.3); noise(0.5, 0.2, 400); },
    win() { [523, 659, 784, 1047].forEach((f, i) => blip(f, f, 0.25, 'sine', 0.22, i * 0.14)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => blip(f, f * 0.9, 0.3, 'triangle', 0.22, i * 0.18)); },
  };
}
