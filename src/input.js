
const validKeys = new Set([
  "Numpad1", "Numpad2", "Numpad3",
  "Numpad4", "Numpad5", "Numpad6",
  "Numpad7", "Numpad8", "Numpad9"
]);

const pitchKeys = {
  Numpad2: "backward",
  Numpad5: "neutral",
  Numpad8: "forward"
};

// Current control state
export const input = {
  pressed: new Set(),
  pitch: "neutral"
};

// Check whether a key is currently held
export function isKeyDown(number) {
  return input.pressed.has(`Numpad${number}`);
}

// Initialise keyboard input
export function initInput() {
  const indicators = document.querySelectorAll("#keypad kbd");

  function updateIndicators() {
    indicators.forEach(indicator => {
      const key = indicator.dataset.key;

      indicator.classList.toggle(
        "pressed",
        input.pressed.has(key)
      );

      indicator.classList.toggle(
        "selected",
        pitchKeys[key] === input.pitch
      );
    });
  }

  // Key pressed
  window.addEventListener("keydown", event => {
    if (!validKeys.has(event.code)) return;

    event.preventDefault();
    input.pressed.add(event.code);

    // Body position stays selected until changed
    if (pitchKeys[event.code]) {
      input.pitch = pitchKeys[event.code];
    }

    updateIndicators();
  });

  // Key released
  window.addEventListener("keyup", event => {
    if (!validKeys.has(event.code)) return;

    event.preventDefault();
    input.pressed.delete(event.code);

    updateIndicators();
  });

  // Clear held keys when the game loses focus
  window.addEventListener("blur", () => {
    input.pressed.clear();
    updateIndicators();
  });

  updateIndicators();
}
