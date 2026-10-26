// Edit mode: drag parts from the tray onto the board, move and rotate them, or drag them back to the
// tray. A selected part gets two handles, like in design apps: a move handle beside it and a rotate
// handle past its end, both sized in screen pixels so small parts are as easy to grab as big ones.
// Works with mouse and touch through pointer events. Parts may not overlap others or leave the board.
(function (root) {
  var deg = Math.PI / 180;
  var ROTATE_SNAP = 5 * deg;
  var TOUCH_SLOP_PX = 22;      // how far from a part a finger may land and still grab it
  var HANDLE_R_PX = 17;        // drawn radius of the move and rotate handles
  var HANDLE_HIT_PX = 28;      // how far from a handle's center a finger still grabs it
  var HANDLE_GAP_PX = 14;      // space between the part and its handles
  var TOUCH_LIFT_PX = 56;      // a part pulled from the tray by finger floats above it so it stays visible

  function create(opts) {
    var canvas = opts.canvas;
    var game = null, enabled = false;
    var selected = null, drag = null, invalid = false, overTray = false;

    function movableBodies() {
      return Matter.Composite.allBodies(game.engine.world).filter(function (b) {
        return b.plugin.part && b.plugin.part.tray;
      });
    }

    function removeBody(body) {
      Matter.Composite.remove(game.engine.world, body);
      if (selected === body) selected = null;
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

    // Handle positions for a part: rotate past one end of its long side, move beside its middle.
    // Each picks the side that stays inside the board.
    function handlesFor(body) {
      var part = body.plugin.part, k = 1 / opts.getScale();
      var w = part.w || 12, h = part.h || 64;
      var axis = w >= h ? 0 : -Math.PI / 2;
      var long = Math.max(w, h), thick = Math.min(w, h);
      var r = HANDLE_R_PX * k, gap = HANDLE_GAP_PX * k;
      var inside = function (p) { return p.x > r && p.x < game.width - r && p.y > r && p.y < game.height - r; };
      function pick(dirs, reach) {
        var spots = dirs.map(function (d) {
          var a = body.angle + d;
          return { x: body.position.x + Math.cos(a) * reach, y: body.position.y + Math.sin(a) * reach, offset: d };
        });
        return inside(spots[0]) || !inside(spots[1]) ? spots[0] : spots[1];
      }
      var move = pick([axis + Math.PI / 2, axis - Math.PI / 2], thick / 2 + gap + r);
      return {
        r: r,
        // Parts that always stand upright (a domino row, a windmill) have no rotate handle
        rotate: part.fixedAngle ? null : pick([axis, axis + Math.PI], long / 2 + gap + r),
        move: move,
        // A motor gets a third handle, opposite the move handle, that flips the way it turns
        flip: part.motor ? pick([move.offset + Math.PI, move.offset], thick / 2 + gap + r) : null
      };
    }

    function placementOk(body) { return ChainWorld.placementOk(Matter, game, body); }

    // Lowers a part that must stand on something (a domino row) onto the first surface below it,
    // so it does not drop when the run starts. Leaves it where it is if nothing is close below.
    var SNAP_REACH = 160;
    function snapDown(body) {
      var start = { x: body.position.x, y: body.position.y };
      for (var d = 1; d <= SNAP_REACH; d++) {
        Matter.Body.setPosition(body, { x: start.x, y: start.y + d });
        if (!placementOk(body)) {
          // Back off a little so it rests just above the surface rather than touching it
          Matter.Body.setPosition(body, { x: start.x, y: start.y + Math.max(0, d - 2) });
          return;
        }
      }
      Matter.Body.setPosition(body, start);
    }

    // Shift a part that pokes past an edge back onto the board, so it slides along the edge
    function keepOnBoard(body) {
      var b = body.bounds;
      var dx = Math.max(0, -b.min.x) - Math.max(0, b.max.x - game.width);
      var dy = Math.max(0, -b.min.y) - Math.max(0, b.max.y - game.height);
      if (dx || dy) Matter.Body.setPosition(body, { x: body.position.x + dx, y: body.position.y + dy });
    }

    // Apply a move or rotation, keeping the last valid transform to fall back to on release.
    // While the pointer is over the board the part is kept inside it; over the tray it may hang outside.
    function apply(body, pos, angle, onBoard) {
      Matter.Body.setPosition(body, pos);
      Matter.Body.setAngle(body, angle);
      if (onBoard) keepOnBoard(body);
      invalid = !placementOk(body);
      if (!invalid) drag.lastValid = { x: body.position.x, y: body.position.y, angle: angle };
    }

    function onDown(e) {
      if (!enabled || !game) return;
      var p = toWorld(e);
      var slop = TOUCH_SLOP_PX / opts.getScale();

      // Closest part to the pointer, within finger reach
      var hit = null, best = slop;
      movableBodies().forEach(function (b) {
        var d = distToBody(b, p);
        if (d <= best) { best = d; hit = b; }
      });

      // Handles of the selected part come first when the pointer is on one of them. Near a handle
      // but squarely on another part, the other part wins (a handle can sit over a neighbour).
      if (selected) {
        var hs = handlesFor(selected);
        var dr = hs.rotate ? Math.hypot(p.x - hs.rotate.x, p.y - hs.rotate.y) : Infinity;
        var dm = Math.hypot(p.x - hs.move.x, p.y - hs.move.y);
        var reach = HANDLE_HIT_PX / opts.getScale();
        var onOtherPart = hit && hit !== selected && best === 0;
        var df = hs.flip ? Math.hypot(p.x - hs.flip.x, p.y - hs.flip.y) : Infinity;
        if (df < Math.min(dr, dm) && (df < hs.r || (df < reach && !onOtherPart))) {
          selected.plugin.dir = -(selected.plugin.dir || 1);
          e.preventDefault();
          opts.onChange();
          return;
        }
        var nearest = dr <= dm ? 'rotate' : 'move', dn = Math.min(dr, dm);
        if (dn < hs.r || (dn < reach && !onOtherPart)) {
          drag = nearest === 'rotate'
            ? { body: selected, mode: 'rotate', offset: hs.rotate.offset }
            : { body: selected, mode: 'move', dx: selected.position.x - p.x, dy: selected.position.y - p.y };
        }
      }
      if (!drag) {
        selected = hit;
        if (hit) drag = { body: hit, mode: 'move', dx: hit.position.x - p.x, dy: hit.position.y - p.y };
      }
      if (drag) {
        drag.lastValid = { x: drag.body.position.x, y: drag.body.position.y, angle: drag.body.angle };
        e.preventDefault();
      }
      opts.onChange();
    }

    // Start dragging a new copy of a tray item from the tray button the pointer went down on
    function beginFromTray(item, e) {
      if (!enabled || !game) return;
      var p = toWorld(e);
      var lift = e.pointerType === 'mouse' ? 0 : TOUCH_LIFT_PX / opts.getScale();
      var body = ChainWorld.makeTrayBody(Matter, item, p.x, p.y - lift, 0);
      Matter.Composite.add(game.engine.world, body);
      selected = body;
      drag = { body: body, mode: 'move', dx: 0, dy: -lift, fromTray: true, lastValid: null };
      apply(body, body.position, 0, false);
      e.preventDefault();
      opts.onChange();
    }

    function onMove(e) {
      if (!drag) return;
      overTray = opts.isOverTray(e);
      var p = toWorld(e), body = drag.body;
      if (drag.mode === 'move') {
        apply(body, { x: p.x + drag.dx, y: p.y + drag.dy }, body.angle, !overTray);
      } else {
        var a = Math.atan2(p.y - body.position.y, p.x - body.position.x) - drag.offset;
        a = Math.round(a / ROTATE_SNAP) * ROTATE_SNAP;
        // Parts with a limited swing (a seesaw) only turn within it
        var max = body.plugin.part.maxAngle;
        if (max) {
          a = Math.atan2(Math.sin(a), Math.cos(a));
          a = Math.max(-max * deg, Math.min(max * deg, a));
        }
        apply(body, body.position, a, true);
      }
      opts.onChange();
    }

    // Dropped on the tray: the part goes back. Dropped where it does not fit: back to its last free
    // spot, or to the tray if it never had one.
    function onUp(e) {
      if (!drag) return;
      var v = drag.lastValid;
      if (opts.isOverTray(e) || (invalid && !v)) {
        removeBody(drag.body);
      } else if (invalid) {
        Matter.Body.setPosition(drag.body, { x: v.x, y: v.y });
        Matter.Body.setAngle(drag.body, v.angle);
      }
      if (drag.body.plugin.part && drag.body.plugin.part.snapDown && game.engine.world.bodies.indexOf(drag.body) >= 0) {
        snapDown(drag.body);
      }
      invalid = false;
      overTray = false;
      drag = null;
      opts.onChange();
    }

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    return {
      setGame: function (g) { game = g; drag = null; invalid = false; overTray = false; selected = null; },
      beginFromTray: beginFromTray,
      isDraggingOverTray: function () { return !!drag && overTray; },
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
          if (b.plugin.part.motor) out[b.plugin.part.id].dir = b.plugin.dir;
        });
        return out;
      },

      isSelected: function (b) { return b === selected; },
      isInvalid: function (b) { return b === selected && (invalid || (!!drag && overTray)); },

      drawOverlay: function (ctx, colors) {
        if (!enabled || !selected) return;
        var hs = handlesFor(selected), c = selected.position, r = hs.r, k = 1 / opts.getScale();
        var color = invalid ? colors.invalid : colors.handle;
        [hs.rotate, hs.move, hs.flip].filter(Boolean).forEach(function (h) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 * k;
          ctx.setLineDash([4 * k, 4 * k]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(h.x, h.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2 * k;
          ctx.stroke();
        });
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.2 * k;
        ctx.lineCap = 'round';

        // Rotate icon: an open circle with an arrow head
        var R = hs.rotate, ri = r * 0.5;
        if (R) {
          ctx.beginPath();
          ctx.arc(R.x, R.y, ri, -0.3, Math.PI * 1.35);
          ctx.stroke();
          var ax = R.x + Math.cos(-0.3) * ri, ay = R.y + Math.sin(-0.3) * ri;
          ctx.beginPath();
          ctx.moveTo(ax - 4 * k, ay - 1 * k);
          ctx.lineTo(ax, ay);
          ctx.lineTo(ax + 1.5 * k, ay - 4.5 * k);
          ctx.stroke();
        }

        // Move icon: four arrows
        var M = hs.move, mi = r * 0.55, hd = 3.5 * k;
        ctx.beginPath();
        ctx.moveTo(M.x - mi, M.y); ctx.lineTo(M.x + mi, M.y);
        ctx.moveTo(M.x, M.y - mi); ctx.lineTo(M.x, M.y + mi);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var tx = M.x + d[0] * mi, ty = M.y + d[1] * mi;
          ctx.moveTo(tx - d[0] * hd - d[1] * hd, ty - d[1] * hd - d[0] * hd);
          ctx.lineTo(tx, ty);
          ctx.lineTo(tx - d[0] * hd + d[1] * hd, ty - d[1] * hd + d[0] * hd);
        });
        ctx.stroke();

        // Flip icon: two arrows pointing opposite ways
        var F = hs.flip;
        if (F) {
          var fi = r * 0.5;
          ctx.beginPath();
          ctx.moveTo(F.x - fi, F.y - fi * 0.45); ctx.lineTo(F.x + fi, F.y - fi * 0.45);
          ctx.lineTo(F.x + fi - hd, F.y - fi * 0.45 - hd);
          ctx.moveTo(F.x + fi, F.y + fi * 0.45); ctx.lineTo(F.x - fi, F.y + fi * 0.45);
          ctx.lineTo(F.x - fi + hd, F.y + fi * 0.45 + hd);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
    };
  }

  root.ChainEditor = { create: create };
})(this);
