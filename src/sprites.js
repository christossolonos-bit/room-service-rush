// Pixel-art rendering: procedural waiter sprite + prebuilt hotel-floor canvases.
// Everything is drawn with integer-aligned rects so it stays crisp when scaled.

export const WORLD_W = 1140;
export const WORLD_H = 240;

// Player-center walkable band (corridor)
export const WALK = { x0: 86, x1: 1052, y0: 108, y1: 150 };

export const TOP_DOORS = [130, 280, 430, 580, 730, 880];
export const BOT_DOORS = [205, 355, 505, 655, 805, 955];

export const KITCHEN_X = 108;   // load when player.cx < this
export const ELEVATOR_X = 1030; // use end lift when player.cx > this

// Mid-corridor lifts (on the top wall) so you don't have to walk to the end.
// Placed on gaps between the top doors. reCy = where the player lands after riding.
export const MID_LIFTS = [
  { x: 355, reach: 26, reCy: 116 },
  { x: 655, reach: 26, reCy: 116 },
];

const PAL = {
  skin: "#e8b58e", skinSh: "#c98d68",
  hair: "#2b1d14",
  vest: "#181420", vestHi: "#2a2434",
  shirt: "#f4f1ea",
  pants: "#1c1a26",
  shoe: "#09070d",
  gold: "#f0c040",
  bow: "#c0243a",
  glove: "#f2eee4",
  tray: "#d2dae2", dome: "#aab6c2", domeHi: "#e6edf3",
  eye: "#20141c",
};

/* -------------------------------------------------------- waiter sprite */

export function drawWaiter(ctx, cx, cy, dir, walkT, carrying, role = "waiter") {
  cx = Math.round(cx);
  cy = Math.round(cy);
  const moving = walkT > 0;
  const step = moving ? (Math.floor(walkT * 8) % 2 === 0 ? 1 : -1) : 0;
  const busboy = role === "busboy";

  // shadow
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (dir === "left" || dir === "right") {
    drawSide(ctx, cx, cy, dir === "right", step, carrying, busboy);
  } else {
    drawFrontBack(ctx, cx, cy, dir === "up", step, carrying, busboy);
  }
}

function p(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, w, h);
}

function drawFrontBack(ctx, cx, cy, back, step, carrying, busboy) {
  const lx = cx - 4;
  // legs (alternate)
  p(ctx, lx, cy - 6 - Math.max(0, step), 3, 5, PAL.pants);
  p(ctx, lx, cy - 1 - Math.max(0, step), 3, 1, PAL.shoe);
  p(ctx, cx + 1, cy - 6 - Math.max(0, -step), 3, 5, PAL.pants);
  p(ctx, cx + 1, cy - 1 - Math.max(0, -step), 3, 1, PAL.shoe);

  // torso
  p(ctx, cx - 5, cy - 15, 10, 10, busboy ? "#2a3548" : PAL.vest);
  p(ctx, cx - 5, cy - 15, 10, 1, busboy ? "#3a4558" : PAL.vestHi);

  if (!back) {
    if (busboy) {
      // white apron
      p(ctx, cx - 3, cy - 14, 6, 9, "#e8e4dc");
      p(ctx, cx - 1, cy - 12, 2, 2, "#c0b8b0");
    } else {
      p(ctx, cx - 1, cy - 14, 2, 8, PAL.shirt);
      p(ctx, cx - 2, cy - 15, 4, 2, PAL.bow);
      p(ctx, cx, cy - 11, 1, 1, PAL.gold);
      p(ctx, cx, cy - 9, 1, 1, PAL.gold);
    }
  } else if (busboy) {
    p(ctx, cx - 4, cy - 10, 8, 5, "#e8e4dc");
  }

  // arms
  const armY = carrying ? cy - 15 : cy - 14;
  const handY = carrying ? cy - 12 : cy - 8;
  p(ctx, cx - 7, armY, 2, handY - armY, busboy ? "#2a3548" : PAL.vest);
  p(ctx, cx + 5, armY, 2, handY - armY, busboy ? "#2a3548" : PAL.vest);
  p(ctx, cx - 7, handY, 2, 2, PAL.glove);
  p(ctx, cx + 5, handY, 2, 2, PAL.glove);

  // head
  p(ctx, cx - 4, cy - 23, 8, 8, PAL.skin);
  if (back) {
    p(ctx, cx - 4, cy - 23, 8, 7, PAL.hair);
  } else {
    p(ctx, cx - 4, cy - 23, 8, 2, PAL.hair);
    p(ctx, cx - 4, cy - 23, 1, 5, PAL.hair);
    p(ctx, cx + 3, cy - 23, 1, 5, PAL.hair);
    p(ctx, cx - 2, cy - 19, 1, 1, PAL.eye);
    p(ctx, cx + 1, cy - 19, 1, 1, PAL.eye);
    p(ctx, cx - 1, cy - 16, 2, 1, PAL.skinSh);
  }

  if (carrying) {
    if (busboy) drawBin(ctx, cx, cy - 12);
    else drawTray(ctx, cx, cy - 13, back);
  }
}

