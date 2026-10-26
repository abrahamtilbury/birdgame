// Ground foraging and simple resource -> nest construction loop.
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
  const nearby = world.groundResources.find(resource =>
    !resource.collected && Math.hypot(resource.x - bird.x, resource.y - bird.y) < 23);
  if (nearby) {
    nearby.collected = true;
    bird.inventory[nearby.type] += 1;
    setBirdMessage(bird, `Collected ${nearby.type} (${bird.inventory[nearby.type]})`);
    return;
  }
  const ix = Math.floor(bird.x / GROUND_TILE), iy = Math.floor(bird.y / GROUND_TILE);
  const key = `${ix},${iy}`;
  if (world.searchedPatches.has(key)) {
    setBirdMessage(bird, "This patch has already been searched");
    return;
  }
  world.searchedPatches.add(key);
  const insect = deterministicRoll(ix, iy) < 0.27;
  if (insect) bird.inventory.insects++;
  setBirdMessage(bird, insect ? "Caught an insect!" : "No insects in this patch");
}

export function useNest(bird, world) {
  if (!bird.perchedOn) {
    setBirdMessage(bird, "Perch on the marked nesting branch first");
    return;
  }
  if (bird.perchedOn.branchId !== world.nest.branchId) {
    setBirdMessage(bird, "This isn't the nesting branch");
    return;
  }
  if (world.nest.built) {
    setBirdMessage(bird, "Nest complete! Your mate is nearby");
    return;
  }
  for (const type of ["grass", "twig", "web"]) {
    if (bird.inventory[type] > 0 && world.nest.progress[type] < world.nest.required[type]) {
      bird.inventory[type]--;
      world.nest.progress[type]++;
      world.nest.built = ["grass", "twig", "web"].every(
        t => world.nest.progress[t] >= world.nest.required[t]);
      setBirdMessage(bird, world.nest.built ? "Nest complete!" : `Added ${type} to nest`);
      return;
    }
  }
  setBirdMessage(bird, "Need 3 grass, 1 twig and 1 web to build the nest");
}
