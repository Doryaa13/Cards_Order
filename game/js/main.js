// Game loop, rendering and play/reset controls.
(function () {
  var level = window.LEVELS[0];
  var W = level.world.width, H = level.world.height;
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var btnPlay = document.getElementById('btn-play');
  var btnReset = document.getElementById('btn-reset');
  var statusEl = document.getElementById('status');
  document.getElementById('level-name').textContent = level.name;

  var COLORS = {
    sky: '#fbf7f0', wall: '#6b5b4b', domino: ['#2f6fb0', '#e0662f', '#3c9a5f', '#c9a227'],
    ball: '#d63c3c', basket: '#8a5a2b', goal: 'rgba(60,154,95,0.18)'
  };

  var game, running, accumulator, lastTime, scale;

  function reset() {
    game = ChainWorld.buildWorld(Matter, level);
    running = false;
    accumulator = 0;
    btnPlay.disabled = false;
    statusEl.textContent = 'לחצו "הפעל" כדי להפיל את הדומינו הראשון';
  }

  function play() {
    if (running) return;
    running = true;
    btnPlay.disabled = true;
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

  function drawBody(body, fill) {
    var v = body.vertices;
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (var i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
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
      if (kind === 'ball') {
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
  }

  // Fixed-step physics keeps the simulation identical on every device
  function frame(now) {
    if (lastTime == null) lastTime = now;
    var dt = Math.min(now - lastTime, 100);
    lastTime = now;
    if (running) {
      accumulator += dt;
      while (accumulator >= ChainWorld.STEP_MS) {
        Matter.Engine.update(game.engine, ChainWorld.STEP_MS);
        accumulator -= ChainWorld.STEP_MS;
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  btnPlay.addEventListener('click', play);
  btnReset.addEventListener('click', reset);
  window.addEventListener('resize', resize);

  reset();
  resize();
  requestAnimationFrame(frame);
})();