function drawSide(ctx, cx, cy, faceRight, step, carrying, busboy) {
  const s = faceRight ? 1 : -1;
  const fx = (dx) => cx + s * dx;

  p(ctx, fx(-1) - 1, cy - 6 - Math.max(0, step), 3, 5, PAL.pants);
  p(ctx, fx(-1) - 1, cy - 1 - Math.max(0, step), 3, 1, PAL.shoe);
  p(ctx, fx(2) - 1, cy - 6 - Math.max(0, -step), 3, 5, PAL.pants);
  p(ctx, fx(2) - 1, cy - 1 - Math.max(0, -step), 3, 1, PAL.shoe);

  const bx = Math.min(fx(-3), fx(4));
  p(ctx, bx, cy - 15, 7, 10, busboy ? "#2a3548" : PAL.vest);
  p(ctx, bx, cy - 15, 7, 1, busboy ? "#3a4558" : PAL.vestHi);
  if (busboy) p(ctx, fx(0) - 1, cy - 14, 4, 8, "#e8e4dc");
  else p(ctx, fx(2), cy - 15, 2, 2, PAL.bow);

  const armY = carrying ? cy - 15 : cy - 13;
  const handY = carrying ? cy - 12 : cy - 8;
  p(ctx, fx(3), armY, 2, handY - armY, busboy ? "#2a3548" : PAL.vest);
  p(ctx, fx(3), handY, 2, 2, PAL.glove);

  p(ctx, fx(-2) - (faceRight ? 0 : 3), cy - 23, 7, 8, PAL.skin);
  p(ctx, fx(-3), cy - 23, 3, 7, PAL.hair);
  p(ctx, fx(-2) - (faceRight ? 0 : 3), cy - 23, 7, 2, PAL.hair);
  p(ctx, fx(2), cy - 19, 1, 1, PAL.eye);
  p(ctx, fx(3), cy - 18, 1, 1, PAL.skinSh);

  if (carrying) {
    if (busboy) drawBin(ctx, fx(3), cy - 12);
    else drawTray(ctx, fx(3), cy - 13, false);
  }
}

function drawTray(ctx, cx, cy, behind) {
  ctx.globalAlpha = behind ? 0.85 : 1;
  p(ctx, cx - 5, cy + 1, 10, 2, PAL.tray);
  p(ctx, cx - 4, cy - 2, 8, 3, PAL.dome);
  p(ctx, cx - 4, cy - 2, 8, 1, PAL.domeHi);
  p(ctx, cx - 1, cy - 3, 2, 1, PAL.gold);
  ctx.globalAlpha = 1;
}

function drawBin(ctx, cx, cy) {
  p(ctx, cx - 5, cy, 10, 7, "#5a4030");
  p(ctx, cx - 5, cy, 10, 1, "#7a5840");
  p(ctx, cx - 3, cy - 2, 3, 2, "#d2dae2");
  p(ctx, cx + 1, cy - 3, 3, 2, "#c8b090");
}

/* --------------------------------------------------------- floor canvas */

