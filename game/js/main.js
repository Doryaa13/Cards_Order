// Game loop, rendering and the edit / run / result flow.
(function () {
  var level = window.LEVELS[0];
  var W = level.world.width, H = level.world.height;
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var btnPlay = document.getElementById('btn-play');
  var btnReset = document.getElementById('btn-reset');
  var statusEl = document.getElementById('status');
  var winEl = document.getElementById('win');
  document.getElementById('level-name').textContent = level.name;

  var COLORS = {
    sky: '#fbf7f0', wall: '#6b5b4b', domino: ['#2f6fb0', '#e0662f', '#3c9a5f', '#c9a227'],
    ball: '#d63c3c', basket: '#8a5a2b', goal: 'rgba(60,154,95,0.18)',
    movable: '#7a4fc4', handle: '#7a4fc4', invalid: '#d63c3c', selected: '#fff'
  };
  var EDIT_HINT = 'גררו את החלק הסגול. העיגול מסובב אותו';

  // mode: 'edit' (player arranges movable parts), 'run' (physics running), 'done' (result shown)
  var game, mode, accumulator, lastTime, scale;
  var placements = {};   // the player's arrangement, kept across runs

  var editor = ChainEditor.create({
    canvas: canvas,
    getScale: function () { return scale; },
    onChange: function () {}
  });

  // Back to edit mode with the player's arrangement
  function edit() {
    game = ChainWorld.buildWorld(Matter, level, placements);
    editor.setGame(game);
    editor.setEnabled(true);
    mode = 'edit';
    accumulator = 0;
    btnPlay.disabled = false;
    btnReset.textContent = '↺ אפס';
    winEl.hidden = true;
    statusEl.textContent = EDIT_HINT;
  }

  function onResetClick() {
    // While editing, the button puts movable parts back where the level started them
    if (mode === 'edit') placements = {};
    edit();
  }

  function playAgain() {
    placements = {};
    edit();
  }

  function finish(outcome) {
    mode = 'done';
    btnReset.textContent = '✎ חזרה לעריכה';
    if (outcome === 'win') {
      winEl.hidden = false;
      statusEl.textContent = 'הכדור בסל!';
    } else {
      statusEl.textContent = 'הכדור לא הגיע לסל. חזרו לעריכה ונסו מיקום אחר';
    }
  }

  function play() {
    if (mode !== 'edit') return;
    placements = editor.placements();
    editor.setEnabled(false);
    mode = 'run';
    btnPlay.disabled = true;
    btnReset.textContent = '■ עצור';
    ChainWorld.startChain(Matter, game);
    statusEl.textContent = 'השרשרת רצה...';
  }

  // Fit the canvas to the stage while keeping the world's aspect ratio
  function resize() {
    var stage = canvas.parentElement;
    var maxW = stage.clientWidth, maxH = stage.clientHeight;
    scale = Math.min(maxW / W, maxH / H);
    var dpr = window.devicePixelRatio || 1;
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.width = Math.floor(W * scale * dpr);
    canvas.height = Math.floor(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  function tracePath(body) {
    var v = body.vertices;
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (var i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
  }

  function drawBody(body, fill) {
    tracePath(body);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // Movable parts are purple with grip dots; the selected one gets an outline
  function drawMovable(body) {
    var bad = editor.isInvalid(body);
    drawBody(body, bad ? COLORS.invalid : COLORS.movable);
    if (editor.isSelected(body)) {
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

  function draw() {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, W, H);

    var g = game.goal;
    if (g) {
      ctx.fillStyle = COLORS.goal;
      ctx.fillRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
    }

    var dominoIndex = 0;
    Matter.Composite.allBodies(game.engine.world).forEach(function (b) {
      var kind = b.render.kind;
      if (kind === 'bound') return;
      if (b.plugin.part && b.plugin.part.movable) {
        drawMovable(b);
      } else if (kind === 'ball') {
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, b.circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.ball;
        ctx.fill();
        // A highlight line so rolling is visible
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.position.x, b.position.y);
        ctx.lineTo(b.position.x + Math.cos(b.angle) * b.circleRadius * 0.8,
                   b.position.y + Math.sin(b.angle) * b.circleRadius * 0.8);
        ctx.stroke();
      } else if (kind === 'domino') {
        drawBody(b, COLORS.domino[dominoIndex++ % COLORS.domino.length]);
      } else if (kind === 'basket') {
        drawBody(b, COLORS.basket);
      } else {
        drawBody(b, COLORS.wall);
      }
    });
    editor.drawOverlay(ctx, COLORS);
  }

  // Fixed-step physics keeps the simulation identical on every device
  function frame(now) {
    if (lastTime == null) lastTime = now;
    var dt = Math.min(now - lastTime, 100);
    lastTime = now;
    if (mode === 'run') {
      accumulator += dt;
      while (mode === 'run' && accumulator >= ChainWorld.STEP_MS) {
        Matter.Engine.update(game.engine, ChainWorld.STEP_MS);
        accumulator -= ChainWorld.STEP_MS;
        var outcome = ChainWorld.checkOutcome(Matter, game);
        if (outcome) finish(outcome);
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  btnPlay.addEventListener('click', play);
  btnReset.addEventListener('click', onResetClick);
  document.getElementById('btn-again').addEventListener('click', playAgain);
  window.addEventListener('resize', resize);

  edit();
  resize();
  requestAnimationFrame(frame);
})();
