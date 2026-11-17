// Emberkeep's rules and state, with no drawing and no browser in it: the
// keeper, the lantern flame, the waves of foes, embers, orbs, mines and
// pickups. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react (sound, shake, screens) without the world
// knowing about them. Nothing here allocates after createWorld returns.
//
// The core idea: the lantern's flame is health, ammo and light at once.
// Firing an ember costs flame; a foe's touch costs more; kills and flame
// embers give some back. When the flame dies, the light dies, and so does
// the keeper. Standing in your own light is what keeps you alive — and the
// dark beyond it is where the foes come from.
import { EMBER, ENEMY, FIELD, KEEPER, ORB, UPGRADES, VICTORY_WAVE, WAVES } from './config.js';

export const KIND_WISP = 'wisp';
export const KIND_CRAWLER = 'crawler';
export const KIND_SPITTER = 'spitter';
export const KIND_BOSS = 'boss';

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_DIE = 4;
export const EVENT_PICKUP = 8;
export const EVENT_WAVE = 16;
export const EVENT_CLEAR = 32;
export const EVENT_OVER = 64;
export const EVENT_WIN = 128;
export const EVENT_BOSS = 256;

function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random, effects) {
  const player = { x: FIELD.width / 2, y: FIELD.height / 2, flame: KEEPER.flameStart, hurt: 0, fire: 0, pulse: 0, aim: 0 };
  const mods = { shots: 1, fireInterval: KEEPER.fireInterval, lightBonus: 0, flameMax: KEEPER.flameMax, flameBonus: 0, regen: KEEPER.regen, pierce: 0, speed: KEEPER.speed, mines: false, pulse: false, magnet: false, damage: EMBER.damage, thorns: false };
  const enemies = [];
  const bullets = [];
  const orbs = [];
  const mines = [];
  const pickups = [];
  for (let i = 0; i < 80; i += 1) enemies.push({ alive: false, kind: KIND_WISP, x: 0, y: 0, hp: 1, maxHp: 1, elite: false, radius: 13, speed: 100, touch: 9, score: 10, colour: '#fff', shot: 0, wobble: 0, burst: 0, spawn: 0 });
  for (let i = 0; i < 96; i += 1) bullets.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, pierce: 0, damage: 1 });
  for (let i = 0; i < 48; i += 1) orbs.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  for (let i = 0; i < 32; i += 1) mines.push({ alive: false, x: 0, y: 0, life: 0 });
  for (let i = 0; i < 32; i += 1) pickups.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });

  const state = {
    player, enemies, bullets, orbs, mines, pickups,
    score: 0, kills: 0, wave: 0, phase: 'banner', phaseTimer: 1.2,
    toSpawn: 0, spawnTimer: 0, elapsed: 0, boss: null,
    offers: [], waveCleared: 0,
  };

  function lightRadius() {
    const share = Math.max(0, player.flame) / mods.flameMax;
    return KEEPER.lightMin + share * (KEEPER.lightBase + mods.lightBonus - KEEPER.lightMin);
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].alive) return pool[i];
    return null;
  }

  function edgePoint(kind) {
    // Foes step out of the dark at the arena's edge, as far from the keeper
    // as the edge allows — the dark is where they come from. The boss is big,
    // so it steps in farther from the wall and never hides behind the HUD.
    const side = random.int(0, 3);
    const margin = kind === KIND_BOSS ? 130 : 30;
    let x;
    let y;
    if (side === 0) { x = random.range(margin, FIELD.width - margin); y = margin; }
    else if (side === 1) { x = random.range(margin, FIELD.width - margin); y = FIELD.height - margin; }
    else if (side === 2) { x = margin; y = random.range(margin, FIELD.height - margin); }
    else { x = FIELD.width - margin; y = random.range(margin, FIELD.height - margin); }
    return { x, y };
  }

  function spawnEnemy(kind, elite) {
    const slot = free(enemies);
    if (!slot) return null;
    const spec = ENEMY[kind];
    const at = edgePoint(kind);
    slot.alive = true;
    slot.kind = kind;
    slot.x = at.x;
    slot.y = at.y;
    slot.elite = elite;
    slot.hp = spec.hp * (elite ? 3 : 1) * (1 + Math.floor((state.wave - 1) / 4));
    slot.maxHp = slot.hp;
    slot.radius = spec.radius * (elite ? 1.35 : 1);
    slot.speed = spec.speed * random.range(0.9, 1.1);
    slot.touch = spec.touch;
    slot.score = spec.score * (elite ? 3 : 1);
    slot.colour = spec.colour;
    slot.shot = random.range(1, 2.4);
    slot.wobble = random.range(0, Math.PI * 2);
    slot.burst = random.range(2, 3.5);
    slot.spawn = random.range(4, 7);
    return slot;
  }

  function pickKind() {
    const roll = random.next();
    if (state.wave >= 3 && roll < 0.2) return KIND_SPITTER;
    if (state.wave >= 2 && roll < 0.45) return KIND_CRAWLER;
    return KIND_WISP;
  }

  function startWave(number) {
    state.wave = number;
    state.phase = 'banner';
    state.phaseTimer = 1.6;
    state.boss = null;
    if (number % WAVES.bossEvery === 0) {
      state.toSpawn = 6;
    } else {
      state.toSpawn = WAVES.baseCount + WAVES.perWave * number;
    }
    state.spawnTimer = 0.4;
  }

  function offerUpgrades() {
    const pool = UPGRADES.slice();
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      picks.push(pool.splice(random.int(0, pool.length - 1), 1)[0]);
    }
    state.offers = picks;
    return picks;
  }

  function applyUpgrade(upgrade) {
    upgrade.apply(mods);
    if (upgrade.id === 'flame') player.flame = Math.min(mods.flameMax, player.flame + 25);
  }

  function fireEmber() {
    if (player.flame < KEEPER.fireCost + 1) return false;
    player.flame -= KEEPER.fireCost;
    player.fire = mods.fireInterval;
    const spread = (mods.shots - 1) * 0.14;
    for (let i = 0; i < mods.shots; i += 1) {
      const slot = free(bullets);
      if (!slot) break;
      const angle = player.aim + (i - (mods.shots - 1) / 2) * spread;
      slot.alive = true;
      slot.x = player.x + Math.cos(angle) * (KEEPER.radius + 8);
      slot.y = player.y + Math.sin(angle) * (KEEPER.radius + 8);
      slot.vx = Math.cos(angle) * EMBER.speed;
      slot.vy = Math.sin(angle) * EMBER.speed;
      slot.life = EMBER.life;
      slot.pierce = mods.pierce;
      slot.damage = mods.damage;
    }
    effects.burst(player.x + Math.cos(player.aim) * 24, player.y + Math.sin(player.aim) * 24, 3, '#ffb347', 120, 3, 0.25);
    return true;
  }

  function hurtPlayer(amount, fromX, fromY) {
    if (player.hurt > 0) return false;
    player.flame -= amount;
    player.hurt = KEEPER.hurtCooldown;
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    player.x = Math.min(FIELD.width - 24, Math.max(24, player.x + (dx / len) * 26));
    player.y = Math.min(FIELD.height - 24, Math.max(24, player.y + (dy / len) * 26));
    effects.burst(player.x, player.y, 14, '#ff4d6d', 220, 4, 0.5);
    effects.addShake(7);
    if (mods.thorns) {
      for (const foe of enemies) {
        if (foe.alive && distanceSq(foe.x, foe.y, player.x, player.y) < (foe.radius + KEEPER.radius + 30) ** 2) killEnemy(foe, true);
      }
    }
    return true;
  }

  function dropPickup(x, y) {
    const slot = free(pickups);
    if (!slot) return;
    slot.alive = true;
    slot.x = x;
    slot.y = y;
    slot.vx = random.range(-30, 30);
    slot.vy = random.range(-30, 30);
    slot.life = 9;
  }

  function killEnemy(foe, silent) {
    foe.alive = false;
    state.kills += 1;
    state.score += foe.score;
    player.flame = Math.min(mods.flameMax, player.flame + KEEPER.killRestore);
    effects.burst(foe.x, foe.y, foe.kind === KIND_BOSS ? 60 : 16, foe.colour, 260, 4, 0.6);
    // Only big scores float: every kill shouting its points drowns the field.
    if (foe.score >= 25) effects.floatText(foe.x, foe.y - foe.radius, `+${foe.score}`, '#ffe9a8');
    effects.addShake(foe.kind === KIND_BOSS ? 12 : 2);
    effects.addFreeze(foe.kind === KIND_BOSS ? 0.12 : 0.03);
    if (foe.kind === KIND_BOSS) state.boss = null;
    if (mods.mines && foe.kind !== KIND_BOSS) {
      const mine = free(mines);
      if (mine) { mine.alive = true; mine.x = foe.x; mine.y = foe.y; mine.life = 6; }
    }
    if (!silent && (foe.elite || random.next() < 0.3)) dropPickup(foe.x, foe.y);
  }

  function stepEnemy(foe, dt, events) {
    const dx = player.x - foe.x;
    const dy = player.y - foe.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    foe.wobble += dt * 3;
    if (foe.kind === KIND_SPITTER) {
      // Holds its distance and lobs dark orbs.
      const want = 260;
      const toward = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
      foe.x += (ux * toward + Math.cos(foe.wobble) * 0.4) * foe.speed * dt;
      foe.y += (uy * toward + Math.sin(foe.wobble) * 0.4) * foe.speed * dt;
      foe.shot -= dt;
      if (foe.shot <= 0 && dist < 520) {
        foe.shot = ENEMY.spitter.shotInterval;
        const orb = free(orbs);
        if (orb) {
          orb.alive = true;
          orb.x = foe.x;
          orb.y = foe.y;
          orb.vx = ux * ENEMY.spitter.orbSpeed;
          orb.vy = uy * ENEMY.spitter.orbSpeed;
          orb.life = ORB.life;
        }
      }
    } else if (foe.kind === KIND_BOSS) {
      foe.x += ux * foe.speed * dt;
      foe.y += uy * foe.speed * dt;
      foe.burst -= dt;
      if (foe.burst <= 0) {
        foe.burst = 3.2;
        for (let i = 0; i < 10; i += 1) {
          const orb = free(orbs);
          if (!orb) break;
          const angle = (i / 10) * Math.PI * 2 + foe.wobble;
          orb.alive = true;
          orb.x = foe.x;
          orb.y = foe.y;
          orb.vx = Math.cos(angle) * 130;
          orb.vy = Math.sin(angle) * 130;
          orb.life = ORB.life;
        }
        effects.addShake(5);
      }
      foe.spawn -= dt;
      if (foe.spawn <= 0) {
        foe.spawn = 6;
        spawnEnemy(KIND_WISP, false);
        spawnEnemy(KIND_WISP, false);
      }
    } else {
      const sway = foe.kind === KIND_WISP ? 0.5 : 0.15;
      foe.x += (ux + Math.cos(foe.wobble) * sway) * foe.speed * dt;
      foe.y += (uy + Math.sin(foe.wobble) * sway) * foe.speed * dt;
    }
    foe.x = Math.min(FIELD.width - 10, Math.max(10, foe.x));
    foe.y = Math.min(FIELD.height - 10, Math.max(10, foe.y));
    // Touching the keeper costs flame.
    if (dist < foe.radius + KEEPER.radius) {
      if (hurtPlayer(foe.touch, foe.x, foe.y)) return EVENT_HIT;
    }
    return 0;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.flame = KEEPER.flameStart;
    player.hurt = 0;
    player.fire = 0;
    player.pulse = 0;
    mods.shots = 1;
    mods.fireInterval = KEEPER.fireInterval;
    mods.lightBonus = 0;
    mods.flameMax = KEEPER.flameMax;
    mods.flameBonus = 0;
    mods.regen = KEEPER.regen;
    mods.pierce = 0;
    mods.speed = KEEPER.speed;
    mods.mines = false;
    mods.pulse = false;
    mods.magnet = false;
    mods.damage = EMBER.damage;
    mods.thorns = false;
    for (const pool of [enemies, bullets, orbs, mines, pickups]) for (const item of pool) item.alive = false;
    state.score = 0;
    state.kills = 0;
    state.wave = 0;
    state.phase = 'banner';
    state.phaseTimer = 1.2;
    state.toSpawn = 0;
    state.elapsed = 0;
    state.boss = null;
    state.offers = [];
    state.waveCleared = 0;
    effects.clear();
  }

  /**
   * One fixed step. `control` carries the steering vector, the aim angle and
   * whether the fire button is held. With `harmless` set (the title screen's
   * backdrop) foes drift and embers fly, but nothing can hurt the keeper and
   * nothing scores — the title plays itself.
   */
  function step(dt, control, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (player.hurt > 0) player.hurt -= dt;
    if (player.fire > 0) player.fire -= dt;

    if (state.phase === 'banner') {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.phase = 'fight';
        if (state.wave % WAVES.bossEvery === 0 && state.wave > 0) {
          const boss = spawnEnemy(KIND_BOSS, false);
          if (boss) { state.boss = boss; events |= EVENT_BOSS; }
        }
      }
    } else if (state.phase === 'fight') {
      state.spawnTimer -= dt;
      if (state.toSpawn > 0 && state.spawnTimer <= 0) {
        state.spawnTimer = Math.max(0.25, 0.9 - state.wave * 0.04);
        spawnEnemy(pickKind(), state.wave >= WAVES.eliteFrom && random.next() < WAVES.eliteChance);
        state.toSpawn -= 1;
      }
    }

    // On the title screen the keep plays itself: keep a few wisps drifting
    // in from the dark so the backdrop is alive, without ever scoring.
    if (harmless) {
      let alive = 0;
      for (const foe of enemies) if (foe.alive) alive += 1;
      state.spawnTimer -= dt;
      if (alive < 6 && state.spawnTimer <= 0) {
        state.spawnTimer = 0.9;
        spawnEnemy(KIND_WISP, false);
      }
    }

    // The keeper moves and aims.
    const aimDx = Math.cos(control.aim) ;
    const aimDy = Math.sin(control.aim);
    player.aim = control.aim;
    player.x = Math.min(FIELD.width - KEEPER.radius, Math.max(KEEPER.radius, player.x + control.steer.x * mods.speed * dt));
    player.y = Math.min(FIELD.height - KEEPER.radius, Math.max(KEEPER.radius, player.y + control.steer.y * mods.speed * dt));
    void aimDx; void aimDy;

    // Firing costs flame; not firing lets it regrow.
    if (control.firing && player.fire <= 0 && !harmless) {
      if (fireEmber()) events |= EVENT_SHOOT;
    } else if (!control.firing) {
      player.flame = Math.min(mods.flameMax, player.flame + mods.regen * dt);
    }

    // Shield pulse shoves foes back every six seconds.
    if (mods.pulse) {
      player.pulse -= dt;
      if (player.pulse <= 0) {
        player.pulse = 6;
        const radius = lightRadius() + 40;
        for (const foe of enemies) {
          if (!foe.alive) continue;
          const d = Math.hypot(foe.x - player.x, foe.y - player.y);
          if (d < radius && d > 1) {
            foe.x += ((foe.x - player.x) / d) * 90;
            foe.y += ((foe.y - player.y) / d) * 90;
          }
        }
        effects.burst(player.x, player.y, 20, '#7dffb0', 180, 3, 0.4);
      }
    }

    // Embers fly, pierce and burn.
    for (const bullet of bullets) {
      if (!bullet.alive) continue;
      bullet.life -= dt;
      if (bullet.life <= 0) { bullet.alive = false; continue; }
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.x < 0 || bullet.x > FIELD.width || bullet.y < 0 || bullet.y > FIELD.height) { bullet.alive = false; continue; }
      for (const foe of enemies) {
        if (!foe.alive) continue;
        if (distanceSq(bullet.x, bullet.y, foe.x, foe.y) > (foe.radius + EMBER.radius) ** 2) continue;
        foe.hp -= bullet.damage;
        effects.burst(bullet.x, bullet.y, 5, '#ffb347', 140, 3, 0.3);
        if (foe.hp <= 0) {
          if (!harmless) killEnemy(foe, false);
          else foe.alive = false;
          events |= EVENT_DIE;
        }
        if (bullet.pierce > 0) bullet.pierce -= 1;
        else { bullet.alive = false; }
        break;
      }
    }

    // Foes chase, spit and touch.
    for (const foe of enemies) {
      if (!foe.alive) continue;
      if (!harmless) events |= stepEnemy(foe, dt, events);
      else {
        foe.x += Math.cos(foe.wobble) * foe.speed * 0.4 * dt;
        foe.y += Math.sin(foe.wobble) * foe.speed * 0.4 * dt;
      }
    }

    // Dark orbs drift and burn the keeper on contact.
    for (const orb of orbs) {
      if (!orb.alive) continue;
      orb.life -= dt;
      if (orb.life <= 0) { orb.alive = false; continue; }
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      if (orb.x < 0 || orb.x > FIELD.width || orb.y < 0 || orb.y > FIELD.height) { orb.alive = false; continue; }
      if (!harmless && distanceSq(orb.x, orb.y, player.x, player.y) < (ORB.radius + KEEPER.radius) ** 2) {
        orb.alive = false;
        if (hurtPlayer(ORB.damage, orb.x, orb.y)) events |= EVENT_HIT;
      }
    }

    // Mines wait, then burst when a foe steps on them.
    for (const mine of mines) {
      if (!mine.alive) continue;
      mine.life -= dt;
      if (mine.life <= 0) { mine.alive = false; continue; }
      for (const foe of enemies) {
        if (!foe.alive) continue;
        if (distanceSq(mine.x, mine.y, foe.x, foe.y) < (foe.radius + 14) ** 2) {
          mine.alive = false;
          foe.hp -= 2;
          effects.burst(mine.x, mine.y, 12, '#ff7a1a', 240, 4, 0.5);
          if (foe.hp <= 0) { killEnemy(foe, false); events |= EVENT_DIE; }
          break;
        }
      }
    }

    // Flame embers drift to the keeper (faster with the magnet) and restore flame.
    for (const pickup of pickups) {
      if (!pickup.alive) continue;
      pickup.life -= dt;
      if (pickup.life <= 0) { pickup.alive = false; continue; }
      const d = Math.hypot(player.x - pickup.x, player.y - pickup.y);
      if (mods.magnet && d < 220) {
        pickup.x += ((player.x - pickup.x) / (d || 1)) * 260 * dt;
        pickup.y += ((player.y - pickup.y) / (d || 1)) * 260 * dt;
      } else {
        pickup.x += pickup.vx * dt;
        pickup.y += pickup.vy * dt;
        pickup.vx *= 0.98;
        pickup.vy *= 0.98;
      }
      if (d < KEEPER.radius + 16) {
        pickup.alive = false;
        player.flame = Math.min(mods.flameMax, player.flame + 12);
        effects.burst(pickup.x, pickup.y, 8, '#7dffb0', 120, 3, 0.4);
        events |= EVENT_PICKUP;
      }
    }

    // Wave cleared: no foes left and nothing left to spawn.
    if (state.phase === 'fight' && state.toSpawn === 0 && !harmless) {
      let anyAlive = false;
      for (const foe of enemies) if (foe.alive) { anyAlive = true; break; }
      if (!anyAlive) {
        const bonus = WAVES.clearBonus * state.wave;
        state.score += bonus;
        state.waveCleared = state.wave;
        events |= EVENT_CLEAR;
        if (state.wave >= VICTORY_WAVE) {
          events |= EVENT_WIN;
        } else {
          state.phase = 'upgrade';
          offerUpgrades();
        }
      }
    }

    // The flame going out ends the run.
    if (!harmless && player.flame <= 0) {
      player.flame = 0;
      events |= EVENT_OVER;
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave, offerUpgrades, applyUpgrade, lightRadius, mods };
}
