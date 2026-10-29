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
  if (insect) {
    bird.inventory.insects++;
  
    bird.hunger = Math.min(
      100,
      (bird.hunger ?? 80) + 20
    );
  }
  
  setBirdMessage(
    bird,
    insect
      ? `Ate an insect! Hunger ${Math.round(bird.hunger)}/100`
      : "No insects in this patch"
  );
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
  if (bird.perchedOn.treeId !== nest.treeId ||
      bird.perchedOn.branchId !== nest.branchId) {
    setBirdMessage(bird, "Return to the same tree and branch where you started the nest", 4);
    return;
  }
  if (nest.built) {
    setBirdMessage(bird, "The nest is already complete!");
    return;
  }
  const type = bird.carrying;
  if (!type || bird.inventory[type] < 1) {
    const grassLeft = Math.max(0, nest.required.grass - nest.progress.grass);
    const twigsLeft = Math.max(0, nest.required.twig - nest.progress.twig);
    setBirdMessage(bird, `Need ${grassLeft} more grass and ${twigsLeft} more twig. Bring one at a time.`, 4);
    return;
  }
  if (nest.progress[type] >= nest.required[type]) {
    setBirdMessage(bird, `Already added enough ${type} — find other materials`);
    return;
  }
  bird.inventory[type]--;
  bird.carrying = null;
  nest.progress[type]++;
  nest.built = ["grass", "twig"].every(
    type => nest.progress[type] >= nest.required[type]
  );
  const progress = `Grass ${nest.progress.grass}/${nest.required.grass}, twig ${nest.progress.twig}/${nest.required.twig}`;
  setBirdMessage(bird, nest.built ? `Nest complete! ${progress}` : `Added ${type}! ${progress}`, 4.5);
}

// X anywhere, or Space while grounded with something in the beak.
// A dropped object is returned to the forest, not silently deleted.
export function dropCarriedItem(bird, world) {
  const type = bird.carrying;
  if (!type) {
    setBirdMessage(bird, "Beak already empty");
    return false;
  }
  bird.carrying = null;
  bird.inventory[type] = Math.max(0, (bird.inventory[type] || 0) - 1);
  world.groundResources.push({
    id: `dropped-${world.groundResources.length}-${Math.floor(world.time * 1000)}`,
    type, x: bird.x, y: bird.y, collected: false
  });
  setBirdMessage(bird, `Dropped ${type} — beak free`);
  return true;
}
