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
    totalFlaps: 0, flapFeedbackTimer: 0, airspeed: 0,
    leftWingTimer: 0, rightWingTimer: 0,
    grounded: true, perchedOn: null,
    glide: false, hopTimer: 0, hopAnimation: 0, peckAnimation: 0,
    tailPhase: 0, inventory: { grass: 0, twig: 0, web: 0, insects: 0 },
    carrying: null, lastWingEvent: "none",
    // Six wing keys produce distinct impulses. Continuous poses use eased values.
    leftLiftImpulse: 0, rightLiftImpulse: 0,
    leftThrustImpulse: 0, rightThrustImpulse: 0,
    leftBrakeImpulse: 0, rightBrakeImpulse: 0,
    leftWingPose: 0, rightWingPose: 0,
    leftWingPulse: 0, rightWingPulse: 0,
    leftHeld: false, rightHeld: false,
    bank: 0, pitchVisual: 0, flightMode: "ground",
    message: "Find a perch, forage and build a nest", messageTime: 5
  };
}

// These are game-feel approximations, not literal wingbeat aerodynamics.
// Every fresh key press is a flap; held keys select different glide postures.
export const WING_EFFECTS = Object.freeze({
  raised:  { lift: 0.58, thrust: 0.20, brake: 1.0 },
  middle:  { lift: 1.15, thrust: 0.45, brake: 0.05 },
  lowered: { lift: 0.83, thrust: 1.22, brake: 0 }
});

function applyWingEvent(bird, number) {
  const match = WING_KEYS[number];
  if (!match) return;
  const [side, position] = match;
  const effect = WING_EFFECTS[position];
  bird[`${side}Wing`] = position;
  bird.lastWingEvent = `${side} ${position}`;
  bird[`${side}WingTimer`] = 0.34;
  bird[`${side}WingPulse`] = 1;
  bird[`${side}LiftImpulse`] += effect.lift;
  bird[`${side}ThrustImpulse`] += effect.thrust;
  bird[`${side}BrakeImpulse`] += effect.brake;
  bird[`${side}FlapCount`] += 1;
  bird[`${side}StrokePhase`] = position === 'raised' ? 0 : position === 'middle' ? 1 : 2;
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
  const held = side => [side === 'left' ? '7' : '9', side === 'left' ? '4' : '6', side === 'left' ? '1' : '3']
    .some(n => controls.pressed.has(`Numpad${n}`));
  bird.leftHeld = held('left');
  bird.rightHeld = held('right');
  for (const side of ['left', 'right']) {
    bird[`${side}WingTimer`] = Math.max(0, bird[`${side}WingTimer`] - dt);
    bird[`${side}WingPulse`] = Math.max(0, bird[`${side}WingPulse`] - dt / 0.32);
    const position = bird[`${side}Wing`];
    const target = position === 'raised' ? -1 : position === 'lowered' ? 1 : 0;
    bird[`${side}WingPose`] += (target - bird[`${side}WingPose`]) * (1 - Math.exp(-dt * 17));
  }
  const targetPitch = bird.pitch === 'forward' ? 1 : bird.pitch === 'backward' ? -1 : 0;
  bird.pitchVisual += (targetPitch - bird.pitchVisual) * (1 - Math.exp(-dt * 10));
  // A held matching pair selects flight mode. Tapping any key is still a flap.
  bird.glide = bird.leftHeld && bird.rightHeld;
  bird.flightMode = controls.pressed.has('Numpad4') && controls.pressed.has('Numpad6') ? 'glide' :
    controls.pressed.has('Numpad7') && controls.pressed.has('Numpad9') ? 'flare' :
    controls.pressed.has('Numpad1') && controls.pressed.has('Numpad3') ? 'fast-glide' :
    bird.glide ? 'mixed-wing' : bird.grounded ? 'ground' : 'free-flight';
  bird.tailPhase += dt * (bird.grounded ? 11 : 7);
  bird.messageTime = Math.max(0, bird.messageTime - dt);
  bird.flapFeedbackTimer = Math.max(0, bird.flapFeedbackTimer - dt);
  bird.peckAnimation = Math.max(0, bird.peckAnimation - dt);
  hopOnGround(bird, controls, dt);
}

export function setBirdMessage(bird, message, duration = 2.5) {
  bird.message = message;
  bird.messageTime = duration;
}
