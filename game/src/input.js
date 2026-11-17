// Keyboard and pointer input. Held keys steer the keeper; one-shot presses
// (start, pause, upgrade picks) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// The mouse aims the lantern: the pointer position is kept in playfield
// coordinates, and holding the button fires.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PICK1 = 4;
export const ACTION_PICK2 = 8;
export const ACTION_PICK3 = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas, toField) {
  const keys = new Set();
  let actions = 0;
  let pointer = { x: 640, y: 360, down: false };

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (code === 'Digit1' || code === 'Numpad1') actions |= ACTION_PICK1;
    else if (code === 'Digit2' || code === 'Numpad2') actions |= ACTION_PICK2;
    else if (code === 'Digit3' || code === 'Numpad3') actions |= ACTION_PICK3;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code) || PAUSE.has(event.code) || event.code.startsWith('Digit') || event.code.startsWith('Numpad')) {
      if (!event.repeat) press(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); pointer.down = false; });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { ...pointer, ...toField(event.clientX - rect.left, event.clientY - rect.top) };
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { ...toField(event.clientX - rect.left, event.clientY - rect.top), down: true };
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => { pointer.down = false; });

  return {
    // Normalised steering vector from the held movement keys.
    steer() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        if (LEFT.has(code)) x -= 1;
        else if (RIGHT.has(code)) x += 1;
        else if (UP.has(code)) y -= 1;
        else if (DOWN.has(code)) y += 1;
      }
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    aim() { return { x: pointer.x, y: pointer.y }; },
    firing() { return pointer.down; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
