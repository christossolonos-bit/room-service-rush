// Keyboard input for the 2D arcade game.

const down = new Set();
const just = new Set();

const MAP = {
  w: "up", arrowup: "up",
  s: "down", arrowdown: "down",
  a: "left", arrowleft: "left",
  d: "right", arrowright: "right",
  " ": "interact",
  f: "elevator",
  shift: "sprint",
  enter: "confirm",
  escape: "pause",
};

function resolve(e) {
  const k = e.key.toLowerCase();
  if (MAP[k]) return MAP[k];
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") return "sprint";
  return null;
}

window.addEventListener("keydown", (e) => {
  const action = resolve(e);
  if (!action) return;
  e.preventDefault();
  if (!down.has(action)) just.add(action);
  down.add(action);
});

window.addEventListener("keyup", (e) => {
  const action = resolve(e);
  if (action) down.delete(action);
});

export function held(a) { return down.has(a); }

export function pressed(a) {
  if (just.has(a)) {
    just.delete(a);
    return true;
  }
  return false;
}

export function clearPressed() {
  just.clear();
}
