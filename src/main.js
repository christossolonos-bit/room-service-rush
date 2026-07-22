import { Game } from "./game.js?v=mid5";

const canvas = document.getElementById("game");
const game = new Game(canvas);

// debug: open with /#autostart to jump straight into a shift
if (location.hash.startsWith("#autostart")) game.startShift();
