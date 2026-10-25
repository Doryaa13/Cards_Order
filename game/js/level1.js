// Level 1: a row of dominoes knocks a ball off a shelf, down a ramp, into the basket.
// World units: 1000 x 600, y grows downward. Angles are in degrees.
window.LEVELS = window.LEVELS || [];
window.LEVELS.push({
  name: 'שלב 1: הדומינו הראשון',
  world: { width: 1000, height: 600 },
  push: { target: 'd1', angularVelocity: 0.12 },
  parts: [
    // Shelf the dominoes stand on
    { type: 'wall', x: 255, y: 260, w: 390, h: 20 },
    // Dominoes
    { type: 'domino', id: 'd1', x: 100, y: 218 },
    { type: 'domino', x: 136, y: 218 },
    { type: 'domino', x: 172, y: 218 },
    { type: 'domino', x: 208, y: 218 },
    { type: 'domino', x: 244, y: 218 },
    { type: 'domino', x: 280, y: 218 },
    { type: 'domino', x: 316, y: 218 },
    { type: 'domino', x: 352, y: 218 },
    { type: 'domino', x: 388, y: 218 },
    // The ball waiting at the end of the shelf
    { type: 'ball', id: 'ball', x: 436, y: 233, r: 16 },
    // Ramp down to the basket
    { type: 'wall', x: 615, y: 380, w: 385, h: 16, angle: 15 },
    // Goal basket (x, y = bottom-center of the basket)
    { type: 'basket', x: 900, y: 560, w: 120, h: 90 }
  ]
});
