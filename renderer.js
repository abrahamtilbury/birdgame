
 // Bird Flight — top-down Canvas renderer.
 // Horizontal world coordinates are pixels; bird altitude is in gameplay metres.
 // This module only draws: movement and collisions remain in other modules.

import { getTreeSection } from "./world.js";

function circle(ctx, x, y, radius, colour) {
  if (radius <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
}

function drawGround(ctx, world) {
  ctx.fillStyle = world.groundColour;
  ctx.fillRect(0, 0, world.width, world.height);
}

function drawShrubs(ctx, world, altitude) {
  // Shrubs remain on the ground; from high above they look less prominent.
  ctx.save();
  ctx.globalAlpha = altitude < 2 ? 1 : 0.55;

  for (const shrub of world.shrubs) {
    const r = shrub.radius;
    circle(ctx, shrub.x, shrub.y, r, "#426D43");
    circle(ctx, shrub.x - r * 0.35, shrub.y - r * 0.25,
      r * 0.65, "#60915A");
    circle(ctx, shrub.x + r * 0.4, shrub.y + r * 0.2,
      r * 0.57, "#527E4B");
  }

  ctx.restore();
}

function drawCanopy(ctx, tree, radius) {
  // All leaf patches are anchored to the tree's world coordinates.
  circle(ctx, tree.x, tree.y, radius, "#386C3D");
  circle(ctx, tree.x - radius * 0.32, tree.y - radius * 0.2,
    radius * 0.58, "#477D42");
  circle(ctx, tree.x + radius * 0.34, tree.y - radius * 0.18,
    radius * 0.53, "#55894A");
  circle(ctx, tree.x + radius * 0.1, tree.y + radius * 0.32,
    radius * 0.53, "#467A40");
  circle(ctx, tree.x - radius * 0.18, tree.y + radius * 0.1,
    radius * 0.27, "#669B54");
}

function drawTrunk(ctx, tree, radius) {
  circle(ctx, tree.x, tree.y, radius + 3, "#4F6043");
  circle(ctx, tree.x, tree.y, radius, "#70543B");
  circle(ctx, tree.x, tree.y, radius * 0.7, "#94714C");
  circle(ctx, tree.x, tree.y, radius * 0.35, "#70543B");
}

function drawBranch(ctx, tree, branch) {
  const x1 = tree.x + branch.x1;
  const y1 = tree.y + branch.y1;
  const x2 = tree.x + branch.x2;
  const y2 = tree.y + branch.y2;

  ctx.lineCap = "round";
  ctx.strokeStyle = "#5A422D";
  ctx.lineWidth = branch.width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = "#A17A53";
  ctx.lineWidth = Math.max(2, branch.width * 0.4);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawTrees(ctx, world, altitude) {
  for (const tree of world.trees) {
    const section = getTreeSection(tree, altitude);

    if (section.canopyRadius > 0) {
      drawCanopy(ctx, tree, section.canopyRadius);
    }

    if (section.trunkRadius > 0) {
      drawTrunk(ctx, tree, section.trunkRadius);
    }

    for (const branch of section.branches) {
      drawBranch(ctx, tree, branch);
    }
  }
}

function wingTip(position) {
  switch (position) {
    case "raised":  return { reach: 43, y: -53 };
    case "middle":  return { reach: 75, y: -17 };
    case "lowered": return { reach: 45, y: 34 };
    default:        return { reach: 61, y: -17 };
  }
}

function drawWing(ctx, side, position) {
  const tip = wingTip(position);
  const x = side * tip.reach;

  ctx.fillStyle = "#222C34";
  ctx.strokeStyle = "#17222A";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(side * 9, -12);
  ctx.lineTo(x * 0.82, tip.y - 11);
  ctx.lineTo(x, tip.y);
  ctx.lineTo(x * 0.88, tip.y + 12);
  ctx.lineTo(side * 12, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // White patches characteristic of the Willie Wagtail.
  ctx.strokeStyle = "#F1F1E7";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(side * 19, -1);
  ctx.lineTo(x * 0.76, tip.y + 2);
  ctx.stroke();
}

function drawBird(ctx, bird, centreX, centreY) {
  ctx.save();
  ctx.translate(centreX, centreY);
  ctx.rotate(bird.heading);

  // A little tail movement, even when not flying.
  const tailWag = Math.sin(bird.tailPhase) * 5;
  ctx.fillStyle = "#222C34";
  ctx.beginPath();
  ctx.moveTo(-7, 13);
  ctx.lineTo(-11 + tailWag, 48);
  ctx.lineTo(0 + tailWag, 40);
  ctx.lineTo(11 + tailWag, 48);
  ctx.lineTo(7, 13);
  ctx.closePath();
  ctx.fill();

  drawWing(ctx, -1, bird.leftWing);
  drawWing(ctx, 1, bird.rightWing);

  circle(ctx, 0, 0, 14, "#293139");
  ctx.fillStyle = "#293139";
  ctx.beginPath();
  ctx.ellipse(0, 3, 12, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Moving the head makes the selected body-weight position visible.
  const headOffset = bird.pitch === "forward" ? -6
    : bird.pitch === "backward" ? 5 : 0;
  const headY = -20 + headOffset;
  circle(ctx, 0, headY, 12, "#252D35");

  ctx.fillStyle = "#E1B15B";
  ctx.beginPath();
  ctx.moveTo(-4, headY - 9);
  ctx.lineTo(0, headY - 19);
  ctx.lineTo(4, headY - 9);
  ctx.closePath();
  ctx.fill();

  // Small feet while perched or grounded.
  if (bird.perchedOn || bird.grounded) {
    ctx.strokeStyle = "#B38D63";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, 17);
    ctx.lineTo(-7, 24);
    ctx.moveTo(5, 17);
    ctx.lineTo(7, 24);
    ctx.stroke();
  }

  ctx.restore();
}

function drawOverheadLeaves(ctx, world, bird, camera) {
  // Only show an overhead foliage tint when the bird is INSIDE a canopy.
  // This indicates leaves above the bird without hiding the flight controls.
  for (const tree of world.trees) {
    const { baseHeight, topHeight, radius } = tree.canopy;
    if (bird.altitude < baseHeight || bird.altitude >= topHeight) continue;
    if (Math.hypot(bird.x - tree.x, bird.y - tree.y) >= radius) continue;

    ctx.save();
    ctx.globalAlpha = 0.16;
    circle(ctx, tree.x - camera.x, tree.y - camera.y,
      radius, "#244F30");
    ctx.restore();
  }
}

function drawHud(ctx, bird) {
  ctx.save();
  ctx.fillStyle = "rgba(15, 28, 22, 0.78)";
  ctx.fillRect(8, 8, 305, 131);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "14px monospace";
  ctx.textBaseline = "top";

  const status = bird.perchedOn
    ? `Perched: ${bird.perchedOn.branchId}`
    : bird.grounded ? "Grounded" : "Flying";
  const lines = [
    `Pitch: ${bird.pitch}`,
    `Wings: ${bird.leftWing} / ${bird.rightWing}`,
    `Altitude: ${bird.altitude.toFixed(2)} m`,
    `Heading: ${(bird.heading * 180 / Math.PI).toFixed(0)} deg`,
    `Position: ${bird.x.toFixed(0)}, ${bird.y.toFixed(0)}`,
    status
  ];

  lines.forEach((line, index) => ctx.fillText(line, 16, 16 + index * 20));
  ctx.restore();
}

// One rendering entry point. Never updates bird physics or camera coordinates.
export function renderScene(ctx, world, bird, camera) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#324237"; // Visible only outside world boundaries.
  ctx.fillRect(0, 0, width, height);

  // World objects move in the opposite direction of the camera.
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, world);
  drawShrubs(ctx, world, bird.altitude);
  drawTrees(ctx, world, bird.altitude);
  ctx.restore();

  // Screen-space bird: always remains at the centre of the square viewport.
  drawBird(ctx, bird, width / 2, height / 2);
  drawOverheadLeaves(ctx, world, bird, camera);
  drawHud(ctx, bird);
}
