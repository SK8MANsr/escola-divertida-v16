type SoundName = 'tap' | 'success' | 'error' | 'reward' | 'unlock';

let audioContext: AudioContext | null = null;

const getContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
};

const patternMap: Record<SoundName, number[]> = {
  tap: [420],
  success: [520, 660],
  error: [240, 180],
  reward: [420, 520, 680],
  unlock: [360, 480, 720],
};

export const playSound = (name: SoundName, enabled: boolean) => {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  patternMap[name].forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = name === 'error' ? 'sawtooth' : 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + index * 0.12);
    gain.gain.exponentialRampToValueAtTime(name === 'tap' ? 0.03 : 0.07, now + index * 0.12 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + index * 0.12);
    osc.stop(now + index * 0.12 + 0.14);
  });
};
