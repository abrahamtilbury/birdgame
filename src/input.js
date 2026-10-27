
const wingNumbers = new Set([1, 3, 4, 6, 7, 9]);

const pitchByNumber = {
  2: "backward",
  5: "neutral",
  8: "forward"
};

const actionCodes = new Set([
  "Space", "KeyE", "KeyN", "KeyF", "KeyT", "KeyX"
]);

const groundCodes = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD"
]);

// On touchscreens, these keys become arrows while grounded.
const touchGroundArrows = {
  Numpad8: "KeyW",
  Numpad4: "KeyA",
  Numpad2: "KeyS",
  Numpad6: "KeyD"
};

export const input = {
  pressed: new Set(),
  pitch: "neutral",
  wingEvents: [],
  actions: [],
  lastInput: "none",
  inputCount: 0,
  touchGroundMode: true
};

export function getNumber(code) {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return match ? Number(match[1]) : null;
}

export function initInput() {
  // Covers both keypad keys and HTML action buttons.
  const controls = document.querySelectorAll("[data-key]");
  const sourcesByCode = new Map();

  function canonicalize(code) {
    const number = getNumber(code);
    if (number !== null) return `Numpad${number}`;

    if (actionCodes.has(code) || groundCodes.has(code)) {
      return code;
    }

    return null;
  }

  function updateIndicators() {
    controls.forEach(el => {
      const code = canonicalize(el.dataset.key);

      const isGroundArrow =
        input.touchGroundMode &&
        touchGroundArrows[el.dataset.key] &&
        window.matchMedia("(pointer: coarse)").matches;

      const effectiveCode = isGroundArrow
        ? touchGroundArrows[el.dataset.key]
        : code;

      el.classList.toggle(
        "pressed",
        input.pressed.has(effectiveCode)
      );

      const number = getNumber(el.dataset.key);

      el.classList.toggle(
        "selected",
        number !== null && pitchByNumber[number] === input.pitch
      );
    });
  }

  function press(code, source) {
    const canonical = canonicalize(code);
    if (!canonical) return;

    let sources = sourcesByCode.get(canonical);

    if (!sources) {
      sources = new Set();
      sourcesByCode.set(canonical, sources);
    }

    if (sources.has(source)) return;

    const firstPress = sources.size === 0;
    sources.add(source);

    if (!firstPress) return;

    input.pressed.add(canonical);
    input.lastInput = canonical;
    input.inputCount++;

    const number = getNumber(code);

    if (wingNumbers.has(number)) {
      input.wingEvents.push(number);
    }

    if (pitchByNumber[number]) {
      input.pitch = pitchByNumber[number];
    }

    if (actionCodes.has(canonical)) {
      input.actions.push(canonical);
    }

    updateIndicators();
  }

  function release(code, source) {
    const canonical = canonicalize(code);
    if (!canonical) return;

    const sources = sourcesByCode.get(canonical);

    if (!sources || !sources.delete(source)) return;

    if (sources.size === 0) {
      sourcesByCode.delete(canonical);
      input.pressed.delete(canonical);
    }

    updateIndicators();
  }

  // Physical keyboard
  window.addEventListener("keydown", event => {
    if (!canonicalize(event.code)) return;

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    event.preventDefault();

    if (!event.repeat) {
      press(event.code, "keyboard");
    }
  });

  window.addEventListener("keyup", event => {
    if (!canonicalize(event.code)) return;

    event.preventDefault();
    release(event.code, "keyboard");
  });

  // Mouse and multitouch on-screen controls.
  controls.forEach(el => {
    const code = el.dataset.key;
    const activePointers = new Map();

    el.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      event.preventDefault();

      const effectiveCode =
        event.pointerType !== "mouse" &&
        input.touchGroundMode
          ? (touchGroundArrows[code] || code)
          : code;

      activePointers.set(event.pointerId, effectiveCode);

      try {
        el.setPointerCapture(event.pointerId);
      } catch (_) {
        // The release handlers still clean up input.
      }

      press(effectiveCode, `pointer-${event.pointerId}`);
    });

    function releasePointer(event) {
      const effectiveCode = activePointers.get(event.pointerId);
      if (!effectiveCode) return;

      activePointers.delete(event.pointerId);
      release(effectiveCode, `pointer-${event.pointerId}`);
    }

    el.addEventListener("pointerup", releasePointer);
    el.addEventListener("pointercancel", releasePointer);
    el.addEventListener("lostpointercapture", releasePointer);
  });

  function clearInput() {
    sourcesByCode.clear();
    input.pressed.clear();
    input.wingEvents.length = 0;
    input.actions.length = 0;
    updateIndicators();
  }

  window.addEventListener("blur", clearInput);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInput();
  });

  updateIndicators();
}
