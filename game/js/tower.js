// The tower: every floor stacked top to bottom, joined by pipes from each basket to the next floor's
// entry. It is the game's menu and its opening shot: a camera pans and zooms between the whole tower
// and single floors. Solved floors show the player's arrangement and stars, the current floor is
// highlighted, and floors not reached yet are grey silhouettes of their fixed parts.
(function (root) {
  var GAP = 320;              // world units between floors, room for the pipe and the floor's label
  var TOWER_PAD_PX = 18;      // screen margin around the whole tower

  function create(opts) {
    var tower = opts.tower, levels = tower.floors, progress = opts.progress;
    var W = levels[0].world.width, H = levels[0].world.height;
    var games = [];
    var cam = { x: W / 2, y: H / 2, s: 1 };
    var anim = null;
    var css = null;

    function top(i) { return i * (H + GAP); }

    // Rebuilds the still pictures of all floors from the saved progress
    function build() {
      games = levels.map(function (level, i) {
        var open = !opts.locked && progress.unlocked(tower, i);
        return {
          open: open,
          stars: progress.stars(level.id),
          game: ChainWorld.buildWorld(Matter, level, open ? progress.placements(level.id) : {}, { edit: true })
        };
      });
    }

    function size() { return opts.getSize(); }

    // Camera that fits a world rectangle in the canvas, with an optional margin in screen pixels
    function fit(x, y, w, h, padPx) {
      var sz = size(), pad = padPx || 0;
      var s = Math.min((sz.w - 2 * pad) / w, (sz.h - 2 * pad) / h);
      return { x: x + w / 2, y: y + h / 2, s: s };
    }

    function floorCamera(i) { return fit(0, top(i), W, H, 0); }

    // Watching a floor run during the tower replay: the floor and a bit of what is around it
    function replayCamera(i) { return fit(0, top(i) - GAP * 0.4, W, H + GAP * 0.8, 24); }

    // The menu: close enough to tap floors comfortably, centered on one floor; drag to scroll
    function menuCamera(i) {
      var sz = size();
      var s = Math.min(sz.w * 0.62 / W, sz.h * 0.4 / H);
      return clampCamera({ x: W / 2, y: top(i) + H / 2, s: s });
    }

    // Keeps the camera's view inside the tower (plus the label space above the first floor)
    function clampCamera(c) {
      var sz = size(), half = sz.h / 2 / c.s;
      var lo = -GAP + half, hi = levels.length * (H + GAP) - GAP - half;
      c.y = lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, c.y));
      return c;
    }
    function towerCamera(padPx) {
      var height = levels.length * (H + GAP);
      return fit(-40, -GAP, W + 80, height, padPx || TOWER_PAD_PX);
    }

    // Moves the camera through the given stops. Zoom eases in log space so it feels even at any scale.
    function animate(stops, ms, done) {
      anim = { stops: [Object.assign({}, cam)].concat(stops), start: performance.now(), ms: ms, done: done };
    }
    function skip() {
      if (!anim) return false;
      var a = anim;
      anim = null;
      cam = Object.assign({}, a.stops[a.stops.length - 1]);
      if (a.done) a.done();
      return true;
    }
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function update(now) {
      if (!anim) return;
      // The frame time can be a little earlier than the moment the animation was started
      var t = Math.max(0, Math.min(1, (now - anim.start) / anim.ms));
      var n = anim.stops.length - 1, e = ease(t) * n;
      var k = Math.min(n - 1, Math.floor(e)), f = e - k;
      var a = anim.stops[k], b = anim.stops[k + 1];
      cam = {
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * f)
      };
      if (t >= 1) skip();
    }

    function colors() {
      if (!css) {
        var st = getComputedStyle(document.documentElement);
        var v = function (name) { return st.getPropertyValue(name).trim(); };
        css = { bg: v('--bg'), panel: v('--panel'), border: v('--border'), accent: v('--accent'), ink: v('--ink'), muted: v('--muted'), star: v('--star') };
      }
      return css;
    }

    function drawPipe(ctx, i) {
      var level = levels[i], next = levels[i + 1];
      var basket = level.parts.filter(function (p) { return p.type === 'basket'; })[0];
      var ball = next.parts.filter(function (p) { return p.id === 'ball'; })[0];
      var x0 = basket.x, x1 = ball.x, y0 = top(i) + H, y1 = top(i + 1), mid = (y0 + y1) / 2 + 30;
      ctx.strokeStyle = games[i + 1].open ? ChainRender.COLORS.pipe : ChainRender.COLORS.silhouette;
      ctx.lineWidth = ChainRender.PIPE_W;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, mid);
      ctx.lineTo(x1, mid);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    function label(ctx, text, x, y, sizePx, color, weight) {
      ctx.font = (weight || 600) + ' ' + sizePx / cam.s + 'px system-ui, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    }

    // live: { index, game, mode } draws that floor's running game instead of its still picture
    // shift: { dx (screen pixels), keepBackground } to slide the tower sideways in the tower picker
    function draw(ctx, currentIndex, live, shift) {
      var sz = size(), c = colors(), dx = shift ? shift.dx : 0;
      ctx.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0);
      if (!(shift && shift.keepBackground)) {
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, sz.w, sz.h);
      }
      ctx.setTransform(sz.dpr * cam.s, 0, 0, sz.dpr * cam.s,
        sz.dpr * (sz.w / 2 + dx - cam.x * cam.s), sz.dpr * (sz.h / 2 - cam.y * cam.s));

      for (var i = 0; i < levels.length - 1; i++) drawPipe(ctx, i);

      games.forEach(function (f, i) {
        var y = top(i);
        ctx.save();
        ctx.translate(0, y);
        // Rounded board, like the canvas while playing
        ChainRender.roundRect(ctx, 0, 0, W, H, 12 / cam.s);
        ctx.save();
        ctx.clip();
        if (live && live.index === i) ChainRender.drawFloor(ctx, live.game, { scale: cam.s, mode: live.mode || 'run' });
        else ChainRender.drawFloor(ctx, f.game, { scale: cam.s, mode: 'static', silhouette: !f.open });
        ctx.restore();
        ChainRender.roundRect(ctx, 0, 0, W, H, 12 / cam.s);
        var highlight = live ? live.index === i : i === currentIndex;
        ctx.strokeStyle = highlight ? c.accent : c.border;
        ctx.lineWidth = (highlight ? 3 : 1) / cam.s;
        ctx.stroke();
        ctx.restore();

        // One line above each floor: number and name, then stars, "you are here", or locked
        var name = levels[i].name.replace(/^[^:]+: /, '');
        var ly = y - 16 / cam.s;   // a fixed distance above the floor on screen, at any zoom
        var here = !live && i === currentIndex && !f.stars;
        if (!f.open) {
          label(ctx, (i + 1) + ' · נעולה', W / 2, ly, 12, c.muted);
        } else {
          var stars = '★★★'.slice(0, f.stars) + '☆☆☆'.slice(0, 3 - f.stars);
          label(ctx, (i + 1) + ' · ' + name + ' · ' + (here ? 'אתם כאן' : stars), W / 2, ly, 12,
            here ? c.accent : c.ink, 700);
        }
      });
    }

    // Which floor a screen point falls on, or -1
    // ---- The main menu picture: the tower as a building, each floor a window with its name and stars ----

    var OVERVIEW_TOP = 30, OVERVIEW_BOTTOM = 28, ARROW_ROOM = 64;

    function overviewLayout() {
      var sz = size(), n = levels.length;
      var roof = 40, base = 10;
      var rowH = (sz.h - OVERVIEW_TOP - OVERVIEW_BOTTOM - roof - base - 8) / n;
      var fh = rowH - 6, fw = fh * W / H;
      var bw = Math.min(sz.w - 2 * ARROW_ROOM, 300), bx = (sz.w - bw) / 2;
      var y0 = OVERVIEW_TOP + roof;
      return {
        n: n, rowH: rowH, fh: fh, fw: fw, bx: bx, bw: bw, roofTop: OVERVIEW_TOP, y0: y0,
        bodyH: n * rowH + 8,
        // The window of floor i, on the right of its row (the game reads right to left)
        win: function (i) { return { x: bx + bw - 10 - fw, y: y0 + 4 + i * rowH + 3, w: fw, h: fh }; }
      };
    }

    function drawOverview(ctx, currentIndex, shift) {
      var sz = size(), c = colors(), L = overviewLayout(), dx = shift ? shift.dx : 0;
      ctx.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0);
      if (!(shift && shift.keepBackground)) {
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, sz.w, sz.h);
      }
      ctx.save();
      ctx.translate(dx, 0);
      var locked = !!opts.locked;

      // Roof, walls and a base
      ctx.fillStyle = locked ? c.border : c.accent;
      ctx.beginPath();
      ctx.moveTo(L.bx - 12, L.y0);
      ctx.lineTo(sz.w / 2, L.roofTop);
      ctx.lineTo(L.bx + L.bw + 12, L.y0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c.panel;
      ctx.fillRect(L.bx, L.y0, L.bw, L.bodyH);
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(L.bx, L.y0, L.bw, L.bodyH);
      ctx.fillStyle = c.border;
      ChainRender.roundRect(ctx, L.bx - 10, L.y0 + L.bodyH, L.bw + 20, 10, 3);
      ctx.fill();

      games.forEach(function (f, i) {
        var r = L.win(i), here = !locked && i === currentIndex;
        // The current floor's row is highlighted
        if (here) {
          ctx.save();
          ctx.globalAlpha = 0.14;
          ctx.fillStyle = c.accent;
          ctx.fillRect(L.bx + 3, r.y - 3, L.bw - 6, r.h + 6);
          ctx.restore();
        }
        // The floor itself, shrunk into its window
        var k = r.h / H;
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.scale(k, k);
        ChainRender.roundRect(ctx, 0, 0, W, H, 40);
        ctx.save();
        ctx.clip();
        ChainRender.drawFloor(ctx, f.game, { scale: k, mode: 'static', silhouette: !f.open });
        ctx.restore();
        ChainRender.roundRect(ctx, 0, 0, W, H, 40);
        ctx.strokeStyle = here ? c.accent : c.border;
        ctx.lineWidth = (here ? 2.5 : 1) / k;
        ctx.stroke();
        ctx.restore();

        // Number and name beside the window, stars at the far end of the row
        var ty = r.y + r.h / 2, size = Math.max(11, Math.min(15, r.h * 0.34));
        var name = levels[i].name.replace(/^[^:]+: /, '');
        ctx.textBaseline = 'middle';
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.font = (f.open ? 700 : 500) + ' ' + size + 'px system-ui, sans-serif';
        ctx.fillStyle = here ? c.accent : f.open ? c.ink : c.muted;
        var text = (i + 1) + ' · ' + (f.open ? name : 'נעולה');
        var room = r.x - 10 - (L.bx + 58);
        while (ctx.measureText(text).width > room && text.length > 4) text = text.slice(0, -2) + '…';
        ctx.fillText(text, r.x - 10, ty);
        ctx.textAlign = 'left';
        ctx.font = size + 'px system-ui, sans-serif';
        ctx.fillStyle = f.stars ? c.star : c.muted;
        ctx.fillText(here && !f.stars ? 'אתם כאן' : f.open ? '★★★'.slice(0, f.stars) + '☆☆☆'.slice(0, 3 - f.stars) : '', L.bx + 8, ty);
      });

      // A locked tower: a lock over the building
      if (locked) {
        var cy = L.y0 + L.bodyH / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.fillRect(L.bx, L.y0, L.bw, L.bodyH);
        ctx.fillStyle = c.bg;
        ctx.beginPath();
        ctx.arc(sz.w / 2, cy, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.border;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '32px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔒', sz.w / 2, cy + 2);
      }
      ctx.restore();
    }

    function overviewFloorAt(clientX, clientY, rect) {
      var L = overviewLayout(), x = clientX - rect.left, y = clientY - rect.top;
      if (x < L.bx || x > L.bx + L.bw) return -1;
      var i = Math.floor((y - L.y0 - 4) / L.rowH);
      return i >= 0 && i < L.n ? i : -1;
    }

    // A camera that shows floor i exactly where its window is in the main menu, to zoom in from
    function windowCamera(i) {
      var sz = size(), r = overviewLayout().win(i), s = r.h / H;
      return { x: W / 2 - (r.x + r.w / 2 - sz.w / 2) / s, y: top(i) + H / 2 - (r.y + r.h / 2 - sz.h / 2) / s, s: s };
    }

    // An empty background, for the start of a slide between towers
    function clear(ctx) {
      var sz = size();
      ctx.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0);
      ctx.fillStyle = colors().bg;
      ctx.fillRect(0, 0, sz.w, sz.h);
    }

    function floorAt(clientX, clientY, rect) {
      var sz = size();
      var wx = (clientX - rect.left - sz.w / 2) / cam.s + cam.x;
      var wy = (clientY - rect.top - sz.h / 2) / cam.s + cam.y;
      for (var i = 0; i < levels.length; i++) {
        if (wx >= 0 && wx <= W && wy >= top(i) - GAP * 0.8 && wy <= top(i) + H) return i;
      }
      return -1;
    }

    return {
      build: build,
      draw: draw,
      clear: clear,
      drawOverview: drawOverview,
      overviewFloorAt: overviewFloorAt,
      windowCamera: windowCamera,
      update: update,
      animate: animate,
      skip: skip,
      animating: function () { return !!anim; },
      floorAt: floorAt,
      floorCamera: floorCamera,
      towerCamera: towerCamera,
      // A camera stop between two floors, zoomed out far enough to see both
      betweenCamera: function (a, b) {
        var lo = Math.min(a, b), hi = Math.max(a, b);
        return fit(0, top(lo), W, top(hi) + H - top(lo), TOWER_PAD_PX);
      },
      setCamera: function (c) { cam = Object.assign({}, c); anim = null; },
      menuCamera: menuCamera,
      replayCamera: replayCamera,
      // Scrolls the tower by a drag of dy screen pixels
      pan: function (dy) { if (!anim) cam = clampCamera({ x: cam.x, y: cam.y - dy / cam.s, s: cam.s }); },
      resetColors: function () { css = null; }
    };
  }

  root.ChainTower = { create: create };
})(this);
