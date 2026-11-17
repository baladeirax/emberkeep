// The screenshot scenes behind ?shot=title|play|boss|victory. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (move toward the nearest foe, keep a little
// distance, aim and fire at it), so the frame is what a real game looks like
// and the same seed always gives the same frame. The victory scene plays the
// final wave with the boss weakened to one ember's worth of health, so the
// shot reaches the win screen without playing all fifteen waves.
import { STEP } from './config.js';
import { EVENT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 6;
const PLAY_SECONDS = 30;
const BOSS_SECONDS = 40;
const VICTORY_LIMIT_SECONDS = 90;

/** Steer toward the nearest foe — the boss, when one lives — keep a little
  distance, aim at it. */
function autopilot(state) {
  let nearest = state.boss || null;
  let nearestDist = nearest ? Math.hypot(nearest.x - state.player.x, nearest.y - state.player.y) : Infinity;
  if (!nearest) {
    for (const foe of state.enemies) {
      if (!foe.alive) continue;
      const dist = Math.hypot(foe.x - state.player.x, foe.y - state.player.y);
      if (dist < nearestDist) { nearestDist = dist; nearest = foe; }
    }
  }
  if (!nearest) return { steer: { x: 0, y: 0 }, aim: state.player.aim, firing: false };
  const dx = nearest.x - state.player.x;
  const dy = nearest.y - state.player.y;
  const aim = Math.atan2(dy, dx);
  // Keep a fighting distance: closer for small foes, farther from the boss,
  // so the pilot strafes around its target instead of chasing it to a wall.
  const hold = nearest.kind === 'boss' ? 260 : 170;
  let steer = { x: 0, y: 0 };
  if (nearestDist > hold) steer = { x: dx / nearestDist, y: dy / nearestDist };
  else if (nearestDist < 80) steer = { x: -dx / nearestDist, y: -dy / nearestDist };
  else steer = { x: -dy / nearestDist, y: dx / nearestDist }; // strafe around it
  return { steer, aim, firing: nearestDist < 520 };
}

/** Run the world forward with the autopilot until `stop` says so. */
function runFor(world, seconds, stop) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const control = autopilot(world.state);
    const events = world.step(STEP, control, false);
    if (stop && stop(events)) return events;
    if (events & EVENT_OVER) return events;
  }
  return 0;
}

export function stageShot(name, world) {
  if (name === 'play') {
    world.reset();
    world.startWave(3);
    // A mid-game keeper: two blessings already earned, so the shot shows
    // the upgrade system paying off (spread embers, broader light).
    world.applyUpgrade(world.state.offers.length ? world.state.offers[0] : { id: 'spread', apply: (u) => { u.shots += 1; } });
    // Stop mid-wave, while foes are still fighting — not after the clear.
    runFor(world, 10, null);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    world.reset();
    world.startWave(5);
    runFor(world, BOSS_SECONDS, (events) => world.state.boss !== null);
    // Bring the encounter to the middle of the arena so the boss, the
    // keeper and the boss bar all read in one frame, then fight it there.
    if (world.state.boss) {
      world.state.boss.x = 640;
      world.state.boss.y = 280;
      world.state.player.x = 640;
      world.state.player.y = 560;
      world.state.player.flame = 100;
    }
    runFor(world, 5, null);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'victory') {
    world.reset();
    world.startWave(15);
    runFor(world, VICTORY_LIMIT_SECONDS, (events) => {
      if (world.state.boss && world.state.boss.hp > 1) world.state.boss.hp = 1;
      return (events & EVENT_WIN) !== 0;
    });
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  if (name === 'upgrade') {
    world.reset();
    world.startWave(1);
    runFor(world, 60, (events) => (events & EVENT_CLEAR) !== 0);
    return { screen: SCREEN_UPGRADE, best: world.state.score };
  }
  // Title: the keep plays itself behind the panel.
  world.reset();
  world.startWave(1);
  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
    world.step(STEP, { steer: { x: 0, y: 0 }, aim: world.state.elapsed * 0.5, firing: false }, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
