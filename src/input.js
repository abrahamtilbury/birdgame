// Preserve discrete keydown events, including taps between physics frames.
const wingNumbers = new Set([1, 3, 4, 6, 7, 9]);
const pitchByNumber = { 2: "backward", 5: "neutral", 8: "forward" };
const actionCodes = new Set(["Space", "KeyE", "KeyF"]);
const groundCodes = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

export const input = {
  pressed: new Set(),
  pitch: "neutral",
  wingEvents: [],
  actions: []
};

export function getNumber(code) {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return m ? Number(m[1]) : null;
}

export function initInput() {
  const indicators = document.querySelectorAll("#keypad kbd");
  const updateIndicators = () => {
    indicators.forEach(el => {
      const number = getNumber(el.dataset.key);
      const isPressed = input.pressed.has(`Numpad${number}`);
      el.classList.toggle("pressed", isPressed);
      el.classList.toggle("selected", pitchByNumber[number] === input.pitch);
    });
  };

  window.addEventListener("keydown", event => {
    const number = getNumber(event.code);
    const code = number === null ? event.code : `Numpad${number}`;
    if (number === null && !actionCodes.has(code) && !groundCodes.has(code)) return;
    event.preventDefault();
    // A new press is an event, a held key is a state. Both are needed.
    if (event.repeat || input.pressed.has(code)) return;
    input.pressed.add(code);
    if (wingNumbers.has(number)) input.wingEvents.push(number);
    if (pitchByNumber[number]) input.pitch = pitchByNumber[number];
    if (actionCodes.has(code)) input.actions.push(code);
    updateIndicators();
  });

  window.addEventListener("keyup", event => {
    const number = getNumber(event.code);
    const code = number === null ? event.code : `Numpad${number}`;
    if (input.pressed.has(code)) event.preventDefault();
    input.pressed.delete(code);
    updateIndicators();
  });

  window.addEventListener("blur", () => {
    input.pressed.clear();
    input.wingEvents.length = 0;
    input.actions.length = 0;
    updateIndicators();
  });
  updateIndicators();
}
