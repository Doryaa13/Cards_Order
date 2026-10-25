// The game's flow: the tower (menu and opening shot) and the floor being played, with its
// edit / run / result steps, the tray, and saved progress.
(function () {
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var stage = document.getElementById('stage');
  var btnPlay = document.getElementById('btn-play');
  var btnReset = document.getElementById('btn-reset');
  var btnTower = document.getElementById('btn-tower');
  var btnNext = document.getElementById('btn-next');
  var btnEdit = document.getElementById('btn-edit');
  var titleEl = document.getElementById('level-name');
  var statusEl = document.getElementById('status');
  var winEl = document.getElementById('win');
  var trayEl = document.getElementById('tray');

  var SPRING_ICON = '<svg class="tray-spring" viewBox="0 0 40 26" aria-hidden="true">' +
    '<rect x="4" y="2" width="32" height="5" rx="1.5"/>' +
    '<polyline points="8,9 32,12 8,15 32,18 8,21" fill="none" stroke-width="2.2"/>' +
    '<rect x="4" y="21" width="32" height="4" rx="1.5"/></svg>';

  var levels, progress, tower;
  // view: 'tower' or 'floor'. mode (inside a floor): 'edit', 'run' or 'done'.
  var view = null, mode = null;
  var floorIndex = 0, level = null, trayItems = [];
  var game, accumulator = 0, lastTime = null, scale = 1;
  var placements = {};   // the player's arrangement on this floor, kept across runs
  var lastRunText = null;

  var editor = ChainEditor.create({
    canvas: canvas,
    getScale: function () { return scale; },
    isOverTray: function (e) { return e.clientY > canvas.getBoundingClientRect().bottom; },
    onChange: function () { if (view === 'floor' && mode === 'edit') updateEditUi(); }
  });

  function starText(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  // ---- Canvas size: the whole stage for the tower, the floor's aspect ratio while playing ----

  function stageSize() {
    return { w: stage.clientWidth, h: stage.clientHeight, dpr: window.devicePixelRatio || 1 };
  }

  function resize() {
    var sz = stageSize();
    if (view === 'tower') {
      canvas.style.width = sz.w + 'px';
      canvas.style.height = sz.h + 'px';
      canvas.width = Math.floor(sz.w * sz.dpr);
      canvas.height = Math.floor(sz.h * sz.dpr);
      return;
    }
    var W = level.world.width, H = level.world.height;
    scale = Math.min(sz.w / W, sz.h / H);
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.width = Math.floor(W * scale * sz.dpr);
    canvas.height = Math.floor(H * scale * sz.dpr);
  }

  function totalStars() {
    return levels.reduce(function (sum, l) { return sum + progress.stars(l.id); }, 0);
  }

  // ---- The tower ----

  // Shared setup when the tower takes over the screen
  function towerChrome(trayText) {
    view = 'tower';
    mode = null;
    editor.setEnabled(false);
    document.body.classList.add('in-tower');
    winEl.hidden = true;
    titleEl.textContent = 'המגדל · ★ ' + totalStars() + ' מתוך ' + levels.length * 3;
    btnTower.hidden = true;
    btnReset.hidden = true;
    btnPlay.disabled = false;
    btnPlay.textContent = '▶ לקומה ' + (progress.currentIndex(levels) + 1);
    trayEl.classList.remove('locked', 'drop');
    trayEl.innerHTML = '<p class="tray-empty">' + trayText + '</p>';
    statusEl.textContent = ' ';
    tower.build();
    resize();
  }

  // Shows the tower. intro: the opening shot (whole tower, then down into the current floor).
  // Otherwise the camera zooms out from the floor just left, and the player picks a floor.
  function showTower(intro) {
    var cur = progress.currentIndex(levels);
    towerChrome(intro ? 'נגיעה מדלגת' : 'געו בקומה כדי לשחק בה. גררו כדי לגלול');
    if (intro) {
      tower.setCamera(tower.towerCamera());
      // Hold on the whole tower for a moment, then fly down into the current floor
      tower.animate([tower.towerCamera(), tower.floorCamera(cur)], 2600, function () { enterFloor(cur); });
    } else {
      tower.setCamera(tower.floorCamera(floorIndex));
      tower.animate([tower.menuCamera(floorIndex)], 900);
    }
  }

  function flyToFloor(i) {
    trayEl.innerHTML = '<p class="tray-empty"> </p>';
    tower.animate([tower.floorCamera(i)], 1200, function () { enterFloor(i); });
  }

  // In the tower a drag scrolls and a tap (little movement) picks a floor
  var towerPointer = null;
  function onTowerDown(e) {
    if (view !== 'tower') return;
    if (tower.skip()) return;
    towerPointer = { id: e.pointerId, x: e.clientX, y: e.clientY, lastY: e.clientY, moved: false };
    e.preventDefault();
  }
  function onTowerMove(e) {
    if (!towerPointer || e.pointerId !== towerPointer.id || view !== 'tower') return;
    if (Math.abs(e.clientY - towerPointer.y) + Math.abs(e.clientX - towerPointer.x) > 8) towerPointer.moved = true;
    if (towerPointer.moved) tower.pan(e.clientY - towerPointer.lastY);
    towerPointer.lastY = e.clientY;
  }
  function onTowerUp(e) {
    var p = towerPointer;
    towerPointer = null;
    if (!p || e.pointerId !== p.id || view !== 'tower' || p.moved) return;
    onTowerTap(e);
  }

  function onTowerTap(e) {
    var i = tower.floorAt(e.clientX, e.clientY, canvas.getBoundingClientRect());
    if (i < 0) return;
    if (!progress.unlocked(levels, i)) {
      statusEl.textContent = 'קומה ' + (i + 1) + ' נעולה. השיגו כוכב בקומה שמעליה כדי לפתוח אותה';
      return;
    }
    flyToFloor(i);
  }

  // After a win: down the pipe to the next floor, zooming out just enough to see both
  function goToNextFloor() {
    var from = floorIndex, to = floorIndex + 1;
    if (to >= levels.length) { showTower(false); return; }
    towerChrome(' ');
    tower.setCamera(tower.floorCamera(from));
    tower.animate([tower.betweenCamera(from, to), tower.floorCamera(to)], 1800, function () { enterFloor(to); });
  }

  // ---- A floor ----

  function enterFloor(i) {
    view = 'floor';
    floorIndex = i;
    level = levels[i];
    trayItems = level.tray || [];
    placements = progress.placements(level.id);
    document.body.classList.remove('in-tower');
    titleEl.textContent = level.name;
    btnTower.hidden = false;
    btnReset.hidden = false;
    btnPlay.textContent = '▶ הפעל';
    resize();
    edit();
  }

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
        btn.setAttribute('aria-label', 'קפיץ, נגיעה אחת בכל ריצה');
        btn.innerHTML = SPRING_ICON + '<span class="tray-badge">1</span>';
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
    var hasSpring = trayItems.some(function (it) { return it.type === 'spring'; });
    statusEl.textContent = left > 0
      ? 'גררו את החלקים מהמאגר ללוח (נשארו ' + left + ')'
      : hasSpring ? 'בזמן הריצה אפשר לגעת בקפיץ פעם אחת. מוכנים? "הפעל"'
      : 'מוכנים? לחצו "הפעל"';
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

  function finish(outcome) {
    mode = 'done';
    btnReset.textContent = '✎ חזרה לעריכה';
    var s = ChainWorld.score(game);
    if (outcome === 'win' && s.stars > 0) {
      progress.saveWin(level.id, s.stars, placements);
      var last = floorIndex === levels.length - 1;
      document.getElementById('win-stars').textContent = starText(s.stars);
      document.getElementById('win-text').textContent =
        'הכדור נגע ב-' + s.touched + ' מתוך ' + s.total + ' חלקים' +
        (s.stars < 3 ? '. נסו לגעת בכולם בשביל 3 כוכבים' : '. מושלם!');
      btnNext.textContent = last ? '↑ למגדל' : '▼ לקומה ' + (floorIndex + 2);
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
    if (view === 'tower') {
      if (!tower.skip()) flyToFloor(progress.currentIndex(levels));
      return;
    }
    if (mode !== 'edit' || btnPlay.disabled) return;
    placements = editor.placements();
    progress.saveDraft(level.id, placements);
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
    } else if (game.tapUsed) {
      text += ' · הנגיעה נוצלה';
    }
    if (text === lastRunText) return;
    lastRunText = text;
    statusEl.textContent = text;
  }

  // One tap per run: it fires the tapped spring, or the only spring on the board wherever you tap
  function onRunTap(e) {
    if (view !== 'floor' || mode !== 'run' || !ChainWorld.tapAvailable(Matter, game)) return;
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

  // ---- Main loop. Fixed-step physics keeps the simulation identical on every device. ----

  function frame(now) {
    if (lastTime == null) lastTime = now;
    var dt = Math.min(now - lastTime, 100);
    lastTime = now;
    if (view === 'tower') {
      tower.update(now);
      if (view === 'tower') tower.draw(ctx, progress.currentIndex(levels));
    }
    if (view === 'floor') {
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
      var dpr = window.devicePixelRatio || 1;
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ChainRender.drawFloor(ctx, game, { scale: scale, mode: mode, editor: mode === 'edit' ? editor : null });
    }
    requestAnimationFrame(frame);
  }

  btnPlay.addEventListener('click', play);
  btnReset.addEventListener('click', onResetClick);
  btnTower.addEventListener('click', function () { if (view === 'floor') showTower(false); });
  btnNext.addEventListener('click', goToNextFloor);
  // Back to editing with the arrangement that just won, to improve on it
  btnEdit.addEventListener('click', edit);
  canvas.addEventListener('pointerdown', onRunTap);
  canvas.addEventListener('pointerdown', onTowerDown);
  window.addEventListener('pointermove', onTowerMove);
  window.addEventListener('pointerup', onTowerUp);
  window.addEventListener('pointercancel', function () { towerPointer = null; });
  window.addEventListener('resize', function () { if (view) resize(); });
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (tower) tower.resetColors(); });
  }

  ChainLevels.load().then(function (loaded) {
    levels = loaded;
    progress = ChainProgress.create();
    tower = ChainTower.create({ levels: levels, progress: progress, getSize: stageSize });
    showTower(true);
    requestAnimationFrame(frame);
  }).catch(function (err) {
    statusEl.textContent = 'לא הצלחתי לטעון את הקומות (' + err.message + '). פתחו את המשחק דרך שרת, למשל npx serve';
  });
})();
