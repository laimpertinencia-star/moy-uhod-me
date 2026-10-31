/* Напоминания работают на текущем устройстве, пока открыто приложение. */
(() => {
  const prefix = document.documentElement.dataset.storagePrefix || 'moyuhod';
  const key = name => `${prefix}:${name}`;
  const read = (name, fallback) => { try { return JSON.parse(localStorage.getItem(key(name))) ?? fallback; } catch { return fallback; } };
  const save = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));
  const defaults = { planned: false, missed: false, lowStock: false, morning: '09:00', evening: '20:00', stockThreshold: 20, system: false };
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const isOwned = product => product && !/в планах|архив|закончилось|нет в наличии|не использую|отложено/i.test(product.status || '');
  let settings = { ...defaults, ...read('notificationSettings', {}) };
  let events = read('notificationEvents', []);
  if (!Array.isArray(events)) events = [];

  const title = document.createElement('div');
  title.className = 'care-notify-title';
  title.innerHTML = '<strong>Напоминания</strong><p>Выбери, о чём сообщать на этом устройстве.</p>';
  const card = document.createElement('div');
  card.className = 'care-notify-card';
  const overlay = document.createElement('div');
  overlay.className = 'care-notify-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Настройки уведомлений');
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !overlay.hidden) close(); });
  const header = document.querySelector('.top');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'care-notify-trigger';
  trigger.textContent = '◌ Напоминания';
  trigger.addEventListener('click', open);
  header?.append(trigger);
  overlay.append(card);
  document.body.append(overlay);

  function close() { overlay.hidden = true; document.body.classList.remove('care-notify-open'); trigger.focus(); }
  function checkbox(name, label, help) {
    const row = document.createElement('label'); row.className = 'care-notify-option';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = settings[name];
    const copy = document.createElement('span'); copy.innerHTML = `<strong>${label}</strong><small>${help}</small>`;
    input.addEventListener('change', () => { settings[name] = input.checked; save('notificationSettings', settings); evaluate(); });
    row.append(input, copy); return row;
  }
  function labeledInput(label, type, value, onChange, attrs = {}) {
    const row = document.createElement('label'); row.className = 'care-notify-field';
    const text = document.createElement('span'); text.textContent = label;
    const input = document.createElement('input'); input.type = type; input.value = value;
    Object.entries(attrs).forEach(([name, val]) => input.setAttribute(name, val));
    input.addEventListener('change', () => { onChange(input.value); save('notificationSettings', settings); evaluate(); });
    row.append(text, input); return row;
  }
  function open() {
    settings = { ...defaults, ...read('notificationSettings', {}) };
    events = read('notificationEvents', []); if (!Array.isArray(events)) events = [];
    card.replaceChildren();
    const closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.className = 'care-notify-close';
    closeButton.textContent = 'Закрыть'; closeButton.addEventListener('click', close);
    card.append(closeButton, title,
      checkbox('planned', 'Запланированный уход', 'Утренние и вечерние шаги в заданное время.'),
      checkbox('missed', 'Пропущенные шаги', 'Утром сообщить о вчерашних обязательных шагах без отметки.'),
      checkbox('lowStock', 'Средство заканчивается', 'Только по остатку, который ты указала, или статусу «Заканчивается».'));
    const times = document.createElement('div'); times.className = 'care-notify-times';
    times.append(
      labeledInput('Утро', 'time', settings.morning, value => { settings.morning = value || '09:00'; }),
      labeledInput('Вечер', 'time', settings.evening, value => { settings.evening = value || '20:00'; }),
      labeledInput('Напомнить при остатке, %', 'number', settings.stockThreshold, value => { settings.stockThreshold = Math.max(1, Math.min(50, Number(value) || 20)); }, { min: 1, max: 50 }));
    card.append(times);
    const permission = document.createElement('button'); permission.type = 'button'; permission.className = 'care-notify-permission';
    const permissionStatus = () => {
      permission.textContent = Notification.permission === 'granted' && settings.system ? 'Уведомления устройства включены' : 'Разрешить уведомления устройства';
      permission.disabled = Notification.permission === 'granted' && settings.system;
    };
    if ('Notification' in window && 'serviceWorker' in navigator && window.isSecureContext) {
      permissionStatus();
      permission.addEventListener('click', async () => {
        const result = await Notification.requestPermission();
        settings.system = result === 'granted'; save('notificationSettings', settings);
        permissionStatus(); evaluate();
      });
      card.append(permission);
    }
    const note = document.createElement('p'); note.className = 'care-notify-note';
    note.textContent = 'Сейчас напоминания приходят, пока приложение открыто. На iPhone для системных уведомлений добавь сайт на экран «Домой». Уведомления при полностью закрытом приложении появятся после подключения отдельной службы рассылки.';
    card.append(note);
    const listTitle = document.createElement('h3'); listTitle.textContent = 'Последние напоминания'; card.append(listTitle);
    const list = document.createElement('div'); list.className = 'care-notify-list';
    if (!events.length) { const empty = document.createElement('p'); empty.textContent = 'Пока нет напоминаний.'; list.append(empty); }
    events.slice(0, 10).forEach(item => { const p = document.createElement('p'); const strong = document.createElement('strong'); strong.textContent = item.title; const detail = document.createElement('span'); detail.textContent = item.body; p.append(strong, detail); list.append(p); });
    card.append(list);
    overlay.hidden = false; document.body.classList.add('care-notify-open'); closeButton.focus();
  }

  async function systemNotify(item) {
    if (!settings.system || !('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(new URL('./notification-sw.js', document.baseURI), { scope: './' });
      const iconPath = document.documentElement.dataset.appMode === 'personal' ? '../icons/icon-192.png' : 'icons/icon-192.png';
      await registration.showNotification(item.title, { body: item.body, tag: item.id, icon: new URL(iconPath, document.baseURI).href });
    } catch { /* Напоминание остаётся в списке приложения. */ }
  }
  function deliver(id, heading, body) {
    if (events.some(item => item.id === id)) return;
    const item = { id, title: heading, body, createdAt: new Date().toISOString() };
    events.unshift(item); events = events.slice(0, 40); save('notificationEvents', events);
    if (!overlay.hidden) open();
    systemNotify(item);
  }
  function scheduledSteps(day, period, adjustment = null) {
    const weekday = day.getDay();
    const dayKey = dateKey(day);
    const products = read('products', []);
    const moved = adjustment?.assignments?.filter(item => item.sourceDate === dayKey).map(item => item.step.id) || [];
    const vitaminMisses = adjustment?.vitamins?.filter(item => item.sourceDate === dayKey).map(item => item.step.id) || [];
    const list = read('steps', []).filter(step => step.time === period && (!step.days?.length || step.days.includes(weekday)) && !step.optional &&
      !moved.includes(step.id) && !vitaminMisses.includes(step.id) &&
      (!step.productId || products.some(product => product.id === step.productId && isOwned(product) && !product.reactionPause?.active)) &&
      !(step.productIds?.length && step.productIds.every(id => !products.some(product => product.id === id && isOwned(product) && !product.reactionPause?.active))));
    if (dayKey === dateKey(new Date())) for (const item of adjustment?.assignments || []) {
      if (item.targetDate === dayKey && item.step.time === period && !list.some(step => step.id === item.step.id)) list.push(item.step);
    }
    return list;
  }
  function evaluate() {
    settings = { ...defaults, ...read('notificationSettings', {}) };
    if (!settings.planned && !settings.missed && !settings.lowStock) return;
    const now = new Date(), today = dateKey(now), minute = now.toTimeString().slice(0, 5);
    const checks = read('checks', {});
    const adjustment = typeof getAccentScheduleAdjustments === 'function' ? getAccentScheduleAdjustments() : null;
    if (settings.planned) for (const [period, time, label] of [['am', settings.morning, 'утро'], ['pm', settings.evening, 'вечер']]) {
      if (minute < time) continue;
      const remaining = scheduledSteps(now, period, adjustment).filter(step => !checks[`${today}:${step.id}`]);
      if (remaining.length) deliver(`planned:${today}:${period}`, `Уход на ${label}`, `${remaining.length} ${remaining.length === 1 ? 'шаг ждёт' : 'шагов ждут'} отметки в плане.`);
    }
    if (settings.missed && minute >= settings.morning) {
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = dateKey(yesterday);
      const missed = ['am','pm'].flatMap(period => scheduledSteps(yesterday, period, adjustment)).filter(step => !checks[`${yesterdayKey}:${step.id}`]);
      if (missed.length) deliver(`missed:${yesterdayKey}`, 'Вчерашний уход', `${missed.length} обязательных шагов без отметки. Проверь план: выполненное можно отметить за вчера.`);
    }
    if (settings.lowStock && minute >= settings.morning) {
      const threshold = Number(settings.stockThreshold) || 20;
      const low = read('products', []).filter(product => isOwned(product) &&
        ((Number.isFinite(Number(product.remaining)) && product.remaining !== null && Number(product.remaining) <= threshold) || /заканчивается/i.test(product.status || '')));
      if (low.length) deliver(`stock:${today}`, 'Средства на исходе', `${low.slice(0, 2).map(product => product.name).join(', ')}${low.length > 2 ? ` и ещё ${low.length - 2}` : ''}. Проверь остаток и корзину.`);
    }
  }
  evaluate();
  setInterval(evaluate, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) evaluate(); });
  window.addEventListener('storage', event => { if (event.key?.startsWith(prefix + ':')) evaluate(); });
})();
