// Level 1: a row of dominoes knocks a ball off a shelf and down a ramp. The player has to place
// a second ramp so the ball crosses to the basket on the left.
// World units: 600 x 1000 (portrait), y grows downward. Angles are in degrees.
window.LEVELS = window.LEVELS || [];
window.LEVELS.push({
  name: 'שלב 1: הדומינו הראשון',
  world: { width: 600, height: 1000 },
  push: { target: 'd1', angularVelocity: 0.12 },
  // One known placement that wins; used by the headless test
  solution: { ramp: { x: 400, y: 520, angle: 160 } },
  parts: [
    // Shelf the dominoes stand on
    { type: 'wall', x: 230, y: 210, w: 380, h: 20 },
    // Dominoes
    { type: 'domino', id: 'd1', x: 70, y: 168 },
    { type: 'domino', x: 106, y: 168 },
    { type: 'domino', x: 142, y: 168 },
    { type: 'domino', x: 178, y: 168 },
    { type: 'domino', x: 214, y: 168 },
    { type: 'domino', x: 250, y: 168 },
    { type: 'domino', x: 286, y: 168 },
    { type: 'domino', x: 322, y: 168 },
    { type: 'domino', x: 358, y: 168 },
    // The ball waiting at the end of the shelf
    { type: 'ball', id: 'ball', x: 406, y: 184, r: 16 },
    // Fixed ramp under the shelf: sends the ball to the right wall
    { type: 'wall', x: 455, y: 325, w: 177, h: 16, angle: 16.4 },
    // The player's ramp: starts flat and out of the way, must be moved and tilted to catch the ball
    { type: 'wall', id: 'ramp', movable: true, x: 330, y: 760, w: 400, h: 16, angle: 0 },
    // Goal basket against the left wall (x, y = bottom-center of the basket)
    { type: 'basket', x: 75, y: 990, w: 150, h: 110 }
  ]
});
