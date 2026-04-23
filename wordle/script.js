(() => {
  const gridEl = document.getElementById('grid');
  const kbdEl = document.getElementById('kbd');
  const statusEl = document.getElementById('status');
  const scoreEl = document.getElementById('score');
  const coinsLineEl = document.getElementById('coinsLine');
  const kbdToggleEl = document.getElementById('kbdToggle');
  const kbdBackdropEl = document.getElementById('kbdBackdrop');
  const maxBadgeEl = document.getElementById('maxBadge');
  const restartBtnEl = document.getElementById('restartBtn');

  const MT_KEY = 'mt_state_v1';
  const GAME_KEY = 'wordle';

  const WORDS = [
    'КЕШБЭК',
    'КРЕКЕР',
    'КРЕДИТ',
    'ПАРОЛЬ',
    'КОМАРЫ',
    'КАРТИН',
    'МОЛОКО',
    'СОЛНЦЕ',
  ];

  const COLS = 6;
  const ROWS = 4;

  const SCORE_PER_COIN = 1;
  const COINS_PER_GREEN = 10;
  const COINS_WIN_BONUS = 60;

  const WORDS6 = WORDS.filter((w) => String(w).length === COLS);
  const target = WORDS6[Math.floor(Math.random() * WORDS6.length)].toUpperCase();

  window.addEventListener('pageshow', (e) => {
    if (e?.persisted) window.location.reload();
  });

  const state = {
    row: 0,
    col: 0,
    grid: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => '')),
    done: false,
    keyState: new Map(), // char -> green|yellow|gray
    score: 0,
    creditedGreen: Array.from({ length: COLS }, () => false),
    winAwarded: false,
  };

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setRestartVisible(v) {
    if (!restartBtnEl) return;
    restartBtnEl.classList.toggle('is-visible', Boolean(v));
  }

  function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 576px)').matches;
  }

  function setKbdOpen(open) {
    if (!kbdEl) return;
    const next = Boolean(open);
    kbdEl.classList.toggle('is-open', next);
    if (kbdBackdropEl) kbdBackdropEl.classList.toggle('is-open', next);
    if (kbdToggleEl) kbdToggleEl.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (kbdToggleEl) kbdToggleEl.classList.toggle('is-hidden', next);

    const root = document.querySelector('.w');
    if (root) root.classList.toggle('is-kbd-open', next);

    if (next) {
      setTimeout(() => {
        const row = gridEl?.querySelector(`.w__row[data-r="${state.row}"]`);
        row?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }, 0);
    }
  }

  function toggleKbd() {
    const isOpen = kbdEl?.classList.contains('is-open');
    setKbdOpen(!isOpen);
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

  function awardCoinsDelta(deltaCoins) {
    const delta = Math.floor(deltaCoins);
    if (!Number.isFinite(delta) || delta <= 0) return;

    const s = loadMtState();
    const prev = Math.min(250, Math.floor(s.games[GAME_KEY] ?? 0));
    if (prev >= 250) return;

    const allowed = Math.min(delta, 250 - prev);
    if (allowed <= 0) return;

    s.games[GAME_KEY] = prev + allowed;
    s.coins = Math.floor((s.coins ?? 0) + allowed);
    saveMtState(s);
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(state.score);
    const coins = scoreToCoins(state.score);
    const coinsTextEl = coinsLineEl?.querySelector('.w__coinsText');
    if (coinsTextEl) coinsTextEl.textContent = `+${format(coins)}`;

    const s = loadMtState();
    const total = Math.min(250, Math.floor(s.games[GAME_KEY] ?? 0));
    if (maxBadgeEl) {
      maxBadgeEl.classList.toggle('is-visible', total >= 250);
      maxBadgeEl.setAttribute('aria-hidden', total >= 250 ? 'false' : 'true');
    }
  }

  function buildGrid() {
    gridEl.style.setProperty('--cols', String(COLS));
    gridEl.style.setProperty('--rows', String(ROWS));
    gridEl.innerHTML = '';

    for (let r = 0; r < ROWS; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'w__row';
      rowEl.dataset.r = String(r);
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'w__cell';
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        rowEl.appendChild(cell);
      }

      gridEl.appendChild(rowEl);
    }
  }

  function lockRows() {
    for (const row of gridEl.querySelectorAll('.w__row')) {
      const r = Number(row.dataset.r);
      row.classList.toggle('is-locked', Number.isFinite(r) && r > state.row);
    }
  }

  function cellEl(r, c) {
    return gridEl.querySelector(`.w__cell[data-r="${r}"][data-c="${c}"]`);
  }

  function writeCell(r, c, ch) {
    state.grid[r][c] = ch;
    const el = cellEl(r, c);
    el.textContent = ch;
    el.classList.toggle('is-filled', ch !== '');
  }

  function deleteChar() {
    if (state.done) return;
    if (state.col <= 0) return;
    state.col -= 1;
    writeCell(state.row, state.col, '');
  }

  function addChar(ch) {
    if (state.done) return;
    if (state.col >= COLS) return;
    writeCell(state.row, state.col, ch);
    state.col += 1;

    if (state.col === COLS) {
      submit();
    }
  }

  function rankColor(prev, next) {
    const order = { gray: 1, yellow: 2, green: 3 };
    if (!prev) return next;
    return order[next] > order[prev] ? next : prev;
  }

  function applyKeyColor(ch, color) {
    state.keyState.set(ch, rankColor(state.keyState.get(ch), color));
  }

  function paintKeyboard() {
    for (const btn of kbdEl.querySelectorAll('.key')) {
      const v = btn.dataset.key;
      if (!v || v.length !== 1) continue;
      btn.classList.remove('is-green', 'is-yellow', 'is-gray');
      const s = state.keyState.get(v);
      if (s) btn.classList.add(`is-${s}`);
    }
  }

  function submit() {
    if (state.done) return;
    if (state.col < COLS) {
      setStatus('Нужно 6 букв');
      return;
    }

    const guess = state.grid[state.row].join('');

    const targetArr = target.split('');
    const res = Array.from({ length: COLS }, () => 'gray');

    const remaining = new Map();
    for (let i = 0; i < COLS; i++) {
      const t = targetArr[i];
      if (guess[i] === t) {
        res[i] = 'green';
      } else {
        remaining.set(t, (remaining.get(t) || 0) + 1);
      }
    }

    for (let i = 0; i < COLS; i++) {
      if (res[i] === 'green') continue;
      const ch = guess[i];
      const left = remaining.get(ch) || 0;
      if (left > 0) {
        res[i] = 'yellow';
        remaining.set(ch, left - 1);
      } else {
        res[i] = 'gray';
      }
    }

    for (let i = 0; i < COLS; i++) {
      const el = cellEl(state.row, i);
      el.classList.remove('is-green', 'is-yellow', 'is-gray');
      el.classList.add(`is-${res[i]}`);

      const ch = guess[i];
      applyKeyColor(ch, res[i]);

      el.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.04)' },
          { transform: 'scale(1)' },
        ],
        { duration: 200, easing: 'ease-out', delay: i * 40 },
      );
    }

    let gained = 0;
    for (let i = 0; i < COLS; i++) {
      if (res[i] === 'green' && !state.creditedGreen[i]) {
        gained += COINS_PER_GREEN;
        state.creditedGreen[i] = true;
      }
    }

    if (guess === target && !state.winAwarded) {
      gained = Math.max(gained, COINS_WIN_BONUS);
      state.winAwarded = true;
    }
    awardCoinsDelta(gained);
    state.score += gained;
    renderHud();

    paintKeyboard();

    if (guess === target) {
      state.done = true;
      setStatus('Угадал!');
      setRestartVisible(false);
      return;
    }

    if (state.row === ROWS - 1) {
      state.done = true;
      setStatus(`Не угадал. Слово: ${target}`);
      setRestartVisible(true);
      return;
    }

    state.row += 1;
    state.col = 0;
    setStatus('');
    lockRows();
  }

  function normalizeKey(k) {
    if (!k) return '';
    if (k === 'ё' || k === 'Ё') return 'Ё';
    return k.toUpperCase();
  }

  function isRuLetter(ch) {
    return /^[А-ЯЁ]$/.test(ch);
  }

  function onKey(k) {
    if (state.done) return;
    if (k === 'ENTER') return submit();
    if (k === 'BACK') return deleteChar();

    const ch = normalizeKey(k);
    if (!isRuLetter(ch)) return;
    addChar(ch);
  }

  function buildKeyboard() {
    const rows = [
      ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З','Х','Ъ'],
      ['Ф','Ы','В','А','П','Р','О','Л','Д','Ж','Э'],
      ['Я','Ч','С','М','И','Т','Ь','Б','Ю','BACK'],
    ];

    kbdEl.innerHTML = '';
    for (const row of rows) {
      const r = document.createElement('div');
      r.className = 'krow';
      r.style.setProperty('--n', String(row.length));

      for (const key of row) {
        const b = document.createElement('button');
        b.className = 'key';
        b.type = 'button';
        b.dataset.key = key;
        b.textContent = key === 'BACK' ? '⌫' : key === 'ENTER' ? '↵' : key;
        b.addEventListener('click', () => onKey(key));
        r.appendChild(b);
      }

      kbdEl.appendChild(r);
    }
  }

  function bindPhysicalKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isMobile()) setKbdOpen(false);
        return;
      }
      if (e.key === 'Enter') {
        onKey('ENTER');
        return;
      }
      if (e.key === 'Backspace') {
        onKey('BACK');
        return;
      }
      onKey(e.key);
    });
  }

  function boot() {
    buildGrid();
    buildKeyboard();
    bindPhysicalKeyboard();
    setStatus('');
    renderHud();
    lockRows();

    if (kbdToggleEl) {
      kbdToggleEl.addEventListener('click', () => toggleKbd());
    }
    if (kbdBackdropEl) {
      kbdBackdropEl.addEventListener('click', () => setKbdOpen(false));
    }

    setRestartVisible(false);
    if (restartBtnEl) {
      restartBtnEl.addEventListener('click', () => {
        if (isMobile()) setKbdOpen(false);
        window.location.reload();
      });
    }

    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!isMobile()) return;
        if (!kbdEl?.classList.contains('is-open')) return;
        const t = e.target;
        if (kbdEl?.contains(t)) return;
        if (kbdToggleEl?.contains(t)) return;
        setKbdOpen(false);
      },
      { capture: true },
    );

    if (gridEl) {
      gridEl.addEventListener('click', () => {
        if (!isMobile()) return;
        setKbdOpen(true);
      });
    }
  }

  boot();
})();
