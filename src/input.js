// Buffered keyboard/pointer input. A key press is recorded even between physics ticks.
const wingNumbers = new Set([1, 3, 4, 6, 7, 9]);
const pitchByNumber = { 2: "backward", 5: "neutral", 8: "forward" };
const actionCodes = new Set(["Space", "KeyE", "KeyN", "KeyF", "KeyT"]);
const groundCodes = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

export const input = {
  pressed: new Set(), pitch: "neutral", wingEvents: [], actions: [],
  lastInput: "none", inputCount: 0
};

export function getNumber(code) {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return match ? Number(match[1]) : null;
}

export function initInput() {
  const indicators = document.querySelectorAll("#keypad kbd");
  function updateIndicators() {
    indicators.forEach(el => {
      const number = getNumber(el.dataset.key);
      el.classList.toggle("pressed", input.pressed.has(`Numpad${number}`));
      el.classList.toggle("selected", pitchByNumber[number] === input.pitch);
    });
  }

  function press(code) {
    const number = getNumber(code);
    const canonical = number === null ? code : `Numpad${number}`;
    if (number === null && !actionCodes.has(code) && !groundCodes.has(code)) return;
    if (input.pressed.has(canonical)) return;
    input.pressed.add(canonical);
    input.lastInput = canonical;
    input.inputCount++;
    if (wingNumbers.has(number)) input.wingEvents.push(number);
    if (pitchByNumber[number]) input.pitch = pitchByNumber[number];
    if (actionCodes.has(code)) input.actions.push(code);
    updateIndicators();
  }
  function release(code) {
    const number = getNumber(code);
    const canonical = number === null ? code : `Numpad${number}`;
    input.pressed.delete(canonical);
    updateIndicators();
  }

  window.addEventListener("keydown", event => {
    const number = getNumber(event.code);
    if (number === null && !actionCodes.has(event.code) && !groundCodes.has(event.code)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat) press(event.code);
  });
  window.addEventListener("keyup", event => {
    const number = getNumber(event.code);
    if (number === null && !actionCodes.has(event.code) && !groundCodes.has(event.code)) return;
    event.preventDefault();
    release(event.code);
  });

  // The pictured numpad is also playable with mouse or touch.
  indicators.forEach(el => {
    el.addEventListener("pointerdown", event => {
      event.preventDefault();
      el.setPointerCapture(event.pointerId);
      press(el.dataset.key);
    });
    el.addEventListener("pointerup", () => release(el.dataset.key));
    el.addEventListener("pointercancel", () => release(el.dataset.key));
    el.addEventListener("lostpointercapture", () => release(el.dataset.key));
  });

  window.addEventListener("blur", () => {
    input.pressed.clear();
    input.wingEvents.length = 0;
    input.actions.length = 0;
    updateIndicators();
  });
  updateIndicators();
}
