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

  var trayEl = document.getElementById('tray');
  var trayItems = level.tray || [];

  var COLORS = {
    sky: '#fbf7f0', wall: '#6b5b4b', domino: ['#2f6fb0', '#e0662f', '#3c9a5f', '#c9a227'],
    ball: '#d63c3c', basket: '#8a5a2b', goal: 'rgba(60,154,95,0.18)',
    movable: '#7a4fc4', handle: '#7a4fc4', invalid: '#d63c3c', selected: '#fff', touched: '#1fa36f'
  };

  // mode: 'edit' (player arranges tray parts), 'run' (physics running), 'done' (result shown)
  var game, mode, accumulator, lastTime, scale;
  var placements = {};   // the player's arrangement, kept across runs
  var lastRunText = null;

  var editor = ChainEditor.create({
    canvas: canvas,
    getScale: function () { return scale; },
    isOverTray: function (e) { return e.clientY > canvas.getBoundingClientRect().bottom; },
    onChange: function () { if (mode === 'edit') updateEditUi(); }
  });

  var SPRING_ICON = '<svg class="tray-spring" viewBox="0 0 40 26" aria-hidden="true">' +
    '<rect x="4" y="2" width="32" height="5" rx="1.5"/>' +
    '<polyline points="8,9 32,12 8,15 32,18 8,21" fill="none" stroke-width="2.2"/>' +
    '<rect x="4" y="21" width="32" height="4" rx="1.5"/></svg>';

  function starText(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  // Tray buttons for the parts not yet on the board, each drawn to scale against the others
  var trayKey = null;
  function renderTray() {
    var onBoard = editor.placements();
    var key = Object.keys(onBoard).sort().join(',');
    if (key === trayKey) return;
    trayKey = key;
    var longest = Math.max.apply(null, trayItems.map(function (it) { return it.w || 0; }));
    trayEl.innerHTML = '';
    trayItems.forEach(function (item) {
      if (onBoard[item.id]) return;
      var btn = document.createElement('button');
      btn.className = 'tray-item';
      if (item.type === 'spring') {
        btn.setAttribute('aria-label', 'קפיץ');
        btn.innerHTML = SPRING_ICON;
      } else {
        btn.setAttribute('aria-label', 'רמפה באורך ' + item.w);
        var bar = document.createElement('span');
        bar.className = 'tray-bar';
        bar.style.width = Math.round(28 + 62 * item.w / longest) + 'px';
        btn.appendChild(bar);
      }
      btn.addEventListener('pointerdown', function (e) { editor.beginFromTray(item, e); });
      trayEl.appendChild(btn);
    });
    if (!trayEl.children.length) {
      var done = document.createElement('p');
      done.className = 'tray-empty';
      done.textContent = 'כל החלקים על הלוח';
      trayEl.appendChild(done);
    }
  }

  function updateEditUi() {
    var left = trayItems.length - Object.keys(editor.placements()).length;
    renderTray();
    trayEl.classList.toggle('drop', editor.isDraggingOverTray());
    btnPlay.disabled = left > 0;
    statusEl.textContent = left > 0
      ? 'גררו את החלקים מהמאגר ללוח (נשארו ' + left + ')'
      : 'אפשר לסובב עם העיגול. מוכנים? לחצו "הפעל"';
  }

  // Back to edit mode with the player's arrangement
  function edit() {
    game = ChainWorld.buildWorld(Matter, level, placements);
    editor.setGame(game);
    editor.setEnabled(true);
    mode = 'edit';
    accumulator = 0;
    btnReset.textContent = '↺ אפס';
    winEl.hidden = true;
    trayEl.classList.remove('locked');
    trayKey = null;
    updateEditUi();
  }

  function onResetClick() {
    // While editing, the button sends every part back to the tray
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
    var s = ChainWorld.score(game);
    if (outcome === 'win' && s.stars > 0) {
      document.getElementById('win-stars').textContent = starText(s.stars);
      document.getElementById('win-text').textContent =
        'הכדור נגע ב-' + s.touched + ' מתוך ' + s.total + ' חלקים' +
        (s.stars < 3 ? '. נסו לגעת בכולם בשביל 3 כוכבים' : '. מושלם!');
      winEl.hidden = false;
      statusEl.textContent = 'הכדור בסל!';
    } else if (outcome === 'win') {
      statusEl.textContent = 'הכדור בסל, אבל נגע רק ב-' + s.touched + ' מתוך ' + s.total +
        ' חלקים. צריך לפחות ' + s.needed;
    } else {
      statusEl.textContent = 'הכדור לא הגיע לסל. חזרו לעריכה ונסו מיקום אחר';
    }
  }

  function play() {
    if (mode !== 'edit' || btnPlay.disabled) return;
    placements = editor.placements();
    editor.setEnabled(false);
    mode = 'run';
    lastRunText = null;
    btnPlay.disabled = true;
    btnReset.textContent = '■ עצור';
    trayEl.classList.add('locked');
    ChainWorld.startChain(Matter, game);
  }

  // During a run the status line counts the touched parts and says whether the tap is still available.
  // When the ball has stopped and the tap is unused, it nudges the player to tap.
  function updateRunUi() {
    var s = ChainWorld.score(game);
    var text = 'חלקים שנגעו: ' + s.touched + ' מתוך ' + s.total;
    if (ChainWorld.tapAvailable(Matter, game)) {
      text += game.stillSeconds >= 1 ? ' · געו בקפיץ!' : ' · נגיעה אחת זמינה';
    }
    if (text === lastRunText) return;
    lastRunText = text;
    statusEl.textContent = text;
  }

  // One tap per run: it fires the tapped spring, or the only spring on the board wherever you tap
  function onRunTap(e) {
    if (mode !== 'run' || !ChainWorld.tapAvailable(Matter, game)) return;
    var rect = canvas.getBoundingClientRect();
    var p = { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    var springs = Matter.Composite.allBodies(game.engine.world).filter(function (b) {
      return b.plugin.part && b.plugin.part.tappable;
    });
    var target = springs.length === 1 ? springs[0] : null;
    springs.forEach(function (b) {
      if (Math.hypot(b.position.x - p.x, b.position.y - p.y) < 50 + 30 / scale) target = b;
    });
    if (target) {
      ChainWorld.fireSpring(Matter, game, target);
      e.preventDefault();
    }
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

  // A spring: base plate, coil and pad, drawn in the body's own frame. The pad pops up briefly when fired.
  // While its tap is still available during a run, a pulsing ring shows it can be tapped.
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
    if (mode === 'run' && ChainWorld.tapAvailable(Matter, game)) {
      var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      ctx.strokeStyle = 'rgba(224,102,47,' + (0.35 + 0.5 * pulse) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, w / 2 + 8 + 4 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Tray parts are purple with grip dots, and turn green once something hits them during a run
  function drawMovable(body) {
    if (body.plugin.part.type === 'spring') {
      var color = game.touched[body.plugin.part.id] ? COLORS.touched
        : editor.isInvalid(body) ? COLORS.invalid : COLORS.movable;
      drawSpring(body, color);
      if (editor.isSelected(body)) {
        tracePath(body);
        ctx.strokeStyle = COLORS.handle;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      return;
    }
    var bad = editor.isInvalid(body);
    var hit = game.touched[body.plugin.part.id];
    if (hit) {
      ctx.save();
      ctx.shadowColor = COLORS.touched;
      ctx.shadowBlur = 14;
      drawBody(body, COLORS.touched);
      ctx.restore();
    } else {
      drawBody(body, bad ? COLORS.invalid : COLORS.movable);
    }
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
      if (b.plugin.part && b.plugin.part.tray) {
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
      if (mode === 'run') updateRunUi();
    }
    draw();
    requestAnimationFrame(frame);
  }

  btnPlay.addEventListener('click', play);
  canvas.addEventListener('pointerdown', onRunTap);
  btnReset.addEventListener('click', onResetClick);
  document.getElementById('btn-again').addEventListener('click', playAgain);
  window.addEventListener('resize', resize);

  edit();
  resize();
  requestAnimationFrame(frame);
})();
