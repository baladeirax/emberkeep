// Emberkeep — every tuning number, colour and wave rule in one place.
// The arena is a fixed 1280x720 logical space; the renderer scales it to the
// window, so no rule here depends on the screen size. All art is procedural:
// ember-orange on deep blue-black, drawn with canvas shapes and gradients.

export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60; // fixed simulation step, 60 updates a second
export const VICTORY_WAVE = 15;
export const BEST_KEY = 'emberkeep.best.v1';

export const KEEPER = {
  radius: 15,
  speed: 300,
  flameMax: 100, // the lantern's flame is health, ammo and light at once
  flameStart: 100,
  fireCost: 0.9, // flame spent per ember fired
  fireInterval: 0.16, // seconds between embers
  regen: 2.6, // flame regained per second while not firing
  killRestore: 2.5, // flame regained per kill
  hurtCooldown: 0.7, // seconds of mercy after being touched
  lightBase: 150, // lantern radius at full flame
  lightMin: 46, // lantern radius at zero flame
};

export const EMBER = { speed: 620, radius: 6, life: 0.9, damage: 1 };

export const ENEMY = {
  // wisp: small, fast, drifts in from the dark and chases the keeper
  wisp: { radius: 13, hp: 1, speed: 105, touch: 9, score: 10, colour: '#b78cff' },
  // crawler: slow and heavy, takes three embers, hits hard
  crawler: { radius: 22, hp: 3, speed: 52, touch: 16, score: 25, colour: '#5ad67a' },
  // spitter: keeps its distance and lobs slow dark orbs
  spitter: { radius: 16, hp: 2, speed: 72, touch: 8, score: 30, colour: '#ff7ab8', shotInterval: 2.4, orbSpeed: 150 },
  // boss: the Gloomlord, every fifth wave
  boss: { radius: 46, hp: 90, speed: 38, touch: 24, score: 500, colour: '#ff4d6d' },
};

export const ORB = { radius: 8, damage: 10, life: 6 };

// How a wave is built: base count plus growth, and how the mix shifts as
// the waves get deeper. Elites (3x hp, worth 3x, drop a flame ember) appear
// from wave 3; a boss replaces the normal spawn on waves 5, 10 and 15.
export const WAVES = {
  baseCount: 5,
  perWave: 3,
  eliteFrom: 3,
  eliteChance: 0.12,
  bossEvery: 5,
  betweenSeconds: 3.5, // breather before the next wave's banner
  clearBonus: 100, // score per wave cleared, times the wave number
};

export const UPGRADES = [
  { id: 'spread', name: 'Twin Embers', text: 'Fire one extra ember per shot', apply: (u) => { u.shots += 1; } },
  { id: 'rapid', name: 'Quick Hands', text: 'Fire 18% faster', apply: (u) => { u.fireInterval *= 0.82; } },
  { id: 'wide', name: 'Broad Lantern', text: 'Lantern light +30 radius', apply: (u) => { u.lightBonus += 30; } },
  { id: 'flame', name: 'Deep Wick', text: 'Max flame +25, restore 25 now', apply: (u) => { u.flameMax += 25; u.flameBonus += 25; } },
  { id: 'regen', name: 'Slow Burn', text: 'Flame regrows 60% faster', apply: (u) => { u.regen *= 1.6; } },
  { id: 'pierce', name: 'Piercing Embers', text: 'Embers pass through one extra foe', apply: (u) => { u.pierce += 1; } },
  { id: 'swift', name: 'Swift Boots', text: 'Move 15% faster', apply: (u) => { u.speed *= 1.15; } },
  { id: 'mines', name: 'Ember Mines', text: 'Slain foes leave a burning mine', apply: (u) => { u.mines = true; } },
  { id: 'pulse', name: 'Shield Pulse', text: 'A pulse every 6 s shoves foes away', apply: (u) => { u.pulse = true; } },
  { id: 'magnet', name: 'Ember Magnet', text: 'Flame embers drift to you', apply: (u) => { u.magnet = true; } },
  { id: 'heavy', name: 'Heavy Embers', text: 'Embers deal +1 damage', apply: (u) => { u.damage += 1; } },
  { id: 'thorns', name: 'Thorn Light', text: 'Foes touching you take damage', apply: (u) => { u.thorns = true; } },
];

export const PALETTE = {
  backdrop: '#070a14',
  ground: '#0d1326',
  groundLine: '#141c36',
  ember: '#ffb347',
  emberHot: '#ff7a1a',
  emberCore: '#ffe9a8',
  keeper: '#ffd27a',
  text: '#f2ead8',
  muted: '#9aa3c0',
  dim: '#5d6787',
  panel: '#10182e',
  panelEdge: '#2a3a63',
  danger: '#ff4d6d',
  heal: '#7dffb0',
  boss: '#ff4d6d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
