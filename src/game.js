import { held, pressed } from "./input.js?v=mid2";
import { sfx, unlockAudio } from "./audio.js?v=mid2";
import {
  loadSave, writeSave, UPGRADES, buyUpgrade, canBuy, upgradeLevel,
  carryCapacity, timerBonus, sprintPower, hasRadio, busboyCount,
} from "./meta.js?v=mid2";
import {
  buildFloor, drawWaiter, WORLD_W, WALK, KITCHEN_X, ELEVATOR_X, MID_LIFTS,
} from "./sprites.js?v=mid2";

const VIEW_W = 360;
const VIEW_H = 240;
const FOODS = ["STEAK", "SOUP", "CLUB", "BUBBLY", "PASTA", "CAKE", "COFFEE", "TART"];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    this.save = loadSave();
    this.mode = "title";
    this.time = 0;
    this.last = performance.now();

    // build both floors once
    this.floors = [buildFloor(1), buildFloor(2)];
    this.roomInfo = new Map();
    this.floors.forEach((fl, idx) => {
      for (const d of fl.doors) this.roomInfo.set(d.room, { ...d, floorIdx: idx });
    });
    this.allRooms = [...this.roomInfo.keys()];

    this.player = { cx: 200, cy: 130, dir: "right", walk: 0 };
    this.floorIdx = 0;
    this.camX = 0;
    this.carrying = [];
    this.orders = [];
    this.floats = [];
    this.combo = 0;
    this.bestCombo = 0;
    this.tipsEarned = 0;
    this.delivered = 0;
    this.needed = 5;
    this.shiftTime = 150;
    this.liftBusy = 0;
    this.toast = "";
    this._toastT = 0;

    this.hud = {
      root: document.getElementById("hud"),
      day: document.getElementById("hud-day"),
      tips: document.getElementById("hud-tips"),
      floor: document.getElementById("hud-floor"),
      timer: document.getElementById("hud-timer"),
      combo: document.getElementById("hud-combo"),
      orders: document.getElementById("order-list"),
      carry: document.getElementById("carry"),
      prompt: document.getElementById("prompt"),
    };
    this.panel = document.getElementById("panel");
    this.panelKicker = document.getElementById("panel-kicker");
    this.panelTitle = document.getElementById("panel-title");
    this.panelText = document.getElementById("panel-text");
    this.panelExtra = document.getElementById("panel-extra");
    this.menuActions = document.getElementById("menu-actions");
    this.panelPrompt = document.getElementById("panel-prompt");
    this.fade = document.getElementById("fade");

    this.showTitle();
    this.loop();
  }

  /* ------------------------------------------------------------ panels */

  showPanel(kicker, title, text, { prompt = "PRESS ENTER", extra = "", actions = [] } = {}) {
    this.panel.classList.remove("hidden");
    this.panelKicker.textContent = kicker;
    this.panelTitle.textContent = title;
    this.panelText.textContent = text;
    this.panelExtra.innerHTML = extra;
    this.panelPrompt.textContent = prompt;
    this.panelPrompt.style.display = actions.length ? "none" : "block";
    this.menuActions.innerHTML = "";
    for (const a of actions) {
      const b = document.createElement("button");
      b.textContent = a.label;
      if (a.secondary) b.classList.add("secondary");
      b.addEventListener("click", (e) => { e.stopPropagation(); a.onClick(); });
      this.menuActions.appendChild(b);
    }
  }

  hidePanel() {
    this.panel.classList.add("hidden");
    this.menuActions.innerHTML = "";
  }

  showTitle() {
    this.mode = "title";
    this.hud.root.classList.add("hidden");
    this.showPanel(
      "Grand Hotel · Night Shift",
      "ROOM SERVICE RUSH",
      "Load plates at the kitchen, sprint the halls, ride the lift between floors, and deliver to the right door before guests storm out. Chain deliveries for combo tips.",
      {
        actions: [
          { label: "START SHIFT", onClick: () => this.startShift() },
          { label: "UPGRADES", secondary: true, onClick: () => this.showHub() },
        ],
      }
    );
  }

  showHub() {
    this.mode = "hub";
    this.hud.root.classList.add("hidden");
    const rows = UPGRADES.map((u) => {
      const lvl = upgradeLevel(this.save, u.id);
      const maxed = lvl >= u.max;
      const cost = maxed ? "MAX" : `$${u.costs[lvl]}`;
      const disabled = maxed || !canBuy(this.save, u.id);
      return `<div class="upgrade-row">
        <div><div class="name">${u.name} Lv${lvl}/${u.max}</div>
        <div class="desc">${u.desc}</div></div>
        <button ${disabled ? "disabled" : ""} data-buy="${u.id}">${cost}</button>
      </div>`;
    }).join("");

    this.showPanel(
      `Bank $${this.save.tips} · Day ${this.save.day}`,
      "SERVICE STATION",
      "Spend your tips on better gear before clocking in.",
      {
        extra: `<div class="upgrade-grid">${rows}</div>`,
        actions: [
          { label: "START SHIFT", onClick: () => this.startShift() },
          { label: "BACK", secondary: true, onClick: () => this.showTitle() },
        ],
      }
    );

    this.panelExtra.querySelectorAll("[data-buy]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (buyUpgrade(this.save, btn.getAttribute("data-buy"))) {
          sfx.pickup();
          this.showHub();
        }
      });
    });
  }

  /* ------------------------------------------------------------ shift */

  startShift() {
    unlockAudio();
    sfx.start();
    this.mode = "play";
    this.hidePanel();
    this.hud.root.classList.remove("hidden");
    this.carrying = [];
    this.orders = [];
    this.floats = [];
    this.combo = 0;
    this.bestCombo = 0;
    this.tipsEarned = 0;
    this.delivered = 0;
    this.needed = 5 + Math.min(8, this.save.day);
    this.shiftTime = 130 + Math.min(90, this.save.day * 6);
    this.liftBusy = 0;
    this.floorIdx = 0;
    this.player.cx = 200;
    this.player.cy = 130;
    this.player.dir = "right";
    this.player.walk = 0;
    this.camX = this.clampCam(this.player.cx - VIEW_W / 2);
    this.spawnOrders(4);
    this.updateHud();
  }

  capacity() {
    return carryCapacity(this.save) + busboyCount(this.save);
  }

  spawnOrders(n) {
    for (let i = 0; i < n; i++) {
      if (this.orders.length >= 7) break;
      const pool = this.allRooms.filter(
        (r) => !this.orders.some((o) => o.room === r && !o.done)
      );
      if (!pool.length) break;
      const room = pool[(Math.random() * pool.length) | 0];
      const base = 42 + Math.random() * 22;
      const max = base * timerBonus(this.save);
      this.orders.push({
        id: Math.random().toString(36).slice(2, 8),
        room,
        food: FOODS[(Math.random() * FOODS.length) | 0],
        time: max,
        max,
        done: false,
      });
    }
  }

  /* ------------------------------------------------------------ loop */

  loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.update(dt);
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    // floats always animate
    for (const f of this.floats) { f.y += f.vy * dt; f.life -= dt; }
    this.floats = this.floats.filter((f) => f.life > 0);

    if (this.mode === "title" || this.mode === "hub") {
      if (pressed("confirm") && this.mode === "title") this.startShift();
      return;
    }
    if (this.mode === "clear" || this.mode === "fail") {
      if (pressed("confirm")) this.showHub();
      return;
    }

    this.liftBusy = Math.max(0, this.liftBusy - dt);
    this.shiftTime -= dt;

    // order timers
    for (const o of this.orders) {
      if (o.done) continue;
      o.time -= dt;
      if (o.time < -14) {
        o.done = true;
        this.combo = 0;
        this.carrying = this.carrying.filter((c) => c.id !== o.id);
        sfx.hurt();
        const info = this.roomInfo.get(o.room);
        this.addFloat(info.x, info.iy - 20, "WALKED OUT", "#ff5a7a");
        this.flashToast(`Room ${o.room} gave up!`);
      }
    }

    this.updatePlayer(dt);

    if (this.liftBusy <= 0) {
      if (pressed("interact")) this.interact();
      if (pressed("elevator")) this.useElevator();
    }

    this.updatePrompt();
    this.updateHud();

    // keep the board stocked
    const active = this.orders.filter((o) => !o.done).length;
    if (active < 3) this.spawnOrders(2);

    if (this.shiftTime <= 0) { this.endShift(this.delivered >= Math.ceil(this.needed * 0.6)); return; }
    if (this.delivered >= this.needed) { this.endShift(true); return; }
  }

  updatePlayer(dt) {
    let vx = 0;
    let vy = 0;
    if (held("left")) vx -= 1;
    if (held("right")) vx += 1;
    if (held("up")) vy -= 1;
    if (held("down")) vy += 1;

    const sprinting = held("sprint") && sprintPower(this.save) > 0;
    const speed = (92 + upgradeLevel(this.save, "speed") * 16) * (sprinting ? 1 + sprintPower(this.save) * 0.3 : 1);

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const len = Math.hypot(vx, vy);
      vx /= len; vy /= len;
      this.player.cx += vx * speed * dt;
      this.player.cy += vy * speed * dt;
      // facing: dominant axis
      if (Math.abs(vx) > Math.abs(vy)) this.player.dir = vx > 0 ? "right" : "left";
      else this.player.dir = vy > 0 ? "down" : "up";
      this.player.walk += dt;
    } else {
      this.player.walk = 0;
    }

    // clamp to corridor band
    this.player.cx = Math.max(WALK.x0, Math.min(WALK.x1, this.player.cx));
    this.player.cy = Math.max(WALK.y0, Math.min(WALK.y1, this.player.cy));

    // camera
    const targetCam = this.clampCam(this.player.cx - VIEW_W / 2);
    this.camX += (targetCam - this.camX) * Math.min(1, dt * 10);
  }

  clampCam(x) {
    return Math.max(0, Math.min(WORLD_W - VIEW_W, x));
  }

  /* ------------------------------------------------------------ actions */

  nearestDoor() {
    const doors = this.floors[this.floorIdx].doors;
    let best = null;
    let bestD = 20;
    for (const d of doors) {
      const dd = Math.hypot(this.player.cx - d.ix, this.player.cy - d.iy);
      if (dd < bestD) { best = d; bestD = dd; }
    }
    return best;
  }

  atKitchen() { return this.player.cx < KITCHEN_X; }

  // Returns the reposition target if the player is at any lift, else null.
  liftAt() {
    const p = this.player;
    if (p.cx > ELEVATOR_X) return { cx: ELEVATOR_X - 26, cy: p.cy };
    for (const m of MID_LIFTS) {
      if (Math.abs(p.cx - m.x) < m.reach && p.cy < 130) return { cx: m.x, cy: m.reCy };
    }
    return null;
  }

  interact() {
    if (this.atKitchen()) { this.loadFromKitchen(); return; }
    const door = this.nearestDoor();
    if (door) this.deliverTo(door);
  }

  loadFromKitchen() {
    if (this.carrying.length >= this.capacity()) {
      this.flashToast("Tray full!");
      return;
    }
    const waiting = this.orders
      .filter((o) => !o.done && !this.carrying.some((c) => c.id === o.id))
      .sort((a, b) => a.time - b.time);
    if (!waiting.length) { this.flashToast("No tickets up"); return; }

    const slots = this.capacity() - this.carrying.length;
    const take = waiting.slice(0, slots);
    for (const o of take) this.carrying.push(o);
    sfx.pickup();
    this.flashToast(`Loaded ${take.length} · ${take.map((o) => o.room).join(",")}`);
    this.addFloat(this.player.cx, this.player.cy - 26, "LOADED", "#40d0a0");
  }

  deliverTo(door) {
    const idx = this.carrying.findIndex((c) => c.room === door.room);
    if (idx < 0) {
      if (this.carrying.length) this.flashToast(`Not for room ${door.room}`);
      return;
    }
    const item = this.carrying.splice(idx, 1)[0];
    const order = this.orders.find((o) => o.id === item.id);
    if (order) order.done = true;
    this.delivered++;

    const onTime = item.time > 0;
    if (onTime) this.combo++; else this.combo = 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = 1 + Math.floor(this.combo / 3) * 0.5;
    const speedBonus = onTime ? Math.max(0, (item.time / item.max) * 14) | 0 : 0;
    const tip = Math.round((10 + speedBonus) * (onTime ? mult : 0.4));

    this.tipsEarned += tip;
    this.save.tips += tip;
    writeSave(this.save);
    sfx.win();

    this.addFloat(door.x, door.iy - 22, `+$${tip}`, onTime ? "#f0c040" : "#ff9a5a");
    if (onTime && this.combo >= 3) {
      this.addFloat(door.x, door.iy - 34, `COMBO x${mult.toFixed(1)}`, "#ff5a7a");
    }
    this.flashToast(onTime ? `Delivered ${item.food}! +$${tip}` : `Late… +$${tip}`);
  }

  useElevator() {
    const l = this.liftAt();
    if (!l) return;
    this.liftBusy = 1;
    sfx.jump();
    this.fade.style.opacity = "1";
    setTimeout(() => {
      this.floorIdx = this.floorIdx === 0 ? 1 : 0;
      this.player.cx = l.cx;
      this.player.cy = l.cy;
      this.camX = this.clampCam(this.player.cx - VIEW_W / 2);
      this.fade.style.opacity = "0";
      this.flashToast(`Floor ${this.floorIdx + 1}`);
    }, 220);
  }

  /* ------------------------------------------------------------ helpers */

  addFloat(x, y, text, color) {
    this.floats.push({ x, y, vy: -18, text, color, life: 1.1 });
  }

  flashToast(msg) {
    this.toast = msg;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { this.toast = ""; }, 1500);
  }

  endShift(success) {
    if (success) {
      this.mode = "clear";
      this.save.day += 1;
      this.save.bestDay = Math.max(this.save.bestDay, this.save.day);
      writeSave(this.save);
      sfx.win();
      this.showPanel(
        `Day ${this.save.day - 1} cleared`,
        "SHIFT COMPLETE",
        `Delivered ${this.delivered}. Best combo x${this.bestCombo}. Tips this shift $${this.tipsEarned}. Bank $${this.save.tips}.`,
        { prompt: "PRESS ENTER — SPEND TIPS" }
      );
    } else {
      this.mode = "fail";
      sfx.hurt();
      this.showPanel(
        "Guests furious",
        "SHIFT FAILED",
        `Only ${this.delivered}/${this.needed} delivered. Tips kept $${this.tipsEarned}.`,
        { prompt: "PRESS ENTER — TRY AGAIN" }
      );
    }
    this.hud.root.classList.add("hidden");
  }

  /* ------------------------------------------------------------ HUD */

  updatePrompt() {
    const el = this.hud.prompt;
    if (this.atKitchen()) {
      el.textContent = "SPACE — Load tray";
      el.classList.remove("hidden");
    } else if (this.liftAt()) {
      el.textContent = `F — Lift to floor ${this.floorIdx === 0 ? 2 : 1}`;
      el.classList.remove("hidden");
    } else {
      const door = this.nearestDoor();
      if (door) {
        const match = this.carrying.find((c) => c.room === door.room);
        el.textContent = match ? `SPACE — Deliver to ${door.room}` : `Room ${door.room}`;
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
  }

  updateHud() {
    this.hud.day.textContent = `DAY ${this.save.day}`;
    this.hud.tips.textContent = `$${this.save.tips}`;
    this.hud.floor.textContent = `FL ${this.floorIdx + 1}`;
    const t = Math.max(0, Math.ceil(this.shiftTime));
    this.hud.timer.textContent = `${(t / 60) | 0}:${String(t % 60).padStart(2, "0")}`;
    this.hud.combo.textContent = this.combo >= 2 ? `COMBO x${this.combo}` : "";

    this.hud.carry.textContent = this.toast
      ? this.toast
      : this.carrying.length
        ? "TRAY: " + this.carrying.map((c) => c.room).join(" ")
        : "TRAY EMPTY";

    this.hud.orders.innerHTML = this.orders
      .filter((o) => !o.done)
      .sort((a, b) => a.time - b.time)
      .slice(0, 5)
      .map((o) => {
        const late = o.time < 0;
        const loaded = this.carrying.some((c) => c.id === o.id);
        const fl = Math.floor(o.room / 100);
        const pct = Math.max(0, Math.min(100, (o.time / o.max) * 100));
        return `<div class="order-chip ${late ? "late" : ""} ${loaded ? "loaded" : ""}">
          FL${fl} · ${o.room} ${o.food}
          <div class="meta">${late ? "LATE!" : `${Math.ceil(o.time)}s`}${loaded ? " · TRAY" : ""}</div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>`;
      })
      .join("");
  }

  /* ------------------------------------------------------------ draw */

  draw() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    if (this.mode === "title" || this.mode === "hub") {
      this.drawScene(this.time * 26 % (WORLD_W - VIEW_W));
      return;
    }
    this.drawScene(this.camX);
  }

  drawScene(camX) {
    const ctx = this.ctx;
    camX = Math.round(camX);
    const fl = this.floors[this.floorIdx] || this.floors[0];
    ctx.drawImage(fl.canvas, camX, 0, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

    if (this.mode === "play") {
      this.drawMarkers(ctx, camX);
      drawWaiter(
        ctx,
        this.player.cx - camX,
        this.player.cy,
        this.player.dir,
        this.player.walk,
        this.carrying.length > 0
      );
    }

    // floating texts
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "7px monospace";
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = "#000";
      ctx.fillText(f.text, f.x - camX + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - camX, f.y);
    }
    ctx.globalAlpha = 1;
  }

  drawMarkers(ctx, camX) {
    const doors = this.floors[this.floorIdx].doors;
    const bob = Math.sin(this.time * 6) * 2;
    for (const d of doors) {
      const carried = this.carrying.some((c) => c.room === d.room);
      const pending = hasRadio(this.save) && this.orders.some((o) => !o.done && o.room === d.room);
      const sx = d.x - camX;
      if (carried) {
        // bouncing gold diamond
        const my = (d.side === "top" ? d.iy - 26 : d.iy + 18) + bob;
        ctx.fillStyle = "#f0c040";
        ctx.save();
        ctx.translate(sx, my);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
        ctx.fillStyle = "#7a5a10";
        ctx.fillRect(sx - 1, my - 1, 2, 2);
      } else if (pending) {
        const my = d.side === "top" ? d.iy - 20 : d.iy + 14;
        ctx.fillStyle = "#ff5a7a";
        ctx.fillRect(sx - 1, my, 3, 3);
      }
    }
  }
}
