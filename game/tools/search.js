// Level design helper: tries random placements of a floor's tray parts (and, with a spring, taps at
// different moments) and prints the layouts that win, best stars first.
// Usage: node game/tools/search.js game/levels/floor2.json [tries]
var path = require('path'), fs = require('fs');
var Matter = require(path.join(__dirname, '../vendor/matter.min.js'));
var ChainWorld = require(path.join(__dirname, '../js/world.js'));

var level = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
var tries = +process.argv[3] || 400;
var seed = 7;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

function run(placements, tapStep) {
  var game = ChainWorld.buildWorld(Matter, level, placements);
  var trayBodies = Matter.Composite.allBodies(game.engine.world).filter(function (b) { return b.plugin.part && b.plugin.part.tray; });
  if (!trayBodies.every(function (b) { return ChainWorld.placementOk(Matter, game, b); })) return null;
  var spring = trayBodies.filter(function (b) { return b.plugin.part.tappable; })[0];
  ChainWorld.startChain(Matter, game);
  var outcome = null, t, near = [];
  for (t = 0; !outcome; t++) {
    if (spring && t === tapStep) ChainWorld.fireSpring(Matter, game, spring);
    Matter.Engine.update(game.engine, ChainWorld.STEP_MS);
    outcome = ChainWorld.checkOutcome(Matter, game);
    if (spring) {
      var p = game.byId.ball.position;
      if (Math.hypot(p.x - spring.position.x, p.y - spring.position.y) < 60) near.push(t);
    }
  }
  var s = ChainWorld.score(game);
  return { stars: outcome === 'win' ? s.stars : 0, touched: s.touched, near: near };
}

function randomPlacements() {
  var out = {};
  level.tray.forEach(function (item) {
    var spring = item.type === 'spring';
    out[item.id] = {
      x: Math.round(40 + rnd() * 520), y: Math.round(80 + rnd() * 880),
      angle: spring ? Math.round(rnd() * 16 - 8) * 5 : Math.round(rnd() * 24 - 12) * 5
    };
  });
  return out;
}

var found = [], valid = 0;
for (var i = 0; i < tries; i++) {
  var pl = randomPlacements();
  var r = run(pl, -1);
  if (!r) continue;
  valid++;
  var best = { stars: r.stars, tap: null };
  // With a spring: try tapping at moments when the ball is near it, every 6 steps
  for (var j = 0; j < r.near.length && best.stars < 3; j += 6) {
    var q = run(pl, r.near[j]);
    if (q && q.stars > best.stars) best = { stars: q.stars, tap: r.near[j] };
  }
  if (best.stars) found.push({ stars: best.stars, tap: best.tap, placements: pl });
}
found.sort(function (a, b) { return b.stars - a.stars; });
console.log(valid + ' valid layouts of ' + tries + ', ' + found.length + ' wins');
found.slice(0, 12).forEach(function (f) { console.log(f.stars + '★ tap ' + f.tap + ' ' + JSON.stringify(f.placements)); });
