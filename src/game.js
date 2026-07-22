import { held, pressed } from "./input.js?v=mid5";
import { sfx, unlockAudio } from "./audio.js?v=mid5";
import {
  loadSave, writeSave, UPGRADES, buyUpgrade, canBuy, upgradeLevel,
  carryCapacity, timerBonus, sprintPower, hasRadio, busboyCount, hasBusboyMode,
} from "./meta.js?v=mid5";
import {
  buildFloor, drawWaiter, WORLD_W, WALK, KITCHEN_X, ELEVATOR_X, MID_LIFTS,
} from "./sprites.js?v=mid5";

const VIEW_W = 360;
const VIEW_H = 240;
const FOODS = ["STEAK", "SOUP", "CLUB", "BUBBLY", "PASTA", "CAKE", "COFFEE", "TART"];
const DIRTY = ["PLATES", "GLASSES", "TRAY", "CUPS", "NAPKINS", "CART"];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    this.save = loadSave();
    this.mode = "title";
    this.job = "waiter"; // waiter | busboy
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
    this.earlyBonus = 0;
    this.delivered = 0;
    this.needed = 5;
    this.shiftTime = 100;
    this.rushTimer = 0;
    this.liftBusy = 0;
    this.toast = "";
    this._toastT = 0;

    this.hud = {
      root: document.getElementById("hud"),
      day: document.getElementById("hud-day"),
      tips: document.getElementById("hud-tips"),
      floor: document.getElementById("hud-floor"),
      goal: document.getElementById("hud-goal"),
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
      "Pick your post. Waiters run hot plates to rooms. Busboys clear dirty trays from the halls and dump them back at the kitchen.",
      {
        actions: [
          { label: "CHOOSE SHIFT", onClick: () => this.showRoleSelect() },
          { label: "UPGRADES", secondary: true, onClick: () => this.showHub() },
        ],
      }
    );
  }

  showRoleSelect() {
    this.mode = "title";
    this.hud.root.classList.add("hidden");
    const unlocked = hasBusboyMode(this.save);
    const actions = [
      { label: "WAITER", onClick: () => this.startShift("waiter") },
    ];
    if (unlocked) {
      actions.push({ label: "BUSBOY", onClick: () => this.startShift("busboy") });
    } else {
      actions.push({
        label: "BUSBOY (LOCKED)",
        secondary: true,
        onClick: () => {
          this.panelText.textContent = "Busboy unlocks after you clear a waiter shift (finish day 1).";
        },
      });
    }
    actions.push({ label: "BACK", secondary: true, onClick: () => this.showTitle() });

    this.showPanel(
      unlocked ? "Staff roster open" : "Trainee · clear day 1 to unlock busboy",
      "PICK YOUR POST",
      unlocked
        ? "WAITER: load at kitchen, deliver to doors.\nBUSBOY: grab dirty trays from doors, dump at the kitchen."
        : "Start as a waiter. Survive your first night and the busboy post unlocks.",
      { actions }
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
          { label: "CHOOSE SHIFT", onClick: () => this.showRoleSelect() },
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

  startShift(job = "waiter") {
    unlockAudio();
    sfx.start();
    this.job = job === "busboy" ? "busboy" : "waiter";
    this.mode = "play";
    this.hidePanel();
    this.hud.root.classList.remove("hidden");
    this.carrying = [];
    this.orders = [];
    this.floats = [];
    this.combo = 0;
    this.bestCombo = 0;
    this.tipsEarned = 0;
    this.earlyBonus = 0;
    this.delivered = 0;
    this.needed = this.quotaForShift();
    this.shiftTime = 90 + Math.min(50, this.save.day * 3);
    this.rushTimer = 28 + Math.random() * 10;
    this.liftBusy = 0;
    this._closingToast = false;
    this.floorIdx = 0;
    this.player.cx = this.job === "busboy" ? 280 : 200;
    this.player.cy = 130;
    this.player.dir = "right";
    this.player.walk = 0;
    this.camX = this.clampCam(this.player.cx - VIEW_W / 2);
    this.spawnJobs(this.boardTarget());
    this.flashToast(this.job === "busboy" ? "BUSBOY SHIFT" : "WAITER SHIFT");
    this.updateHud();
  }

  /** How many clears this shift demands — scales with day AND upgrades. */
  quotaForShift() {
    const power =
      upgradeLevel(this.save, "speed") +
      upgradeLevel(this.save, "trolley") +
      busboyCount(this.save) +
      sprintPower(this.save);
    const base = this.job === "busboy" ? 8 : 6;
    return base + Math.min(10, this.save.day) + power * 2;
  }

  /** Keep roughly tray/bin capacity + buffer live. */
  boardTarget() {
    const extra = this.job === "busboy" ? 1 : 0;
    return Math.min(
      this.allRooms.length,
      this.capacity() + 2 + extra + Math.min(3, (this.save.day / 2) | 0)
    );
  }

  capacity() {
    return carryCapacity(this.save) + busboyCount(this.save);
  }

  activeCount() {
    return this.orders.filter((o) => !o.done).length;
  }

  spawnJobs(n) {
    return this.job === "busboy" ? this.spawnDirty(n) : this.spawnOrders(n);
  }

  spawnOrders(n) {
    const maxBoard = Math.max(this.boardTarget() + 1, 8);
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      if (this.activeCount() >= maxBoard) break;
      const pool = this.allRooms.filter(
        (r) => !this.orders.some((o) => o.room === r && !o.done)
      );
      if (!pool.length) break;
      const room = pool[(Math.random() * pool.length) | 0];
      const base = 34 + Math.random() * 18;
      const max = base * timerBonus(this.save);
      this.orders.push({
        id: Math.random().toString(36).slice(2, 8),
        room,
        food: FOODS[(Math.random() * FOODS.length) | 0],
        kind: "order",
        time: max,
        max,
        done: false,
      });
      spawned++;
    }
    return spawned;
  }

  spawnDirty(n) {
    const maxBoard = Math.max(this.boardTarget() + 1, 9);
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      if (this.activeCount() >= maxBoard) break;
      const pool = this.allRooms.filter(
        (r) => !this.orders.some((o) => o.room === r && !o.done)
      );
      if (!pool.length) break;
      const room = pool[(Math.random() * pool.length) | 0];
      // Dirty rooms are impatient — slightly shorter timers
      const base = 28 + Math.random() * 16;
      const max = base * timerBonus(this.save);
      this.orders.push({
        id: Math.random().toString(36).slice(2, 8),
        room,
        food: DIRTY[(Math.random() * DIRTY.length) | 0],
        kind: "dirty",
        time: max,
        max,
        done: false,
      });
      spawned++;
    }
    return spawned;
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
      if (pressed("confirm") && this.mode === "title") this.showRoleSelect();
      return;
    }
    if (this.mode === "clear" || this.mode === "fail") {
      if (pressed("confirm")) this.showHub();
      return;
    }

    this.liftBusy = Math.max(0, this.liftBusy - dt);

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
        this.flashToast(this.job === "busboy" ? `Room ${o.room} complained!` : `Room ${o.room} gave up!`);
      }
    }

    this.updatePlayer(dt);

    if (this.liftBusy <= 0) {
      if (pressed("interact")) this.interact();
      if (pressed("elevator")) this.useElevator();
    }

    // No tickets left (board + tray empty) → race the clock; don't refill.
    const idle = this.activeCount() === 0 && this.carrying.length === 0;

    // Rush waves keep pressure while tickets are still out
    if (!idle && this.delivered < this.needed) {
      this.rushTimer -= dt;
      if (this.rushTimer <= 0) {
        this.rushTimer = 34 + Math.random() * 12;
        const need = Math.max(0, this.boardTarget() - this.activeCount());
        const dumped = this.spawnJobs(Math.max(need, Math.min(3, this.capacity() + 1)));
        if (dumped > 0) {
          sfx.jump();
          this.flashToast(this.job === "busboy" ? "DIRTY RUSH!" : "RUSH HOUR!");
          this.addFloat(this.player.cx, this.player.cy - 28, "RUSH!", "#ff5a7a");
        }
      }
    }

    this.shiftTime -= dt * (idle ? 14 : 1);
    if (idle) {
      if (!this._closingToast) {
        this._closingToast = true;
        this.flashToast(this.job === "busboy" ? "No trays — wrapping up" : "No tickets — wrapping up");
      }
    } else {
      this._closingToast = false;
    }

    this.updatePrompt();
    this.updateHud();

    if (this.delivered >= this.needed) {
      this.endShift(true);
      return;
    }
    if (this.shiftTime <= 0) {
      this.endShift(this.delivered >= Math.ceil(this.needed * 0.6));
    }
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
    if (this.job === "busboy") {
      this.interactBusboy();
      return;
    }
    if (this.atKitchen()) { this.loadFromKitchen(); return; }
    const door = this.nearestDoor();
    if (door) this.deliverTo(door);
  }

  interactBusboy() {
    if (this.atKitchen()) {
      this.dumpAtKitchen();
      return;
    }
    const door = this.nearestDoor();
    if (door) this.pickupDirty(door);
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

  pickupDirty(door) {
    if (this.carrying.length >= this.capacity()) {
      this.flashToast("Bin full — dump at kitchen");
      return;
    }
    const job = this.orders.find(
      (o) => !o.done && o.room === door.room && !this.carrying.some((c) => c.id === o.id)
    );
    if (!job) {
      this.flashToast(this.orders.some((o) => !o.done && o.room === door.room) ? "Already grabbed" : "Room is clean");
      return;
    }
    this.carrying.push(job);
    sfx.pickup();
    this.addFloat(door.x, door.iy - 22, "GRABBED", "#40d0a0");
    this.flashToast(`${job.food} from ${door.room}`);
  }

  dumpAtKitchen() {
    if (!this.carrying.length) {
      this.flashToast("Bin empty — clear rooms");
      return;
    }
    let tips = 0;
    let onTimeCount = 0;
    for (const item of this.carrying) {
      const order = this.orders.find((o) => o.id === item.id);
      if (order) order.done = true;
      this.delivered++;
      const onTime = item.time > 0;
      if (onTime) {
        this.combo++;
        onTimeCount++;
      } else {
        this.combo = 0;
      }
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mult = 1 + Math.floor(this.combo / 3) * 0.5;
      const speedBonus = onTime ? Math.max(0, (item.time / item.max) * 10) | 0 : 0;
      tips += Math.round((8 + speedBonus) * (onTime ? mult : 0.4));
    }
    const n = this.carrying.length;
    this.carrying = [];
    this.tipsEarned += tips;
    this.save.tips += tips;
    writeSave(this.save);
    sfx.win();
    this.addFloat(this.player.cx, this.player.cy - 26, `+$${tips}`, "#f0c040");
    if (onTimeCount >= 2) {
      this.addFloat(this.player.cx, this.player.cy - 38, `COMBO x${this.combo}`, "#ff5a7a");
    }
    this.flashToast(`Dumped ${n} · +$${tips}`);
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
      this.earlyBonus = 0;
      if (this.shiftTime > 0) {
        this.earlyBonus = Math.max(10, Math.round(this.shiftTime * 0.45));
        this.tipsEarned += this.earlyBonus;
        this.save.tips += this.earlyBonus;
      }
      this.mode = "clear";
      this.save.day += 1;
      this.save.bestDay = Math.max(this.save.bestDay, this.save.day);
      const justUnlocked = !this.save.unlockedBusboy && this.save.day >= 2;
      this.save.unlockedBusboy = true;
      writeSave(this.save);
      sfx.win();
      const earlyLine = this.earlyBonus
        ? ` Early clear bonus +$${this.earlyBonus}.`
        : "";
      const unlockLine = justUnlocked ? " Busboy shift unlocked!" : "";
      const verb = this.job === "busboy" ? "Cleared" : "Delivered";
      this.showPanel(
        `${this.job === "busboy" ? "Busboy" : "Waiter"} · Day ${this.save.day - 1}`,
        "SHIFT COMPLETE",
        `${verb} ${this.delivered}/${this.needed}. Best combo x${this.bestCombo}. Tips $${this.tipsEarned}.${earlyLine}${unlockLine} Bank $${this.save.tips}.`,
        { prompt: "PRESS ENTER — SPEND TIPS" }
      );
    } else {
      this.mode = "fail";
      sfx.hurt();
      const verb = this.job === "busboy" ? "cleared" : "delivered";
      this.showPanel(
        "Guests furious",
        "SHIFT FAILED",
        `Only ${this.delivered}/${this.needed} ${verb}. Tips kept $${this.tipsEarned}.`,
        { prompt: "PRESS ENTER — TRY AGAIN" }
      );
    }
    this.hud.root.classList.add("hidden");
  }

  /* ------------------------------------------------------------ HUD */

  updatePrompt() {
    const el = this.hud.prompt;
    if (this.job === "busboy") {
      if (this.atKitchen()) {
        el.textContent = this.carrying.length ? "SPACE — Dump dirty bin" : "Kitchen pass";
        el.classList.remove("hidden");
      } else if (this.liftAt()) {
        el.textContent = `F — Lift to floor ${this.floorIdx === 0 ? 2 : 1}`;
        el.classList.remove("hidden");
      } else {
        const door = this.nearestDoor();
        if (door) {
          const dirty = this.orders.find(
            (o) => !o.done && o.room === door.room && !this.carrying.some((c) => c.id === o.id)
          );
          el.textContent = dirty
            ? `SPACE — Grab ${dirty.food} (${door.room})`
            : `Room ${door.room}`;
          el.classList.remove("hidden");
        } else {
          el.classList.add("hidden");
        }
      }
      return;
    }

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
    this.hud.floor.textContent = this.job === "busboy" ? `BB · FL ${this.floorIdx + 1}` : `FL ${this.floorIdx + 1}`;
    if (this.hud.goal) this.hud.goal.textContent = `${this.delivered}/${this.needed}`;
    const t = Math.max(0, Math.ceil(this.shiftTime));
    this.hud.timer.textContent = `${(t / 60) | 0}:${String(t % 60).padStart(2, "0")}`;
    this.hud.combo.textContent = this.combo >= 2 ? `COMBO x${this.combo}` : "";

    if (this.toast) {
      this.hud.carry.textContent = this.toast;
    } else if (this.job === "busboy") {
      this.hud.carry.textContent = this.carrying.length
        ? `BIN: ${this.carrying.map((c) => c.room).join(" ")}`
        : "BIN EMPTY";
    } else {
      this.hud.carry.textContent = this.carrying.length
        ? "TRAY: " + this.carrying.map((c) => c.room).join(" ")
        : "TRAY EMPTY";
    }

    this.hud.orders.innerHTML = this.orders
      .filter((o) => !o.done)
      .sort((a, b) => a.time - b.time)
      .slice(0, 5)
      .map((o) => {
        const late = o.time < 0;
        const loaded = this.carrying.some((c) => c.id === o.id);
        const fl = Math.floor(o.room / 100);
        const pct = Math.max(0, Math.min(100, (o.time / o.max) * 100));
        const tag = this.job === "busboy" ? "DIRTY" : o.food;
        const held = this.job === "busboy" ? (loaded ? " · BIN" : "") : (loaded ? " · TRAY" : "");
        return `<div class="order-chip ${late ? "late" : ""} ${loaded ? "loaded" : ""}">
          FL${fl} · ${o.room} ${tag}
          <div class="meta">${late ? "LATE!" : `${Math.ceil(o.time)}s`}${held}</div>
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
        this.carrying.length > 0,
        this.job
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
      const sx = d.x - camX;
      const pending = this.orders.some(
        (o) => !o.done && o.room === d.room && !this.carrying.some((c) => c.id === o.id)
      );
      const held = this.job === "waiter" && this.carrying.some((c) => c.room === d.room);
      const radio = hasRadio(this.save) && pending;

      if (this.job === "busboy" && pending) {
        // dirty pile marker
        const my = (d.side === "top" ? d.iy - 18 : d.iy + 12) + bob * 0.5;
        ctx.fillStyle = "#8a6040";
        ctx.fillRect(sx - 4, my, 8, 5);
        ctx.fillStyle = "#d2dae2";
        ctx.fillRect(sx - 3, my - 2, 3, 2);
        ctx.fillRect(sx, my - 3, 3, 2);
      } else if (held) {
        const my = (d.side === "top" ? d.iy - 26 : d.iy + 18) + bob;
        ctx.fillStyle = "#f0c040";
        ctx.save();
        ctx.translate(sx, my);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
        ctx.fillStyle = "#7a5a10";
        ctx.fillRect(sx - 1, my - 1, 2, 2);
      } else if (radio) {
        const my = d.side === "top" ? d.iy - 20 : d.iy + 14;
        ctx.fillStyle = this.job === "busboy" ? "#c9a24a" : "#ff5a7a";
        ctx.fillRect(sx - 1, my, 3, 3);
      }
    }
  }
}
