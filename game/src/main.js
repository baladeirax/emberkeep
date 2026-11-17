// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, upgrade, paused, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=title|play|boss|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_CLEAR, EVENT_DIE, EVENT_HIT, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_WIN } from './world.js';
import { createEffects } from './particles.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_PICK1, ACTION_PICK2, ACTION_PICK3, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const effects = createEffects(rng);
const world = createWorld(rng, effects);
const renderer = createRenderer(canvas, effects);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.lightRadius());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let titleWaveStarted = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.startWave(1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Hold the light — wave 1.');
  }

  function finishRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.win();
    else audio.lose();
    announce(won ? `Victory. Score ${world.state.score}. Best ${best}.` : `The light goes out. Score ${world.state.score}. Best ${best}.`);
  }

  function pickUpgrade(index) {
    const offers = world.state.offers;
    if (index < 0 || index >= offers.length) return;
    world.applyUpgrade(offers[index]);
    audio.upgrade();
    world.startWave(world.state.wave + 1);
    screen = SCREEN_PLAY;
    announce(`Wave ${world.state.wave}. ${offers[index].name} chosen.`);
  }

  // Which upgrade card (0, 1, 2) holds this field point, or -1.
  function cardAt(point) {
    const cardW = 300;
    const gap = 30;
    const total = cardW * 3 + gap * 2;
    const startX = (1280 - total) / 2;
    const y = 240;
    if (point.y < y || point.y > y + 220) return -1;
    for (let i = 0; i < 3; i += 1) {
      const x = startX + i * (cardW + gap);
      if (point.x >= x && point.x <= x + cardW) return i;
    }
    return -1;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK1) pickUpgrade(0);
      else if (actions & ACTION_PICK2) pickUpgrade(1);
      else if (actions & ACTION_PICK3) pickUpgrade(2);
      else if (actions & ACTION_CONFIRM) {
        const picked = cardAt(input.aim());
        if (picked >= 0) pickUpgrade(picked);
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      if (!titleWaveStarted) {
        world.startWave(1);
        titleWaveStarted = true;
      }
      world.step(STEP, { steer: { x: 0, y: 0 }, aim: world.state.elapsed * 0.4, firing: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const aimPoint = input.aim();
    const aim = Math.atan2(aimPoint.y - world.state.player.y, aimPoint.x - world.state.player.x);
    const events = world.step(STEP, { steer: input.steer(), aim, firing: input.firing() }, false);
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_DIE) audio.die();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_BOSS) audio.boss();
    if (events & EVENT_CLEAR) {
      audio.wave();
      if (events & EVENT_WIN) finishRun(true);
      else {
        screen = SCREEN_UPGRADE;
        announce('Wave clear. Choose a blessing.');
      }
    } else if (events & EVENT_OVER) {
      finishRun(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    audio.tickMusic();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        if (!effects.frozen) {
          step();
          accumulator -= STEP;
        } else {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    effects.step(STEP);
    renderer.draw(world.state, screen, best, world.lightRadius());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberkeep. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
