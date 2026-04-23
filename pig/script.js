(() => {
  const clicksEl = document.getElementById('clicks');
  const coinsLineEl = document.getElementById('coinsLine');
  const pigBtn = document.getElementById('pigBtn');
  const pigScene = document.getElementById('pigScene');
  const particles = document.getElementById('particles');
  const btnX2 = document.getElementById('btnX2');
  const btnAuto = document.getElementById('btnAuto');

  const MT_KEY = 'mt_state_v1';
  const GAME_KEY = 'pig';
  const ACH_X2_ID = 'hammer';

  const STORAGE_KEY = 'pig_clicker_v2';

  const CLICKS_PER_COIN = 10;
  const AUTO_TPS = 4;

  const state = {
    clicks: 0,
    x2: false,
    auto: false,
  };

  let autoTimer = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data?.clicks === 'number') state.clicks = data.clicks;
      if (typeof data?.x2 === 'boolean') state.x2 = data.x2;
      if (typeof data?.auto === 'boolean') state.auto = data.auto;
    } catch {
      // ignore
    }

  }

  function hasX2Achievement() {
    const s = loadMtState();
    return Boolean(s?.shop?.active && s.shop.active[ACH_X2_ID]);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function format(n) {
    return Math.floor(n).toLocaleString('ru-RU');
  }

  function getCoinsFromClicks(clicks) {
    return Math.floor(clicks / CLICKS_PER_COIN);
  }

  function getPendingClicks(clicks) {
    return clicks % CLICKS_PER_COIN;
  }

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
      const games = parsed?.games;
      if (games && typeof games === 'object') {
        for (const k of Object.keys(next.games)) {
          if (typeof games[k] === 'number') next.games[k] = games[k];
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

  function syncCoinsFromSessionCoins(sessionCoins) {
    const s = loadMtState();
    const prev = Math.min(250, Math.floor(s.games[GAME_KEY] ?? 0));
    const next = Math.min(250, Math.floor(sessionCoins));
    if (next <= prev) return;
    const delta = next - prev;
    s.games[GAME_KEY] = next;
    s.coins = Math.floor((s.coins ?? 0) + delta);
    saveMtState(s);
  }

  function render() {
    const coins = getCoinsFromClicks(state.clicks);
    clicksEl.textContent = format(state.clicks);

    const coinsTextEl = coinsLineEl?.querySelector('.pig__coinsText');
    if (coinsTextEl) coinsTextEl.textContent = `+${format(coins)}`;

    syncCoinsFromSessionCoins(coins);

    const canUseX2 = hasX2Achievement();
    if (!canUseX2 && state.x2) {
      state.x2 = false;
      save();
    }

    btnX2.disabled = !canUseX2;

    btnX2.classList.toggle('is-on', state.x2);
    btnAuto.classList.toggle('is-on', state.auto);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function setTiltFromPoint(clientX, clientY) {
    const rect = pigScene.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = (clientX - cx) / (rect.width / 2);
    const dy = (clientY - cy) / (rect.height / 2);

    const rx = clamp(-dy * 10, -12, 12);
    const ry = clamp(dx * 12, -14, 14);

    pigScene.style.setProperty('--rx', `${rx}deg`);
    pigScene.style.setProperty('--ry', `${ry}deg`);
  }

  function resetTilt() {
    pigScene.style.setProperty('--rx', '0deg');
    pigScene.style.setProperty('--ry', '0deg');
  }

  function spawnParticle(x, y, text) {
    const el = document.createElement('div');
    el.className = 'particle';
    el.textContent = text;

    const driftX = (Math.random() * 2 - 1) * 60;
    const driftY = -80 - Math.random() * 50;
    const dur = 650 + Math.random() * 220;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = '1';

    particles.appendChild(el);

    const start = performance.now();

    const tick = (t) => {
      const p = clamp((t - start) / dur, 0, 1);
      const ease = 1 - Math.pow(1 - p, 3);

      el.style.transform = `translate(${driftX * ease}px, ${driftY * ease}px) scale(${1 + 0.1 * (1 - p)})`;
      el.style.opacity = String(1 - p);

      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        el.remove();
      }
    };

    requestAnimationFrame(tick);
  }

  function hitAnimation() {
    pigScene.classList.add('is-hit');
    pigScene.style.setProperty('--s', '0.96');

    setTimeout(() => {
      pigScene.style.setProperty('--s', '1.06');
    }, 70);

    setTimeout(() => {
      pigScene.style.setProperty('--s', '1');
      pigScene.classList.remove('is-hit');
    }, 170);
  }

  function applyClicks(delta, clientX, clientY) {
    if (!Number.isFinite(delta) || delta <= 0) return;

    state.clicks += delta;
    save();
    render();

    const x = clientX ?? (window.innerWidth / 2);
    const y = clientY ?? (window.innerHeight / 2);

    hitAnimation();
    spawnParticle(x, y, `+${delta}`);
  }

  function onClick(e) {
    const delta = state.x2 ? 2 : 1;
    applyClicks(delta, e?.clientX, e?.clientY);
  }

  function onPointerMove(e) {
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setTiltFromPoint(x, y);
  }

  function onPointerLeave() {
    resetTilt();
  }

  function setAuto(enabled) {
    state.auto = Boolean(enabled);
    save();
    render();

    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }

    if (state.auto) {
      autoTimer = setInterval(() => {
        applyClicks(1);
      }, Math.floor(1000 / AUTO_TPS));
    }
  }

  function toggleX2() {
    if (!hasX2Achievement()) return;
    state.x2 = !state.x2;
    save();
    render();
  }

  function toggleAuto() {
    setAuto(!state.auto);
  }

  function bind() {
    pigBtn.addEventListener('click', onClick);

    pigScene.addEventListener('mousemove', onPointerMove);
    pigScene.addEventListener('mouseleave', onPointerLeave);

    pigScene.addEventListener('touchstart', onPointerMove, { passive: true });
    pigScene.addEventListener('touchmove', onPointerMove, { passive: true });
    pigScene.addEventListener('touchend', onPointerLeave, { passive: true });

    btnX2.addEventListener('click', toggleX2);
    btnAuto.addEventListener('click', toggleAuto);
  }

  load();
  bind();
  setAuto(state.auto);
  render();
})();
