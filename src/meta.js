const SAVE_KEY = "roomservice_run_v1";

export const UPGRADES = [
  {
    id: "speed",
    name: "Service Sneakers",
    desc: "Move faster through the halls.",
    max: 4,
    costs: [40, 80, 140, 220],
  },
  {
    id: "trolley",
    name: "Service Trolley",
    desc: "Carry +1 order per level (start 1).",
    max: 3,
    costs: [60, 120, 200],
  },
  {
    id: "timer",
    name: "Cloche Covers",
    desc: "Guest timers last longer.",
    max: 3,
    costs: [50, 100, 180],
  },
  {
    id: "busboy",
    name: "Hire Busboy",
    desc: "Helper grabs ready plates from the pass.",
    max: 2,
    costs: [100, 220],
  },
  {
    id: "radio",
    name: "Hall Radio",
    desc: "See order rooms highlighted on the map.",
    max: 1,
    costs: [75],
  },
  {
    id: "cart",
    name: "Rush Cart",
    desc: "Brief sprint boost (hold Shift).",
    max: 2,
    costs: [90, 160],
  },
];

export function defaultSave() {
  return {
    day: 1,
    tips: 0,
    bestDay: 1,
    upgrades: {
      speed: 0,
      trolley: 0,
      timer: 0,
      busboy: 0,
      radio: 0,
      cart: 0,
    },
    survivalBest: 0,
    unlockedSurvival: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = { ...defaultSave(), ...JSON.parse(raw) };
    data.upgrades = { ...defaultSave().upgrades, ...(data.upgrades || {}) };
    return data;
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function upgradeLevel(save, id) {
  return save.upgrades[id] || 0;
}

export function canBuy(save, id) {
  const def = UPGRADES.find((u) => u.id === id);
  const lvl = upgradeLevel(save, id);
  if (lvl >= def.max) return false;
  return save.tips >= def.costs[lvl];
}

export function buyUpgrade(save, id) {
  const def = UPGRADES.find((u) => u.id === id);
  const lvl = upgradeLevel(save, id);
  if (lvl >= def.max) return false;
  const cost = def.costs[lvl];
  if (save.tips < cost) return false;
  save.tips -= cost;
  save.upgrades[id] = lvl + 1;
  writeSave(save);
  return true;
}

export function carryCapacity(save) {
  return 1 + upgradeLevel(save, "trolley");
}

export function moveSpeed(save) {
  return 95 + upgradeLevel(save, "speed") * 18;
}

export function timerBonus(save) {
  return 1 + upgradeLevel(save, "timer") * 0.18;
}

export function busboyCount(save) {
  return upgradeLevel(save, "busboy");
}

export function hasRadio(save) {
  return upgradeLevel(save, "radio") > 0;
}

export function sprintPower(save) {
  return upgradeLevel(save, "cart");
}
