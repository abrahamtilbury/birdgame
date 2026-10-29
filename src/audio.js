// Small, opt-in Willie Wagtail contact-call layer. No autoplay.
// Put the actual MP3 at assets/audio/wagtail-contact.mp3.
export function createBirdsong(toggleButton) {
  const call = new Audio('./assets/audio/wagtail-contact.mp3');
  call.preload = 'none';
  call.loop = false;
  call.volume = 0.24;
  let enabled = false;
  let available = true;
  let elapsed = 0;
  let nextCall = 20 + Math.random() * 25;

  function paint() {
    toggleButton.textContent = !available ? 'Bird call unavailable' :
      enabled ? '🔊 Bird calls: On' : '🔇 Bird calls: Off';
    toggleButton.setAttribute('aria-pressed', String(enabled));
    toggleButton.disabled = !available;
  }
  call.addEventListener('error', () => { available = false; enabled = false; paint(); });
  toggleButton.addEventListener('click', async () => {
    if (!available) return;
    if (enabled) {
      enabled = false;
      call.pause();
      call.currentTime = 0;
      paint();
      return;
    }
    try {
      // A direct user gesture unlocks playback on iPhone browsers.
      call.currentTime = 0;
      await call.play();
      enabled = true;
      elapsed = 0;
      paint();
    } catch (_) {
      available = false;
      enabled = false;
      paint();
    }
  });
  paint();
  return {
    update(dt, world) {
      if (!enabled || !available || document.hidden) return;
      elapsed += dt;
      if (elapsed < nextCall || !call.paused) return;
      elapsed = 0;
      nextCall = 20 + Math.random() * 25;
      const nest = world.nest;
      const mate = world.mate;
      const nearNest = nest.started &&
        Math.hypot(mate.x - nest.point.x, mate.y - nest.point.y) < 60;
      call.volume = nearNest ? 0.28 : 0.18;
      call.currentTime = 0;
      call.play().catch(() => { enabled = false; paint(); });
    }
  };
}
