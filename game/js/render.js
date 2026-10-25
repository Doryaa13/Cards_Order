// Draws one floor (a game built by ChainWorld) onto a canvas context whose transform already maps
// world units to the screen. Used for the floor being played and for every floor in the tower view.
(function (root) {
  var COLORS = {
    sky: '#fbf7f0', wall: '#6b5b4b', domino: ['#2f6fb0', '#e0662f', '#3c9a5f', '#c9a227'],
    ball: '#d63c3c', basket: '#8a5a2b', goal: 'rgba(60,154,95,0.18)',
    movable: '#7a4fc4', handle: '#7a4fc4', invalid: '#d63c3c', selected: '#fff', touched: '#1fa36f',
    charge: '#e0662f', spent: '#9a948a', pipe: '#8d8578', pipeEdge: '#6f685d',
    silhouetteSky: '#e7e1d6', silhouette: '#cfc7b9', otherBall: '#3a6ea5', heavyRim: '#1d3550'
  };
  var PIPE_W = 44;

  // view: {
  //   scale:      screen pixels per world unit (keeps labels and badges a fixed size on screen)
  //   mode:       'edit' | 'run' | 'done' | 'static'
  //   editor:     the editor while this floor is being edited, for selection and handles
  //   silhouette: true for floors not reached yet: fixed parts only, in one muted color
  // }
  function drawFloor(ctx, game, view) {
    var W = game.width, H = game.height;
    var mode = view.mode || 'static';
    var editor = view.editor;
    var px = function (n) { return n / view.scale; };

    // Outline of a body; for a compound body (funnel, seesaw, domino row) each visible piece
    function tracePath(body) {
      var pieces = body.parts.length > 1 ? body.parts.slice(1) : [body];
      ctx.beginPath();
      pieces.forEach(function (piece) {
        if (piece.isSensor) return;
        var v = piece.vertices;
        ctx.moveTo(v[0].x, v[0].y);
        for (var i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
      });
    }

    function drawBody(body, fill) {
      tracePath(body);
      ctx.fillStyle = fill;
      ctx.fill();
    }

    // Badge on a spring's top-left corner (clear of the rotate handle): "1" while its tap is still
    // available, a grey "0" once spent
    function drawChargeBadge(body, charged) {
      var part = body.plugin.part, r = px(10);
      var x = body.position.x - Math.cos(body.angle) * part.w / 2 + Math.sin(body.angle) * part.h / 2;
      var y = body.position.y - Math.sin(body.angle) * part.w / 2 - Math.cos(body.angle) * part.h / 2;
      ctx.fillStyle = charged ? COLORS.charge : COLORS.spent;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = px(2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 ' + px(13) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(charged ? '1' : '0', x, y + px(1));
    }

    // A small label next to a part: above it, or below when it sits near the top of the board
    function drawCallout(body, text, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.font = '600 ' + px(13) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var tw = ctx.measureText(text).width + px(16), th = px(24);
      var below = body.bounds.min.y - px(40) < 0;
      var x = Math.min(Math.max(body.position.x, tw / 2 + px(4)), W - tw / 2 - px(4));
      var y = below ? body.bounds.max.y + px(22) : body.bounds.min.y - px(22);
      ctx.fillStyle = COLORS.charge;
      roundRect(ctx, x - tw / 2, y - th / 2, tw, th, px(8));
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x, y + px(1));
      ctx.restore();
    }

    // A spring: base plate, coil and pad, drawn in the body's own frame. The pad pops up briefly when
    // fired. While its tap is still available during a run, a pulsing ring shows it can be tapped.
    function drawSpring(body, fill) {
      var part = body.plugin.part, w = part.w, h = part.h;
      var fired = body.plugin.firedAt != null ? game.steps - body.plugin.firedAt : Infinity;
      var pop = fired < 14 ? 12 * Math.sin(Math.PI * fired / 14) : 0;
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      ctx.fillStyle = fill;
      ctx.fillRect(-w / 2, h / 2 - 6, w, 6);
      ctx.fillRect(-w / 2, -h / 2 - pop, w, 7);
      ctx.strokeStyle = fill;
      ctx.lineWidth = 3;
      ctx.beginPath();
      var top = -h / 2 + 7 - pop, bottom = h / 2 - 6, n = 4;
      for (var i = 0; i <= n; i++) {
        var y = top + (bottom - top) * i / n;
        ctx.lineTo(i % 2 ? w / 2 - 10 : -w / 2 + 10, y);
      }
      ctx.stroke();
      var charged = !body.plugin.used;
      if (mode === 'run' && charged) {
        var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
        ctx.strokeStyle = 'rgba(224,102,47,' + (0.35 + 0.5 * pulse) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, w / 2 + 8 + 4 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      if (mode === 'static') return;
      drawChargeBadge(body, charged);
      if (mode === 'run' && charged) drawCallout(body, 'געו כאן · פעם אחת');
      if (fired < 60) drawCallout(body, 'נוצל', 1 - fired / 60);
    }

    // The stand a seesaw pivots on: a triangle under the middle of the plank
    function drawSeesawStand(body, fill) {
      var p = body.plugin.pivot || body.position;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 18, p.y + 34);
      ctx.lineTo(p.x + 18, p.y + 34);
      ctx.closePath();
      ctx.fill();
    }

    // Tray parts are purple with grip dots, and turn green once something hits them during a run
    function drawTrayPart(body) {
      var id = body.plugin.part.id;
      if (body.plugin.part.type === 'seesaw') drawSeesawStand(body, view.silhouette ? COLORS.silhouette : COLORS.wall);
      var bad = editor && editor.isInvalid(body);
      var selected = editor && editor.isSelected(body);
      var hit = game.touched[id];
      if (body.plugin.part.type === 'spring') {
        drawSpring(body, hit ? COLORS.touched : bad ? COLORS.invalid : COLORS.movable);
        if (selected) {
          tracePath(body);
          ctx.strokeStyle = COLORS.handle;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        return;
      }
      if (hit) {
        ctx.save();
        ctx.shadowColor = COLORS.touched;
        ctx.shadowBlur = 14;
        drawBody(body, COLORS.touched);
        ctx.restore();
      } else {
        drawBody(body, bad ? COLORS.invalid : COLORS.movable);
      }
      if (selected) {
        tracePath(body);
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (mode !== 'edit') return;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      var c = Math.cos(body.angle), s = Math.sin(body.angle);
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(body.position.x + c * i * 10, body.position.y + s * i * 10, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // The ball that has to reach the basket is red; other balls are blue. A heavy ball has a dark rim.
    function drawBall(b, fill) {
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, b.circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (view.silhouette) return;
      if (b.plugin.part.heavy) {
        ctx.strokeStyle = COLORS.heavyRim;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, b.circleRadius - 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      // A highlight line so rolling is visible
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.position.x, b.position.y);
      ctx.lineTo(b.position.x + Math.cos(b.angle) * b.circleRadius * 0.8,
                 b.position.y + Math.sin(b.angle) * b.circleRadius * 0.8);
      ctx.stroke();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.fillStyle = view.silhouette ? COLORS.silhouetteSky : COLORS.sky;
    ctx.fillRect(0, 0, W, H);

    var g = game.goal;
    if (g && !view.silhouette) {
      ctx.fillStyle = COLORS.goal;
      ctx.fillRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
    }
    if (game.level.launch) drawEntryPipe(ctx, game, view.silhouette);

    var dominoIndex = 0;
    Matter.Composite.allBodies(game.engine.world).forEach(function (b) {
      var kind = b.render.kind;
      if (kind === 'bound') return;
      var tray = b.plugin.part && b.plugin.part.tray;
      if (view.silhouette) {
        if (tray) return;
        if (kind === 'ball') drawBall(b, COLORS.silhouette);
        else drawBody(b, COLORS.silhouette);
        return;
      }
      if (tray) drawTrayPart(b);
      else if (kind === 'ball') drawBall(b, b.plugin.part.id === (game.level.goalBall || 'ball') ? COLORS.ball : COLORS.otherBall);
      else if (kind === 'domino') drawBody(b, COLORS.domino[dominoIndex++ % COLORS.domino.length]);
      else if (kind === 'basket') drawBody(b, COLORS.basket);
      else drawBody(b, COLORS.wall);
    });
    if (editor) editor.drawOverlay(ctx, COLORS);
    ctx.restore();
  }

  // The short pipe the ball comes out of at the top of floors fed by the floor above
  function drawEntryPipe(ctx, game, silhouette) {
    var ball = game.level.parts.filter(function (p) { return p.id === 'ball'; })[0];
    var x = ball.x, bottom = ball.y - (ball.r || 16) + 4;
    ctx.fillStyle = silhouette ? COLORS.silhouette : COLORS.pipe;
    ctx.fillRect(x - PIPE_W / 2, 0, PIPE_W, bottom);
    ctx.fillStyle = silhouette ? COLORS.silhouette : COLORS.pipeEdge;
    ctx.fillRect(x - PIPE_W / 2 - 5, bottom - 8, PIPE_W + 10, 8);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  root.ChainRender = { drawFloor: drawFloor, roundRect: roundRect, COLORS: COLORS, PIPE_W: PIPE_W };
})(this);
