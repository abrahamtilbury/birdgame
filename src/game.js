
const FIXED_TIMESTEP = 1 / 60;
const MAX_FRAME_TIME = 0.1;

// Start the game engine
export function startGame(update, render) {
  let lastTime = null;
  let accumulator = 0;

  function gameLoop(timestamp) {

    // Initialise timing on the first frame
    if (lastTime === null) {
      lastTime = timestamp;
    }

    // Calculate elapsed time in seconds
    let deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Prevent huge jumps after tab inactivity
    deltaTime = Math.min(deltaTime, MAX_FRAME_TIME);

    // Accumulate time for physics updates
    accumulator += deltaTime;

    // Run simulation at a fixed 60 Hz
    while (accumulator >= FIXED_TIMESTEP) {
      update(FIXED_TIMESTEP);
      accumulator -= FIXED_TIMESTEP;
    }

    // Draw the current game state
    render();

    // Request the next frame
    requestAnimationFrame(gameLoop);
  }

  // Begin the game loop
  requestAnimationFrame(gameLoop);
}