export function buildFloor(floorNum) {
  const c = document.createElement("canvas");
  c.width = WORLD_W;
  c.height = WORLD_H;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const base = floorNum * 100;
  const doors = [];

  // backdrop
  p(ctx, 0, 0, WORLD_W, WORLD_H, "#0c0812");

  // room strips behind the walls
  drawRoomStrip(ctx, 0, 56, "#2c3a52");   // top rooms (blue night suites)
  drawRoomStrip(ctx, 184, 56, "#3a2a42"); // bottom rooms (plum suites)

  // beds in each room, aligned to its door
  TOP_DOORS.forEach((x) => drawBed(ctx, x, 12, false));
  BOT_DOORS.forEach((x) => drawBed(ctx, x, 196, true));

  // walls
  drawWall(ctx, 56, 28, TOP_DOORS);
  drawWall(ctx, 156, 28, BOT_DOORS);

  // corridor carpet
  drawCarpet(ctx, 0, 84, WORLD_W, 72);

  // end caps
  drawKitchen(ctx);
  drawElevator(ctx, floorNum);

  // doors + plaques
  TOP_DOORS.forEach((x, i) => {
    drawDoor(ctx, x, 56, false, base + 1 + i);
    doors.push({ room: base + 1 + i, x, side: "top", ix: x, iy: 112 });
  });
  BOT_DOORS.forEach((x, i) => {
    drawDoor(ctx, x, 156, true, base + 7 + i);
    doors.push({ room: base + 7 + i, x, side: "bottom", ix: x, iy: 146 });
  });

  // mid-corridor lifts
  MID_LIFTS.forEach((m) => drawMidElevator(ctx, m.x, floorNum));

  return { canvas: c, doors, floorNum };
}

function drawRoomStrip(ctx, y, h, color) {
  p(ctx, 0, y, WORLD_W, h, color);
  // subtle floorboards
  ctx.globalAlpha = 0.12;
  for (let x = 0; x < WORLD_W; x += 18) p(ctx, x, y, 1, h, "#000");
  ctx.globalAlpha = 1;
}

function drawBed(ctx, x, y, flip) {
  const fy = flip ? y + 24 : y;
  const dir = flip ? -1 : 1;
  // frame
  p(ctx, x - 16, fy, 32, 22 * dir > 0 ? 22 : 22, "#4a2c1c");
  p(ctx, x - 16, fy, 32, 22, "#4a2c1c");
  // sheet
  p(ctx, x - 14, fy + 2, 28, 18, "#e6ddcc");
  // blanket
  p(ctx, x - 14, flip ? fy + 2 : fy + 8, 28, 12, "#9a3450");
  // pillows
  p(ctx, x - 12, flip ? fy + 13 : fy + 3, 10, 5, "#f6f1e6");
  p(ctx, x + 2, flip ? fy + 13 : fy + 3, 10, 5, "#f6f1e6");
  // nightstand + lamp
  p(ctx, x + 18, fy + 6, 7, 8, "#3c2314");
  p(ctx, x + 20, fy + 1, 3, 5, "#f0c040");
}

function drawWall(ctx, y, h, doorXs) {
  // wallpaper base
  p(ctx, 0, y, WORLD_W, h, "#d8cbb0");
  // vertical stripes
  ctx.globalAlpha = 0.16;
  for (let x = 0; x < WORLD_W; x += 8) p(ctx, x, y, 3, h, "#a8916a");
  ctx.globalAlpha = 1;
  // chair rail + baseboard
  p(ctx, 0, y, WORLD_W, 2, "#8a6a2a");
  p(ctx, 0, y + h - 3, WORLD_W, 3, "#3c2314");
  void doorXs;
}

function drawCarpet(ctx, x, y, w, h) {
  p(ctx, x, y, w, h, "#5a2334");
  // gold diamond lattice
  ctx.strokeStyle = "rgba(200,160,80,0.4)";
  ctx.lineWidth = 1;
  for (let gx = -h; gx < w + h; gx += 20) {
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + h, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx + h, y); ctx.lineTo(gx, y + h); ctx.stroke();
  }
  // runner edges
  p(ctx, x, y + 2, w, 2, "#8a6a2a");
  p(ctx, x, y + h - 4, w, 2, "#8a6a2a");
  // warm lamp pools
  for (let lx = 120; lx < w; lx += 180) {
    const g = ctx.createRadialGradient(lx, y + h / 2, 4, lx, y + h / 2, 46);
    g.addColorStop(0, "rgba(255,220,150,0.28)");
    g.addColorStop(1, "rgba(255,220,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(lx - 46, y, 92, h);
  }
}

