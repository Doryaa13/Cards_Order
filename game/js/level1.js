// Level 1: a row of dominoes knocks a ball off a shelf and down a ramp to the right wall.
// The player places two ramps and a spring from the tray. Ramps alone can reach the basket for
// one star; touching all three means resting the ball on the spring and tapping it.
// World units: 600 x 1000 (portrait), y grows downward. Angles are in degrees.
window.LEVELS = window.LEVELS || [];
window.LEVELS.push({
  name: 'שלב 1: הדומינו הראשון',
  world: { width: 600, height: 1000 },
  push: { target: 'd1', angularVelocity: 0.12 },
  // Parts the player drags from the tray onto the board
  tray: [
    { id: 'a', type: 'wall', w: 280, h: 16 },
    { id: 'b', type: 'wall', w: 240, h: 16 },
    { id: 's', type: 'spring' }
  ],
  // Known placements and the stars they earn; used by the headless test.
  // tap: { part, step } fires that spring at that physics step of the run.
  solutions: [
    // Ramp b rolls the ball down into a V with the spring by the left wall. Tapping while it rests
    // there throws it up over ramp b and across to the basket.
    { stars: 3, tap: { part: 's', step: 450 }, placements: {
      a: { x: 455, y: 470, angle: 160 },
      b: { x: 206, y: 715, angle: 160 },
      s: { x: 55, y: 738, angle: 35 } } },
    // Ramps only, spring parked out of the way: basket reached with two of three parts touched
    { stars: 1, placements: {
      a: { x: 455, y: 470, angle: 160 },
      b: { x: 330, y: 740, angle: 20 },
      s: { x: 40, y: 60, angle: 0 } } }
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
    // Goal basket in the bottom-right corner (x, y = bottom-center of the basket).
    // With nothing placed the ball drops straight in, but touching no tray parts does not count.
    { type: 'basket', x: 510, y: 990, w: 180, h: 90 }
  ]
});
