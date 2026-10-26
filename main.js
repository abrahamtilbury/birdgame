import { input, initInput } from "./input.js";
import { startGame } from "./game.js";
import { createWillieWagtail, updateBird } from "./bird.js";

// Initialise Canvas
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

ctx.imageSmoothingEnabled = false;

// Draw a filled circle
function drawCircle(x, y, radius, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Draw the ground
function drawGround() {
  ctx.fillStyle = "#8DA789";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

// Draw a tree trunk viewed from above
function drawTree(x, y, radius) {
  drawCircle(x, y, radius + 4, "#4F6043");
  drawCircle(x, y, radius, "#70543B");
  drawCircle(x, y, radius * 0.7, "#94714C");
  drawCircle(x, y, radius * 0.35, "#70543B");
}

// Draw a shrub viewed from above
function drawShrub(x, y) {
  drawCircle(x, y, 14, "#426D43");
  drawCircle(x - 5, y - 4, 9, "#60915A");
  drawCircle(x + 6, y + 3, 8, "#527E4B");
}

// Draw the bird viewed directly from above
function drawBird(x, y) {
  ctx.save();
  ctx.translate(x, y);

  // Tail
  ctx.fillStyle = "#252D35";
  ctx.fillRect(-5, 12, 10, 30);

  // Left wing
  ctx.beginPath();
  ctx.moveTo(-10, -8);
  ctx.lineTo(-65, -25);
  ctx.lineTo(-74, -10);
  ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.fill();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(10, -8);
  ctx.lineTo(65, -25);
  ctx.lineTo(74, -10);
  ctx.lineTo(12, 12);
  ctx.closePath();
  ctx.fill();

  // White wing markings
  ctx.strokeStyle = "#E9E9E2";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-57, -13);
  ctx.moveTo(18, 0);
  ctx.lineTo(57, -13);
  ctx.stroke();

  // Body
  ctx.fillStyle = "#293139";
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 23, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  drawCircle(0, -20, 12, "#252D35");

  // Beak
  ctx.fillStyle = "#D9AA55";
  ctx.beginPath();
  ctx.moveTo(-4, -28);
  ctx.lineTo(0, -38);
  ctx.lineTo(4, -28);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Draw the complete scene
function render() {
  drawGround();

  // Trees
  drawTree(140, 140, 25);
  drawTree(510, 190, 32);
  drawTree(160, 490, 20);

  // Shrubs
  drawShrub(80, 310);
  drawShrub(475, 450);
  drawShrub(565, 550);

  // Bird remains in centre
  drawBird(WIDTH / 2, HEIGHT / 2);
  
  ctx.fillStyle = "#213721";
  ctx.font = "16px monospace";
  
  ctx.fillText(`Pitch: ${bird.pitch}`, 16, 26);
  ctx.fillText(
  `Wings: ${bird.leftWing} / ${bird.rightWing}`,
  16, 46
);

}

// Start keyboard controls
initInput();

// Draw first frame

function update(deltaTime) {
  updateBird(bird, input, deltaTime);
}

startGame(update, render);