import { input, initInput } from "./input.js";
import { startGame } from "./game.js";
import { createWillieWagtail, updateBird, setBirdMessage } from "./bird.js";
import { createWorld } from "./world.js";
import { updateFlightPhysics } from "./flightPhysics.js";
import { createCamera, updateCamera } from "./camera.js";
import { resolveCollisions, tryPerch } from "./collision.js";
import { renderScene } from "./renderer.js";
import { searchGround, useNest } from "./foraging.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const world = createWorld();
const bird = createWillieWagtail();
const camera = createCamera(canvas.width, canvas.height);
updateCamera(camera, bird);

function update(dt) {
  const previous = { x: bird.x, y: bird.y, altitude: bird.altitude };
  world.time += dt;
  updateBird(bird, input, dt);
  updateFlightPhysics(bird, dt, world);
  resolveCollisions(bird, world, previous);

  for (const action of input.actions.splice(0)) {
    if (action === "Space") searchGround(bird, world);
    if (action === "KeyE") useNest(bird, world);
    if (action === "KeyF" && !tryPerch(bird, world))
      setBirdMessage(bird, "Get closer to a branch, at its height, to perch");
  }
  world.mate.phase += dt * 6;
  updateCamera(camera, bird);
}

function render() {
  renderScene(ctx, world, bird, camera);
}

initInput();
startGame(update, render);
