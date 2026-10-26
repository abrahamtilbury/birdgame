
const BRANCH_VISIBILITY = 0.75;

// Create a tree with trunk, branches and canopy
function createTree(id, x, y, scale = 1) {
  return {
    id,
    species: "eucalyptus",
    x,
    y,

    // Trunk dimensions
    trunk: {
      baseRadius: 25 * scale,
      topRadius: 9 * scale,
      height: 11
    },

    // Branch coordinates are relative to tree centre
    // Height is in metres
    // Horizontal dimensions are game-world pixels
    branches: [
      {
        id: `${id}-branch-1`,
        x1: 0,
        y1: 0,
        x2: -75 * scale,
        y2: -30 * scale,
        height: 3,
        width: 12 * scale,
        perchable: true
      },
      {
        id: `${id}-branch-2`,
        x1: 0,
        y1: 0,
        x2: 65 * scale,
        y2: -45 * scale,
        height: 5,
        width: 10 * scale,
        perchable: true
      },
      {
        id: `${id}-branch-3`,
        x1: 0,
        y1: 0,
        x2: 45 * scale,
        y2: 75 * scale,
        height: 7,
        width: 8 * scale,
        perchable: true
      },
      {
        id: `${id}-branch-4`,
        x1: 0,
        y1: 0,
        x2: -55 * scale,
        y2: 60 * scale,
        height: 9,
        width: 6 * scale,
        perchable: true
      }
    ],

    // Canopy occupies a volume above the branches
    canopy: {
      baseHeight: 8,
      topHeight: 14,
      radius: 85 * scale
    }
  };
}

// Create the starting game world
export function createWorld() {
  return {
    width: 1600,
    height: 1600,

    groundColour: "#8DA789",

    trees: [
      createTree("tree-1", 140, 140, 1),
      createTree("tree-2", 510, 190, 1.2),
      createTree("tree-3", 160, 490, 0.8)
    ],

    shrubs: [
      { x: 80, y: 310, radius: 14 },
      { x: 475, y: 450, radius: 14 },
      { x: 565, y: 550, radius: 14 }
    ]
  };
}

// Determine the visible tree geometry
// based on the bird's altitude
export function getTreeSection(tree, altitude) {
  const z = Math.max(0, altitude);

  // Trunk narrows as altitude increases
  let trunkRadius = 0;

  if (z <= tree.trunk.height) {
    const progress = z / tree.trunk.height;

    trunkRadius =
      tree.trunk.baseRadius +
      (tree.trunk.topRadius - tree.trunk.baseRadius) *
      progress;
  }

  // Find branches at the current altitude
  const branches = tree.branches.filter(branch =>
    Math.abs(branch.height - z) <= BRANCH_VISIBILITY
  );

  // Calculate visible canopy cross-section
  let canopyRadius = 0;

  if (z >= tree.canopy.baseHeight) {
    if (z >= tree.canopy.topHeight) {
      // Looking down at the full canopy
      canopyRadius = tree.canopy.radius;
    } else {
      // Canopy expands as the bird climbs
      const progress =
        (z - tree.canopy.baseHeight) /
        (tree.canopy.topHeight - tree.canopy.baseHeight);

      canopyRadius =
        tree.canopy.radius *
        (0.35 + 0.65 *
          Math.sin(progress * Math.PI / 2));
    }
  }

  return {
    trunkRadius,
    branches,
    canopyRadius,
    aboveCanopy: z >= tree.canopy.topHeight
  };
}
