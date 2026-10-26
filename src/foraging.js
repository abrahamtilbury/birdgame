// Ground foraging and twig-in-beak nesting loop.
import { setBirdMessage } from "./bird.js";
import { GROUND_TILE } from "./world.js";

function deterministicRoll(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function searchGround(bird, world) {
  bird.peckAnimation = 0.28;
  if (!bird.grounded) {
    setBirdMessage(bird, "Land before searching the grass");
    return;
  }
  if (bird.carrying) {
    setBirdMessage(bird, `Carrying ${bird.carrying} in beak — perch and press N`);
    return;
  }
  const nearby = world.groundResources.find(item =>
    !item.collected && Math.hypot(item.x - bird.x, item.y - bird.y) < 23);
  if (nearby) {
    nearby.collected = true;
    bird.inventory[nearby.type]++;
    bird.carrying = nearby.type;
    setBirdMessage(bird, `Picked up ${nearby.type} — carry it to a branch`);
    return;
  }
  const ix = Math.floor(bird.x / GROUND_TILE), iy = Math.floor(bird.y / GROUND_TILE);
  const key = `${ix},${iy}`;
  if (world.searchedPatches.has(key)) {
    setBirdMessage(bird, "Already searched this patch");
    return;
  }
  world.searchedPatches.add(key);
  const insect = deterministicRoll(ix, iy) < 0.27;
  if (insect) bird.inventory.insects++;
  setBirdMessage(bird, insect ? "Caught an insect!" : "No insects in this patch");
}

export function useNest(bird, world) {
  if (!bird.perchedOn) {
    setBirdMessage(bird, "Perch on a branch before pressing N");
    return;
  }
  const tree = world.trees.find(t => t.id === bird.perchedOn.treeId);
  const branch = tree?.branches.find(b => b.id === bird.perchedOn.branchId);
  // Any perchable branch can host the first prototype nest. This avoids
  // requiring the player to guess which visually similar branch is eligible.
  if (!branch?.perchable) {
    setBirdMessage(bird, "Find a branch to build your nest");
    return;
  }
  const nest = world.nest;
  if (!nest.started) {
    if (bird.carrying !== "twig") {
      setBirdMessage(bird, "Carry a fallen twig to start a nest");
      return;
    }
    nest.started = true;
    nest.treeId = tree.id;
    nest.branchId = branch.id;
    nest.point = { x: bird.perchedOn.x, y: bird.perchedOn.y, height: branch.height };
    // The mate will now travel toward the chosen home branch over time.
  }
  if (bird.perchedOn.branchId !== nest.branchId) {
    setBirdMessage(bird, "Return to your nesting branch");
    return;
  }
  if (nest.built) {
    setBirdMessage(bird, "The nest is already complete!");
    return;
  }
  const type = bird.carrying;
  if (!type || bird.inventory[type] < 1) {
    setBirdMessage(bird, "Find grass, a twig, or spiderweb to carry");
    return;
  }
  if (nest.progress[type] >= nest.required[type]) {
    setBirdMessage(bird, `Already added enough ${type} — find other materials`);
    return;
  }
  bird.inventory[type]--;
  bird.carrying = null;
  nest.progress[type]++;
  nest.built = ["grass", "twig", "web"].every(t => nest.progress[t] >= nest.required[t]);
  setBirdMessage(bird, nest.built ? "Nest complete!" : `Added ${type} to your nest`);
}
