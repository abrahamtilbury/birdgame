
import { input, initInput } from "./input.js";
import { startGame } from "./game.js";
import { createWillieWagtail, updateBird } from "./bird.js";
import { createWorld, getTreeSection } from "./world.js";
import { updateFlightPhysics } from "./flightPhysics.js";
import { createCamera, updateCamera } from "./camera.js";

// Initialise Canvas
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

ctx.imageSmoothingEnabled = false;

// Initialise the world, bird and camera
const world = createWorld();
const bird = createWillieWagtail();
const camera = createCamera(WIDTH, HEIGHT);

updateCamera(camera, bird);

// Draw a filled circle
function drawCircle(x, y, radius, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Draw the ground
function drawGround() {
  ctx.fillStyle = world.groundColour;
  ctx.fillRect(0, 0, world.width, world.height);
}

// Draw a tree trunk viewed from above
function drawTree(x, y, radius) {
  drawCircle(x, y, radius + 4, "#4F6043");
  drawCircle(x, y, radius, "#70543B");
  drawCircle(x, y, radius * 0.7, "#94714C");
  drawCircle(x, y, radius * 0.35, "#70543B");
}

// Draw a shrub
function drawShrub(x, y, radius = 14) {
  drawCircle(x, y, radius, "#426D43");
  drawCircle(x - 5, y - 4, radius * 0.65, "#60915A");
  drawCircle(x + 6, y + 3, radius * 0.57, "#527E4B");
}

// Draw trees based on the bird's altitude
function drawWorldTrees() {
  for (const tree of world.trees) {
    const section = getTreeSection(tree, bird.altitude);

    // Canopy cross-section
    if (section.canopyRadius > 0) {
      drawCircle(
        tree.x,
        tree.y,
        section.canopyRadius,
        "#477D42"
      );
    }

    // Trunk cross-section
    if (section.trunkRadius > 0) {
      drawTree(
        tree.x,
        tree.y,
        section.trunkRadius
      );
    }

    // Branches at the current altitude
    for (const branch of section.branches) {
      ctx.strokeStyle = "#70543B";
      ctx.lineWidth = branch.width;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(tree.x + branch.x1, tree.y + branch.y1);
      ctx.lineTo(tree.x + branch.x2, tree.y + branch.y2);
      ctx.stroke();
    }
  }
}

// Draw vegetation near ground level
function drawWorldShrubs() {
  if (bird.altitude >= 2) return;

  for (const shrub of world.shrubs) {
    drawShrub(shrub.x, shrub.y, shrub.radius);
  }
}

// Draw the Willie Wagtail from above
function drawBird(x, y, heading = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);

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

// Draw diagnostic information
function drawDebugInfo() {
  ctx.fillStyle = "#213721";
  ctx.font = "16px monospace";

  ctx.fillText(`Pitch: ${bird.pitch}`, 16, 26);

  ctx.fillText(
    `Wings: ${bird.leftWing} / ${bird.rightWing}`,
    16, 46
  );

  ctx.fillText(
    `Altitude: ${bird.altitude.toFixed(2)} m`,
    16, 66
  );

  ctx.fillText(
    `Heading: ${(bird.heading * 180 / Math.PI).toFixed(0)}°`,
    16, 86
  );

  ctx.fillText(
    `Position: ${bird.x.toFixed(0)}, ${bird.y.toFixed(0)}`,
    16, 106
  );
}

// Render the complete game
function render() {
  // Clear the entire viewport
  ctx.fillStyle = "#324237";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Apply camera offset to the world
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawGround();
  drawWorldShrubs();
  drawWorldTrees();

  // Restore screen coordinates
  ctx.restore();

  // Keep bird visually centred
  drawBird(
    WIDTH / 2,
    HEIGHT / 2,
    bird.heading
  );

  // Debug information stays fixed on screen
  drawDebugInfo();
}

// Update the simulation
function update(deltaTime) {
  updateBird(bird, input, deltaTime);

  updateFlightPhysics(
    bird,
    deltaTime,
    world
  );

  updateCamera(camera, bird);
}

// Initialise keyboard input
initInput();

// Start the game
startGame(update, render);
