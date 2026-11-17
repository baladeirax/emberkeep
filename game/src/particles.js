// Particles, floating score text, screen shake and hit-stop. Everything is
// pooled at boot: spawning never allocates during play, it just wakes a dead
// particle. The renderer reads these pools; the world writes them. All
// randomness comes from the seeded source, so a seeded scene paints the
// same frame every time.
export function createEffects(random) {
  const particles = [];
  const texts = [];
  for (let i = 0; i < 256; i += 1) {
    particles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, colour: '#fff', drag: 0 });
  }
  for (let i = 0; i < 24; i += 1) {
    texts.push({ alive: false, x: 0, y: 0, life: 0, max: 1, value: '', colour: '#fff' });
  }
  let shake = 0;
  let freeze = 0;

  function burst(x, y, count, colour, speed, size, life) {
    let made = 0;
    for (const p of particles) {
      if (made >= count) break;
      if (p.alive) continue;
      const angle = random.next() * Math.PI * 2;
      const power = speed * (0.3 + random.next() * 0.7);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * power;
      p.vy = Math.sin(angle) * power;
      p.life = life * (0.6 + random.next() * 0.6);
      p.max = p.life;
      p.size = size * (0.6 + random.next() * 0.8);
      p.colour = colour;
      p.drag = 3;
      made += 1;
    }
  }

  function floatText(x, y, value, colour) {
    for (const t of texts) {
      if (t.alive) continue;
      t.alive = true;
      t.x = x;
      t.y = y;
      t.life = 0.9;
      t.max = 0.9;
      t.value = value;
      t.colour = colour;
      return;
    }
  }

  function step(dt) {
    if (freeze > 0) freeze -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 26);
    for (const p of particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const t of texts) {
      if (!t.alive) continue;
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) t.alive = false;
    }
  }

  return {
    particles,
    texts,
    burst,
    floatText,
    addShake(amount) { shake = Math.min(14, shake + amount); },
    addFreeze(seconds) { freeze = Math.max(freeze, seconds); },
    get shake() { return shake; },
    get frozen() { return freeze > 0; },
    clear() {
      for (const p of particles) p.alive = false;
      for (const t of texts) t.alive = false;
      shake = 0;
      freeze = 0;
    },
  };
}
