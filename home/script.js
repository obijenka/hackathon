(() => {
  const MT_KEY = 'mt_state_v1';

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

  function format(n) {
    return Math.floor(n).toLocaleString('ru-RU');
  }

  function ensureInit() {
    const raw = localStorage.getItem(MT_KEY);
    if (raw) return;
    saveMtState(defaultMtState());
  }

  function render() {
    const s = loadMtState();

    const profileCoins = document.getElementById('profileCoins');
    if (profileCoins) profileCoins.textContent = String(format(s.coins));

    const setProgress = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = `${Math.min(250, Math.floor(v))}/250`;
    };

    setProgress('wordleProgress', s.games.wordle);
    setProgress('blockblastProgress', s.games.blockblast);
    setProgress('pigProgress', s.games.pig);
    setProgress('jumperProgress', s.games.jumper);
  }

  ensureInit();
  render();

  window.addEventListener('storage', (e) => {
    if (e.key === MT_KEY) render();
  });
})();
