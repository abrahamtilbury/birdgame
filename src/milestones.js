// Pokémon-inspired presentation, using the player's own photograph.
// Family begins after nest completion AND the mate actually arrives.
export function createFamilyMilestone(overlay) {
  const photo = overlay.querySelector('#familyPhoto');
  const fallback = overlay.querySelector('#familyPhotoFallback');
  const close = overlay.querySelector('#familyContinue');
  let seen = false;
  let open = false;
  let mateTime = 0;

  // The photo is loaded from the permanent project asset path in index.html.
  photo.addEventListener('error', () => {
    photo.hidden = true;
    fallback.hidden = false;
  });
  photo.addEventListener('load', () => {
    photo.hidden = false;
    fallback.hidden = true;
  });
  function dismiss() {
    open = false;
    overlay.hidden = true;
  }
  function show() {
    open = true;
    overlay.hidden = false;
    close.focus();
  }
  close.addEventListener('click', dismiss);
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dismiss();
    }
  });
  return {
    get isOpen() { return open; },
    // A visual preview only: does NOT mark eggs, nest, or event as completed.
    preview() { show(); },
    update(world, dt) {
      const nest = world.nest;
      if (seen || !nest.built || !nest.point) return;
      const mate = world.mate;
      const dx = mate.x - (nest.point.x + 17);
      const dy = mate.y - (nest.point.y + 13);
      const arrived = Math.hypot(dx, dy) < 20 &&
        Math.abs(mate.altitude - nest.point.height) < 1.5;
      mateTime = arrived ? mateTime + dt : 0;
      if (mateTime < 5) return;
      nest.familyStarted = true;
      nest.eggs = 2;
      seen = true;
      show();
    }
  };
}
