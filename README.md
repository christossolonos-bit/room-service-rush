# Room Service Rush

**A pixel-art arcade game about the most stressful job in a five-star hotel: room service on the night shift.**

Grab plates at the kitchen pass, weave your trolley through the corridors, ride the lifts between floors, and get every order to the right door *before* the guests lose their patience. Chain deliveries to build combo tips, then blow your earnings on better gear before the next shift. Miss too many and the complaints pile up.

No installs, no build step, no dependencies — it's a single HTML canvas game that runs straight in your browser.

---

## Quick start

You need **Python 3** (for the tiny local server) and any modern browser.

**Windows — easiest way:**

Double-click **`play.bat`**. It launches the server and opens the game automatically.

**Any OS — from a terminal:**

```bash
python serve.py
```

Then open **http://127.0.0.1:5173** in your browser.

> Tip: if the page ever looks stale after an update, press **Ctrl+Shift+R** for a hard refresh. (The included server already sends no-cache headers to help.)

---

## How to play

You're a waiter pushing a service trolley. Every guest ticket shows a **room number**, a **dish**, and a **countdown**. Your job:

1. **Load up** at the **KITCHEN** (far left of the corridor). Press **Space** to fill your tray with the most urgent tickets, up to your trolley's capacity.
2. **Deliver** by walking up to the matching **room door** and pressing **Space**. A gold diamond bounces over doors you're carrying an order for.
3. **Change floors** using a **LIFT**. There are lifts in the middle of the corridor *and* at the end — walk into one and press **F**. You'll step out at the matching lift on the other floor.
4. **Beat the shift goal**: deliver the required number of orders before the timer hits zero.

### Controls

| Action | Keys |
| --- | --- |
| Move | **W A S D** or **Arrow keys** |
| Load tray / Deliver | **Space** |
| Take the lift (change floor) | **F** |
| Sprint | **Shift** *(requires the Rush Cart upgrade)* |
| Confirm menus | **Enter** or click a button |

### Tips & combos

- **On-time deliveries build a combo.** Every few in a row bumps your tip multiplier — the longer the streak, the fatter the tips.
- **Deliver early for bonuses.** The more time left on a ticket, the bigger the reward.
- **Late is better than never** — you'll still get a small tip, but your combo resets.
- **Don't let guests walk out.** If a ticket's timer runs far into the red, the guest gives up, you lose the order, and your combo breaks.
- **Plan your trips.** Load several same-floor orders at once, then sweep the corridor and hop a lift for the rest.

---

## Upgrades

Tips you bank carry over between shifts. Spend them at the **Service Station** (the "Upgrades" menu) to make each night easier:

| Upgrade | What it does |
| --- | --- |
| **Service Sneakers** | Move faster through the halls |
| **Service Trolley** | Carry more orders at once |
| **Cloche Covers** | Guest timers last longer |
| **Hire Busboy** | An extra pair of hands — more tray capacity |
| **Hall Radio** | Highlights doors that have pending orders |
| **Rush Cart** | Unlocks a Shift-to-sprint burst of speed |

Each day gets a little tougher: more orders to deliver and a tighter clock. Survive, upgrade, repeat.

---

## Under the hood

- **Pure front-end.** Plain HTML + CSS + vanilla JavaScript (ES modules). No frameworks, no bundler.
- **Everything is drawn procedurally** to a `<canvas>` at a low internal resolution and scaled up crisp for that chunky pixel-art look — the hotel, the sprites, and the waiter's walk cycle are all generated in code.
- **`serve.py`** is a minimal static server that sends no-cache headers so you always get the latest build during development.

### Project layout

```
index.html      Game shell + HUD markup
style.css       Arcade-cabinet styling (CRT scanlines, pixel font)
serve.py        No-cache local dev server
play.bat        One-click launcher for Windows
src/
  main.js       Entry point
  game.js       Game loop, state, orders, scoring, camera
  sprites.js    Procedural waiter sprite + hotel-floor renderer
  input.js      Keyboard handling
  audio.js      Web Audio sound effects
  meta.js       Save data + the upgrade system
```

---

## Save data

Your day count, banked tips, and purchased upgrades are stored in your browser's `localStorage`. Clearing your site data resets your progress and starts a fresh career.

---

Now clock in, keep those trays moving, and don't keep room 207 waiting.
