// Headless check: run each level without a browser.
// A level must fail as first laid out (otherwise there is no puzzle) and win with its `solution` placements.
// Usage: node game/test/sim.js
var path = require('path');
var Matter = require(path.join(__dirname, '../vendor/matter.min.js'));
var ChainWorld = require(path.join(__dirname, '../js/world.js'));

global.window = {};
require(path.join(__dirname, '../js/level1.js'));
var levels = global.window.LEVELS;

function run(level, placements) {
  var game = ChainWorld.buildWorld(Matter, level, placements);
  ChainWorld.startChain(Matter, game);
  var t, outcome = null;
  for (t = 0; !outcome; t++) {
    Matter.Engine.update(game.engine, ChainWorld.STEP_MS);
    outcome = ChainWorld.checkOutcome(Matter, game);
  }
  var b = game.byId.ball.position;
  return { outcome: outcome, seconds: (t / 60).toFixed(2), ball: b.x.toFixed(0) + ',' + b.y.toFixed(0) };
}

var failed = 0;
levels.forEach(function (level) {
  var checks = [
    { label: 'as laid out', placements: {}, expect: 'fail' },
    { label: 'solution', placements: level.solution || {}, expect: 'win' }
  ];
  checks.forEach(function (c) {
    var r = run(level, c.placements);
    var ok = r.outcome === c.expect;
    if (!ok) failed++;
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + level.name + ' / ' + c.label + ': ' + r.outcome +
      ' (' + r.seconds + 's, ball at ' + r.ball + ')');
  });
});
process.exit(failed ? 1 : 0);
