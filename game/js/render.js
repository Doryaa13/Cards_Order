// Draws one floor (a game built by ChainWorld) onto a canvas context whose transform already maps
// world units to the screen. Used for the floor being played and for every floor in the tower view.
(function (root) {
  var COLORS = {
    sky: '#fbf7f0', wall: '#6b5b4b', domino: ['#2f6fb0', '#e0662f', '#3c9a5f', '#c9a227'],
    basket: '#8a5a2b', zone: 'rgba(214,60,60,0.55)', zoneFill: 'rgba(214,60,60,0.07)',
    // Ball colors; a basket is tinted with the color of the ball it takes. Helper balls are grey.
    balls: { red: '#d63c3c', blue: '#2f6fb0', yellow: '#e0a52f', green: '#3c9a5f' }, helperBall: '#8d8578',
    movable: '#7a4fc4', handle: '#7a4fc4', invalid: '#d63c3c', selected: '#fff', touched: '#1fa36f',
    charge: '#e0662f', spent: '#9a948a', pipe: '#8d8578', pipeEdge: '#6f685d',
    silhouetteSky: '#e7e1d6', silhouette: '#cfc7b9', heavyRim: '#3b352d'
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

    // Badge with the taps a part has left, on its top-left corner (clear of the rotate handle),
    // grey once spent. A windmill has it beside the hub.
    function drawChargeBadge(body) {
      var part = body.plugin.part, r = px(10), n = body.plugin.charges || 0;
      var x, y;
      if (part.type === 'windmill') {
        x = body.position.x - px(24); y = body.position.y - px(24);
      } else {
        x = body.position.x - Math.cos(body.angle) * part.w / 2 + Math.sin(body.angle) * part.h / 2;
        y = body.position.y - Math.sin(body.angle) * part.w / 2 - Math.cos(body.angle) * part.h / 2;
      }
      ctx.fillStyle = n > 0 ? COLORS.charge : COLORS.spent;
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
      ctx.fillText(String(n), x, y + px(1));
    }

    // While a part can still be tapped during a run: a pulsing ring and a label saying what a tap
    // does. Right after a tap, a fading note.
    function drawTapHints(body, ringR, label, spentLabel) {
      var charged = body.plugin.charges > 0;
      var fired = body.plugin.firedAt != null ? game.steps - body.plugin.firedAt : Infinity;
      if (mode === 'run' && charged) {
        var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
        ctx.strokeStyle = 'rgba(224,102,47,' + (0.35 + 0.5 * pulse) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, ringR + 4 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (mode === 'static') return;
      drawChargeBadge(body);
      if (mode === 'run' && charged && fired >= 60) drawCallout(body, label);
      if (fired < 60) drawCallout(body, spentLabel, 1 - fired / 60);
    }

    // The way a motor turns: a curved arrow around a windmill, chevrons along a conveyor belt
    function drawWindmill(body, fill) {
      var part = body.plugin.part, R = part.sweep, dir = body.plugin.dir || 1, c = body.position;
      // The circle the blades sweep, so it is clear how much room it needs
      ctx.strokeStyle = 'rgba(122,79,196,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawBody(body, fill);
      ctx.fillStyle = COLORS.wall;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
      ctx.fill();
      // Arrow on the sweep circle, showing the way it turns
      var a0 = -Math.PI / 2 - dir * 0.7, a1 = -Math.PI / 2 + dir * 0.7, ar = R + 12;
      ctx.strokeStyle = COLORS.charge;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(c.x, c.y, ar, Math.min(a0, a1), Math.max(a0, a1));
      var hx = c.x + Math.cos(a1) * ar, hy = c.y + Math.sin(a1) * ar;
      var tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir;   // direction of travel at the tip
      ctx.moveTo(hx - tx * 12 + ty * 9, hy - ty * 12 - tx * 9);
      ctx.lineTo(hx, hy);
      ctx.lineTo(hx - tx * 12 - ty * 9, hy - ty * 12 + tx * 9);
      ctx.stroke();
      ctx.lineCap = 'butt';
      drawTapHints(body, R + 22, 'געו להפוך כיוון', 'הפוך!');
    }

    function drawConveyor(body, fill) {
      var part = body.plugin.part, w = part.w, h = part.h, dir = body.plugin.dir || 1;
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      ctx.fillStyle = fill;
      roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
      // Rollers
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      [-w / 2 + h / 2, 0, w / 2 - h / 2].forEach(function (x) {
        ctx.beginPath();
        ctx.arc(x, 0, h / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
      });
      // Chevrons that slide along the belt while it runs
      var gap = 26, shift = ((game.steps || 0) * 0.8 * dir) % gap;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(-w / 2 + h / 2, -h / 2, w - h, h);
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      for (var x = -w / 2 - gap; x < w / 2 + gap; x += gap) {
        var cx = x + shift;
        ctx.moveTo(cx - dir * 4, -h / 2 + 4);
        ctx.lineTo(cx + dir * 4, 0);
        ctx.lineTo(cx - dir * 4, h / 2 - 4);
      }
      ctx.stroke();
      ctx.restore();
      ctx.restore();
      drawTapHints(body, w / 2 + 10, 'געו להפוך כיוון', 'הפוך!');
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
      ctx.restore();
      drawTapHints(body, w / 2 + 8, 'געו כאן · פעם אחת', 'נוצל');
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
      var special = { spring: drawSpring, windmill: drawWindmill, conveyor: drawConveyor }[body.plugin.part.type];
      if (special) {
        special(body, hit ? COLORS.touched : bad ? COLORS.invalid : COLORS.movable);
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

    // A colored ball has to reach the basket of its color; helper balls are grey. A heavy ball has a dark rim.
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

    if (!view.silhouette) {
      // Each basket's inside is tinted with its color, with a ball-sized ring of that color at the bottom
      game.baskets.forEach(function (k) {
        var c = COLORS.balls[k.color] || COLORS.balls.red;
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = c;
        ctx.fillRect(k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0);
        ctx.restore();
        ctx.strokeStyle = c;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc((k.x0 + k.x1) / 2, k.y1 - 18, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      // No-build zones: a faint fill with diagonal stripes
      game.engine.world.bodies.forEach(function (b) {
        if (b.render.kind !== 'zone') return;
        var z = b.plugin.zone;
        ctx.save();
        ctx.beginPath();
        ctx.rect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h);
        ctx.fillStyle = COLORS.zoneFill;
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = COLORS.zone;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (var d = -z.h; d < z.w; d += 18) {
          ctx.moveTo(z.x - z.w / 2 + d, z.y + z.h / 2);
          ctx.lineTo(z.x - z.w / 2 + d + z.h, z.y - z.h / 2);
        }
        ctx.stroke();
        ctx.restore();
      });
    }
    if (game.level.launch) drawEntryPipe(ctx, game, view.silhouette);

    var dominoIndex = 0;
    Matter.Composite.allBodies(game.engine.world).forEach(function (b) {
      var kind = b.render.kind;
      if (kind === 'bound' || kind === 'zone') return;
      var tray = b.plugin.part && b.plugin.part.tray;
      if (view.silhouette) {
        if (tray) return;
        if (kind === 'ball') drawBall(b, COLORS.silhouette);
        else drawBody(b, COLORS.silhouette);
        return;
      }
      if (tray) drawTrayPart(b);
      else if (kind === 'ball') drawBall(b, b.plugin.color ? COLORS.balls[b.plugin.color] : COLORS.helperBall);
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
