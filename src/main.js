import { input, initInput } from "./input.js";
import { startGame } from "./game.js";
import { createWillieWagtail, updateBird, setBirdMessage } from "./bird.js";
import { createWorld } from "./world.js";
import { updateFlightPhysics } from "./flightPhysics.js";
import { createCamera, updateCamera } from "./camera.js";
import { resolveCollisions, tryPerch } from "./collision.js";
import { renderScene } from "./renderer.js";
import { searchGround, useNest, dropCarriedItem } from "./foraging.js";
import { createBirdsong } from "./audio.js";
import { createFamilyMilestone } from "./milestones.js";
import { updateMate } from "./mateAI.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const world = createWorld();
const bird = createWillieWagtail();
const camera = createCamera(canvas.width, canvas.height);
updateCamera(camera, bird);

const gameElement = document.getElementById("game");
const birdsong = createBirdsong(document.getElementById('birdsongToggle'));
const familyMilestone = createFamilyMilestone(document.getElementById('familyMilestone'));
document.getElementById('milestonePreview').addEventListener('click', () => {
  familyMilestone.preview();
});
const audioPicker = document.getElementById('birdCallFile');
document.getElementById('birdCallLoad').addEventListener('click', () => audioPicker.click());
audioPicker.addEventListener('change', () => {
  if (birdsong.setFile(audioPicker.files?.[0])) {
    setBirdMessage(bird, 'Bird call selected. Tap Bird calls: Off to listen.', 5);
  }
});

const nestStatusEl = document.getElementById('nestStatus');
function updateNestStatus() {
  const nest = world.nest;
  const count = `Twig ${nest.progress.twig}/${nest.required.twig} · Grass ${nest.progress.grass}/${nest.required.grass}`;
  let status;
  if (nest.built) {
    status = `✅ Nest complete! ${count}. The mate will visit, then the family event unlocks.`;
  } else if (!nest.started) {
    status = `🪺 Nest not started · ${count}. Carry 1 twig to a branch, perch, press N.`;
  } else {
    const sameBranch = bird.perchedOn && bird.perchedOn.treeId === nest.treeId &&
      bird.perchedOn.branchId === nest.branchId;
    status = `🪺 Building nest · ${count}. ${sameBranch
      ? 'Press N to deposit the item in your beak.'
      : 'Return to your ORIGINAL nesting branch with material, perch, then press N.'}`;
  }
  if (nestStatusEl.textContent !== status) nestStatusEl.textContent = status;
}
updateNestStatus();

// Grounded: touchscreen 8/4/2/6 are brown direction arrows.
// Airborne: the same keys return to normal flight controls.
function syncTouchMode() {
  // Ground movement uses the separate WASD pad. Numpad always flies.
  input.touchGroundMode = false;
  gameElement.classList.remove('ground-touch-mode');
}

syncTouchMode();

// Read-only browser Console snapshot for diagnosing real keyboard behaviour.
window.birdFlightDebug = () => ({
  version: '0.12.3',
  altitude: Number(bird.altitude.toFixed(3)),
  verticalSpeed: Number(bird.velocityZ.toFixed(3)),
  flaps: bird.totalFlaps,
  lastKey: input.lastInput,

  lastHoldMs: input.lastHoldMs === null
    ? null
    : Number(input.lastHoldMs.toFixed(1)),
  
  lastWingGapMs: input.lastWingGapMs === null
    ? null
    : Number(input.lastWingGapMs.toFixed(1)),
  
  completedWingbeats: bird.completedWingbeats,
  
  lastStrokePower: Number(
    bird.lastStrokePower.toFixed(2)
  ),
  
  lastWingEvent: bird.lastWingEvent,
  grounded: bird.grounded,
  carrying: bird.carrying,
  pitch: bird.pitch,
  pitchVisual: Number(bird.pitchVisual.toFixed(3)),
  bank: Number(bird.bank.toFixed(3)),
  turnPulse: Number((bird.turnPulse || 0).toFixed(3)),
  headingDegrees: Number((bird.heading * 180 / Math.PI).toFixed(1)),
  flightMode: bird.flightMode,
  airspeed: Number((bird.airspeed || 0).toFixed(1)),
  yawRate: Number((bird.yawRate || 0).toFixed(2)),
  heldWingKeys: [...input.pressed].filter(code => /^Numpad[134679]$/.test(code)),
  birdCall: birdsong.status(),
  hunger: Number((bird.hunger ?? 80).toFixed(1)),
  leftWingFold: Number((bird.leftWingFold || 0).toFixed(2)),
  rightWingFold: Number((bird.rightWingFold || 0).toFixed(2)),
  nestStarted: world.nest.started,
  nestProgress: { ...world.nest.progress },
  nestRequired: { ...world.nest.required },
  nestBuilt: world.nest.built,
  onNestingBranch: !!bird.perchedOn && bird.perchedOn.treeId === world.nest.treeId &&
    bird.perchedOn.branchId === world.nest.branchId,
  familyStarted: !!world.nest.familyStarted,
  mate: { x: Number(world.mate.x.toFixed(1)), y: Number(world.mate.y.toFixed(1)),
    altitude: Number(world.mate.altitude.toFixed(2)) }
});

function update(dt) {
  if (familyMilestone.isOpen) {
    input.wingEvents.length = 0;
    input.actions.length = 0;
    return;
  }
  const previous = { x: bird.x, y: bird.y, altitude: bird.altitude };
  world.time += dt;
  updateBird(bird, input, dt);
  const actions = input.actions.splice(0);
  updateFlightPhysics(bird, dt, world);
  resolveCollisions(bird, world, previous);

  for (const action of actions) {
    
    if (action === 'KeyX') dropCarriedItem(bird, world);

    if (action === "Space") {
      if (bird.grounded) {
        if (bird.carrying) dropCarriedItem(bird, world);
        else searchGround(bird, world);
      }
      else if (bird.perchedOn) {
        if (bird.carrying) useNest(bird, world);
        else setBirdMessage(bird, 'Perched — find nesting material');
      }
      else if (tryPerch(bird, world)) setBirdMessage(bird,
        bird.carrying ? "Perched! Press N to use material in beak" :
          "Perched! Bring a twig and press N to begin a nest");
      else setBirdMessage(bird,
        "Fly near a branch at its height, then tap Space to grip (56px / 3m)");
    }
    if (action === "KeyN" || action === "KeyE") {
      // N may grab a nearby branch first when carrying a nesting item.
      if (!bird.grounded && !bird.perchedOn && bird.carrying) tryPerch(bird, world);
      useNest(bird, world);
    }
    if (action === "KeyF" && !tryPerch(bird, world))
      setBirdMessage(bird, "Fly closer to a branch, then Space or F to grip");
  }
  updateMate(world, dt);
  familyMilestone.update(world, dt);
  updateNestStatus();
  birdsong.update(dt, world);
  updateCamera(camera, bird);
  syncTouchMode();
}

function render() {
  renderScene(ctx, world, bird, camera, input);
}

initInput();
startGame(update, render);
