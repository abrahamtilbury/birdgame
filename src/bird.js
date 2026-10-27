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
    lastHopDirection: "none",
    hunger: 80,
    tailPhase: 0, inventory: { grass: 0, twig: 0, web: 0, insects: 0 },
    carrying: null, lastWingEvent: "none",
    // Six wing keys produce distinct impulses. Continuous poses use eased values.
    leftLiftImpulse: 0, rightLiftImpulse: 0,
    leftThrustImpulse: 0, rightThrustImpulse: 0,
    leftBrakeImpulse: 0, rightBrakeImpulse: 0,
    leftWingPose: 0, rightWingPose: 0,
    leftWingFold: 0, rightWingFold: 0,
    leftWingPulse: 0, rightWingPulse: 0,
    leftHeld: false, rightHeld: false,
    bank: 0,
    rollRate: 0,
    yawRate: 0,
    tailSpread: 0.35,
    tailTwist: 0,
    pitchVisual: 0,
    flightMode: "ground",
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
  bird.hopTimer = Math.max(0, bird.hopTimer - dt);
  bird.hopAnimation = Math.max(0, bird.hopAnimation - dt);

  if (!bird.grounded || bird.perchedOn) return;

  const dx =
    Number(controls.pressed.has("KeyD")) -
    Number(controls.pressed.has("KeyA"));

  const dy =
    Number(controls.pressed.has("KeyS")) -
    Number(controls.pressed.has("KeyW"));

  if (!dx && !dy) {
    bird.lastHopDirection = "none";
    return;
  }

  // Changing direction causes an immediate new hop.
  const direction = `${dx},${dy}`;
  if (direction !== bird.lastHopDirection) {
    bird.hopTimer = 0;
  }

  bird.lastHopDirection = direction;
  if (bird.hopTimer > 0) return;

  const distance = 20;
  const norm = Math.hypot(dx, dy);

  bird.x += dx / norm * distance;
  bird.y += dy / norm * distance;
  bird.heading = Math.atan2(dx, -dy);

  bird.hopTimer = 0.125;
  bird.hopAnimation = 0.125;
}

export function updateBird(bird, controls, dt) {
  bird.pitch = controls.pitch;
  for (const number of controls.wingEvents.splice(0)) applyWingEvent(bird, number);
  
  // Holding a wing key maintains its posture.
  // Tapping produces a brief flap, then the wing folds.
  const wingKeys = {
    left: [
      ["Numpad7", "raised"],
      ["Numpad4", "middle"],
      ["Numpad1", "lowered"]
    ],
    right: [
      ["Numpad9", "raised"],
      ["Numpad6", "middle"],
      ["Numpad3", "lowered"]
    ]
  };

  for (const side of ["left", "right"]) {
    const heldEntries = wingKeys[side].filter(
      ([code]) => controls.pressed.has(code)
    );

    const current = bird[`${side}Wing`];

    const position =
      heldEntries.find(([, pos]) => pos === current)?.[1]
      ?? heldEntries[0]?.[1]
      ?? "rest";

    const holding = heldEntries.length > 0;

    bird[`${side}Held`] = holding;
    bird[`${side}Wing`] = position;

    bird[`${side}WingTimer`] = Math.max(
      0, bird[`${side}WingTimer`] - dt
    );

    bird[`${side}WingPulse`] = Math.max(
      0, bird[`${side}WingPulse`] - dt / 0.25
    );

    // A short wingbeat continues after a tap.
    // Sustained extension requires a held key.
    const pulse = Math.sin(
      bird[`${side}WingPulse`] * Math.PI
    );

    const extensionTarget = holding
      ? 1
      : Math.max(0, pulse * 0.9);

    bird[`${side}WingFold`] +=
      (extensionTarget - bird[`${side}WingFold`]) *
      (1 - Math.exp(-dt * (holding ? 24 : 19)));

    const poseTarget =
      position === "raised" ? -1 :
      position === "lowered" ? 1 : 0;

    bird[`${side}WingPose`] +=
      (poseTarget - bird[`${side}WingPose`]) *
      (1 - Math.exp(-dt * 18));
  }

  const targetPitch = bird.pitch === 'forward' ? 1 : bird.pitch === 'backward' ? -1 : 0;
  bird.pitchVisual += (targetPitch - bird.pitchVisual) * (1 - Math.exp(-dt * 10));
  // A held matching pair selects flight mode. Tapping any key is still a flap.
  bird.glide = bird.leftHeld && bird.rightHeld;
  bird.flightMode = controls.pressed.has('Numpad4') && controls.pressed.has('Numpad6') ? 'glide' :
    controls.pressed.has('Numpad7') && controls.pressed.has('Numpad9') ? 'flare' :
    controls.pressed.has('Numpad1') && controls.pressed.has('Numpad3') ? 'fast-glide' :
    bird.glide ? 'mixed-wing' : bird.grounded ? 'ground' : 'free-flight';
  bird.tailPhase += dt * (bird.grounded ? 15 : 9);

  bird.hunger = Math.max(
    0,
    (bird.hunger ?? 80) -
      (bird.grounded || bird.perchedOn ? 0.035 : 0.08) * dt
  );
  bird.messageTime = Math.max(0, bird.messageTime - dt);
  bird.flapFeedbackTimer = Math.max(0, bird.flapFeedbackTimer - dt);
  bird.peckAnimation = Math.max(0, bird.peckAnimation - dt);
  hopOnGround(bird, controls, dt);
}

export function setBirdMessage(bird, message, duration = 2.5) {
  bird.message = message;
  bird.messageTime = duration;
}
