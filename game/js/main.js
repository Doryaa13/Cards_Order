// The game's flow: the tower (menu and opening shot) and the floor being played, with its
// edit / run / result steps, the tray, and saved progress.
(function () {
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var stage = document.getElementById('stage');
  var btnPlay = document.getElementById('btn-play');
  var btnReset = document.getElementById('btn-reset');
  var btnTower = document.getElementById('btn-tower');
  var btnSwitch = document.getElementById('btn-switch');
  var btnNext = document.getElementById('btn-next');
  var btnEdit = document.getElementById('btn-edit');
  var titleEl = document.getElementById('level-name');
  var statusEl = document.getElementById('status');
  var winEl = document.getElementById('win');
  var trayEl = document.getElementById('tray');
  var winTitleEl = document.getElementById('win-title');
  var towersEl = document.getElementById('towers');

  // Tray button pictures for parts that are not plain ramps
  var ICONS = {
    spring: { label: 'קפיץ, נגיעה אחת בכל ריצה', badge: true, svg:
      '<rect x="4" y="2" width="32" height="5" rx="1.5"/>' +
      '<polyline points="8,9 32,12 8,15 32,18 8,21" fill="none" stroke-width="2.2"/>' +
      '<rect x="4" y="21" width="32" height="4" rx="1.5"/>' },
    funnel: { label: 'משפך', svg:
      '<polyline points="3,3 17,22 23,22 37,3" fill="none" stroke-width="3.5" stroke-linejoin="round"/>' },
    seesaw: { label: 'נדנדה', svg:
      '<rect x="2" y="8" width="36" height="4" rx="1.5" transform="rotate(-12 20 10)"/>' +
      '<polygon points="20,11 13,24 27,24" stroke="none"/>' },
    dominoes: { label: 'שורת דומינו', svg:
      '<rect x="5" y="3" width="4" height="20" rx="1"/><rect x="14" y="3" width="4" height="20" rx="1"/>' +
      '<rect x="23" y="3" width="4" height="20" rx="1"/><rect x="32" y="3" width="4" height="20" rx="1"/>' }
  };

  var towers, towerIndex = 0, towerData, levels, progress, tower;
  // view: 'tower', 'floor' or 'replay' (the finished tower running from top to bottom).
  // mode (inside a floor): 'edit', 'run' or 'done'.
  var view = null, mode = null;
  var runTaps = [];      // taps during the current run: [{ part, step }], saved with a win
  var replay = null;     // { index, game, taps, running } while the tower replays
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
    if (view === 'tower' || view === 'replay') {
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

  // Switches which tower is shown: the main tower or the lab
  function useTower(i) {
    towerIndex = i;
    towerData = towers[i];
    levels = towerData.floors;
    tower = ChainTower.create({ tower: towerData, progress: progress, getSize: stageSize });
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
    titleEl.textContent = towerData.name + ' · ★ ' + totalStars() + ' מתוך ' + levels.length * 3;
    btnTower.hidden = true;
    btnSwitch.hidden = towers.length < 2;
    btnSwitch.textContent = 'מגדלים';
    btnReset.hidden = true;
    btnPlay.disabled = false;
    btnPlay.textContent = progress.complete(towerData) && !towerData.open
      ? '★ סיימתי את המגדל!'
      : '▶ לקומה ' + (progress.currentIndex(towerData) + 1);
    trayEl.classList.remove('locked', 'drop');
    trayEl.innerHTML = '<p class="tray-empty">' + trayText + '</p>';
    statusEl.textContent = ' ';
    tower.build();
    resize();
  }

  // Shows the tower. intro: the opening shot (whole tower, then down into the current floor).
  // Otherwise the camera zooms out from the floor just left, and the player picks a floor.
  function showTower(intro) {
    var cur = progress.currentIndex(towerData);
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
    if (!progress.unlocked(towerData, i)) {
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
    btnSwitch.hidden = true;
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
      var icon = ICONS[item.type];
      if (icon) {
        btn.setAttribute('aria-label', icon.label);
        btn.innerHTML = '<svg class="tray-icon" viewBox="0 0 40 26" aria-hidden="true">' + icon.svg + '</svg>' +
          (icon.badge ? '<span class="tray-badge">1</span>' : '');
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
    game = ChainWorld.buildWorld(Matter, level, placements, { edit: true });
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
    var many = game.goalBalls.length > 1;
    if (outcome === 'win' && s.stars > 0) {
      progress.saveWin(level.id, s.stars, placements, runTaps);
      var last = floorIndex === levels.length - 1;
      winTitleEl.textContent = 'הצלחת!';
      document.getElementById('win-stars').textContent = starText(s.stars);
      document.getElementById('win-text').textContent =
        'הכדור נגע ב-' + s.touched + ' מתוך ' + s.total + ' חלקים' +
        (s.stars < 3 ? '. נסו לגעת בכולם בשביל 3 כוכבים' : '. מושלם!');
      // Once every floor of a tower has a star, the next step is watching the whole tower run
      var done = progress.complete(towerData) && !towerData.open;
      btnNext.textContent = done ? '★ סיימתי את המגדל!' : last ? '↑ למגדל' : '▼ לקומה ' + (floorIndex + 2);
      winEl.hidden = false;
      statusEl.textContent = many ? 'כל הכדורים בסלים שלהם!' : 'הכדור בסל!';
    } else if (outcome === 'win') {
      statusEl.textContent = (many ? 'הכדורים בסלים' : 'הכדור בסל') + ', אבל נגעו רק ב-' + s.touched + ' מתוך ' + s.total +
        ' חלקים. צריך לפחות ' + s.needed;
    } else {
      statusEl.textContent = many
        ? 'לא כל הכדורים הגיעו לסל בצבע שלהם. חזרו לעריכה ונסו שוב'
        : 'הכדור לא הגיע לסל. חזרו לעריכה ונסו מיקום אחר';
    }
  }

  function play() {
    if (view === 'tower') {
      if (tower.skip()) return;
      if (progress.complete(towerData) && !towerData.open) startReplay();
      else flyToFloor(progress.currentIndex(towerData));
      return;
    }
    if (mode !== 'edit' || btnPlay.disabled) return;
    placements = editor.placements();
    progress.saveDraft(level.id, placements);
    editor.setEnabled(false);
    // The run gets its own world: seesaws on their pivots, domino rows as separate dominoes
    game = ChainWorld.buildWorld(Matter, level, placements);
    mode = 'run';
    runTaps = [];
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
    if (target && ChainWorld.fireSpring(Matter, game, target)) {
      runTaps.push({ part: target.plugin.part.id, step: game.steps || 0 });
      e.preventDefault();
    }
  }

  // ---- The finished tower, running from top to bottom ----

  // Every floor replays its best run (same arrangement, same taps, same physics), one after the
  // other, while the camera follows down the tower. Then the tower is marked done.
  function startReplay() {
    towerChrome('המכונה שלכם, מההתחלה ועד הסוף');
    view = 'replay';
    btnPlay.disabled = true;
    btnPlay.textContent = '▶ רץ...';
    btnSwitch.hidden = true;
    btnReset.hidden = false;
    btnReset.textContent = '⏭ דלג';
    replayFloor(0);
  }

  function replayFloor(i) {
    if (i >= levels.length) { endReplay(); return; }
    var run = progress.bestRun(levels[i].id);
    var g = ChainWorld.buildWorld(Matter, levels[i], run ? run.placements : {});
    replay = { index: i, game: g, taps: run ? run.taps : [], running: false };
    statusEl.textContent = levels[i].name;
    tower.animate([tower.replayCamera(i)], i === 0 ? 1200 : 900, function () {
      ChainWorld.startChain(Matter, g);
      replay.running = true;
      accumulator = 0;
    });
  }

  function stepReplay(dt) {
    if (!replay || !replay.running) return;
    accumulator += dt;
    var g = replay.game;
    while (replay && replay.running && accumulator >= ChainWorld.STEP_MS) {
      replay.taps.forEach(function (t) {
        if (t.step !== (g.steps || 0)) return;
        var spring = Matter.Composite.allBodies(g.engine.world).filter(function (b) {
          return b.plugin.part && b.plugin.part.id === t.part;
        })[0];
        if (spring) ChainWorld.fireSpring(Matter, g, spring);
      });
      Matter.Engine.update(g.engine, ChainWorld.STEP_MS);
      accumulator -= ChainWorld.STEP_MS;
      if (ChainWorld.checkOutcome(Matter, g)) {
        replay.running = false;
        replayFloor(replay.index + 1);
      }
    }
  }

  function endReplay() {
    replay = null;
    view = 'tower';
    btnReset.hidden = true;
    tower.animate([tower.towerCamera()], 1400, function () {
      var next = nextTowerIndex();
      winTitleEl.textContent = 'המגדל הושלם!';
      document.getElementById('win-stars').textContent = '★ ' + totalStars() + ' מתוך ' + levels.length * 3;
      document.getElementById('win-text').textContent = next >= 0
        ? 'המגדל הבא נפתח: ' + towers[next].name
        : 'סיימתם את כל המגדלים שיש כרגע!';
      btnNext.textContent = next >= 0 ? '▶ למגדל הבא' : '↺ צפו שוב';
      btnEdit.textContent = '↑ חזרה למגדל';
      winEl.hidden = false;
    });
  }

  // The next tower in the main progression (not the lab), or -1
  function nextTowerIndex() {
    for (var i = towerIndex + 1; i < towers.length; i++) if (!towers[i].open) return i;
    return -1;
  }

  // ---- Choosing a tower ----

  function openTowerList() {
    towersEl.innerHTML = '';
    var world = null;
    towers.forEach(function (t, i) {
      if (t.world && t.world !== world) {
        world = t.world;
        var h = document.createElement('p');
        h.className = 'towers-world';
        h.textContent = world;
        towersEl.appendChild(h);
      }
      var open = progress.towerUnlocked(towers, i);
      var stars = t.floors.reduce(function (sum, f) { return sum + progress.stars(f.id); }, 0);
      var btn = document.createElement('button');
      btn.className = 'btn tower-choice' + (i === towerIndex ? ' current' : '');
      btn.disabled = !open;
      btn.innerHTML = '<span>' + t.name + '</span><span class="tower-stars">' +
        (open ? '★ ' + stars + '/' + t.floors.length * 3 : 'נעול') + '</span>';
      btn.addEventListener('click', function () { chooseTower(i); });
      towersEl.appendChild(btn);
    });
    var close = document.createElement('button');
    close.className = 'btn';
    close.textContent = 'סגירה';
    close.addEventListener('click', function () { towersEl.hidden = true; });
    towersEl.appendChild(close);
    towersEl.hidden = false;
  }

  function chooseTower(i) {
    towersEl.hidden = true;
    useTower(i);
    towerChrome('געו בקומה כדי לשחק בה. גררו כדי לגלול');
    tower.setCamera(tower.towerCamera());
    tower.animate([tower.menuCamera(progress.currentIndex(towerData))], 900);
  }

  // Where to start: the first tower of the main progression that is open and not yet complete
  function startingTower() {
    var last = 0;
    for (var i = 0; i < towers.length; i++) {
      if (towers[i].open || !progress.towerUnlocked(towers, i)) continue;
      last = i;
      if (!progress.complete(towers[i])) return i;
    }
    return last;
  }

  // ---- Main loop. Fixed-step physics keeps the simulation identical on every device. ----

  function frame(now) {
    if (lastTime == null) lastTime = now;
    var dt = Math.min(now - lastTime, 100);
    lastTime = now;
    if (view === 'tower') {
      tower.update(now);
      if (view === 'tower') tower.draw(ctx, progress.currentIndex(towerData));
    }
    if (view === 'replay') {
      tower.update(now);
      stepReplay(dt);
      if (replay) tower.draw(ctx, -1, { index: replay.index, game: replay.game, mode: 'run' });
      else tower.draw(ctx, -1);
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
  btnReset.addEventListener('click', function () {
    if (view === 'replay') { if (replay) { replay.running = false; tower.skip(); } endReplay(); return; }
    onResetClick();
  });
  btnTower.addEventListener('click', function () { if (view === 'floor') showTower(false); });
  btnSwitch.addEventListener('click', function () { if (view === 'tower') openTowerList(); });
  btnNext.addEventListener('click', function () {
    if (view === 'tower') {
      // The "tower complete" card: on to the next tower, or watch again
      var next = nextTowerIndex();
      btnEdit.textContent = '✎ המשך לערוך';
      if (next >= 0) { useTower(next); winEl.hidden = true; showTower(true); }
      else startReplay();
      return;
    }
    if (progress.complete(towerData) && !towerData.open && btnNext.textContent.indexOf('סיימתי') >= 0) {
      showTower(false);
      startReplay();
      return;
    }
    goToNextFloor();
  });
  btnEdit.addEventListener('click', function () {
    if (view === 'tower') { winEl.hidden = true; btnEdit.textContent = '✎ המשך לערוך'; return; }
    // Back to editing with the arrangement that just won, to improve on it
    edit();
  });
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
    towers = loaded;
    progress = ChainProgress.create();
    useTower(startingTower());
    showTower(true);
    requestAnimationFrame(frame);
  }).catch(function (err) {
    statusEl.textContent = 'לא הצלחתי לטעון את הקומות (' + err.message + '). פתחו את המשחק דרך שרת, למשל npx serve';
  });
})();
