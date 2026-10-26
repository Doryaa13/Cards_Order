// Builds a Matter.js world from a level definition. Shared by the game and the headless test.
(function (root) {
  var DOMINO_W = 12, DOMINO_H = 64, WALL_T = 10;
  var deg = Math.PI / 180;

  var TOUCH_MIN_SPEED = 0.2;   // a resting piece leaning on a tray part does not count as touching it

  var SPRING_W = 84, SPRING_H = 28;
  var SPRING_KICK = 22;        // speed added along the spring's facing direction when it fires
  var SPRING_REACH = 40;       // how far above its pad the spring still catches things

  var FUNNEL_W = 170, FUNNEL_H = 90, FUNNEL_GAP = 44, FUNNEL_T = 12, SPOUT = 40;
  var SEESAW_W = 220, SEESAW_H = 14, SEESAW_MAX = 30;   // a seesaw rocks between -30 and +30 degrees
  var ROW_SPACING = 34;

  // Fills in the size of tray parts whose size is fixed by their type
  function trayItem(item) {
    var sizes = {
      spring: { w: SPRING_W, h: SPRING_H, tappable: true },
      funnel: { w: FUNNEL_W, h: FUNNEL_H, gap: FUNNEL_GAP },
      seesaw: { w: SEESAW_W, h: SEESAW_H, maxAngle: SEESAW_MAX },
      dominoes: { w: ((item.count || 4) - 1) * ROW_SPACING + DOMINO_W, h: DOMINO_H, fixedAngle: true, snapDown: true }
    };
    return Object.assign({ tray: true }, sizes[item.type] || {}, item);
  }

  // A part from the tray, placed on the board by the player. Returns the bodies to add to the world.
  // forRun: build what physics needs during a run. Otherwise the editing version: one solid,
  // unmoving body per tray part, which is what the editor drags around.
  //   spring    fires once when the player taps it during a run
  //   funnel    two walls in a V with an opening at the bottom
  //   seesaw    a plank on a pivot at its middle; during a run it tips, between its stops
  //   dominoes  a row of dominoes; during a run each one stands on its own
  function makeTrayBodies(Matter, item, x, y, angleDeg, forRun) {
    item = trayItem(item);
    var Bodies = Matter.Bodies, Body = Matter.Body;
    var angle = (angleDeg || 0) * deg;
    var tag = function (b) { b.render.kind = item.type; b.plugin.part = item; return b; };

    if (item.type === 'funnel') {
      // Each wall runs from a top corner down to the edge of the opening. Its center line stops a
      // little outside the opening so the wall's thickness does not narrow it.
      var inner = item.gap / 2 + FUNNEL_T * 0.8, run = item.w / 2 - inner, slope = Math.atan2(item.h, run);
      var len = Math.hypot(item.h, run) + FUNNEL_T, mid = inner + run / 2;
      var left = Bodies.rectangle(-mid, 0, len, FUNNEL_T, { angle: slope });
      var right = Bodies.rectangle(mid, 0, len, FUNNEL_T, { angle: -slope });
      // A short spout under the opening straightens the ball so it drops out straight down
      var spoutX = item.gap / 2 + FUNNEL_T / 2, spoutY = item.h / 2 + SPOUT / 2;
      var spoutL = Bodies.rectangle(-spoutX, spoutY, FUNNEL_T, SPOUT);
      var spoutR = Bodies.rectangle(spoutX, spoutY, FUNNEL_T, SPOUT);
      // An invisible sensor in the throat, so a ball dropping cleanly through still counts as a touch
      var throat = Bodies.rectangle(0, item.h / 2, item.gap, FUNNEL_T, { isSensor: true });
      var funnel = Body.create({ parts: [left, right, spoutL, spoutR, throat], isStatic: true, friction: 0.3 });
      Body.setPosition(funnel, { x: x, y: y });
      Body.setAngle(funnel, angle);
      return [tag(funnel)];
    }

    if (item.type === 'dominoes' && forRun) {
      var n = item.count || 4;
      var bodies = [];
      for (var i = 0; i < n; i++) {
        bodies.push(tag(Bodies.rectangle(x + (i - (n - 1) / 2) * ROW_SPACING, y, DOMINO_W, DOMINO_H, {
          friction: 0.1, frictionStatic: 0.5, restitution: 0, density: 0.004
        })));
      }
      return bodies;
    }
    if (item.type === 'dominoes') {
      var m = item.count || 4, pieces = [];
      for (var j = 0; j < m; j++) pieces.push(Bodies.rectangle((j - (m - 1) / 2) * ROW_SPACING, 0, DOMINO_W, DOMINO_H));
      var row = Body.create({ parts: pieces, isStatic: true });
      Body.setPosition(row, { x: x, y: y });
      return [tag(row)];
    }

    if (item.type === 'seesaw') {
      // A plank with a small lip at each end, so a ball sitting on the low end stays there
      var lip = 10, lipH = item.h + 14;
      var board = Bodies.rectangle(0, 0, item.w, item.h);
      var lipL = Bodies.rectangle(-item.w / 2 + lip / 2, -(lipH - item.h) / 2, lip, lipH);
      var lipR = Bodies.rectangle(item.w / 2 - lip / 2, -(lipH - item.h) / 2, lip, lipH);
      var plank = Body.create(forRun
        ? { parts: [board, lipL, lipR], density: 0.002, friction: 0.6, frictionAir: 0.02 }
        : { parts: [board, lipL, lipR], isStatic: true });
      // Keep the pivot at the middle of the board, not at the centre of mass the lips shift upward
      var shift = { x: plank.position.x - board.position.x, y: plank.position.y - board.position.y };
      Body.setPosition(plank, { x: x + shift.x, y: y + shift.y });
      Body.rotate(plank, angle, { x: x, y: y });
      tag(plank);
      if (forRun) plank.plugin.pivot = { x: x, y: y, max: item.maxAngle * deg, offset: shift };
      return [plank];
    }

    var body = Bodies.rectangle(x, y, item.w, item.h, {
      isStatic: true, angle: angle, friction: item.type === 'spring' ? 0.9 : 0.6
    });
    return [tag(body)];
  }

  // The editing body of a tray part (one per part)
  function makeTrayBody(Matter, item, x, y, angleDeg) {
    return makeTrayBodies(Matter, item, x, y, angleDeg, false)[0];
  }

  // placements: { trayItemId: { x, y, angle } } for the tray parts the player put on the board.
  // opts.edit: build tray parts in their editing form (see makeTrayBodies); otherwise ready to run.
  function buildWorld(Matter, level, placements, opts) {
    var forRun = !(opts && opts.edit);
    var Bodies = Matter.Bodies, Composite = Matter.Composite;
    var engine = Matter.Engine.create({ positionIterations: 12, velocityIterations: 10 });
    engine.gravity.y = 1; engine.gravity.scale = 0.0018;
    var W = level.world.width, H = level.world.height;
    var byId = {};
    var baskets = [], zones = [];

    // Ball colors: a colored ball has to end up in the basket of its color; balls without a color
    // are helpers. A floor that names no colors has one red goal ball (goalBall, or 'ball').
    var anyColor = level.parts.some(function (p) { return p.type === 'ball' && p.color; });
    function colorOf(p) {
      if (p.color) return p.color;
      return !anyColor && p.id === (level.goalBall || 'ball') ? 'red' : null;
    }

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
        // A heavy ball weighs four times as much: enough to tip a seesaw and fling a normal ball
        var ball = add(Bodies.circle(p.x, p.y, p.r || 16, {
          friction: 0.02, frictionAir: 0.002, restitution: 0.2, density: p.heavy ? 0.008 : 0.002
        }), part);
        ball.plugin.color = colorOf(p);
      } else if (p.type === 'basket') {
        var x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, top = p.y - p.h;
        var opts = { isStatic: true, friction: 0.8, restitution: 0 };
        [
          Bodies.rectangle(p.x, p.y - WALL_T / 2, p.w, WALL_T, opts),
          Bodies.rectangle(x0 + WALL_T / 2, p.y - p.h / 2, WALL_T, p.h, opts),
          Bodies.rectangle(x1 - WALL_T / 2, p.y - p.h / 2, WALL_T, p.h, opts)
        ].forEach(function (b) { add(b, part); });
        baskets.push({ color: p.color || 'red', x0: x0 + WALL_T, x1: x1 - WALL_T, y0: top, y1: p.y - WALL_T });
      }
    });

    // Areas where the player may not place parts: sensors that only the placement check notices
    (level.noBuild || []).forEach(function (z) {
      var zone = Bodies.rectangle(z.x, z.y, z.w, z.h, { isStatic: true, isSensor: true });
      zone.render.kind = 'zone';
      zone.plugin.zone = z;
      Composite.add(engine.world, zone);
      zones.push(zone);
    });

    // Floor and side walls so nothing leaves the screen
    var bounds = { isStatic: true, friction: 0.6 };
    [
      Bodies.rectangle(W / 2, H + 25, W + 100, 50, bounds),
      Bodies.rectangle(-25, H / 2, 50, H * 2, bounds),
      Bodies.rectangle(W + 25, H / 2, 50, H * 2, bounds)
    ].forEach(function (b) { b.render.kind = 'bound'; Composite.add(engine.world, b); });

    var pivots = [];
    (level.tray || []).forEach(function (item) {
      var at = placements && placements[item.id];
      if (!at) return;
      makeTrayBodies(Matter, item, at.x, at.y, at.angle, forRun).forEach(function (b) {
        Composite.add(engine.world, b);
        if (b.plugin.pivot) {
          pivots.push(b);
          var pv = b.plugin.pivot;
          Composite.add(engine.world, Matter.Constraint.create({
            pointA: { x: pv.x, y: pv.y }, bodyB: b, length: 0, stiffness: 1,
            pointB: { x: pv.x - b.position.x, y: pv.y - b.position.y }
          }));
        }
      });
    });

    var goalBalls = Matter.Composite.allBodies(engine.world).filter(function (b) {
      return b.plugin.color && baskets.some(function (k) { return k.color === b.plugin.color; });
    });
    var game = {
      engine: engine, byId: byId, level: level, width: W, height: H, touched: {},
      baskets: baskets, goal: baskets[0] || null, goalBalls: goalBalls
    };

    // A seesaw rocks between stops on either side of level
    if (pivots.length) {
      Matter.Events.on(engine, 'afterUpdate', function () {
        pivots.forEach(function (b) {
          // Only motion further past a stop is cancelled; a push back toward level is kept
          var max = b.plugin.pivot.max, side = Math.sign(b.angle);
          if (Math.abs(b.angle) > max) {
            var spin = b.angularVelocity;
            Matter.Body.setAngle(b, side * max);
            Matter.Body.setAngularVelocity(b, Math.sign(spin) === side ? 0 : spin);
          }
        });
      });
    }

    // A tray part lights up when the ball or any other moving piece hits it during the run.
    // Collisions report the parts of compound bodies, so look at the parent body.
    Matter.Events.on(engine, 'collisionStart', function (e) {
      if (!game.started) return;
      e.pairs.forEach(function (pair) {
        [[pair.bodyA.parent, pair.bodyB.parent], [pair.bodyB.parent, pair.bodyA.parent]].forEach(function (ab) {
          var part = ab[0].plugin.part, other = ab[1];
          // A spring counts only when it is fired (see fireSpring), not when something rolls over it
          if (part && part.tray && !part.tappable && !other.isStatic && other.speed > TOUCH_MIN_SPEED) game.touched[part.id] = true;
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

  // Starts a run: either knocks over the first domino (push) or shoots the ball out of the
  // entry pipe at the top of the floor (launch), as the level says.
  function startChain(Matter, game) {
    var level = game.level;
    game.started = true;
    if (level.push) {
      var target = game.byId[level.push.target];
      if (target) Matter.Body.setAngularVelocity(target, level.push.angularVelocity);
    }
    if (level.launch) {
      Matter.Body.setVelocity(game.byId.ball, { x: level.launch.vx, y: level.launch.vy });
    }
  }

  // The first ball that has to end up in a basket (the only one, on most floors)
  function goalBall(game) {
    return game.goalBalls[0];
  }

  // True when a ball is inside a basket of its own color
  function inOwnBasket(game, ball) {
    var p = ball.position;
    return game.baskets.some(function (k) {
      return k.color === ball.plugin.color && p.x > k.x0 && p.x < k.x1 && p.y > k.y0 && p.y < k.y1;
    });
  }

  var ALLOWED_DEPTH = 1.5;     // parts may touch, but not overlap

  // True when a placed part is fully on the board and does not overlap anything else
  function placementOk(Matter, game, body) {
    var b = body.bounds;
    if (b.min.x < 0 || b.min.y < 0 || b.max.x > game.width || b.max.y > game.height) return false;
    var others = Matter.Composite.allBodies(game.engine.world).filter(function (o) { return o !== body; });
    var pieces = (body.parts.length > 1 ? body.parts.slice(1) : [body]).filter(function (p) { return !p.isSensor; });
    return pieces.every(function (piece) {
      return !Matter.Query.collides(piece, others).some(function (c) { return c.depth > ALLOWED_DEPTH; });
    });
  }

  // Fires a spring: everything resting on (or just above) its pad is launched the way the pad faces.
  // Each spring has one charge per run.
  function fireSpring(Matter, game, spring) {
    if (spring.plugin.used) return false;
    spring.plugin.used = true;
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
        // A spring counts as touched when it launches something
        if (game.started) game.touched[part.id] = true;
      }
    });
    return true;
  }

  // True while the player can still change the run with a tap
  function tapAvailable(Matter, game) {
    return Matter.Composite.allBodies(game.engine.world).some(function (b) {
      return b.plugin.part && b.plugin.part.tappable && !b.plugin.used;
    });
  }

  // True when every colored ball is in the basket of its color
  function ballInGoal(game) {
    return game.goalBalls.length > 0 && game.goalBalls.every(function (b) { return inOwnBasket(game, b); });
  }

  // Called once per physics step after the chain starts. Returns 'win', 'fail' or null (still running).
  // Win: every colored ball stays inside the basket of its color for half a second.
  // Fail: every colored ball still outside its basket has left its start and then stays put for two
  // seconds, or nothing at all moves for two seconds (the chain broke), or the run passes 40 seconds.
  // While a tap is still available the game waits longer, since the player may be about to use it.
  function checkOutcome(Matter, game) {
    game.steps = (game.steps || 0) + 1;
    if (!game.ballStart) game.ballStart = game.goalBalls.map(function (b) { return { x: b.position.x, y: b.position.y }; });
    if (ballInGoal(game)) {
      game.inGoalSteps = (game.inGoalSteps || 0) + 1;
      return game.inGoalSteps >= 30 ? 'win' : null;
    }
    game.inGoalSteps = 0;
    // Compare positions once per second; speed alone misreads a ball rocking in place
    if (game.steps % 60 === 0) {
      var lastAll = game.ballLast || game.ballStart;
      var waiting = game.goalBalls.filter(function (b) { return !inOwnBasket(game, b); });
      var stuck = waiting.length > 0 && waiting.every(function (b) {
        var i = game.goalBalls.indexOf(b), p = b.position, s0 = game.ballStart[i], last = lastAll[i];
        var started = Math.abs(p.x - s0.x) + Math.abs(p.y - s0.y) > 20;
        return started && Math.abs(p.x - last.x) + Math.abs(p.y - last.y) <= 3;
      });
      game.ballLast = game.goalBalls.map(function (b) { return { x: b.position.x, y: b.position.y }; });
      game.stillSeconds = stuck ? (game.stillSeconds || 0) + 1 : 0;

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
    buildWorld: buildWorld, makeTrayBody: makeTrayBody, trayItem: trayItem, startChain: startChain,
    ballInGoal: ballInGoal, goalBall: goalBall, inOwnBasket: inOwnBasket,
    fireSpring: fireSpring, tapAvailable: tapAvailable, placementOk: placementOk,
    checkOutcome: checkOutcome, score: score, STEP_MS: 1000 / 60
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChainWorld = api;
})(this);
