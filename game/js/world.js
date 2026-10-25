// Builds a Matter.js world from a level definition. Shared by the game and the headless test.
(function (root) {
  var DOMINO_W = 12, DOMINO_H = 64, WALL_T = 10;
  var deg = Math.PI / 180;

  var TOUCH_MIN_SPEED = 0.2;   // a resting piece leaning on a tray part does not count as touching it

  var SPRING_W = 70, SPRING_H = 24;
  var SPRING_KICK = 16;        // speed added along the spring's facing direction when it fires
  var SPRING_REACH = 40;       // how far above its pad the spring still catches things

  // A part from the tray, placed on the board by the player.
  // Springs fire once when the player taps them during a run.
  function makeTrayBody(Matter, item, x, y, angleDeg) {
    var spring = item.type === 'spring';
    if (spring) item = Object.assign({ w: SPRING_W, h: SPRING_H, tappable: true }, item);
    var body = Matter.Bodies.rectangle(x, y, item.w, item.h, {
      isStatic: true, angle: (angleDeg || 0) * deg, friction: spring ? 0.9 : 0.6
    });
    body.render.kind = item.type;
    body.plugin.part = Object.assign({ tray: true }, item);
    return body;
  }

  // placements: { trayItemId: { x, y, angle } } for the tray parts the player put on the board.
  function buildWorld(Matter, level, placements) {
    var Bodies = Matter.Bodies, Composite = Matter.Composite;
    var engine = Matter.Engine.create({ positionIterations: 12, velocityIterations: 10 });
    engine.gravity.y = 1; engine.gravity.scale = 0.0018;
    var W = level.world.width, H = level.world.height;
    var byId = {};
    var goal = null;

    function add(body, part) {
      body.render.kind = part.type;
      body.plugin.part = part;
      Composite.add(engine.world, body);
      if (part.id) byId[part.id] = body;
      return body;
    }

    level.parts.forEach(function (part) {
      var p = part;
      var angle = (p.angle || 0) * deg;
      if (p.type === 'wall') {
        add(Bodies.rectangle(p.x, p.y, p.w, p.h, { isStatic: true, angle: angle, friction: 0.6 }), part);
      } else if (p.type === 'domino') {
        add(Bodies.rectangle(p.x, p.y, p.w || DOMINO_W, p.h || DOMINO_H, {
          angle: angle, friction: 0.1, frictionStatic: 0.5, restitution: 0, density: 0.004
        }), part);
      } else if (p.type === 'ball') {
        add(Bodies.circle(p.x, p.y, p.r || 16, {
          friction: 0.02, frictionAir: 0.002, restitution: 0.2, density: 0.002
        }), part);
      } else if (p.type === 'basket') {
        var x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, top = p.y - p.h;
        var opts = { isStatic: true, friction: 0.8, restitution: 0 };
        [
          Bodies.rectangle(p.x, p.y - WALL_T / 2, p.w, WALL_T, opts),
          Bodies.rectangle(x0 + WALL_T / 2, p.y - p.h / 2, WALL_T, p.h, opts),
          Bodies.rectangle(x1 - WALL_T / 2, p.y - p.h / 2, WALL_T, p.h, opts)
        ].forEach(function (b) { add(b, part); });
        goal = { x0: x0 + WALL_T, x1: x1 - WALL_T, y0: top, y1: p.y - WALL_T };
      }
    });

    // Floor and side walls so nothing leaves the screen
    var bounds = { isStatic: true, friction: 0.6 };
    [
      Bodies.rectangle(W / 2, H + 25, W + 100, 50, bounds),
      Bodies.rectangle(-25, H / 2, 50, H * 2, bounds),
      Bodies.rectangle(W + 25, H / 2, 50, H * 2, bounds)
    ].forEach(function (b) { b.render.kind = 'bound'; Composite.add(engine.world, b); });

    (level.tray || []).forEach(function (item) {
      var at = placements && placements[item.id];
      if (at) Composite.add(engine.world, makeTrayBody(Matter, item, at.x, at.y, at.angle));
    });

    var game = { engine: engine, byId: byId, goal: goal, level: level, width: W, height: H, touched: {} };

    // A tray part lights up when the ball or any other moving piece hits it during the run
    Matter.Events.on(engine, 'collisionStart', function (e) {
      if (!game.started) return;
      e.pairs.forEach(function (pair) {
        [[pair.bodyA, pair.bodyB], [pair.bodyB, pair.bodyA]].forEach(function (ab) {
          var part = ab[0].plugin.part, other = ab[1];
          if (part && part.tray && !other.isStatic && other.speed > TOUCH_MIN_SPEED) game.touched[part.id] = true;
        });
      });
    });

    return game;
  }

  // Stars for a run where the ball reached the basket. 0 means too few tray parts were touched.
  // 1 star: at least half the tray parts, 2 stars: at least three quarters, 3 stars: all of them.
  function score(game) {
    var total = (game.level.tray || []).length;
    var touched = Object.keys(game.touched).length;
    var stars = 3;
    if (touched < total) stars = touched >= Math.ceil(total * 0.75) ? 2 : 1;
    if (touched < Math.ceil(total / 2)) stars = 0;
    return { touched: touched, total: total, needed: Math.ceil(total / 2), stars: stars };
  }

  function startChain(Matter, game) {
    var push = game.level.push;
    var target = game.byId[push.target];
    game.started = true;
    if (target) Matter.Body.setAngularVelocity(target, push.angularVelocity);
  }

  // Fires a spring: everything resting on (or just above) its pad is launched the way the pad faces.
  // Only one tap per run.
  function fireSpring(Matter, game, spring) {
    if (game.tapUsed) return false;
    game.tapUsed = true;
    spring.plugin.firedAt = game.steps || 0;
    var a = spring.angle, part = spring.plugin.part;
    var up = { x: Math.sin(a), y: -Math.cos(a) }, along = { x: Math.cos(a), y: Math.sin(a) };
    Matter.Composite.allBodies(game.engine.world).forEach(function (b) {
      if (b.isStatic) return;
      var dx = b.position.x - spring.position.x, dy = b.position.y - spring.position.y;
      var u = dx * along.x + dy * along.y, h = dx * up.x + dy * up.y;
      var r = b.circleRadius || 10;
      if (Math.abs(u) < part.w / 2 + r && h > 0 && h < part.h / 2 + r + SPRING_REACH) {
        Matter.Body.setVelocity(b, { x: b.velocity.x + up.x * SPRING_KICK, y: b.velocity.y + up.y * SPRING_KICK });
      }
    });
    return true;
  }

  // True while the player can still change the run with a tap
  function tapAvailable(Matter, game) {
    return !game.tapUsed && Matter.Composite.allBodies(game.engine.world).some(function (b) {
      return b.plugin.part && b.plugin.part.tappable;
    });
  }

  function ballInGoal(game) {
    var ball = game.byId.ball, g = game.goal;
    if (!ball || !g) return false;
    var p = ball.position;
    return p.x > g.x0 && p.x < g.x1 && p.y > g.y0 && p.y < g.y1;
  }

  // Called once per physics step after the chain starts. Returns 'win', 'fail' or null (still running).
  // Win: the ball stays inside the basket for half a second.
  // Fail: the ball has left its start and then stays put outside the basket for two seconds,
  // or nothing at all moves for two seconds (the chain broke), or the run passes 40 seconds.
  // While a tap is still available the game waits longer, since the player may be about to use it.
  function checkOutcome(Matter, game) {
    var ball = game.byId.ball, p = ball.position;
    game.steps = (game.steps || 0) + 1;
    if (!game.ballStart) game.ballStart = { x: p.x, y: p.y };
    if (ballInGoal(game)) {
      game.inGoalSteps = (game.inGoalSteps || 0) + 1;
      return game.inGoalSteps >= 30 ? 'win' : null;
    }
    game.inGoalSteps = 0;
    // Compare positions once per second; speed alone misreads a ball rocking in place
    if (game.steps % 60 === 0) {
      var last = game.ballLast || game.ballStart;
      var started = Math.abs(p.x - game.ballStart.x) + Math.abs(p.y - game.ballStart.y) > 20;
      var moved = Math.abs(p.x - last.x) + Math.abs(p.y - last.y) > 3;
      game.ballLast = { x: p.x, y: p.y };
      game.stillSeconds = started && !moved ? (game.stillSeconds || 0) + 1 : 0;

      var bodies = Matter.Composite.allBodies(game.engine.world).filter(function (b) { return !b.isStatic; });
      var prev = game.bodiesLast || [];
      var anyMoved = bodies.some(function (b, i) {
        return !prev[i] || Math.abs(b.position.x - prev[i].x) + Math.abs(b.position.y - prev[i].y) > 3;
      });
      game.bodiesLast = bodies.map(function (b) { return { x: b.position.x, y: b.position.y }; });
      game.frozenSeconds = anyMoved ? 0 : (game.frozenSeconds || 0) + 1;
    }
    var patience = tapAvailable(Matter, game) ? 6 : 2;
    if (game.stillSeconds >= patience || game.frozenSeconds >= patience || game.steps >= 60 * 40) return 'fail';
    return null;
  }

  var api = {
    buildWorld: buildWorld, makeTrayBody: makeTrayBody, startChain: startChain, ballInGoal: ballInGoal,
    fireSpring: fireSpring, tapAvailable: tapAvailable,
    checkOutcome: checkOutcome, score: score, STEP_MS: 1000 / 60
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChainWorld = api;
})(this);
