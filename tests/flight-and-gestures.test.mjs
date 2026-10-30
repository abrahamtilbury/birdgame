import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createWillieWagtail, updateBird } from '../src/bird.js';
import { updateFlightPhysics, FLIGHT } from '../src/flightPhysics.js';
import { createWorld } from '../src/world.js';
import { useNest } from '../src/foraging.js';

const DT = 1 / 60;
const fakeWorld = () => ({
  time: 0, width: 2600, height: 2600, maxAltitude: 40,
  windAt: () => ({ x: 0, y: 0, up: 0 })
});
const controls = keys => ({ pressed: new Set(keys), wingEvents: [], pitch: 'neutral' });
function tick(bird, c, world, n = 1) {
  for (let k = 0; k < n; k++) {
    world.time += DT;
    updateBird(bird, c, DT);
    updateFlightPhysics(bird, DT, world);
  }
}
function event(c, number, atMs) {
  c.wingEvents.push({number, atMs});
  c.pressed.add(`Numpad${number}`);
}
function flyAt(speed = 100) {
  const bird = createWillieWagtail();
  bird.grounded = false;
  bird.altitude = 30;
  bird.velocityY = -speed;
  return bird;
}

test('ground 4+6 coordinated lift: fresh left then right within 160 ms', () => {
  const bird = createWillieWagtail(), c = controls(), w = fakeWorld();
  event(c, 4, 1000); tick(bird, c, w); c.pressed.clear(); tick(bird, c, w);
  assert.equal(bird.grounded, true);
  event(c, 6, 1150); tick(bird, c, w);
  assert.equal(bird.grounded, false);
  assert.ok(bird.velocityZ > 0);
  assert.equal(bird.pairedStrokes, 1);
  tick(bird, c, w, 10);
  assert.equal(bird.pairedStrokes, 1, 'holding both does not reapply lift');
});

test('4+6 pair outside 160 ms does not launch', () => {
  const bird = createWillieWagtail(), c = controls(), w = fakeWorld();
  event(c, 4, 1000); tick(bird, c, w); c.pressed.clear(); tick(bird, c, w);
  event(c, 6, 1165); tick(bird, c, w);
  assert.equal(bird.grounded, true);
});

test('1+3 thrust-heavy takeoff works; 7+9 never powers takeoff', () => {
  const b = createWillieWagtail(), c = controls(), w = fakeWorld();
  event(c, 1, 1000); event(c, 3, 1030); tick(b,c,w);
  assert.equal(b.grounded, false);
  assert.ok(Math.hypot(b.velocityX,b.velocityY) > 0);
  const b2 = createWillieWagtail(), c2 = controls(), w2 = fakeWorld();
  event(c2, 7, 1000); event(c2, 9, 1050); tick(b2,c2,w2);
  assert.equal(b2.grounded, true);
});

test('carrying twig reduces acceleration without affecting gravity', () => {
  const b1 = createWillieWagtail(), b2 = createWillieWagtail();
  const c1 = controls(), c2 = controls();
  const w1 = fakeWorld(), w2 = fakeWorld();
  b2.carrying = 'twig';
  for (const c of [c1,c2]) { event(c, 4, 1000); event(c, 6, 1015); }
  tick(b1,c1,w1); tick(b2,c2,w2);
  assert.ok(b2.velocityZ < b1.velocityZ, `${b2.velocityZ} < ${b1.velocityZ}`);
  assert.equal(b1.effectiveMassKg, 0.020);
  assert.equal(b2.effectiveMassKg, 0.023);
});

test('symmetric gliding descends slower than tucked wings at speed', () => {
  const open = flyAt(100), tucked = flyAt(100);
  const w1=fakeWorld(), w2=fakeWorld(), c1=controls(['Numpad4','Numpad6']),c2=controls();
  open.leftWingFold=open.rightWingFold=1;
  open.leftWing=open.rightWing='middle';
  tick(open,c1,w1,60); tick(tucked,c2,w2,60);
  assert.ok(open.altitude>tucked.altitude+1, `${open.altitude} versus ${tucked.altitude}`);
  assert.ok(open.aeroLift>0);
  assert.equal(tucked.aeroLift, 0);
});

test('low speed stalls even with wings fully extended', () => {
  const b=flyAt(7), c=controls(['Numpad4','Numpad6']), w=fakeWorld();
  b.leftWingFold=b.rightWingFold=1;
  b.leftWing=b.rightWing='middle';
  tick(b,c,w);
  assert.equal(b.aeroLift,0);
  assert.equal(b.aeroState,'STALL');
  assert.ok(b.velocityZ<0);
});

