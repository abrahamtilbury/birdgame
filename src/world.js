// The forest is one 2D map with a separate physical altitude for every bird.
const BRANCH_VISIBILITY = 0.7;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function createTree(id, x, y, scale = 1, variant = 0) {
  const endpoints = [
    [-72, -28, 3, 12], [64, -43, 5, 11],
    [43, 76, 7, 9], [-58, 56, 9, 7]
  ];
  return {
    id, species: "eucalyptus", x, y, scale, variant,
    trunk: { baseRadius: 22 * scale, topRadius: 9 * scale, height: 11 },
    branches: endpoints.map(([ex, ey, height, width], index) => {
      // Each point is absolute in the world, never local-to-camera.
      const perchPoints = [0.6, 0.82].map((t, i) => ({
        id: `${id}-branch-${index + 1}-perch-${i + 1}`,
        x: x + ex * scale * t, y: y + ey * scale * t, height
      }));
      return {
        id: `${id}-branch-${index + 1}`,
        x1: 0, y1: 0, x2: ex * scale, y2: ey * scale,
        height, width: width * scale, perchable: true,
        nestSuitable: index === 1 || index === 2,
        canopyCover: index > 1 ? 0.7 : 0.4,
        perchPoints
      };
    }),
    canopy: { baseHeight: 8, topHeight: 14, radius: 78 * scale }
  };
}

export function createWorld() {
  const trees = [
    createTree("tree-1", 170, 155, 1, 1),
    createTree("tree-2", 515, 210, 1.15, 2),
    createTree("tree-3", 178, 505, 0.85, 3),
    createTree("tree-4", 805, 515, 1.05, 4),
    createTree("tree-5", 1050, 260, 1.12, 5),
    createTree("tree-6", 1170, 950, 0.92, 6),
    createTree("tree-7", 650, 1030, 1.2, 7),
    createTree("tree-8", 310, 1300, 1, 8)
  ];
  const shrubs = [
    { x: 92, y: 350, radius: 16 }, { x: 460, y: 470, radius: 17 },
    { x: 570, y: 580, radius: 13 }, { x: 760, y: 110, radius: 16 },
    { x: 910, y: 760, radius: 22 }, { x: 1250, y: 610, radius: 14 },
    { x: 1090, y: 1200, radius: 20 }, { x: 380, y: 1050, radius: 17 }
  ];
  const groundResources = [];
  for (const tree of trees) {
    for (const [i, [dx, dy, type]] of [
      [70, 47, "twig"], [-73, 32, "grass"], [54, -70, "grass"], [-62, -58, "web"]
    ].entries()) {
      groundResources.push({
        id: `${tree.id}-resource-${i}`,
        x: tree.x + dx * tree.scale, y: tree.y + dy * tree.scale,
        type, collected: false
      });
    }
  }
  const nestTree = trees[1], nestBranch = nestTree.branches[1];
  return {
    width: 1600, height: 1600, groundColour: "#8DA789", time: 0,
    trees, shrubs, groundResources, searchedPatches: new Set(),
    nest: {
      treeId: nestTree.id, branchId: nestBranch.id,
      point: nestBranch.perchPoints[0],
      progress: { grass: 0, twig: 0, web: 0 },
      required: { grass: 3, twig: 1, web: 1 },
      built: false
    },
    // Starter companion: visits the nest tree. Rich flock AI is a later milestone.
    mate: { x: nestBranch.perchPoints[1].x, y: nestBranch.perchPoints[1].y,
      altitude: nestBranch.height, phase: 0, heading: 1.4 },
    windAt(x, y, altitude) {
      if (altitude < 1) return { x: 0, y: 0, up: 0 };
      const t = this.time;
      const xWind = 2.0 * Math.sin(t * 0.37 + y / 185);
      const yWind = 1.4 * Math.cos(t * 0.29 + x / 220);
      let up = 0;
      for (const tree of trees) {
        const d = Math.hypot(x - tree.x, y - tree.y);
        if (d < tree.canopy.radius * 1.8 && altitude < 16) {
          up = Math.max(up, 0.6 * (1 - d / (tree.canopy.radius * 1.8)));
        }
      }
      return { x: xWind, y: yWind, up };
    }
  };
}

// A physical height-slice helper retained for compatible rendering and tests.
export function getTreeSection(tree, altitude) {
  const z = Math.max(0, altitude);
  const trunkRadius = z >= tree.trunk.height ? 0 :
    tree.trunk.baseRadius + (tree.trunk.topRadius - tree.trunk.baseRadius) *
      clamp(z / tree.trunk.height, 0, 1);
  const branches = tree.branches.filter(b => Math.abs(b.height - z) <= BRANCH_VISIBILITY);
  const { baseHeight, topHeight, radius } = tree.canopy;
  const canopyRadius = z < baseHeight ? 0 : z >= topHeight ? radius :
    radius * (0.3 + 0.7 * Math.sin(((z - baseHeight) / (topHeight - baseHeight)) * Math.PI / 2));
  return { trunkRadius, branches, canopyRadius, aboveCanopy: z >= topHeight };
}
