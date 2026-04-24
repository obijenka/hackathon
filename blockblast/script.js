(() => {
  const boardEl = document.getElementById('board');
  const trayEl = document.getElementById('tray');
  const scoreEl = document.getElementById('score');
  const coinsLineEl = document.getElementById('coinsLine');
  const dragLayer = document.getElementById('dragLayer');

  const MT_KEY = 'mt_state_v1';
  const GAME_KEY = 'blockblast';

  const N = 8;
  const STORAGE_KEY = 'blockblast_v1';

  const SCORE_PER_COIN = 10;

  const SHAPES = [
    // single
    [[0, 0]],
    // 2
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1]],
    // 3 line
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [0, 2]],
    // L 3
    [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 1], [0, 0], [1, 0]],
    // square 2x2
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    // 4 line
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    // T 4
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 1], [0, 0], [0, 2], [1, 1]],
    // L 4
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [0, 1]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[2, 0], [0, 0], [1, 0], [2, 1]],
    // 5 line
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    // big square 3x3
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  ];

  const state = {
    grid: Array.from({ length: N }, () => Array.from({ length: N }, () => 0)),
    score: 0,
    tray: [],
  };

  let gameOverPending = false;

  let cells = [];
  let preview = [];
  let previewClass = 'is-preview';

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rnd(n) {
    return Math.floor(Math.random() * n);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ grid: state.grid, score: state.score }));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data?.grid) && data.grid.length === N) state.grid = data.grid;
      if (typeof data?.score === 'number') state.score = data.score;
    } catch {
      // ignore
    }
  }

  function format(n) {
    return Math.floor(n).toLocaleString('ru-RU');
  }

  function scoreToCoins(score) {
    return Math.floor(score / SCORE_PER_COIN);
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

  function renderScore() {
    scoreEl.textContent = String(state.score);

    const coins = scoreToCoins(state.score);
    const coinsTextEl = coinsLineEl?.querySelector('.bb__coinsText');
    if (coinsTextEl) coinsTextEl.textContent = `+${format(coins)}`;

    syncCoinsFromSessionCoins(coins);
  }

  function gameOver() {
    if (gameOverPending) return;
    gameOverPending = true;

    floatScore('Проигрыш');

    state.grid = Array.from({ length: N }, () => Array.from({ length: N }, () => 0));
    state.score = 0;
    renderScore();
    syncBoard();
    save();

    setTimeout(() => {
      gameOverPending = false;
      newTray();
    }, 420);
  }

  function buildBoard() {
    boardEl.style.setProperty('--n', String(N));
    boardEl.innerHTML = '';
    cells = [];

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.x = String(x);
        el.dataset.y = String(y);
        boardEl.appendChild(el);
        cells.push(el);
      }
    }
  }

  function idx(x, y) {
    return y * N + x;
  }

  function syncBoard() {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const el = cells[idx(x, y)];
        el.classList.toggle('is-filled', state.grid[y][x] === 1);
      }
    }
  }

  function shapeBounds(shape) {
    let maxX = 0;
    let maxY = 0;
    for (const [x, y] of shape) {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    return { w: maxX + 1, h: maxY + 1 };
  }

  function canPlace(shape, ox, oy) {
    for (const [sx, sy] of shape) {
      const x = ox + sx;
      const y = oy + sy;
      if (x < 0 || x >= N || y < 0 || y >= N) return false;
      if (state.grid[y][x] === 1) return false;
    }
    return true;
  }

  function canPlaceAnywhere(shape) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (canPlace(shape, x, y)) return true;
      }
    }
    return false;
  }

  function clearPreview() {
    for (const [x, y] of preview) {
      const el = cells[idx(x, y)];
      el.classList.remove('is-preview');
      el.classList.remove('is-preview-bad');
    }
    preview = [];
  }

  function setPreview(shape, ox, oy, isValid) {
    clearPreview();
    previewClass = isValid ? 'is-preview' : 'is-preview-bad';
    for (const [sx, sy] of shape) {
      const x = ox + sx;
      const y = oy + sy;
      if (x < 0 || x >= N || y < 0 || y >= N) continue;
      preview.push([x, y]);
    }
    for (const [x, y] of preview) {
      const el = cells[idx(x, y)];
      el.classList.add(previewClass);
    }
  }

  function place(shape, ox, oy) {
    for (const [sx, sy] of shape) {
      const x = ox + sx;
      const y = oy + sy;
      state.grid[y][x] = 1;
      const el = cells[idx(x, y)];
      el.animate(
        [{ transform: 'scale(0.7)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
        { duration: 180, easing: 'ease-out' },
      );
    }

    state.score += shape.length;

    const clearedLines = clearLines();
    const clearedCombos = clearComboZones();

    const cleared = clearedLines + clearedCombos;
    if (cleared > 0) {
      state.score += cleared * 10;
      floatScore(`+${cleared * 10}`);
    }

    renderScore();
    syncBoard();
    save();
  }

  function clearCells(toClear) {
    for (const key of toClear) {
      const [xStr, yStr] = key.split(',');
      const x = Number(xStr);
      const y = Number(yStr);
      state.grid[y][x] = 0;
      const el = cells[idx(x, y)];
      el.classList.add('is-clearing');
      setTimeout(() => el.classList.remove('is-clearing'), 260);
    }
  }

  function clearLines() {
    const rows = [];
    const cols = [];

    for (let y = 0; y < N; y++) {
      if (state.grid[y].every((v) => v === 1)) rows.push(y);
    }

    for (let x = 0; x < N; x++) {
      let ok = true;
      for (let y = 0; y < N; y++) {
        if (state.grid[y][x] !== 1) {
          ok = false;
          break;
        }
      }
      if (ok) cols.push(x);
    }

    if (rows.length === 0 && cols.length === 0) return 0;

    const toClear = new Set();
    for (const y of rows) for (let x = 0; x < N; x++) toClear.add(`${x},${y}`);
    for (const x of cols) for (let y = 0; y < N; y++) toClear.add(`${x},${y}`);

    clearCells(toClear);

    return rows.length + cols.length;
  }

  // Clears any fully filled rectangle with width>=2 and height>=2.
  // Returns how many rectangles were detected (for scoring).
  function clearComboZones() {
    const toClear = new Set();
    let rectangles = 0;

    // For each top-left corner, expand downwards while tracking min consecutive width.
    for (let y0 = 0; y0 < N; y0++) {
      for (let x0 = 0; x0 < N; x0++) {
        if (state.grid[y0][x0] !== 1) continue;

        let minW = Infinity;
        for (let y1 = y0; y1 < N; y1++) {
          if (state.grid[y1][x0] !== 1) break;

          // compute consecutive filled width from (x0,y1)
          let w = 0;
          for (let x = x0; x < N; x++) {
            if (state.grid[y1][x] !== 1) break;
            w++;
          }

          minW = Math.min(minW, w);
          const h = y1 - y0 + 1;

          // We only consider rectangles at least 2x2, except 2x2 (too easy).
          // Also ignore small 3x3-ish zones: they make the 3x3 piece auto-clear immediately.
          // Keep combo clears for bigger rectangles only.
          if (h >= 2 && minW >= 2 && (h >= 4 || minW >= 4) && !(h === 2 && minW === 2)) {
            rectangles += 1;
            for (let yy = y0; yy <= y1; yy++) {
              for (let xx = x0; xx < x0 + minW; xx++) {
                toClear.add(`${xx},${yy}`);
              }
            }
          }
        }
      }
    }

    if (toClear.size === 0) return 0;
    clearCells(toClear);
    return rectangles;
  }

  function floatScore(text) {
    const rect = boardEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'floatScore';
    el.textContent = text;
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top + 18}px`;
    el.style.transform = 'translate(-50%, 0)';
    el.style.opacity = '1';
    dragLayer.appendChild(el);

    const anim = el.animate(
      [
        { transform: 'translate(-50%, 0) scale(1)', opacity: 1 },
        { transform: 'translate(-50%, -26px) scale(1.06)', opacity: 0 },
      ],
      { duration: 520, easing: 'ease-out' },
    );

    anim.addEventListener('finish', () => el.remove());
  }

  function newTray() {
    state.tray = Array.from({ length: 3 }, () => ({
      id: crypto?.randomUUID?.() ?? String(Math.random()),
      shape: SHAPES[rnd(SHAPES.length)],
      used: false,
    }));
    renderTray();
  }

  function renderTray() {
    trayEl.innerHTML = '';

    let anyPlaceable = false;
    let anyUnused = false;

    for (const item of state.tray) {
      const slot = document.createElement('div');
      slot.className = 'pieceSlot';

      const p = document.createElement('div');
      p.className = 'piece';
      p.dataset.id = item.id;

      const b = shapeBounds(item.shape);
      p.style.gridTemplateColumns = `repeat(${b.w}, 1fr)`;
      p.style.gridTemplateRows = `repeat(${b.h}, 1fr)`;

      const set = new Set(item.shape.map(([x, y]) => `${x},${y}`));
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          const block = document.createElement('div');
          if (set.has(`${x},${y}`)) {
            block.className = 'pblock';
          } else {
            block.style.width = 'var(--bb-block)';
            block.style.height = 'var(--bb-block)';
          }
          p.appendChild(block);
        }
      }

      if (item.used) {
        p.style.opacity = '0.18';
        p.style.filter = 'none';
      }

      const placeable = !item.used && canPlaceAnywhere(item.shape);
      if (!item.used) anyUnused = true;
      if (placeable) anyPlaceable = true;
      if (!item.used && !placeable) {
        p.classList.add('is-disabled');
      }

      slot.appendChild(p);
      trayEl.appendChild(slot);

      if (!item.used && placeable) bindPieceDrag(p, item);
    }

    if (anyUnused && !anyPlaceable) {
      gameOver();
    }
  }

  function getBoardCellFromPoint(x, y) {
    const rect = boardEl.getBoundingClientRect();

    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (!inside) return null;

    const relX = x - rect.left;
    const relY = y - rect.top;

    const cellW = rect.width / N;
    const cellH = rect.height / N;

    const cx = clamp(Math.floor(relX / cellW), 0, N - 1);
    const cy = clamp(Math.floor(relY / cellH), 0, N - 1);
    return { x: cx, y: cy };
  }

  function bindPieceDrag(pieceEl, item) {
    const pointer = { active: false, id: null };
    let ghost = null;
    let anchorCell = { x: 0, y: 0 };
    let pieceSize = { w: 0, h: 0 };
    let snap = { ok: false, ox: 0, oy: 0, active: false };

    const getNudgePx = () => {
      // Small visual nudge to fine-tune where the grabbed piece sits under the pointer.
      const b = getBlockSizePx();
      return { x: Math.round(b * -0.2), y: Math.round(b * -0.25) };
    };

    const getBlockSizePx = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--bb-block').trim();
      const n = Number.parseFloat(raw);
      return Number.isFinite(n) ? n : 32;
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinUp);
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
      pieceEl.style.opacity = '';
      pieceEl.classList.remove('is-grabbed');
      clearPreview();
      pointer.active = false;
      pointer.id = null;
      snap = { ok: false, ox: 0, oy: 0, active: false };
    };

    const onWinMove = (e) => {
      if (!pointer.active) return;
      if (pointer.id != null && e.pointerId !== pointer.id) return;
      onMove(e);
    };

    const onWinUp = (e) => {
      if (!pointer.active) return;
      if (pointer.id != null && e.pointerId !== pointer.id) return;
      onUp(e);
    };

    const onDown = (e) => {
      e.preventDefault();
      if (pointer.active) return;
      pointer.active = true;
      pointer.id = e.pointerId;

      pieceEl.setPointerCapture?.(e.pointerId);

      const rect = pieceEl.getBoundingClientRect();
      pieceSize = { w: rect.width, h: rect.height };

      // Anchor to the exact cell the user grabbed (not the center).
      // This makes snapping feel natural: the grabbed spot stays under the pointer.
      const b = shapeBounds(item.shape);
      const cellW = rect.width / Math.max(1, b.w);
      const cellH = rect.height / Math.max(1, b.h);
      const localX = clamp(e.clientX - rect.left, 0, rect.width - 1);
      const localY = clamp(e.clientY - rect.top, 0, rect.height - 1);
      anchorCell = {
        x: clamp(Math.floor(localX / cellW), 0, b.w - 1),
        y: clamp(Math.floor(localY / cellH), 0, b.h - 1),
      };

      ghost = pieceEl.cloneNode(true);
      ghost.classList.add('is-grabbed');
      ghost.style.position = 'fixed';
      ghost.style.left = '0px';
      ghost.style.top = '0px';
      ghost.style.margin = '0';
      ghost.style.zIndex = '11';
      ghost.style.pointerEvents = 'none';
      ghost.style.willChange = 'transform';
      ghost.style.transformOrigin = '0 0';

      pieceEl.style.opacity = '0.15';
      pieceEl.classList.add('is-grabbed');

      dragLayer.appendChild(ghost);

      window.addEventListener('pointermove', onWinMove, { passive: false });
      window.addEventListener('pointerup', onWinUp, { passive: false });
      window.addEventListener('pointercancel', onWinUp, { passive: false });

      // Defer first position until layout is ready; otherwise the ghost can jump.
      const firstEvent = e;
      requestAnimationFrame(() => {
        if (!pointer.active || !ghost) return;
        const gRect = ghost.getBoundingClientRect();
        if (gRect.width > 0 && gRect.height > 0) {
          pieceSize = { w: gRect.width, h: gRect.height };
        }
        onMove(firstEvent);
      });
    };

    const onMove = (e) => {
      e.preventDefault();
      if (!pointer.active || !ghost) return;

      const cell = getBoardCellFromPoint(e.clientX, e.clientY);
      if (!cell) {
        snap.active = false;
        clearPreview();
        ghost.style.filter = 'drop-shadow(0 18px 22px rgba(0,0,0,.45))';
        const nudge = getNudgePx();
        const x = e.clientX - pieceSize.w / 2;
        const y = e.clientY - pieceSize.h / 2;
        ghost.style.transform = `translate3d(${x + nudge.x}px, ${y + nudge.y}px, 0)`;
        return;
      }

      ghost.style.filter = 'none';

      const ox = cell.x - anchorCell.x;
      const oy = cell.y - anchorCell.y;

      const ok = canPlace(item.shape, ox, oy);
      setPreview(item.shape, ox, oy, ok);
      snap = { ok, ox, oy, active: true };

      const rect = boardEl.getBoundingClientRect();
      const scaleX = rect.width / (boardEl.offsetWidth || rect.width || 1);
      const scaleY = rect.height / (boardEl.offsetHeight || rect.height || 1);

      const cs = getComputedStyle(boardEl);
      const padL = Number.parseFloat(cs.paddingLeft) || 0;
      const padT = Number.parseFloat(cs.paddingTop) || 0;
      const bL = Number.parseFloat(cs.borderLeftWidth) || 0;
      const bT = Number.parseFloat(cs.borderTopWidth) || 0;

      const contentLeft = rect.left + (bL + padL) * (scaleX || 1);
      const contentTop = rect.top + (bT + padT) * (scaleY || 1);

      const cellW = ((boardEl.clientWidth - padL - (Number.parseFloat(cs.paddingRight) || 0)) / N) * (scaleX || 1);
      const cellH = ((boardEl.clientHeight - padT - (Number.parseFloat(cs.paddingBottom) || 0)) / N) * (scaleY || 1);

      const s = Math.max(0.1, cellW / getBlockSizePx());
      const topLeftX = contentLeft + ox * cellW;
      const topLeftY = contentTop + oy * cellH;

      const nudge = getNudgePx();

      ghost.style.transform = `translate3d(${topLeftX + nudge.x}px, ${topLeftY + nudge.y}px, 0) scale(${s})`;
    };

    const onUp = (e) => {
      e.preventDefault();
      if (!pointer.active) return;
      let placed = false;

      if (snap.active && snap.ok) {
        place(item.shape, snap.ox, snap.oy);
        item.used = true;
        placed = true;
      }

      cleanup();

      if (placed) {
        renderTray();
        if (state.tray.every((t) => t.used)) newTray();
      } else {
        renderTray();
      }
    };

    pieceEl.addEventListener('pointerdown', onDown);
    pieceEl.addEventListener('pointercancel', cleanup);
  }

  function boot() {
    load();
    buildBoard();
    syncBoard();
    renderScore();
    newTray();
  }

  boot();
})();
