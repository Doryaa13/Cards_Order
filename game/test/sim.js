// Headless check: run each level without a browser and report whether the ball reaches the basket.
// Usage: node game/test/sim.js
var path = require('path');
var Matter = require(path.join(__dirname, '../vendor/matter.min.js'));
var ChainWorld = require(path.join(__dirname, '../js/world.js'));

global.window = {};
require(path.join(__dirname, '../js/level1.js'));
var levels = global.window.LEVELS;

var failed = 0;
levels.forEach(function (level) {
  var game = ChainWorld.buildWorld(Matter, level);
  ChainWorld.startChain(Matter, game);
  var t, success = false;
  for (t = 0; t < 60 * 15; t++) {
    Matter.Engine.update(game.engine, ChainWorld.STEP_MS);
    if (ChainWorld.ballInGoal(game)) { success = true; break; }
  }
  var b = game.byId.ball.position;
  console.log((success ? 'PASS' : 'FAIL') + '  ' + level.name +
    '  (' + (t / 60).toFixed(2) + 's, ball at ' + b.x.toFixed(0) + ',' + b.y.toFixed(0) + ')');
  if (!success) failed++;
});
process.exit(failed ? 1 : 0);
