// Level 1: a row of dominoes knocks a ball off a shelf and down a ramp to the right wall.
// The player places the three tray ramps so the ball zigzags down, touching them, into the basket.
// World units: 600 x 1000 (portrait), y grows downward. Angles are in degrees.
window.LEVELS = window.LEVELS || [];
window.LEVELS.push({
  name: 'שלב 1: הדומינו הראשון',
  world: { width: 600, height: 1000 },
  push: { target: 'd1', angularVelocity: 0.12 },
  // Parts the player drags from the tray onto the board
  tray: [
    { id: 'a', type: 'wall', w: 280, h: 16 },
    { id: 'b', type: 'wall', w: 300, h: 16 },
    { id: 'c', type: 'wall', w: 360, h: 16 }
  ],
  // Known placements and the stars they earn; used by the headless test
  solutions: [
    { stars: 3, placements: {
      a: { x: 470, y: 470, angle: 160 },
      b: { x: 150, y: 640, angle: 20 },
      c: { x: 385, y: 775, angle: 160 } } },
    // The ball skips the first ramp: basket reached with two of three parts touched
    { stars: 1, placements: {
      a: { x: 510, y: 470, angle: 170 },
      b: { x: 150, y: 640, angle: 20 },
      c: { x: 385, y: 775, angle: 160 } } }
  ],
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
    // Goal basket against the left wall (x, y = bottom-center of the basket)
    { type: 'basket', x: 90, y: 990, w: 180, h: 90 }
  ]
});
