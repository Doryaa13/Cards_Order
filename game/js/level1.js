// Level 1: a row of dominoes knocks a ball off a shelf, down a zigzag of ramps, into the basket.
// World units: 600 x 1000 (portrait), y grows downward. Angles are in degrees.
window.LEVELS = window.LEVELS || [];
window.LEVELS.push({
  name: 'שלב 1: הדומינו הראשון',
  world: { width: 600, height: 1000 },
  push: { target: 'd1', angularVelocity: 0.12 },
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
    // Zigzag ramps down to the basket
    { type: 'wall', x: 455, y: 325, w: 177, h: 16, angle: 16.4 },
    { type: 'wall', x: 360, y: 530, w: 494, h: 16, angle: 158.6 },
    { type: 'wall', x: 225, y: 780, w: 515, h: 16, angle: 18.1 },
    // Goal basket (x, y = bottom-center of the basket)
    { type: 'basket', x: 515, y: 990, w: 150, h: 110 }
  ]
});
