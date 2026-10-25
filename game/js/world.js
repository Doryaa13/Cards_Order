// Builds a Matter.js world from a level definition. Shared by the game and the headless test.
(function (root) {
  var DOMINO_W = 12, DOMINO_H = 64, WALL_T = 10;
  var deg = Math.PI / 180;

  // placements: optional { partId: { x, y, angle } } chosen by the player for movable parts.
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
      var p = part.movable && placements && placements[part.id]
        ? Object.assign({}, part, placements[part.id]) : part;
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

    return { engine: engine, byId: byId, goal: goal, level: level, width: W, height: H };
  }

  function startChain(Matter, game) {
    var push = game.level.push;
    var target = game.byId[push.target];
    if (target) Matter.Body.setAngularVelocity(target, push.angularVelocity);
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
    if (game.stillSeconds >= 2 || game.frozenSeconds >= 2 || game.steps >= 60 * 40) return 'fail';
    return null;
  }

  var api = {
    buildWorld: buildWorld, startChain: startChain, ballInGoal: ballInGoal,
    checkOutcome: checkOutcome, STEP_MS: 1000 / 60
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChainWorld = api;
})(this);
