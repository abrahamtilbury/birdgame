// Top-down painter. The bird stays centre-screen; ground and trees use world x/y.
// Altitude affects occlusion and gliding, NOT the bird's screen-space y coordinate.
import { getTreeSection, GROUND_TILE } from "./world.js";
import { FLIGHT } from "./flightPhysics.js";
import { findNearbyPerch } from "./collision.js";

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
  const tile = GROUND_TILE;
  const visibleWidth = camera.width / camera.zoom;
  const visibleHeight = camera.height / camera.zoom;
  ctx.fillStyle = world.groundColour;
  ctx.fillRect(camera.x, camera.y, visibleWidth, visibleHeight);
  const startX = Math.max(0, Math.floor(camera.x / tile) - 1);
  const endX = Math.min(Math.ceil(world.width / tile),
    Math.ceil((camera.x + visibleWidth) / tile) + 1);
  const startY = Math.max(0, Math.floor(camera.y / tile) - 1);
  const endY = Math.min(Math.ceil(world.height / tile),
    Math.ceil((camera.y + visibleHeight) / tile) + 1);
  for (let ix = startX; ix <= endX; ix++) for (let iy = startY; iy <= endY; iy++) {
    const seed = ((ix * 67 + iy * 131) % 107 + 107) % 107;
    const x = ix * tile, y = iy * tile;
    // Stable, low-contrast square tiles rather than randomly flickering ground.
    ctx.fillStyle = seed % 5 === 0 ? 'rgba(47,93,54,.055)' :
      seed % 3 === 0 ? 'rgba(221,231,176,.05)' : 'rgba(0,0,0,0)';
    ctx.fillRect(x, y, tile, tile);
    if (world.searchedPatches.has(`${ix},${iy}`)) {
      // Pecked / disturbed square: permanently changes after Space is pressed.
      ctx.fillStyle = '#83775C';
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      ctx.fillStyle = '#9E896A';
      ctx.fillRect(x + 4, y + 5, tile - 8, tile - 10);
      ctx.strokeStyle = '#5B634B'; ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, tile - 4, tile - 4);
      segment(ctx, x + 7, y + 13, x + 22, y + 10, 1.7, '#665D4D');
      segment(ctx, x + 10, y + 23, x + 24, y + 20, 1.3, '#665D4D');
    } else if (seed % 3 === 0) {
      segment(ctx, x + 8, y + 21, x + 10, y + 15, 1.5,
        seed % 2 ? '#739F75' : '#A1B99A');
      segment(ctx, x + 13, y + 23, x + 15, y + 19, 1, '#6C986B');
    }
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
  const colours = ['#35663E', '#478252', '#568C57', '#679665', '#3D7350'];
  disk(ctx, tree.x, tree.y, radius * 0.78, colours[0]);
  const clusters = Math.min(30, Math.round(12 + tree.scale * 6));
  for (let i = 0; i < clusters; i++) {
    const angle = i * 2.39996 + tree.variant;
    const spread = radius * (0.28 + 0.24 * (i % 4) / 3);
    const cx = tree.x + Math.cos(angle) * spread;
    const cy = tree.y + Math.sin(angle) * spread;
    const size = radius * (0.24 + 0.07 * (i % 5));
    ctx.fillStyle = colours[i % colours.length];
    // Slightly angular clusters give a readable 2D-tile-game silhouette.
    ctx.fillRect(cx - size * 0.65, cy - size * 0.65, size * 1.3, size * 1.3);
    disk(ctx, cx, cy, size * 0.48, colours[(i + 1) % colours.length]);
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
  for (const fork of branch.forks || []) {
    segment(ctx, tree.x + fork.x1, tree.y + fork.y1,
      tree.x + fork.x2, tree.y + fork.y2, fork.width + 2,
      'rgba(26,39,29,.20)');
    segment(ctx, tree.x + fork.x1, tree.y + fork.y1,
      tree.x + fork.x2, tree.y + fork.y2, fork.width,
      '#B7AA8B');
  }
  for (const p of branch.perchPoints) {
    disk(ctx, p.x, p.y, 5, "rgba(251,246,213,.24)");
    disk(ctx, p.x, p.y, 2, "#F3DD95");
  }
  ctx.restore();
}
function drawTrees(ctx, world, bird, camera) {
  for (const tree of world.trees) {
    const margin = tree.canopy.radius + 100;
    if (tree.x < camera.x - margin ||
        tree.x > camera.x + camera.width / camera.zoom + margin ||
        tree.y < camera.y - margin ||
        tree.y > camera.y + camera.height / camera.zoom + margin) continue;
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
  if (!nest.started) return; // Players choose the branch by delivering the first twig.
  const { x, y } = nest.point;
  const materialCount = nest.progress.grass + nest.progress.twig + nest.progress.web;
  const r = 5 + materialCount * 1.5;
  disk(ctx, x + 3, y + 4, r + 2, "rgba(16,37,25,.36)");
  disk(ctx, x, y, r, nest.built ? "#866A47" : "#B09564");
  disk(ctx, x, y, Math.max(2, r - 3.5), "#5C513F");
  if (!nest.built) {
    ctx.fillStyle = "#FFF4BE";
    ctx.font = "11px monospace";
    ctx.fillText("NEST", x - 12, y - r - 8);
  }
}
function drawWing(ctx, side, state, bird) {
  const name = side < 0 ? 'left' : 'right';
  const active = bird[`${name}WingTimer`] > 0;
  const holding = bird[`${name}Held`];
  if (!active && !holding && bird.grounded) {
    polygon(ctx, [[side * 7, -7], [side * 17, -6], [side * 13, 19], [side * 8, 8]], '#1D2934');
    return;
  }
  const pose = bird[`${name}WingPose`] ?? 0;
  const pulse = Math.max(0, Math.min(1, bird[`${name}WingPulse`] || 0));
  // Ease through a full visible wing arc instead of snapping to the key pose.
  const sweep = Math.sin(pulse * Math.PI) * 19;
  const reach = 68 - 18 * Math.abs(pose) + sweep * 0.32;
  const tipY = -18 + pose * 47 - sweep;
  const x = reach * side;
  polygon(ctx, [[side * 10, -11], [x * 0.79, tipY - 14], [x, tipY],
    [x * 0.89, tipY + 11], [side * 10, 12]], '#242C37', '#17222C');
  // Feather-tip highlights only; white belly remains on the body, not the wings.
  for (let i = 1; i <= 3; i++) {
    const fraction = i / 4;
    segment(ctx, x * (0.70 + fraction * 0.22), tipY + 3,
      x * (0.74 + fraction * 0.21), tipY + 8 + i * 1.4, 1, '#515B60');
  }
}
function drawBird(ctx, bird, x, y, isMate = false) {
  ctx.save();
  const heading = bird.heading || 0;
  const hopBob = bird.hopAnimation > 0 ? Math.sin((bird.hopAnimation / 0.16) * Math.PI) * 5 : 0;
  ctx.translate(x, y - hopBob); ctx.rotate(heading);
  // 2.5D tilt: foreshorten and shift the entire body when diving or flaring.
  // Bank is a consequence of unequal wing forces, not a direct arrow-key yaw.
  if (!isMate) {
    const pitch = bird.pitchVisual || 0;
    ctx.transform(1, 0, (bird.bank || 0) * 0.36, 1, 0, 0);
    ctx.translate(0, pitch * 5);
    ctx.scale(1 + Math.max(0, -pitch) * 0.06, 1 - pitch * 0.19);
  }
  ctx.scale(isMate ? 0.66 : 1, isMate ? 0.66 : 1);
  
  const wag = Math.sin(bird.tailPhase || bird.phase || 0) * 5;
  
  // Fan opens during a flare and narrows during a dive.
  const tailSpread = bird.tailSpread ?? 0.35;
  const fanWidth = 8 + 12 * tailSpread;
  
  // Tail twists slightly to coordinate a bank.
  const tailTwist = (bird.tailTwist || 0) * 7;
  
  polygon(
    ctx,
    [
      [-6, 11],
      [-fanWidth + wag + tailTwist, 49],
      [wag + tailTwist, 43],
      [fanWidth + wag + tailTwist, 49],
      [6, 11]
    ],
    "#242D36"
  );
  
  // Pale outer tail-feather markings.
  segment(
    ctx,
    -fanWidth * 0.65 + wag + tailTwist,
    44,
    -4,
    17,
    1.4,
    "#DFE1D8"
  );
  
  segment(
    ctx,
    fanWidth * 0.65 + wag + tailTwist,
    44,
    4,
    17,
    1.4,
    "#DFE1D8"
  );

  drawWing(ctx, -1, bird.leftWing, bird);
  drawWing(ctx, 1, bird.rightWing, bird);
  // The white patch is on the breast/belly, NOT the wings.
  ctx.fillStyle = '#F1F0E6';
  ctx.beginPath(); ctx.ellipse(0, 10, 10.3, 15, 0, 0, TWO_PI); ctx.fill();
  // Dark upper back leaves the lower white belly exposed on this top-down sprite.
  ctx.fillStyle = '#24303A';
  ctx.beginPath(); ctx.ellipse(0, -5, 11.4, 15, 0, 0, TWO_PI); ctx.fill();
  const pitchHead = -(bird.pitchVisual ?? 0) * 12 -
    (bird.peckAnimation > 0 ? 7 : 0);
  const headY = -21 + pitchHead;
  disk(ctx, 0, headY, 12, "#202B35");
  // Distinctive white eyebrow arcs.
  segment(ctx, -9, headY - 4, -4, headY - 8, 2.6, "#F0F0E7");
  segment(ctx, 9, headY - 4, 4, headY - 8, 2.6, "#F0F0E7");
  polygon(ctx, [[-3, headY - 9], [0, headY - 18], [3, headY - 9]], "#B8A67C");
  // Carried nesting material follows the moving head and is visible in the beak.
  if (bird.carrying === "twig") {
    segment(ctx, -16, headY - 21, 16, headY - 27, 3.2, "#745037");
    segment(ctx, 3, headY - 24, 8, headY - 33, 1.8, "#A98358");
  } else if (bird.carrying === "grass") {
    for (let i = -1; i <= 1; i++)
      segment(ctx, i * 4 - 5, headY - 22, i * 5 + 3, headY - 34, 2, "#D6BD72");
  } else if (bird.carrying === "web") {
    segment(ctx, -10, headY - 26, 12, headY - 26, 1.5, "#EDE9DF");
    segment(ctx, -2, headY - 34, 3, headY - 20, 1, "#EDE9DF");
  }
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
    ctx.save(); ctx.globalAlpha = 0.16;
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    drawCanopy(ctx, tree, tree.canopy.radius, 1);
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
function drawHud(ctx, bird, world, controls) {
  const speed = Math.hypot(bird.velocityX, bird.velocityY);
  ctx.save();
  ctx.fillStyle = "rgba(16,33,23,0.84)"; ctx.fillRect(8, 8, 354, 238);
  ctx.fillStyle = "#FFFFFF"; ctx.font = "13px monospace"; ctx.textBaseline = "top";
  const lines = [
    `ALT ${bird.altitude.toFixed(2)} m | VZ ${bird.velocityZ.toFixed(2)} m/s`,
    `Speed ${speed.toFixed(0)} px/s | Heading ${(bird.heading * 180 / Math.PI).toFixed(0)}°`,
    `Pitch ${bird.pitch} | ${bird.flightMode} | Bank ${Math.round((bird.bank || 0) * 180 / Math.PI)} deg`,
    `Wing L ${bird.leftWing} / R ${bird.rightWing}`,
    `FLAPS ${bird.totalFlaps || 0}  | AIRSPEED ${(bird.airspeed || 0).toFixed(0)}`,
    `Last key: ${controls?.lastInput || "none"} | Wing ${bird.lastWingEvent}`,
    `Position ${bird.x.toFixed(0)}, ${bird.y.toFixed(0)}`,
    bird.perchedOn ? `PERCHED ${bird.perchedOn.branchId}` : bird.grounded ? "GROUND: WASD to hop" : "FLYING: hold 4+6 to glide",
    `Beak: ${bird.carrying || "empty"} | Insects: ${bird.inventory.insects}`,
    world.nest.started
      ? `Nest G:${world.nest.progress.grass}/${world.nest.required.grass} T:${world.nest.progress.twig}/${world.nest.required.twig} W:${world.nest.progress.web}/${world.nest.required.web}`
      : "Nest: take a twig to a suitable branch (N)",
    bird.grounded ? "Space: peck | 7/9 flare 4/6 lift 1/3 thrust" :
      bird.perchedOn ? "PERCHED N: build with material | any wing: takeoff" :
        "SPACE: grab | 8: dive 2: flare 4+6: glide"
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

function drawAltitudeGauge(ctx, bird) {
  const x = ctx.canvas.width - 29, top = 55, trackHeight = 175;
  ctx.save();
  ctx.fillStyle = 'rgba(16,33,23,.82)';
  ctx.fillRect(x - 24, top - 25, 48, trackHeight + 53);
  ctx.fillStyle = '#D6E6CA';
  ctx.font = '11px monospace';
  ctx.fillText(`${FLIGHT.maxAltitude}m`, x - 15, top - 9);
  ctx.fillStyle = '#526851';
  ctx.fillRect(x - 5, top, 10, trackHeight);
  const fraction = Math.min(1, Math.max(0, bird.altitude / FLIGHT.maxAltitude));
  const filled = fraction * trackHeight;
  ctx.fillStyle = '#BFE2AA';
  ctx.fillRect(x - 5, top + trackHeight - filled, 10, filled);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('0m', x - 8, top + trackHeight + 16);
  ctx.restore();
}

export function renderScene(ctx, world, bird, camera, controls = null) {
  const width = ctx.canvas.width, height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#324237"; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, world, camera);
  drawShrubs(ctx, world);
  drawResources(ctx, world, bird.altitude);
  drawTrees(ctx, world, bird, camera);
  drawNest(ctx, world);
  // A subtle landing target appears when Space can actually grip a branch.
  const nearbyPerch = findNearbyPerch(bird, world);
  if (nearbyPerch) {
    const { x, y } = nearbyPerch.point;
    ctx.save();
    ctx.strokeStyle = '#DDF3A6'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, TWO_PI); ctx.stroke();
    ctx.fillStyle = '#FFF7C9'; ctx.font = '11px monospace';
    ctx.fillText('SPACE', x + 15, y - 8);
    ctx.restore();
  }
  // Mate is a small visible resident of the nesting tree, not full AI yet.
  if (Math.abs(bird.altitude - world.mate.altitude) < 7) {
    drawBird(ctx, { ...world.mate, leftWing: "rest", rightWing: "rest",
      leftWingTimer: 0, rightWingTimer: 0, glide: false,
      tailPhase: world.mate.phase }, world.mate.x, world.mate.y, true);
  }
  ctx.restore();
  // Only a faint shadow changes size with altitude: keeps 2D coords stable.
  disk(ctx, width / 2 + 6, height / 2 + 12,
    Math.max(3, 17 - bird.altitude * 0.55),
    `rgba(22,43,31,${Math.max(0.03, 0.20 - bird.altitude * .008)})`);
  drawBird(ctx, bird, width / 2, height / 2);
  if (bird.peckAnimation > 0 && bird.grounded) {
    const pulse = (1 - bird.peckAnimation / 0.28);
    ctx.save(); ctx.globalAlpha = Math.max(0, 0.65 - pulse * 0.5);
    ctx.strokeStyle = '#E1C99A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(width / 2, height / 2 + 2, 17 + pulse * 18, 0, TWO_PI);
    ctx.stroke(); ctx.restore();
  }
  drawOverheadFoliage(ctx, world, bird, camera);
  drawVignette(ctx, width, height, bird);
  drawHud(ctx, bird, world, controls);
  drawAltitudeGauge(ctx, bird);
}
