(() => {
  const MT_KEY = 'mt_state_v1';

  const icons = {
    foodcourt: '../images/icons/burger.png',
    ramson: '../images/icons/rabbit.png',
    hammer: '../images/icons/hammer.png',
    fly: '../images/icons/trampoline.png',
    wise: '../images/icons/plug.png',
    taxi: '../images/icons/taxi.png',
    musya: '../images/icons/musya.png',
  };

  const medals = {
    active: '../images/medals/active.png',
    inactive: '../images/medals/inactive.png',
  };

  const COIN_ICON = '../images/coin.png';

  const data = {
    temp: [
      {
        id: 'foodcourt',
        active: false,
        title: 'Фудкортница 👑',
        desc: 'Личный купон “Бургер Кинг”',
        long: 'Зачем куда-то прыгать, если тут бесплатный Wi-Fi и свет для селфи? Заняла столик с одной колой на восьмерых и уйду только после закрытия. Вопросы? Набери 1000 очков, пока охранник не выгнал.',
        price: 250,
      },
      {
        id: 'ramson',
        active: false,
        title: 'Черемша',
        desc: 'Купон на скидку 10% в ЦУМ',
        long: 'Накликай 1000 очков. Тихо, неспеша, с чувством выполненного долга.',
        price: 250,
      },
      {
        id: 'taxi',
        active: false,
        title: 'Мама, вызывай такси!',
        desc: 'Скидка на Яндекс.Плюс',
        long: 'Ты потрясный парень!',
        price: 250,
      },
    ],
    perm: [
      {
        id: 'hammer',
        active: false,
        title: 'Молоток',
        desc: 'Кэшбек 1% при оплате на кассе',
        long: 'Сыграй в “Разбей” 10 раз подряд.',
        price: 100,
      },
      {
        id: 'fly',
        active: false,
        title: 'Куда летишь?',
        desc: 'Глитч: -13% по MCC 7896',
        long: 'Покупка открывает постоянную скидку.',
        price: 150,
      },
      {
        id: 'musya',
        active: false,
        title: 'Муся',
        desc: 'Скидка в зоопарк',
        long: 'Муся - это ты? А, нет, это МТБанк.',
        price: 150,
      },
      {
        id: 'wise',
        active: false,
        title: 'Мудрец',
        desc: 'Кэшбек 2% по MCC 5814',
        long: 'Покупка открывает постоянный кэшбек.',
        price: 250,
      },
    ],
  };

  const tempList = document.getElementById('tempList');
  const permList = document.getElementById('permList');

  let expandedId = null;

  function allItems() {
    return [...data.temp, ...data.perm];
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

  function saveExpanded() {
    const s = loadMtState();
    s.shop = s.shop && typeof s.shop === 'object' ? s.shop : { active: {} };
    s.shop.expandedId = expandedId;
    saveMtState(s);
  }

  function load() {
    const s = loadMtState();

    const active = s?.shop?.active;
    if (active && typeof active === 'object') {
      for (const item of allItems()) {
        if (typeof active[item.id] === 'boolean') item.active = active[item.id];
      }
    }

    const ex = s?.shop?.expandedId;
    if (typeof ex === 'string' || ex === null) expandedId = ex;
  }

  function format(n) {
    return Math.floor(n).toLocaleString('ru-RU');
  }

  function getIconFor(item) {
    return icons[item.id] ?? '../images/medals/inactive.png';
  }

  function toggleExpand(itemId) {
    expandedId = expandedId === itemId ? null : itemId;
    saveExpanded();
    render();
  }

  function countActive(list) {
    let n = 0;
    for (const item of list) if (item.active) n += 1;
    return n;
  }

  function canBuy(item) {
    if (item.active) return false;
    if (item.price <= 0) return false;

    const permActive = countActive(data.perm);
    const tempActive = countActive(data.temp);

    const isTemp = data.temp.some((t) => t.id === item.id);
    const isPerm = data.perm.some((p) => p.id === item.id);

    if (isTemp) {
      if (tempActive >= 1) return false;
      if (permActive >= 3) return false;
      if (permActive >= 2 && tempActive >= 1) return false;
      return true;
    }

    if (isPerm) {
      if (tempActive >= 1 && permActive >= 2) return false;
      if (tempActive === 0 && permActive >= 3) return false;
      return true;
    }

    return false;
  }

  function buy(item) {
    if (item.active) return;
    if (item.price <= 0) return;
    if (!canBuy(item)) return;

    const s = loadMtState();
    const coins = Math.floor(s.coins ?? 0);
    if (coins < item.price) return;

    s.coins = coins - item.price;

    item.active = true;

    s.shop = s.shop && typeof s.shop === 'object' ? s.shop : { active: {} };
    s.shop.active = s.shop.active && typeof s.shop.active === 'object' ? s.shop.active : {};
    s.shop.active[item.id] = true;
    s.shop.expandedId = expandedId;
    saveMtState(s);
    render();
  }

  function createCard(item) {
    const card = document.createElement('div');
    card.className = `achCard${item.active ? ' is-active' : ' is-inactive'}${expandedId === item.id ? ' is-expanded' : ''}`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-expanded', expandedId === item.id ? 'true' : 'false');

    const icon = document.createElement('div');
    icon.className = 'achCard__icon';

    const medalImg = document.createElement('img');
    medalImg.className = 'achCard__medal';
    medalImg.alt = '';
    medalImg.src = item.active ? medals.active : medals.inactive;

    const glyphImg = document.createElement('img');
    glyphImg.className = 'achCard__glyph';
    glyphImg.alt = '';
    glyphImg.src = getIconFor(item);

    icon.appendChild(medalImg);
    icon.appendChild(glyphImg);

    const text = document.createElement('div');
    text.className = 'achCard__text';

    const title = document.createElement('div');
    title.className = 'achCard__title';
    title.textContent = item.title;

    const desc = document.createElement('div');
    desc.className = 'achCard__desc';
    desc.textContent = item.desc;

    text.appendChild(title);
    text.appendChild(desc);

    const pill = document.createElement('div');
    pill.className = `achCard__pill${item.active ? ' achCard__pill--active' : ''}`;
    pill.textContent = item.active ? 'Активный' : `Купить за ${item.price}`;

    if (!item.active || expandedId !== item.id) {
      pill.style.display = 'none';
    }

    card.appendChild(icon);
    card.appendChild(text);
    card.appendChild(pill);

    const details = document.createElement('div');
    details.className = 'achCard__details';

    const long = document.createElement('div');
    long.className = 'achCard__long';
    long.textContent = item.long;
    details.appendChild(long);

    const actions = document.createElement('div');
    actions.className = 'achCard__actions';

    const balance = document.createElement('div');
    balance.className = 'achCard__balance';
    const s = loadMtState();
    balance.appendChild(document.createTextNode('Баланс: '));
    balance.appendChild(document.createTextNode(format(s.coins)));

    const coin = document.createElement('img');
    coin.className = 'achCard__coin';
    coin.alt = '';
    coin.src = COIN_ICON;
    balance.appendChild(coin);

    if (!item.active && item.price > 0) {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'btn achCard__buy';
      buyBtn.type = 'button';
      buyBtn.textContent = `Купить за ${format(item.price)}`;
      buyBtn.disabled = !canBuy(item) || s.coins < item.price;

      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        buy(item);
      });

      actions.appendChild(buyBtn);
      details.appendChild(actions);
      details.appendChild(balance);
    }

    card.appendChild(details);

    const open = () => toggleExpand(item.id);

    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    return card;
  }

  function render() {
    tempList.innerHTML = '';
    permList.innerHTML = '';

    for (const item of data.temp) tempList.appendChild(createCard(item));
    for (const item of data.perm) permList.appendChild(createCard(item));
  }

  load();
  render();
})();