test('one-wing gliding banks and curves the flight path in both directions', () => {
  const left=flyAt(100), right=flyAt(100), neutral=flyAt(100);
  const wl=fakeWorld(),wr=fakeWorld(),wn=fakeWorld();
  const cl=controls(['Numpad4']),cr=controls(['Numpad6']),cn=controls(['Numpad4','Numpad6']);
  tick(left,cl,wl,48); tick(right,cr,wr,48); tick(neutral,cn,wn,48);
  assert.ok(left.heading>0.18, `left wing turn ${left.heading}`);
  assert.ok(right.heading<-0.18, `right wing turn ${right.heading}`);
  assert.ok(Math.abs(neutral.heading)<0.05, `neutral ${neutral.heading}`);
  assert.ok(Math.abs(left.velocityX)>5 && Math.abs(right.velocityX)>5);
});

test('tail fan increases rotational damping after turn input ends', () => {
  const spread=flyAt(100), tucked=flyAt(100), w1=fakeWorld(),w2=fakeWorld();
  for (const b of [spread,tucked]) b.yawRate=1.2;
  spread.pitch='backward'; spread.flightMode='flare'; spread.tailSpread=1;
  tucked.pitch='forward'; tucked.flightMode='fast-glide'; tucked.tailSpread=0.20;
  updateFlightPhysics(spread,DT,w1);
  updateFlightPhysics(tucked,DT,w2);
  assert.ok(spread.yawRate < tucked.yawRate);
});

test('nest requires exactly one twig plus one grass', () => {
  const world=createWorld(), bird=createWillieWagtail();
  assert.deepEqual([world.nest.required.twig,world.nest.required.grass],[1,1]);
  const tree=world.trees[0], branch=tree.branches[0];
  bird.perchedOn={treeId:tree.id,branchId:branch.id,x:tree.x+branch.x2,y:tree.y+branch.y2};
  bird.carrying='twig'; bird.inventory.twig=1;
  useNest(bird,world); assert.equal(world.nest.built,false);
  bird.carrying='grass';bird.inventory.grass=1;
  useNest(bird,world); assert.equal(world.nest.built,true);
});

test('original physical media paths remain unchanged', () => {
  assert.ok(existsSync(new URL('../audio/wagtail-contact.mp3',import.meta.url)));
  assert.ok(existsSync(new URL('../images/wagtail-family-milestone.webp',import.meta.url)));
  assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/\.\/images\/wagtail-family-milestone\.webp/);
  assert.match(readFileSync(new URL('../src/audio.js',import.meta.url),'utf8'),/\.\/audio\/wagtail-contact\.mp3/);
});

test('iOS gesture suppression is confined to controls: canvas can pinch', () => {
  const input=readFileSync(new URL('../src/input.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(input,/\['keypad', 'touchControls'\]/);
  assert.match(input,/passive: false/);
  assert.match(css,/#gameCanvas \{ touch-action: manipulation; \}/);
  assert.doesNotMatch(input,/getElementById\('game-canvas'\)/);
});

test('repeated unilateral inputs never launch a grounded bird', () => {
  const b=createWillieWagtail(),c=controls(),w=fakeWorld();
  for(let i=0;i<12;i++) {
    c.pressed.clear();
    event(c,4,1000+220*i); tick(b,c,w);
    c.pressed.clear(); tick(b,c,w);
  }
  assert.equal(b.grounded,true);
  assert.equal(b.altitude,0);
});

test('zero deployed wing area rejects even strong updrafts', () => {
  const b=flyAt(75),c=controls(),w=fakeWorld();
  w.windAt=()=>({x:0,y:0,up:10});
  tick(b,c,w);
  assert.equal(b.aeroLift,0);
  assert.equal(b.aeroSpan,0);
  assert.ok(b.velocityZ<0);
});

test('rapid paired strokes cannot be reused after release', () => {
  const b=createWillieWagtail(),c=controls(),w=fakeWorld();
  event(c,4,1000);event(c,6,1010);tick(b,c,w);
  const after=b.velocityZ;
  c.pressed.clear(); tick(b,c,w);
  assert.ok(b.velocityZ<after);
  assert.equal(b.pairedStrokes,1);
  assert.equal(b.pendingPowerStrokes.left,null);
  assert.equal(b.pendingPowerStrokes.right,null);
});

test('fully balanced wings do not produce unintended turning in crosswind', () => {
  const b=flyAt(100),c=controls(['Numpad4','Numpad6']),w=fakeWorld();
  w.windAt=()=>({x:8,y:3,up:0});
  tick(b,c,w,40);
  assert.ok(Math.abs(b.heading)<0.05);
});

test('camera and canvas ids remain as existing game integrations expect', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(html,/id="gameCanvas"/);
  assert.match(main,/getElementById\("gameCanvas"\)/);
});
