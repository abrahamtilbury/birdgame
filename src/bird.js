// A single wing stroke has three positions: up -> out -> down.
const WING_KEYS = {
  7: ["left", "raised"], 4: ["left", "middle"], 1: ["left", "lowered"],
  9: ["right", "raised"], 6: ["right", "middle"], 3: ["right", "lowered"]
};

export function createWillieWagtail() {
  return {
    species: "willie-wagtail", x: 320, y: 320, altitude: 0,
    velocityX: 0, velocityY: 0, velocityZ: 0,
    heading: 0, pitch: "neutral", roll: 0,
    leftWing: "rest", rightWing: "rest",
    leftStrokePhase: 0, rightStrokePhase: 0,
    leftFlapCount: 0, rightFlapCount: 0,
    leftWingTimer: 0, rightWingTimer: 0,
    grounded: true, perchedOn: null,
    glide: false, hopTimer: 0, hopAnimation: 0,
    tailPhase: 0, inventory: { grass: 0, twig: 0, web: 0, insects: 0 },
    message: "Find a perch, forage and build a nest", messageTime: 5
  };
}

function applyWingEvent(bird, number) {
  const match = WING_KEYS[number];
  if (!match) return;
  const [side, position] = match;
  const phaseKey = `${side}StrokePhase`;
  bird[`${side}Wing`] = position;
  bird[`${side}WingTimer`] = 0.6;
  if (position === "raised") bird[phaseKey] = 1;
  else if (position === "middle") bird[phaseKey] = bird[phaseKey] === 1 ? 2 : 0;
  else if (position === "lowered") {
    if (bird[phaseKey] === 2) bird[`${side}FlapCount`] += 1;
    bird[phaseKey] = 0;
  }
}

function hopOnGround(bird, controls, dt) {
  bird.hopTimer -= dt;
  bird.hopAnimation = Math.max(0, bird.hopAnimation - dt);
  if (!bird.grounded || bird.perchedOn) return;
  const dx = Number(controls.pressed.has("KeyD")) - Number(controls.pressed.has("KeyA"));
  const dy = Number(controls.pressed.has("KeyS")) - Number(controls.pressed.has("KeyW"));
  if (!dx && !dy) return;
  if (bird.hopTimer > 0) return;
  const norm = Math.hypot(dx, dy);
  bird.x += (dx / norm) * 14;
  bird.y += (dy / norm) * 14;
  bird.heading = Math.atan2(dx, -dy);
  bird.hopTimer = 0.16;
  bird.hopAnimation = 0.16;
}

export function updateBird(bird, controls, dt) {
  bird.pitch = controls.pitch;
  for (const number of controls.wingEvents.splice(0)) applyWingEvent(bird, number);
  bird.leftWingTimer = Math.max(0, bird.leftWingTimer - dt);
  bird.rightWingTimer = Math.max(0, bird.rightWingTimer - dt);
  // Both wings held out support a controlled glide at sufficient airspeed.
  bird.glide = controls.pressed.has("Numpad4") && controls.pressed.has("Numpad6");
  bird.tailPhase += dt * (bird.grounded ? 11 : 7);
  bird.messageTime = Math.max(0, bird.messageTime - dt);
  hopOnGround(bird, controls, dt);
}

export function setBirdMessage(bird, message, duration = 2.5) {
  bird.message = message;
  bird.messageTime = duration;
}
