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
        var open = progress.unlocked(tower, i);
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
    function towerCamera() {
      var height = levels.length * (H + GAP);
      return fit(-40, -GAP, W + 80, height, TOWER_PAD_PX);
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
        css = { bg: v('--bg'), border: v('--border'), accent: v('--accent'), ink: v('--ink'), muted: v('--muted'), star: v('--star') };
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

    function draw(ctx, currentIndex) {
      var sz = size(), c = colors();
      ctx.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0);
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, sz.w, sz.h);
      ctx.setTransform(sz.dpr * cam.s, 0, 0, sz.dpr * cam.s,
        sz.dpr * (sz.w / 2 - cam.x * cam.s), sz.dpr * (sz.h / 2 - cam.y * cam.s));

      for (var i = 0; i < levels.length - 1; i++) drawPipe(ctx, i);

      games.forEach(function (f, i) {
        var y = top(i);
        ctx.save();
        ctx.translate(0, y);
        // Rounded board, like the canvas while playing
        ChainRender.roundRect(ctx, 0, 0, W, H, 12 / cam.s);
        ctx.save();
        ctx.clip();
        ChainRender.drawFloor(ctx, f.game, { scale: cam.s, mode: 'static', silhouette: !f.open });
        ctx.restore();
        ChainRender.roundRect(ctx, 0, 0, W, H, 12 / cam.s);
        ctx.strokeStyle = i === currentIndex ? c.accent : c.border;
        ctx.lineWidth = (i === currentIndex ? 3 : 1) / cam.s;
        ctx.stroke();
        ctx.restore();

        // One line above each floor: number and name, then stars, "you are here", or locked
        var name = levels[i].name.replace(/^[^:]+: /, '');
        var ly = y - 16 / cam.s;   // a fixed distance above the floor on screen, at any zoom
        var here = i === currentIndex && !f.stars;
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
      // Scrolls the tower by a drag of dy screen pixels
      pan: function (dy) { if (!anim) cam = clampCamera({ x: cam.x, y: cam.y - dy / cam.s, s: cam.s }); },
      resetColors: function () { css = null; }
    };
  }

  root.ChainTower = { create: create };
})(this);
