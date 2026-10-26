
 // Create a camera for the game viewport
export function createCamera(width, height) {
  return {
    x: 0,
    y: 0,
    width,
    height
  };
}

// Keep the bird centred in the viewport
export function updateCamera(camera, bird) {
  camera.x = bird.x - camera.width / 2;
  camera.y = bird.y - camera.height / 2;
}

// Convert world coordinates to screen coordinates
export function worldToScreen(camera, x, y) {
  return {
    x: x - camera.x,
    y: y - camera.y
  };
}
