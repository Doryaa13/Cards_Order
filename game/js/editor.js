// Edit mode: drag movable parts to move them, drag the round handle to rotate.
// Works with mouse and touch through pointer events. Parts may not overlap others or leave the board.
(function (root) {
  var deg = Math.PI / 180;
  var ROTATE_SNAP = 5 * deg;
  var TOUCH_SLOP_PX = 22;      // how far from a part a finger may land and still grab it
  var HANDLE_GAP = 34;         // distance from the end of the part to the rotation handle (world units)
  var HANDLE_R = 16;           // drawn radius of the rotation handle (world units)
  var ALLOWED_DEPTH = 1.5;     // touching is fine, real overlap is not

  function create(opts) {
    var canvas = opts.canvas;
    var game = null, enabled = false;
    var selected = null, drag = null, invalid = false;

    function movableBodies() {
      return Matter.Composite.allBodies(game.engine.world).filter(function (b) {
        return b.plugin.part && b.plugin.part.movable;
      });
    }

    function toWorld(e) {
      var rect = canvas.getBoundingClientRect();
      var s = opts.getScale();
      return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s };
    }

    function distToBody(body, p) {
      if (Matter.Vertices.contains(body.vertices, p)) return 0;
      var v = body.vertices, best = Infinity;
      for (var i = 0; i < v.length; i++) {
        var a = v[i], b = v[(i + 1) % v.length];
        var dx = b.x - a.x, dy = b.y - a.y;
        var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
        var ex = a.x + t * dx - p.x, ey = a.y + t * dy - p.y;
        best = Math.min(best, Math.sqrt(ex * ex + ey * ey));
      }
      return best;
    }

    // The handle sits past one end of the part's long side, on whichever end stays inside the board.
    function handleFor(body) {
      var part = body.plugin.part;
      var w = part.w || 12, h = part.h || 64;
      var axis = w >= h ? 0 : -Math.PI / 2;
      var reach = Math.max(w, h) / 2 + HANDLE_GAP;
      var sides = [0, Math.PI].map(function (flip) {
        var a = body.angle + axis + flip;
        return { x: body.position.x + Math.cos(a) * reach, y: body.position.y + Math.sin(a) * reach, offset: axis + flip };
      });
      var inside = function (p) { return p.x > HANDLE_R && p.x < game.width - HANDLE_R && p.y > HANDLE_R && p.y < game.height - HANDLE_R; };
      return inside(sides[0]) || !inside(sides[1]) ? sides[0] : sides[1];
    }

    function placementOk(body) {
      var b = body.bounds;
      if (b.min.x < 0 || b.min.y < 0 || b.max.x > game.width || b.max.y > game.height) return false;
      var others = Matter.Composite.allBodies(game.engine.world).filter(function (o) { return o !== body; });
      return !Matter.Query.collides(body, others).some(function (c) { return c.depth > ALLOWED_DEPTH; });
    }

    // Apply a move or rotation, keeping the last valid transform to fall back to on release
    function apply(body, pos, angle) {
      Matter.Body.setPosition(body, pos);
      Matter.Body.setAngle(body, angle);
      invalid = !placementOk(body);
      if (!invalid) drag.lastValid = { x: pos.x, y: pos.y, angle: angle };
    }

    function onDown(e) {
      if (!enabled || !game) return;
      var p = toWorld(e);
      var slop = TOUCH_SLOP_PX / opts.getScale();

      if (selected) {
        var h = handleFor(selected);
        if (Math.hypot(p.x - h.x, p.y - h.y) < HANDLE_R + slop) {
          drag = { body: selected, mode: 'rotate', offset: h.offset };
        }
      }
      if (!drag) {
        var hit = null, best = slop;
        movableBodies().forEach(function (b) {
          var d = distToBody(b, p);
          if (d <= best) { best = d; hit = b; }
        });
        selected = hit;
        if (hit) drag = { body: hit, mode: 'move', dx: hit.position.x - p.x, dy: hit.position.y - p.y };
      }
      if (drag) {
        drag.lastValid = { x: drag.body.position.x, y: drag.body.position.y, angle: drag.body.angle };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
      opts.onChange();
    }

    function onMove(e) {
      if (!drag) return;
      var p = toWorld(e), body = drag.body;
      if (drag.mode === 'move') {
        apply(body, { x: p.x + drag.dx, y: p.y + drag.dy }, body.angle);
      } else {
        var a = Math.atan2(p.y - body.position.y, p.x - body.position.x) - drag.offset;
        apply(body, body.position, Math.round(a / ROTATE_SNAP) * ROTATE_SNAP);
      }
      opts.onChange();
    }

    function onUp() {
      if (!drag) return;
      if (invalid) {
        var v = drag.lastValid;
        Matter.Body.setPosition(drag.body, { x: v.x, y: v.y });
        Matter.Body.setAngle(drag.body, v.angle);
        invalid = false;
      }
      drag = null;
      opts.onChange();
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    return {
      // Start with the first movable part selected so its rotate handle is visible right away
      setGame: function (g) { game = g; drag = null; invalid = false; selected = movableBodies()[0] || null; },
      setEnabled: function (on) { enabled = on; if (!on) { selected = null; drag = null; invalid = false; } },

      // The player's current placements, in the level's units (degrees)
      placements: function () {
        if (!game) return {};
        var out = {};
        movableBodies().forEach(function (b) {
          out[b.plugin.part.id] = {
            x: Math.round(b.position.x), y: Math.round(b.position.y),
            angle: Math.round(b.angle / deg)
          };
        });
        return out;
      },

      isSelected: function (b) { return b === selected; },
      isInvalid: function (b) { return b === selected && invalid; },

      drawOverlay: function (ctx, colors) {
        if (!enabled || !selected) return;
        var h = handleFor(selected), c = selected.position;
        ctx.strokeStyle = invalid ? colors.invalid : colors.handle;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(h.x, h.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = invalid ? colors.invalid : colors.handle;
        ctx.beginPath();
        ctx.arc(h.x, h.y, HANDLE_R, 0, Math.PI * 2);
        ctx.fill();
        // Curved arrow inside the handle
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, HANDLE_R * 0.5, -0.3, Math.PI * 1.3);
        ctx.stroke();
        var ax = h.x + Math.cos(Math.PI * 1.3) * HANDLE_R * 0.5, ay = h.y + Math.sin(Math.PI * 1.3) * HANDLE_R * 0.5;
        ctx.beginPath();
        ctx.moveTo(ax - 4, ay - 3);
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax + 3, ay - 5);
        ctx.stroke();
      }
    };
  }

  root.ChainEditor = { create: create };
})(this);
