// World-space scrolling camera. Zooming out with altitude provides a strong
// visual height cue without changing the bird's screen-centred position.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createCamera(width, height) {
  return { x: 0, y: 0, width, height, zoom: 1 };
}

export function updateCamera(camera, bird) {
  camera.zoom = clamp(1 - bird.altitude * 0.012, 0.70, 1);
  camera.x = bird.x - camera.width / (2 * camera.zoom);
  camera.y = bird.y - camera.height / (2 * camera.zoom);
}

export function worldToScreen(camera, x, y) {
  return { x: (x - camera.x) * camera.zoom,
    y: (y - camera.y) * camera.zoom };
}
