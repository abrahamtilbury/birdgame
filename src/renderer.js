// Top-down painter. The bird stays centre-screen; ground and trees use world x/y.
// Altitude affects occlusion and gliding, NOT the bird's screen-space y coordinate.
import { getTreeSection } from "./world.js";

const TWO_PI = Math.PI * 2;
function disk(ctx, x, y, r, fill) {
  if (r <= 0) return;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TWO_PI);
  ctx.fillStyle = fill; ctx.fill();
}
function segment(ctx, x1, y1, x2, y2, width, colour) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.lineWidth = width; ctx.strokeStyle = colour; ctx.lineCap = "round"; ctx.stroke();
}
function polygon(ctx, points, fill, stroke = null) {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}
function drawGround(ctx, world, camera) {
  ctx.fillStyle = world.groundColour;
  // Keep grass visible even when the centred camera looks beyond a world edge.
  ctx.fillRect(camera.x, camera.y, camera.width, camera.height);
  ctx.fillRect(0, 0, world.width, world.height);
  // Stable grass speckles; never reseed randomly each frame.
  const tile = 32;
  const startX = Math.max(0, Math.floor(camera.x / tile) - 1);
  const endX = Math.min(Math.ceil(world.width / tile), Math.ceil((camera.x + camera.width) / tile) + 1);
  const startY = Math.max(0, Math.floor(camera.y / tile) - 1);
  const endY = Math.min(Math.ceil(world.height / tile), Math.ceil((camera.y + camera.height) / tile) + 1);
  for (let ix = startX; ix <= endX; ix++) for (let iy = startY; iy <= endY; iy++) {
    const seed = ((ix * 67 + iy * 131) % 107 + 107) % 107;
    if (seed % 3) continue;
    const x = ix * tile + 7 + seed % 13;
    const y = iy * tile + 10 + seed % 9;
    segment(ctx, x, y + 4, x + 2, y - 1, 1.5, seed % 2 ? "#739F75" : "#A1B99A");
    segment(ctx, x + 4, y + 3, x + 6, y, 1, "#6C986B");
  }
}
function drawShrubs(ctx, world) {
  for (const shrub of world.shrubs) {
    disk(ctx, shrub.x + 4, shrub.y + 6, shrub.radius * 1.1, "rgba(24,51,36,.17)");
    disk(ctx, shrub.x, shrub.y, shrub.radius, "#42754F");
    disk(ctx, shrub.x - 6, shrub.y - 4, shrub.radius * 0.65, "#649768");
    disk(ctx, shrub.x + 6, shrub.y + 1, shrub.radius * 0.45, "#4D8259");
  }
}
function drawResources(ctx, world, altitude) {
  if (altitude > 11) return;
  ctx.save(); ctx.globalAlpha = altitude > 5 ? 0.45 : 1;
  for (const item of world.groundResources) {
    if (item.collected) continue;
    const { x, y } = item;
    if (item.type === "twig") {
      segment(ctx, x - 7, y + 3, x + 7, y - 4, 3, "#674A36");
      segment(ctx, x + 1, y - 1, x + 5, y - 6, 2, "#9B7C57");
    } else if (item.type === "grass") {
      segment(ctx, x - 3, y + 6, x - 3, y - 5, 2, "#DBD69A");
      segment(ctx, x, y + 6, x + 4, y - 6, 2, "#E0C987");
      segment(ctx, x + 3, y + 5, x + 6, y - 2, 2, "#CDB47A");
    } else {
      ctx.strokeStyle = "#DFE2D5"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, TWO_PI); ctx.stroke();
      segment(ctx, x - 6, y - 5, x + 5, y + 6, 1, "#DFE2D5");
      segment(ctx, x + 6, y - 5, x - 5, y + 6, 1, "#DFE2D5");
    }
  }
  ctx.restore();
}
function drawCanopy(ctx, tree, radius, alpha) {
  ctx.save(); ctx.globalAlpha *= alpha;
  // Deterministic patch placement and non-circular silhouette.
  const colours = ["#35663E", "#478252", "#568C57", "#679665", "#3D7350"];
  disk(ctx, tree.x, tree.y, radius * 0.88, colours[0]);
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.39996 + tree.variant;
    const offset = radius * (0.25 + 0.24 * (i % 3) / 2);
    const rx = tree.x + Math.cos(angle) * offset;
    const ry = tree.y + Math.sin(angle) * offset;
    disk(ctx, rx, ry, radius * (0.28 + 0.05 * (i % 4)), colours[i % colours.length]);
  }
  ctx.restore();
}
function drawTrunk(ctx, tree, radius) {
  disk(ctx, tree.x + 5, tree.y + 6, radius + 5, "rgba(28,37,24,.20)");
  disk(ctx, tree.x, tree.y, radius + 2, "#5F5E4D");
  disk(ctx, tree.x - 1, tree.y - 1, radius * .83, "#A0A096");
  disk(ctx, tree.x + radius * .19, tree.y - radius * .19, radius * .54, "#DDD2AF");
  disk(ctx, tree.x, tree.y, radius * .32, "#927E62");
}
function drawBranch(ctx, tree, branch, alpha) {
  const sx = tree.x + branch.x1, sy = tree.y + branch.y1;
  const ex = tree.x + branch.x2, ey = tree.y + branch.y2;
  ctx.save(); ctx.globalAlpha *= alpha;
  segment(ctx, sx + 2, sy + 3, ex + 2, ey + 3, branch.width + 4, "rgba(26,39,29,.23)");
  segment(ctx, sx, sy, ex, ey, branch.width, "#8F826A");
  segment(ctx, sx, sy, ex, ey, branch.width * .42, "#D4C9A7");
  for (const p of branch.perchPoints) {
    disk(ctx, p.x, p.y, 5, "rgba(251,246,213,.24)");
    disk(ctx, p.x, p.y, 2, "#F3DD95");
  }
  ctx.restore();
}
function drawTrees(ctx, world, bird) {
  for (const tree of world.trees) {
    const z = bird.altitude;
    const section = getTreeSection(tree, z);
    // Ground shadow anchors the tree as camera height changes.
    disk(ctx, tree.x + 14, tree.y + 13, tree.canopy.radius * 0.95, "rgba(35,56,40,.12)");
    if (z >= tree.canopy.baseHeight) {
      drawCanopy(ctx, tree, section.canopyRadius, 0.95);
    } else {
      drawCanopy(ctx, tree, tree.canopy.radius * 0.80, 0.12);
    }
    if (section.trunkRadius > 0) drawTrunk(ctx, tree, section.trunkRadius);
    else disk(ctx, tree.x, tree.y, tree.trunk.topRadius, "#B4AA91");
    // All lower branches remain visible; higher branches fade as cutaways.
    for (const branch of tree.branches) {
      const above = branch.height > z + 0.5;
      drawBranch(ctx, tree, branch, above ? 0.23 : 1);
    }
  }
}
function drawNest(ctx, world) {
  const nest = world.nest;
  const { x, y } = nest.point;
  disk(ctx, x, y, 12, "rgba(16,37,25,.36)");
  disk(ctx, x, y, 10, nest.built ? "#866A47" : "#B09564");
  disk(ctx, x, y, 7, "#5C513F");
  disk(ctx, x, y, 5, "#8D7955");
  if (!nest.built) {
    ctx.fillStyle = "#FFF4BE";
    ctx.font = "11px monospace";
    ctx.fillText("NEST", x - 12, y - 17);
  }
}
function drawWing(ctx, side, state, bird) {
  const isMiddleHeld = bird.glide;
  const isActive = bird[`${side < 0 ? "left" : "right"}WingTimer`] > 0;
  if (!isActive && !isMiddleHeld) {
    polygon(ctx, [[side * 7, -7], [side * 17, -6], [side * 13, 19], [side * 8, 8]], "#1D2934");
    segment(ctx, side * 12, -3, side * 13, 12, 2, "#F1F0E8");
    return;
  }
  const positions = {
    raised: [40, -48], middle: [68, -18], lowered: [47, 35], rest: [52, -12]
  };
  const [distance, ty] = positions[isMiddleHeld ? "middle" : state] || positions.rest;
  const x = distance * side;
  polygon(ctx, [[side * 10, -11], [x * .82, ty - 13], [x, ty],
    [x * .86, ty + 11], [side * 10, 12]], "#242C37", "#17222C");
  segment(ctx, side * 20, -1, x * .78, ty + 2, 4, "#F4F3E9");
}
function drawBird(ctx, bird, x, y, isMate = false) {
  ctx.save();
  const heading = bird.heading || 0;
  const hopBob = bird.hopAnimation > 0 ? Math.sin((bird.hopAnimation / 0.16) * Math.PI) * 5 : 0;
  ctx.translate(x, y - hopBob); ctx.rotate(heading);
  ctx.scale(isMate ? 0.66 : 1, isMate ? 0.66 : 1);
  const wag = Math.sin(bird.tailPhase || bird.phase || 0) * 5;
  // Wagtail: triangular, slightly fanned wedge (black with pale feather edges).
  polygon(ctx, [[-6, 11], [-17 + wag, 49], [wag, 43], [17 + wag, 49], [6, 11]], "#242D36");
  segment(ctx, -11 + wag, 44, -4 + wag, 17, 1.4, "#DFE1D8");
  segment(ctx, 11 + wag, 44, 4 + wag, 17, 1.4, "#DFE1D8");
  drawWing(ctx, -1, bird.leftWing, bird);
  drawWing(ctx, 1, bird.rightWing, bird);
  // White undersides peek along the flanks (not on the black back).
  disk(ctx, -9, 8, 7, "#D6D9D0");
  disk(ctx, 9, 8, 7, "#D6D9D0");
  ctx.fillStyle = "#24303A";
  ctx.beginPath(); ctx.ellipse(0, 2, 12, 22, 0, 0, TWO_PI); ctx.fill();
  const pitchHead = bird.pitch === "forward" ? -10 : bird.pitch === "backward" ? 9 : 0;
  const headY = -21 + pitchHead;
  disk(ctx, 0, headY, 12, "#202B35");
  // Distinctive white eyebrow arcs.
  segment(ctx, -9, headY - 4, -4, headY - 8, 2.6, "#F0F0E7");
  segment(ctx, 9, headY - 4, 4, headY - 8, 2.6, "#F0F0E7");
  polygon(ctx, [[-3, headY - 9], [0, headY - 18], [3, headY - 9]], "#B8A67C");
  if (bird.grounded || bird.perchedOn) {
    segment(ctx, -5, 17, -7, 24, 1.5, "#B79F78");
    segment(ctx, 5, 17, 7, 24, 1.5, "#B79F78");
  }
  ctx.restore();
}
function drawOverheadFoliage(ctx, world, bird, camera) {
  for (const tree of world.trees) {
    if (bird.altitude >= tree.canopy.topHeight) continue;
    if (bird.altitude < tree.canopy.baseHeight) continue;
    const d = Math.hypot(bird.x - tree.x, bird.y - tree.y);
    if (d > tree.canopy.radius) continue;
    // Overhead leaves are translucent so the pilot and HUD stay readable.
    ctx.save(); ctx.globalAlpha = 0.19;
    drawCanopy(ctx, { ...tree, x: tree.x - camera.x, y: tree.y - camera.y },
      tree.canopy.radius, 1);
    ctx.restore();
  }
}
function drawVignette(ctx, width, height, bird) {
  if (bird.altitude < 2) return;
  const r = width * .65;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, r * .3,
    width / 2, height / 2, r);
  gradient.addColorStop(0, "rgba(27,46,30,0)");
  gradient.addColorStop(1, "rgba(27,46,30,0.11)");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
}
function drawHud(ctx, bird, world) {
  const speed = Math.hypot(bird.velocityX, bird.velocityY);
  ctx.save();
  ctx.fillStyle = "rgba(16,33,23,0.84)"; ctx.fillRect(8, 8, 334, 174);
  ctx.fillStyle = "#FFFFFF"; ctx.font = "13px monospace"; ctx.textBaseline = "top";
  const lines = [
    `ALT ${bird.altitude.toFixed(2)} m | VZ ${bird.velocityZ.toFixed(2)} m/s`,
    `Speed ${speed.toFixed(0)} px/s | Heading ${(bird.heading * 180 / Math.PI).toFixed(0)}°`,
    `Pitch ${bird.pitch} | Glide ${bird.glide ? "ON" : "off"}`,
    `Wing L ${bird.leftWing} / R ${bird.rightWing}`,
    `Position ${bird.x.toFixed(0)}, ${bird.y.toFixed(0)}`,
    bird.perchedOn ? `PERCHED ${bird.perchedOn.branchId}` : bird.grounded ? "GROUND: WASD to hop" : "FLYING: hold 4+6 to glide",
    `Bag G:${bird.inventory.grass} T:${bird.inventory.twig} W:${bird.inventory.web} B:${bird.inventory.insects}`,
    `Nest G:${world.nest.progress.grass}/3 T:${world.nest.progress.twig}/1 W:${world.nest.progress.web}/1`
  ];
  lines.forEach((line, i) => ctx.fillText(line, 16, 14 + i * 20));
  if (bird.messageTime > 0) {
    const msg = bird.message.slice(0, 64);
    ctx.fillStyle = "rgba(16,33,23,.86)";
    ctx.fillRect(8, ctx.canvas.height - 39, Math.min(620, msg.length * 8 + 20), 30);
    ctx.fillStyle = "#F8E8B7";
    ctx.fillText(msg, 16, ctx.canvas.height - 32);
  }
  ctx.restore();
}

export function renderScene(ctx, world, bird, camera) {
  const width = ctx.canvas.width, height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#324237"; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, world, camera);
  drawShrubs(ctx, world);
  drawResources(ctx, world, bird.altitude);
  drawTrees(ctx, world, bird);
  drawNest(ctx, world);
  // Mate is a small visible resident of the nesting tree, not full AI yet.
  if (Math.abs(bird.altitude - world.mate.altitude) < 7) {
    drawBird(ctx, { ...world.mate, leftWing: "rest", rightWing: "rest",
      leftWingTimer: 0, rightWingTimer: 0, glide: false, grounded: false,
      tailPhase: world.mate.phase }, world.mate.x, world.mate.y, true);
  }
  ctx.restore();
  // Only a faint shadow changes size with altitude: keeps 2D coords stable.
  disk(ctx, width / 2 + 6, height / 2 + 12,
    Math.max(3, 17 - bird.altitude * 0.55),
    `rgba(22,43,31,${Math.max(0.03, 0.20 - bird.altitude * .008)})`);
  drawBird(ctx, bird, width / 2, height / 2);
  drawOverheadFoliage(ctx, world, bird, camera);
  drawVignette(ctx, width, height, bird);
  drawHud(ctx, bird, world);
}
