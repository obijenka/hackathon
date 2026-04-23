(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: true });
  const hint = document.getElementById('hint');
  const scoreEl = document.getElementById('score');
  const coinsLineEl = document.getElementById('coinsLine');

  const MT_KEY = 'mt_state_v1';
  const GAME_KEY = 'jumper';
  const RUN_KEY = 'jumper_run_v1';
  const SCORE_PER_COIN = 10;

  const DPR = Math.min(2, window.devicePixelRatio || 1);

  const ASSET_CLOUD = '../images/cloud.png';
  const ASSET_PLAYER = '../images/monechka.png';

  const imgCloud = new Image();
  const imgPlayer = new Image();
  imgCloud.src = ASSET_CLOUD;
  imgPlayer.src = ASSET_PLAYER;

  const keys = {
    left: false,
    right: false,
  };

  let pointerActive = false;
  let pointerStartX = 0;
  let pointerX = 0;

  const world = {
    w: 390,
    h: 844,
    gravity: 1900,
    moveAccel: 2400,
    maxVx: 520,
    jumpV: 920,
    cameraY: 0,
    bestY: 0,
    state: 'loading', // loading | playing
  };

  const player = {
    x: 0,
    y: 0,
    r: 26,
    vx: 0,
    vy: 0,
    width: 95,
    height: 157,
  };

  const platforms = [];
  const PLATFORM_COUNT = 7;

  const PLATFORM_KIND = {
    solid: 'solid',
    ghost: 'ghost',
    boost: 'boost',
  };

  const BOOST_MULT = 1.28;

  function pickKind() {
    const last = platforms.at(-1);
    const lastKind = last?.kind;

    const roll = Math.random();
    const baseKind = roll < 0.16 ? PLATFORM_KIND.boost : roll < 0.40 ? PLATFORM_KIND.ghost : PLATFORM_KIND.solid;

    if (baseKind === PLATFORM_KIND.ghost && lastKind === PLATFORM_KIND.ghost) {
      return Math.random() < 0.25 ? PLATFORM_KIND.boost : PLATFORM_KIND.solid;
    }

    return baseKind;
  }

  const score = {
    value: 0,
    maxHeight: 0,
    landings: 0,
  };

  let runBaseCoins = 0;
  let runAwardedCoins = 0;

  function defaultMtState() {
    return {
      coins: 1000,
      games: {
        wordle: 0,
        blockblast: 0,
        pig: 0,
        jumper: 0,
      },
      shop: {
        active: {},
      },
    };
  }

  function loadMtState() {
    try {
      const raw = localStorage.getItem(MT_KEY);
      if (!raw) return defaultMtState();
      const parsed = JSON.parse(raw);
      const next = defaultMtState();
      if (typeof parsed?.coins === 'number') next.coins = parsed.coins;
      if (typeof parsed?.coins === 'string' && Number.isFinite(Number(parsed.coins))) next.coins = Number(parsed.coins);
      const games = parsed?.games;
      if (games && typeof games === 'object') {
        for (const k of Object.keys(next.games)) {
          if (typeof games[k] === 'number') next.games[k] = games[k];
          if (typeof games[k] === 'string' && Number.isFinite(Number(games[k]))) next.games[k] = Number(games[k]);
        }
      }
      const shop = parsed?.shop;
      if (shop && typeof shop === 'object') {
        if (shop.active && typeof shop.active === 'object') next.shop.active = shop.active;
      }
      return next;
    } catch {
      return defaultMtState();
    }
  }

  function saveMtState(s) {
    localStorage.setItem(MT_KEY, JSON.stringify(s));
  }

  function scoreToCoins(v) {
    return Math.floor(v / SCORE_PER_COIN);
  }

  function format(n) {
    return Math.floor(n).toLocaleString('ru-RU');
  }

  function syncCoinsFromHeight(maxHeight) {
    const heightPoints = Math.floor(maxHeight / 10);
    const sessionCoins = scoreToCoins(heightPoints);

    const s = loadMtState();
    const totalPrev = Math.min(250, Math.floor(s.games[GAME_KEY] ?? 0));

    if (totalPrev < runBaseCoins) {
      runBaseCoins = totalPrev;
      runAwardedCoins = 0;
    }

    if (totalPrev > runBaseCoins + runAwardedCoins) {
      runAwardedCoins = Math.max(0, totalPrev - runBaseCoins);
    }

    const remaining = Math.max(0, 250 - runBaseCoins);
    const eligibleThisRun = Math.min(remaining, Math.floor(sessionCoins));
    const delta = eligibleThisRun - runAwardedCoins;
    if (delta <= 0) return;

    runAwardedCoins += delta;

    const totalNext = Math.min(250, runBaseCoins + runAwardedCoins);
    s.games[GAME_KEY] = totalNext;
    s.coins = Math.floor((s.coins ?? 0) + delta);
    saveMtState(s);
  }

  function updateScoreUI() {
    if (!scoreEl) return;
    scoreEl.textContent = String(score.value);
    syncCoinsFromHeight(score.maxHeight);

    const heightPoints = Math.floor(score.maxHeight / 10);
    const sessionCoins = scoreToCoins(heightPoints);
    const remaining = Math.max(0, 250 - runBaseCoins);
    const visibleCoins = Math.min(remaining, Math.floor(sessionCoins));
    const coinsTextEl = coinsLineEl?.querySelector('.j__coinsText');
    if (coinsLineEl) coinsLineEl.style.display = 'inline-flex';
    if (coinsTextEl) {
      const totalNow = Math.min(250, runBaseCoins + runAwardedCoins);
      if (totalNow >= 250) coinsTextEl.textContent = 'MAX';
      else coinsTextEl.textContent = `+${format(visibleCoins)}`;
    }
  }

  function clearRunSave() {
    try {
      localStorage.removeItem(RUN_KEY);
    } catch {
      // ignore
    }
  }

  function saveRun() {
    if (world.state !== 'playing') return;
    const payload = {
      t: Date.now(),
      world: {
        cameraY: world.cameraY,
        bestY: world.bestY,
      },
      player: {
        x: player.x,
        y: player.y,
        vx: player.vx,
        vy: player.vy,
      },
      score: {
        value: score.value,
        maxHeight: score.maxHeight,
        landings: score.landings,
      },
      run: {
        base: runBaseCoins,
        awarded: runAwardedCoins,
      },
      platforms: platforms.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, kind: p.kind })),
    };

    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  function tryRestoreRun() {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      const ts = typeof parsed.t === 'number' ? parsed.t : 0;
      if (!ts || Date.now() - ts > 1000 * 60 * 60 * 6) return false;

      if (!parsed.player || !parsed.world || !parsed.score || !Array.isArray(parsed.platforms)) return false;

      world.cameraY = Number(parsed.world.cameraY) || 0;
      world.bestY = Number(parsed.world.bestY) || 0;

      player.x = Number(parsed.player.x) || world.w * 0.5;
      player.y = Number(parsed.player.y) || world.h * 0.56;
      player.vx = Number(parsed.player.vx) || 0;
      player.vy = Number(parsed.player.vy) || -world.jumpV;

      score.value = Math.max(0, Math.floor(parsed.score.value || 0));
      score.maxHeight = Math.max(0, Math.floor(parsed.score.maxHeight || 0));
      score.landings = Math.max(0, Math.floor(parsed.score.landings || 0));

      const s = loadMtState();
      const base = parsed.run && Number.isFinite(Number(parsed.run.base)) ? Number(parsed.run.base) : s.games[GAME_KEY] ?? 0;
      runBaseCoins = Math.min(250, Math.floor(base));
      const awarded = parsed.run && Number.isFinite(Number(parsed.run.awarded)) ? Number(parsed.run.awarded) : 0;
      runAwardedCoins = Math.min(Math.max(0, Math.floor(awarded)), Math.max(0, 250 - runBaseCoins));

      platforms.length = 0;
      for (const p of parsed.platforms) {
        if (!p) continue;
        platforms.push({
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
          w: Number(p.w) || 80,
          h: Number(p.h) || 18,
          kind: Object.values(PLATFORM_KIND).includes(p.kind) ? p.kind : PLATFORM_KIND.solid,
        });
      }

      if (platforms.length === 0) return false;

      hint.style.opacity = '0';
      world.state = 'playing';
      updateScoreUI();
      return true;
    } catch {
      return false;
    }
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    canvas.width = Math.round(cssW * DPR);
    canvas.height = Math.round(cssH * DPR);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    world.w = cssW;
    world.h = cssH;
  }

  function maxJumpHeight() {
    return (world.jumpV * world.jumpV) / (2 * world.gravity);
  }

  function resetGame() {
    world.cameraY = 0;
    world.bestY = 0;

    score.value = 0;
    score.maxHeight = 0;
    score.landings = 0;

    const s = loadMtState();
    runBaseCoins = Math.min(250, Math.floor(s.games[GAME_KEY] ?? 0));
    runAwardedCoins = 0;

    updateScoreUI();

    player.x = world.w * 0.5;
    player.y = world.h * 0.56;
    player.vx = 0;
    player.vy = -world.jumpV;

    platforms.length = 0;

    const jh = maxJumpHeight();
    const gapMin = Math.max(64, jh * 0.26);
    const gapMax = Math.max(gapMin + 30, Math.min(jh * 0.44, gapMin + Math.max(48, jh * 0.16)));

    const reachX = Math.max(140, world.w * 0.34);
    let prevCx = player.x;

    let y = world.h * 0.88;
    for (let i = 0; i < PLATFORM_COUNT; i++) {
      const w = rand(world.w * 0.22, world.w * 0.32);
      const x = clamp(rand(prevCx - reachX, prevCx + reachX) - w * 0.5, 12, world.w - w - 12);

      const kind = pickKind();

      platforms.push({
        x,
        y,
        w,
        h: 18,
        kind,
      });

      prevCx = x + w * 0.5;

      y -= rand(gapMin, gapMax);
    }

    platforms[0].x = clamp(player.x - platforms[0].w * 0.5, 12, world.w - platforms[0].w - 12);
    platforms[0].y = player.y + player.height * 0.8;
    platforms[0].kind = PLATFORM_KIND.solid;
    hint.style.opacity = '1';

    world.state = 'playing';
    clearRunSave();
  }

  function spawnPlatformAbove(minY) {
    const w = rand(world.w * 0.2, world.w * 0.34);
    const reachX = Math.max(140, world.w * 0.34);

    const highestP = platforms.reduce((acc, p) => (p.y < acc.y ? p : acc), platforms[0]);
    const baseCx = highestP ? highestP.x + highestP.w * 0.5 : world.w * 0.5;
    const x = clamp(rand(baseCx - reachX, baseCx + reachX) - w * 0.5, 10, world.w - w - 10);

    const highest = platforms.reduce((acc, p) => Math.min(acc, p.y), Infinity);
    const jh = maxJumpHeight();
    const gapMin = Math.max(64, jh * 0.26);
    const gapMax = Math.max(gapMin + 30, Math.min(jh * 0.44, gapMin + Math.max(48, jh * 0.16)));
    const y = highest - rand(gapMin, gapMax);

    const kind = pickKind();

    platforms.push({ x, y: Math.max(y, minY), w, h: 18, kind });
  }

  function cullPlatforms() {
    const bottomY = world.cameraY + world.h + 120;
    for (let i = platforms.length - 1; i >= 0; i--) {
      if (platforms[i].y > bottomY) platforms.splice(i, 1);
    }
    while (platforms.length < PLATFORM_COUNT) {
      spawnPlatformAbove(world.cameraY - 40);
    }
  }

  function update(dt) {
    if (world.state !== 'playing') return;

    const target = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    let pointerTarget = 0;
    if (pointerActive) {
      const dx = pointerX - pointerStartX;
      const norm = clamp(dx / (world.w * 0.22), -1, 1);
      pointerTarget = norm;
    }

    const input = clamp(target + pointerTarget, -1, 1);

    player.vx += input * world.moveAccel * dt;
    player.vx *= Math.pow(0.0008, dt);
    player.vx = clamp(player.vx, -world.maxVx, world.maxVx);

    const prevY = player.y;

    player.vy += world.gravity * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.x < -player.width * 0.4) player.x = world.w + player.width * 0.4;
    if (player.x > world.w + player.width * 0.4) player.x = -player.width * 0.4;

    if (player.vy > 0) {
      for (const p of platforms) {
        if (p.kind === PLATFORM_KIND.ghost) continue;
        const px1 = p.x;
        const px2 = p.x + p.w;

        const feetX = player.x;
        const prevFeetY = prevY + player.height * 0.45;
        const feetY = player.y + player.height * 0.45;

        const platformY = p.y;

        const withinX = feetX >= px1 - 6 && feetX <= px2 + 6;
        const crossed = prevFeetY <= platformY && feetY >= platformY;

        if (withinX && crossed) {
          player.y = platformY - player.height * 0.45;
          player.vy = p.kind === PLATFORM_KIND.boost ? -world.jumpV * BOOST_MULT : -world.jumpV;

          score.landings += 1;

          hint.style.opacity = '0';
          break;
        }
      }
    }

    const camTarget = Math.min(world.cameraY, player.y - world.h * 0.55);
    world.cameraY = camTarget;

    score.maxHeight = Math.max(score.maxHeight, -world.cameraY);
    const heightPoints = Math.floor(score.maxHeight / 10);
    const nextScore = heightPoints;
    if (nextScore !== score.value) {
      score.value = nextScore;
      updateScoreUI();
    }

    world.bestY = Math.min(world.bestY, player.y);

    cullPlatforms();

    if (player.y > world.cameraY + world.h + 140) {
      clearRunSave();
      resetGame();
    }
  }

  function drawBackground() {
    // intentionally empty
  }

  function drawPlatform(p) {
    const img = imgCloud;
    const isGhost = p.kind === PLATFORM_KIND.ghost;
    const isBoost = p.kind === PLATFORM_KIND.boost;

    ctx.save();
    if (isGhost) ctx.globalAlpha = 0.38;

    if (!img.complete || img.naturalWidth === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillRect(p.x, p.y - 10, p.w, 14);
      if (isBoost) {
        const cx = p.x + p.w / 2;
        const top = p.y - 34;
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.lineTo(cx + 15, top + 17);
        ctx.lineTo(cx - 15, top + 17);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
      return;
    }

    const aspect = img.naturalWidth / img.naturalHeight;
    const h = p.h + 20;
    const w = h * aspect;

    const scale = p.w / w;
    const drawW = w * scale;
    const drawH = h * scale;

    ctx.drawImage(img, p.x, p.y - drawH * 0.62, drawW, drawH);

    if (isBoost) {
      const cx = p.x + p.w / 2;
      const top = p.y - drawH * 0.62 - 18;
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx + 15, top + 17);
      ctx.lineTo(cx - 15, top + 17);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPlayer() {
    const img = imgPlayer;
    const x = player.x - player.width * 0.5;
    const y = player.y - player.height * 0.65;

    ctx.save();
    const tilt = clamp(player.vx / world.maxVx, -1, 1) * 0.12;
    ctx.translate(player.x, player.y);
    ctx.rotate(tilt);

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -player.width * 0.5, -player.height * 0.65, player.width, player.height);
    } else {
      ctx.fillStyle = '#2fd6ff';
      ctx.beginPath();
      ctx.roundRect(-player.width * 0.5, -player.height * 0.65, player.width, player.height, 18);
      ctx.fill();
    }

    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, world.w, world.h);
    drawBackground();

    ctx.save();
    ctx.translate(0, -world.cameraY);

    for (const p of platforms) drawPlatform(p);
    drawPlayer();

    ctx.restore();
  }

  let lastT = performance.now();

  function loop(t) {
    const dt = clamp((t - lastT) / 1000, 0, 1 / 24);
    lastT = t;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  function addEvents() {
    window.addEventListener('resize', () => {
      resize();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      pointerActive = true;
      pointerStartX = e.clientX;
      pointerX = e.clientX;
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!pointerActive) return;
      e.preventDefault();
      pointerX = e.clientX;
    };

    const onPointerUp = (e) => {
      e?.preventDefault?.();
      pointerActive = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', onPointerUp, { passive: false });

    document.getElementById('menuBtn').addEventListener('click', () => {
      // заглушка под твое меню
    });
  }

  function waitAssets() {
    return new Promise((resolve) => {
      let left = 2;
      const done = () => {
        left -= 1;
        if (left <= 0) resolve();
      };

      const onLoadOrError = () => done();

      imgCloud.addEventListener('load', onLoadOrError, { once: true });
      imgCloud.addEventListener('error', onLoadOrError, { once: true });

      imgPlayer.addEventListener('load', onLoadOrError, { once: true });
      imgPlayer.addEventListener('error', onLoadOrError, { once: true });

      if (imgCloud.complete) done();
      if (imgPlayer.complete) done();
    });
  }

  async function boot() {
    resize();
    addEvents();

    const s = loadMtState();
    runBaseCoins = Math.min(250, Math.floor(s.games[GAME_KEY] ?? 0));
    runAwardedCoins = 0;

    await waitAssets();

    const restored = tryRestoreRun();
    if (!restored) resetGame();

    let lastSave = 0;
    const tickSave = () => {
      const now = performance.now();
      if (now - lastSave > 1000) {
        lastSave = now;
        saveRun();
      }
      requestAnimationFrame(tickSave);
    };
    requestAnimationFrame(tickSave);

    window.addEventListener('pagehide', () => saveRun());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveRun();
    });

    world.state = 'playing';
    requestAnimationFrame(loop);
  }

  boot();
})();