function drawDoor(ctx, x, wallY, flip, num) {
  const y = flip ? wallY + 2 : wallY + 4;
  // frame
  p(ctx, x - 11, y, 22, 22, "#3c2314");
  // door leaf
  p(ctx, x - 9, y + 2, 18, 20, "#6a4028");
  p(ctx, x - 7, y + 4, 14, 7, "#7a4c30");
  p(ctx, x - 7, y + 13, 14, 7, "#7a4c30");
  // knob
  p(ctx, flip ? x - 7 : x + 5, y + 11, 2, 2, "#f0c040");
  // brass plaque + number
  const py = flip ? y + 24 : y - 9;
  p(ctx, x - 9, py, 18, 8, "#c9a24a");
  p(ctx, x - 9, py, 18, 1, "#f0d888");
  ctx.fillStyle = "#2a1c08";
  ctx.font = "7px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), x, py + 4.5);
  // sconce glow
  const g = ctx.createRadialGradient(x, y + 11, 1, x, y + 11, 20);
  g.addColorStop(0, "rgba(255,210,140,0.18)");
  g.addColorStop(1, "rgba(255,210,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 20, y - 8, 40, 40);
}

function drawKitchen(ctx) {
  const x0 = 8;
  // back wall panel
  p(ctx, x0, 84, 74, 72, "#20242c");
  // steel counter
  p(ctx, x0, 118, 70, 30, "#aeb6be");
  p(ctx, x0, 118, 70, 3, "#d8dee4");
  p(ctx, x0, 145, 70, 3, "#6a7078");
  // cloches on the pass
  for (let i = 0; i < 3; i++) {
    const cx = x0 + 16 + i * 20;
    p(ctx, cx - 6, 110, 12, 8, "#aab6c2");
    p(ctx, cx - 6, 110, 12, 2, "#e6edf3");
    p(ctx, cx - 1, 107, 2, 3, "#f0c040");
  }
  // hanging lamp
  p(ctx, x0 + 34, 84, 2, 8, "#3c2314");
  p(ctx, x0 + 30, 92, 10, 4, "#f0c040");
  // sign
  labelPlate(ctx, x0 + 35, 100, "KITCHEN", "#40d0a0");
}

function drawElevator(ctx, floorNum) {
  const x0 = 1064;
  p(ctx, x0, 66, 68, 100, "#2a2f38");
  // frame
  p(ctx, x0 + 6, 84, 56, 72, "#6a5020");
  // brass doors
  p(ctx, x0 + 10, 88, 24, 64, "#c9a24a");
  p(ctx, x0 + 34, 88, 24, 64, "#c9a24a");
  p(ctx, x0 + 33, 88, 2, 64, "#8a6a2a");
  p(ctx, x0 + 10, 88, 48, 2, "#f0d888");
  // floor indicator
  labelPlate(ctx, x0 + 34, 78, "LIFT", "#f0c040");
  // up/down arrow
  ctx.fillStyle = "#f0c040";
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(floorNum === 1 ? "\u25B2 2" : "\u25BC 1", x0 + 34, 120);
}

function drawMidElevator(ctx, x, floorNum) {
  // shaft recess set into the top wall
  p(ctx, x - 24, 48, 48, 46, "#2a2f38");
  // frame
  p(ctx, x - 20, 54, 40, 40, "#6a5020");
  // brass double doors
  p(ctx, x - 16, 58, 15, 34, "#c9a24a");
  p(ctx, x + 1, 58, 15, 34, "#c9a24a");
  p(ctx, x - 1, 58, 2, 34, "#8a6a2a");
  p(ctx, x - 16, 58, 32, 2, "#f0d888");
  // threshold onto the carpet
  p(ctx, x - 14, 92, 28, 3, "#8a6a2a");
  // call light
  p(ctx, x + 18, 70, 3, 3, "#40d0a0");
  // plaque + arrow
  labelPlate(ctx, x, 45, "LIFT", "#f0c040");
  ctx.fillStyle = "#f0c040";
  ctx.font = "7px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(floorNum === 1 ? "\u25B2 2" : "\u25BC 1", x, 82);
}

function labelPlate(ctx, cx, cy, text, color) {
  const w = text.length * 6 + 8;
  p(ctx, cx - w / 2, cy - 6, w, 11, "#140e16");
  p(ctx, cx - w / 2, cy - 6, w, 11, "#140e16");
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2 + 1, cy - 5, w - 2, 9);
  ctx.fillStyle = color;
  ctx.font = "6px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
}
