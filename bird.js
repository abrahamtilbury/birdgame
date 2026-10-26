
const LEFT_WING_KEYS = {
  Numpad1: "raised",
  Numpad4: "middle",
  Numpad7: "lowered"
};

const RIGHT_WING_KEYS = {
  Numpad3: "raised",
  Numpad6: "middle",
  Numpad9: "lowered"
};

// Create the first playable bird
export function createWillieWagtail() {
  return {
    species: "willie-wagtail",

    // Position in the world
    x: 320,
    y: 320,
    altitude: 0,

    // Movement velocities
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,

    // Orientation
    heading: 0,
    pitch: "neutral",
    roll: 0,

    // Independent wing positions
    leftWing: "rest",
    rightWing: "rest",

    // Ground and branch interaction
    grounded: true,
    perchedOn: null,

    // Animation
    tailPhase: 0
  };
}

// Read the most recently pressed wing-position key
function readWingPosition(pressedKeys, mapping) {
  let position = "rest";

  for (const key of pressedKeys) {
    if (Object.hasOwn(mapping, key)) {
      position = mapping[key];
    }
  }

  return position;
}

// Update bird controls
export function updateBird(bird, controls, deltaTime) {
  // Body-weight selection
  bird.pitch = controls.pitch;

  // Independent left and right wing positions
  bird.leftWing = readWingPosition(
    controls.pressed,
    LEFT_WING_KEYS
  );

  bird.rightWing = readWingPosition(
    controls.pressed,
    RIGHT_WING_KEYS
  );

  // Gentle wagtail tail movement
  bird.tailPhase += deltaTime * 5;
}
