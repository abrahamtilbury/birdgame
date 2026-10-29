// Deterministic, scalable forest. World x/y are pixels; tree/flight height is metres.
// The same seed always generates the same branches, perches, forks and resources.
export const GROUND_TILE = 32;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createTree(id, x, y, scale, seed) {
  const random = randomFrom(seed);
  scale = clamp(scale * (0.90 + 0.20 * random()), 0.75, 2.65);
  const trunkHeight = 11.5 * scale;
  const baseRadius = 23 * scale;
  // Larger specimens grow more branches, but each individual is different.
  const branchCount = clamp(Math.round(2.8 + scale * 3.0 + random() * 1.8), 4, 12);
  const offset = random() * Math.PI * 2;
  const branches = [];

  for (let index = 0; index < branchCount; index++) {
    const variation = (random() - 0.5) * 0.62;
    const angle = offset + index * 2.39996 + variation;
    const reach = (58 + 54 * random()) * scale;
    const sx = Math.cos(angle) * baseRadius * 0.40;
    const sy = Math.sin(angle) * baseRadius * 0.40;
    const ex = Math.cos(angle) * reach;
    const ey = Math.sin(angle) * reach;
    const height = 2.4 + ((index + 0.6) / (branchCount + 0.7)) * (trunkHeight - 2.4);
    const width = (9.5 + 5 * random()) * scale * (1.06 - 0.30 * index / branchCount);
    const perchPoints = [0.60, 0.82].map((t, i) => ({
      id: `${id}-b${index + 1}-p${i + 1}`,
      x: x + sx + (ex - sx) * t,
      y: y + sy + (ey - sy) * t,
      height
    }));
    // Decorative secondary forks branch away from the primary limb.
    const forks = [];
    const forkCount = scale > 1.5 ? 2 : 1;
    for (let k = 0; k < forkCount; k++) {
      const split = 0.50 + 0.18 * k;
      const forkAngle = angle + (k % 2 ? -1 : 1) * (0.30 + 0.40 * random());
      const forkReach = reach * (0.22 + random() * 0.21);
      const fx = sx + (ex - sx) * split, fy = sy + (ey - sy) * split;
      forks.push({ x1: fx, y1: fy,
        x2: fx + Math.cos(forkAngle) * forkReach,
        y2: fy + Math.sin(forkAngle) * forkReach,
        width: width * 0.38 });
    }
    branches.push({
      id: `${id}-branch-${index + 1}`,
      x1: sx, y1: sy, x2: ex, y2: ey, width, height,
      perchable: true,
      nestSuitable: index > 0 && index < branchCount - 1 && width >= 10,
      canopyCover: clamp(0.22 + (index / branchCount) * 0.7, 0, 1),
      perchPoints, forks
    });
  }
  return {
    id, x, y, scale, seed,
    species: 'eucalyptus', variant: seed,
    trunk: { baseRadius, topRadius: 8 * scale, height: trunkHeight },
    branches,
    canopy: {
      baseHeight: trunkHeight * 0.62,
      topHeight: trunkHeight + 4.5 * scale,
      radius: 87 * scale
    }
  };
}

function createResources(trees) {
  const resources = [];
  for (const tree of trees) {
    const random = randomFrom(tree.seed + 91021);
    // More and larger limbs generate more fallen twigs below their canopy.
    const count = Math.max(5, Math.round(tree.branches.length * (0.85 + 0.35 * tree.scale)));
    for (let n = 0; n < count; n++) {
      const branch = tree.branches[n % tree.branches.length];
      const angle = Math.atan2(branch.y2, branch.x2) + (random() - 0.5) * 1.2;
      const radius = (0.40 + random() * 0.70) * tree.canopy.radius;
      const type = n < Math.ceil(count * 0.55)
        ? "twig"
        : "grass";
      resources.push({
        id: `${tree.id}-item-${n + 1}`, type,
        x: clamp(tree.x + Math.cos(angle) * radius, 24, 2576),
        y: clamp(tree.y + Math.sin(angle) * radius, 24, 2576),
        collected: false
      });
    }
  }
  return resources;
}

export function createWorld() {
  const trees = [
    createTree('tree-1', 185, 160, 1.40, 108),
    createTree('tree-2', 665, 385, 2.15, 275),
    createTree('tree-3', 190, 850, 0.90, 312),
    createTree('tree-4', 1310, 670, 2.45, 409),
    createTree('tree-5', 1920, 350, 1.65, 517),
    createTree('tree-6', 2050, 1690, 2.25, 627),
    createTree('tree-7', 960, 1590, 1.15, 748),
    createTree('tree-8', 365, 2130, 1.80, 851),
    createTree('tree-9', 1550, 2270, 1.35, 959),
    createTree('tree-10', 2310, 960, 1.05, 1063)
  ];
  const nestTree = trees[1];
  const nestBranch = nestTree.branches.find(branch => branch.nestSuitable)
    || nestTree.branches[1];
  return {
    width: 2600, height: 2600, groundColour: '#8DA789', time: 0,
    trees,
    shrubs: [
      {x: 105, y: 390, radius: 17}, {x: 485, y: 470, radius: 18},
      {x: 585, y: 715, radius: 15}, {x: 1200, y: 145, radius: 18},
      {x: 1600, y: 1140, radius: 24}, {x: 2350, y: 2000, radius: 19}
    ],
    groundResources: createResources(trees), searchedPatches: new Set(),
    nest: {
      started: false,
      treeId: nestTree.id, branchId: nestBranch.id,
      point: nestBranch.perchPoints[0],
      progress: { grass: 0, twig: 0, web: 0 },
      required: { grass: 3, twig: 1, web: 0 }, built: false,
      familyStarted: false, eggs: 0
    },
    mate: { x: 355, y: 337, altitude: 0, phase: 0, heading: 1.4,
      grounded: true, hopTimer: 0, hopAnimation: 0 },
    windAt(x, y, altitude) {
      if (altitude < 1) return { x: 0, y: 0, up: 0 };
      const t = this.time;
      
      const exposure = clamp(altitude / 40, 0, 1);
      
      const xWind =
        (2.0 + 5.0 * exposure) *
        Math.sin(
          t * 0.23 +
          y / 270 +
          exposure * 1.3
        );
      
      const yWind =
        (1.4 + 3.5 * exposure) *
        Math.cos(
          t * 0.31 +
          x / 295 -
          exposure * 0.8
        );

      let up = 0;
      for (const tree of trees) {
        const d = Math.hypot(x - tree.x, y - tree.y);
        if (d < tree.canopy.radius * 1.4 && altitude < tree.canopy.topHeight + 2) {
          up = Math.max(up, 0.95 * (1 - d / (tree.canopy.radius * 1.4)));
        }
      }
      return { x: xWind, y: yWind, up };
    }
  };
}

export function getTreeSection(tree, altitude) {
  const z = Math.max(0, altitude);
  const trunkRadius = z >= tree.trunk.height ? 0 :
    tree.trunk.baseRadius + (tree.trunk.topRadius - tree.trunk.baseRadius) *
      clamp(z / tree.trunk.height, 0, 1);
  const branches = tree.branches.filter(b => Math.abs(b.height - z) <= 0.7);
  const { baseHeight, topHeight, radius } = tree.canopy;
  const canopyRadius = z < baseHeight ? 0 : z >= topHeight ? radius :
    radius * (0.28 + 0.72 * Math.sin(((z - baseHeight) / (topHeight - baseHeight)) * Math.PI / 2));
  return { trunkRadius, branches, canopyRadius, aboveCanopy: z >= topHeight };
}
