// Optional authentic Willie Wagtail recording; never auto-play on load.
// Permanent asset: audio/wagtail-contact.mp3.
const CALL_PATH = './audio/wagtail-contact.mp3';

export function createBirdsong(toggleButton) {
  const call = new Audio(CALL_PATH);
  call.preload = 'none';
  call.loop = false;
  call.volume = 0.24;
  let enabled = false;
  let problem = '';
  let elapsed = 0;
  let nextCall = 20 + Math.random() * 25;
  let activePath = CALL_PATH;

  function paint() {
    toggleButton.textContent = enabled ? '🔊 Bird calls: On' :
      problem ? '⚠ Retry bird call' : '🔇 Bird calls: Off';
    toggleButton.title = problem || `Play authentic contact call (${activePath})`;
    toggleButton.setAttribute('aria-pressed', String(enabled));
    // Do not disable: after copying in the missing file, retry must be possible.
    toggleButton.disabled = false;
  }

  call.addEventListener('error', () => {
    enabled = false;
    problem = `Could not load ${activePath}. Check the name, extension and case.`;
    paint();
  });
  toggleButton.addEventListener('click', async () => {
    if (enabled) {
      enabled = false;
      call.pause();
      call.currentTime = 0;
      paint();
      return;
    }
    problem = '';
    paint();
    try {
      // Retry the real file after a 404, rather than permanently disabling audio.
      if (call.error) {
        call.src = `${CALL_PATH}?retry=${Date.now()}`;
        call.load();
      }
      call.currentTime = 0;
      await call.play(); // In the user's actual click, unlocks mobile media.
      enabled = true;
      elapsed = 0;
      nextCall = 20 + Math.random() * 25;
    } catch (error) {
      enabled = false;
      problem = error?.name === 'NotAllowedError'
        ? 'Browser blocked audio. Tap again to enable.'
        : `Could not play ${activePath}. Confirm the audio file exists and is valid.`;
      console.warn('[Bird Flight] Birdsong unavailable:', problem, error);
    }
    paint();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !call.paused) call.pause();
  });
  paint();
  return {
    status() { return { enabled, problem, path: activePath }; },
    update(dt, world) {
      if (!enabled || document.hidden) return;
      elapsed += dt;
      if (elapsed < nextCall || !call.paused) return;
      elapsed = 0;
      nextCall = 20 + Math.random() * 25;
      const nest = world.nest;
      const mate = world.mate;
      const nearNest = nest.started && nest.point &&
        Math.hypot(mate.x - nest.point.x, mate.y - nest.point.y) < 60;
      call.volume = nearNest ? 0.28 : 0.18;
      call.currentTime = 0;
      call.play().catch(error => {
        enabled = false;
        problem = `Playback failed for ${activePath}`;
        console.warn('[Bird Flight]', problem, error);
        paint();
      });
    }
  };
}
