// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. The look
// is one coherent idea: a warm lantern glow in a cold dark arena. The scene
// is drawn fully lit, then a radial darkness is laid over it so only the
// lantern's circle is bright — the light is the game, so the light must read.
import { FIELD, FONT, KEEPER, PALETTE, VICTORY_WAVE } from './config.js';
import { KIND_BOSS, KIND_CRAWLER, KIND_SPITTER, KIND_WISP } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, line: 32 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas, effects) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  function font(size) {
    if (!fonts.has(size)) fonts.set(size, `700 ${size}px ${FONT}`);
    return fonts.get(size);
  }
  function text(value, x, y, size, colour, align = 'left', weight = 700) {
    ctx.font = weight === 400 ? `${size}px ${FONT}` : font(size);
    ctx.fillStyle = colour;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }
  // Field coordinates from CSS pixel coordinates (for the mouse aim).
  function toField(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (clientX * ratio - view.x) / view.scale,
      y: (clientY * ratio - view.y) / view.scale,
    };
  }

  function drawGround(state) {
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Faint flagstones, so the dark reads as a floor and not a void.
    ctx.strokeStyle = PALETTE.groundLine;
    ctx.lineWidth = 2;
    for (let x = 0; x <= FIELD.width; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 128) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); ctx.stroke();
    }
    // Cold embers of the old keep: dim blue dots that never move.
    ctx.fillStyle = '#1b2547';
    for (let i = 0; i < 40; i += 1) {
      const x = ((i * 317) % FIELD.width);
      const y = ((i * 211) % FIELD.height);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // A broken ring where the last lantern stands — the keeper's ground.
    ctx.strokeStyle = '#232f55';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(FIELD.width / 2, FIELD.height / 2, 150, 0, Math.PI * 2); ctx.stroke();
    void state;
  }

  function drawPickups(state) {
    for (const p of state.pickups) {
      if (!p.alive) continue;
      const pulse = 1 + Math.sin(p.life * 6) * 0.15;
      ctx.fillStyle = PALETTE.heal;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0d1326';
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawMines(state) {
    for (const m of state.mines) {
      if (!m.alive) continue;
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBullets(state) {
    for (const b of state.bullets) {
      if (!b.alive) continue;
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 16);
      glow.addColorStop(0, 'rgba(255,233,168,0.9)');
      glow.addColorStop(0.4, 'rgba(255,179,71,0.55)');
      glow.addColorStop(1, 'rgba(255,122,26,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(b.x, b.y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.emberCore;
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    for (const o of state.orbs) {
      if (!o.alive) continue;
      ctx.fillStyle = '#3a2b5c';
      ctx.beginPath(); ctx.arc(o.x, o.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b78cff';
      ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawEnemy(foe) {
    const r = foe.radius;
    if (foe.kind === KIND_WISP) {
      ctx.fillStyle = foe.colour;
      ctx.beginPath(); ctx.arc(foe.x, foe.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(183,140,255,0.35)';
      ctx.beginPath(); ctx.arc(foe.x, foe.y, r + 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0d1326';
      ctx.beginPath(); ctx.arc(foe.x - 4, foe.y - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(foe.x + 4, foe.y - 2, 3, 0, Math.PI * 2); ctx.fill();
    } else if (foe.kind === KIND_CRAWLER) {
      ctx.fillStyle = foe.colour;
      ctx.beginPath(); ctx.arc(foe.x, foe.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0d1326';
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(foe.x + Math.cos(a) * r * 0.55, foe.y + Math.sin(a) * r * 0.55, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (foe.kind === KIND_SPITTER) {
      ctx.fillStyle = foe.colour;
      ctx.beginPath(); ctx.arc(foe.x, foe.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0d1326';
      ctx.beginPath(); ctx.arc(foe.x, foe.y + 4, 6, 0, Math.PI * 2); ctx.fill();
    } else if (foe.kind === KIND_BOSS) {
      ctx.fillStyle = foe.colour;
      ctx.beginPath(); ctx.arc(foe.x, foe.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a1030';
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i - 2) * 0.35;
        ctx.beginPath();
        ctx.moveTo(foe.x + Math.cos(a) * (r - 6), foe.y + Math.sin(a) * (r - 6));
        ctx.lineTo(foe.x + Math.cos(a) * (r + 16), foe.y + Math.sin(a) * (r + 16));
        ctx.lineTo(foe.x + Math.cos(a + 0.2) * (r - 6), foe.y + Math.sin(a + 0.2) * (r - 6));
        ctx.fill();
      }
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(foe.x - 14, foe.y - 6, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(foe.x + 14, foe.y - 6, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (foe.elite) {
      ctx.strokeStyle = '#ffd27a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(foe.x, foe.y, r + 5, 0, Math.PI * 2); ctx.stroke();
    }
    if (foe.hp < foe.maxHp) {
      const w = r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(foe.x - r, foe.y - r - 12, w, 5);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(foe.x - r, foe.y - r - 12, w * (foe.hp / foe.maxHp), 5);
    }
  }

  function drawKeeper(state, lightRadius) {
    const p = state.player;
    const blink = p.hurt > 0 && Math.floor(p.hurt * 12) % 2 === 0;
    // Lantern glow on the floor.
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, lightRadius);
    glow.addColorStop(0, 'rgba(255,179,71,0.30)');
    glow.addColorStop(0.6, 'rgba(255,179,71,0.12)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(p.x, p.y, lightRadius, 0, Math.PI * 2); ctx.fill();
    if (!blink) {
      ctx.fillStyle = PALETTE.keeper;
      ctx.beginPath(); ctx.arc(p.x, p.y, KEEPER.radius, 0, Math.PI * 2); ctx.fill();
      // Hood and lantern: the keeper carries the flame in front.
      ctx.fillStyle = '#7a4a12';
      ctx.beginPath(); ctx.arc(p.x, p.y, KEEPER.radius * 0.62, 0, Math.PI * 2); ctx.fill();
      const lx = p.x + Math.cos(p.aim) * 22;
      const ly = p.y + Math.sin(p.aim) * 22;
      ctx.fillStyle = PALETTE.emberCore;
      ctx.beginPath(); ctx.arc(lx, ly, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = PALETTE.ember;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lx, ly); ctx.stroke();
    }
  }

  function drawDarkness(state, lightRadius) {
    const p = state.player;
    // The dark is a veil, not a wall: foes beyond the light stay readable,
    // just cold and dim, so the whole arena reads at a glance.
    const dark = ctx.createRadialGradient(p.x, p.y, lightRadius * 0.9, p.x, p.y, lightRadius * 2.8);
    dark.addColorStop(0, 'rgba(3,5,12,0)');
    dark.addColorStop(0.5, 'rgba(3,5,12,0.28)');
    dark.addColorStop(1, 'rgba(3,5,12,0.68)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawParticles() {
    for (const p of effects.particles) {
      if (!p.alive) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.colour;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of effects.texts) {
      if (!t.alive) continue;
      ctx.globalAlpha = Math.max(0, t.life / t.max);
      text(t.value, t.x, t.y, 20, t.colour, 'center');
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best, lightRadius) {
    const p = state.player;
    ctx.fillStyle = 'rgba(7,10,20,0.72)';
    roundRect(ctx, 12, 12, 1256, 54, 10);
    ctx.fill();
    text(`SCORE ${state.score}`, 28, 46, 26, PALETTE.text);
    text(`WAVE ${Math.max(1, state.wave)} / ${VICTORY_WAVE}`, 300, 46, 26, PALETTE.text);
    text(`BEST ${best}`, 500, 46, 26, PALETTE.muted);
    // Flame bar: the lantern's health, drawn as a burning bar.
    const barX = 800;
    const barW = 260;
    const share = Math.max(0, p.flame) / 100;
    ctx.fillStyle = '#1b2547';
    roundRect(ctx, barX, 24, barW, 26, 8);
    ctx.fill();
    ctx.fillStyle = share > 0.35 ? '#ff8c1a' : '#ff4d6d';
    if (share > 0) { roundRect(ctx, barX, 24, barW * share, 26, 8); ctx.fill(); }
    text('FLAME', barX - 12, 46, 20, PALETTE.ember, 'right');
    text(`${Math.ceil(p.flame)}`, barX + barW + 12, 46, 22, PALETTE.text);
    text(`KILLS ${state.kills}`, 1120, 46, 22, PALETTE.muted);
    // Boss health bar, when a boss lives.
    if (state.boss) {
      const boss = state.boss;
      ctx.fillStyle = 'rgba(7,10,20,0.72)';
      roundRect(ctx, 340, 74, 600, 30, 8);
      ctx.fill();
      text('THE GLOOMLORD', 640, 96, 18, PALETTE.danger, 'center');
      ctx.fillStyle = '#3a0d1d';
      ctx.fillRect(360, 100, 560, 6);
      ctx.fillStyle = PALETTE.danger;
      ctx.fillRect(360, 100, 560 * Math.max(0, boss.hp / boss.maxHp), 6);
    }
    // Wave banner during the banner phase.
    if (state.phase === 'banner' && state.wave > 0) {
      const bossWave = state.wave % 5 === 0;
      text(bossWave ? `WAVE ${state.wave} — THE GLOOMLORD` : `WAVE ${state.wave}`, 640, 330, 54, bossWave ? PALETTE.danger : PALETTE.ember, 'center');
      text(bossWave ? 'The dark sends its master.' : 'Hold the light. Spend it well.', 640, 372, 22, PALETTE.muted, 'center');
    }
    void lightRadius;
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = 120 + lines.length * PANEL.line + 70;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    ctx.fillStyle = 'rgba(7,10,20,0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, PANEL.width, height, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, PANEL.width, height, 14);
    ctx.stroke();
    text(title, FIELD.width / 2, y + 74, 46, accent || PALETTE.ember, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 128 + i * PANEL.line, 21, PALETTE.muted, 'center', 400);
    }
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.ember, 'center');
  }

  function drawUpgradeCards(offers) {
    ctx.fillStyle = 'rgba(7,10,20,0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('THE WAVE IS CLEAR', 640, 130, 44, PALETTE.ember, 'center');
    text('The lantern burns brighter. Choose one blessing — press 1, 2 or 3, or click a card.', 640, 172, 21, PALETTE.muted, 'center', 400);
    const cardW = 300;
    const cardH = 220;
    const gap = 30;
    const total = cardW * 3 + gap * 2;
    const startX = (FIELD.width - total) / 2;
    const y = 240;
    offers.forEach((offer, i) => {
      const x = startX + i * (cardW + gap);
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, x, y, cardW, cardH, 14);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, cardW, cardH, 14);
      ctx.stroke();
      text(`[${i + 1}]`, x + cardW / 2, y + 52, 22, PALETTE.ember, 'center');
      text(offer.name, x + cardW / 2, y + 96, 26, PALETTE.text, 'center');
      // Word-wrap the description inside the card.
      const words = offer.text.split(' ');
      let line = '';
      let lineY = y + 138;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 26) {
          text(line.trim(), x + cardW / 2, lineY, 19, PALETTE.muted, 'center', 400);
          line = word;
          lineY += 26;
        } else line += ' ' + word;
      }
      text(line.trim(), x + cardW / 2, lineY, 19, PALETTE.muted, 'center', 400);
    });
  }

  function draw(state, screen, best, lightRadius) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shake = effects.shake;
    // Deterministic shake: a wobble driven by the world's clock, not by
    // Math.random, so a seeded scene paints the same frame every time.
    const sx = shake ? Math.sin(state.elapsed * 91.7) * shake : 0;
    const sy = shake ? Math.cos(state.elapsed * 113.3) * shake : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawGround(state);
    drawPickups(state);
    drawMines(state);
    for (const foe of state.enemies) if (foe.alive) drawEnemy(foe);
    drawBullets(state);
    drawKeeper(state, lightRadius);
    drawDarkness(state, lightRadius);
    drawParticles();

    if (screen === SCREEN_TITLE) {
      drawPanel('EMBERKEEP', [
        'You are the keeper of the last lantern.',
        'Its flame is your health, your ammo and your light.',
        'Firing costs flame. Foes cost more. Kills feed it back.',
        'WASD / arrows to move · mouse to aim · hold click to fire',
        'Clear 15 waves. The Gloomlord comes every 5th.',
        '',
        `Best score: ${best}`,
      ], 'Press Space or click to begin', PALETTE.ember);
      return;
    }
    drawHud(state, best, lightRadius);
    if (screen === SCREEN_UPGRADE) drawUpgradeCards(state.offers);
    else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The dark waits for you.'], 'Press P or Space to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('THE LIGHT GOES OUT', [
        `Score ${state.score}   ·   Best ${best}`,
        `You held the light through wave ${state.waveCleared || state.wave}, and slew ${state.kills} foes.`,
        'The dark takes the keep — for now.',
      ], 'Press Space or click to try again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawPanel('THE DAWN RETURNS', [
        `Score ${state.score}   ·   Best ${best}`,
        `Fifteen waves held. ${state.kills} foes turned to ash.`,
        'The lantern burns on — and so does the keep.',
      ], 'Press Space or click to play again', PALETTE.heal);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
