/* Общие дополнительные функции. Данные остаются в текущем префиксе браузера. */
(() => {
  const prefix = document.documentElement.dataset.storagePrefix || 'moyuhod';
  const personal = document.documentElement.dataset.appMode === 'personal';
  const rules = window.MoyUhodIngredientRules || [];
  const $ = (selector, root = document) => root.querySelector(selector);
  const element = (tag, text = '', cls = '') => {
    const item = document.createElement(tag);
    item.textContent = text;
    if (cls) item.className = cls;
    return item;
  };
  const storage = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(prefix + ':' + key) || 'null') ?? fallback; }
    catch { return fallback; }
  };
  const saveStorage = (key, value) => localStorage.setItem(prefix + ':' + key, JSON.stringify(value));
  const today = () => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  const utcDay = value => /^\d{4}-\d\d-\d\d$/.test(value || '') ? Date.parse(value + 'T00:00:00Z') : NaN;
  const dayDiff = (later, earlier) => Math.round((utcDay(later) - utcDay(earlier)) / 86400000);
  const addDays = (value, days) => {
    const date = new Date(utcDay(value) + days * 86400000);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };
  const dateForDay = weekday => addDays(today(), (weekday - new Date().getDay() + 7) % 7);
  const field = (label, control) => {
    const wrap = element('label', '', 'field');
    wrap.append(element('span', label), control);
    return wrap;
  };
  const input = (type, value = '') => {
    const control = document.createElement('input');
    control.type = type;
    control.value = value == null ? '' : String(value);
    return control;
  };
  const select = (options, current) => {
    const control = document.createElement('select');
    options.forEach(([value, label]) => control.add(new Option(label, value)));
    control.value = current || options[0][0];
    return control;
  };
  const button = (text, action, cls = 'secondary') => {
    const item = element('button', text, cls);
    item.type = 'button';
    item.addEventListener('click', action);
    return item;
  };
  const productById = id => [...products, ...(personal ? archivedProducts : [])].find(p => p.id === id);
  const confirmedInci = p => !!(p && p.inci && p.inciVerified === true);
  const normalized = value => String(value || '').toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const groupsFor = text => rules.filter(rule => rule.terms.some(term => normalized(text).includes(normalized(term)))).map(rule => rule.id);
  const preferred = () => storage('profile', {}).ingredientPreferences || { loved: [], avoided: [] };
  const preferenceMatches = text => {
    const pref = preferred();
    const present = groupsFor(text);
    const match = entries => entries.filter(term => {
      const rule = rules.find(item => item.terms.some(alias => normalized(alias) === normalized(term)));
      return rule ? present.includes(rule.id) : normalized(text).includes(normalized(term));
    });
    return { loved: match(pref.loved || []), avoided: match(pref.avoided || []) };
  };
  const expiry = p => {
    const candidates = [];
    if (Number.isFinite(utcDay(p.expiresAt))) candidates.push(p.expiresAt);
    const months = Number(p.paoMonths);
    if (Number.isFinite(utcDay(p.openedAt)) && Number.isInteger(months) && months > 0) {
      const original = new Date(utcDay(p.openedAt));
      const target = new Date(Date.UTC(original.getUTCFullYear(), original.getUTCMonth() + months + 1, 0));
      target.setUTCDate(Math.min(original.getUTCDate(), target.getUTCDate()));
      candidates.push(target.toISOString().slice(0, 10));
    }
    return candidates.sort()[0] || '';
  };
  const expiryText = p => {
    const date = expiry(p);
    if (!date) return '';
    const days = dayDiff(date, today());
    if (days < 0) return 'Срок истёк · ' + date;
    if (days <= 30) return 'Истекает через ' + days + ' дн. · ' + date;
    return '';
  };
  function productFields(p, wrap) {
    const inci = document.createElement('textarea');
    inci.value = p.inci || '';
    inci.rows = 5;
    inci.placeholder = 'Состав с упаковки или сайта производителя. Если неизвестен, оставь пустым.';
    const sourceType = select([['', 'Не указан'], ['package', 'Упаковка'], ['manufacturer', 'Сайт производителя'], ['other', 'Другое (ссылка)']], p.inciSourceType || '');
    const sourceUrl = input('url', p.inciSourceUrl || p.inciSource || '');
    sourceUrl.placeholder = 'Ссылка, если есть';
    const verified = input('checkbox');
    verified.checked = p.inciVerified === true;
    const verifiedLabel = element('label', '', 'care-check');
    verifiedLabel.append(verified, document.createTextNode('Проверено мной по источнику'));
    const ocrStatus = element('span', '', 'privacy-note');
    const paste = button('Вставить текст', async () => {
      try { inci.value = await navigator.clipboard.readText(); ocrStatus.textContent = 'Текст вставлен. Проверь его по источнику.'; }
      catch { inci.focus(); ocrStatus.textContent = 'Вставь текст в поле вручную.'; }
    });
    const photo = input('file');
    photo.accept = 'image/*';
    photo.setAttribute('capture', 'environment');
    photo.hidden = true;
    photo.addEventListener('change', async () => {
      const file = photo.files?.[0];
      if (!file) return;
      try { inci.value = (await recognizePhoto(file, ocrStatus)).trim(); ocrStatus.textContent = 'Текст распознан. Проверь каждую строку перед отметкой.'; }
      catch { ocrStatus.textContent = 'Распознавание недоступно. Состав можно ввести вручную.'; }
    });
    const photoButton = button('Распознать с фото', () => photo.click());
    const actions = element('div', '', 'care-inline-actions');
    actions.append(paste, photoButton, photo, ocrStatus);
    const dates = element('div', '', 'care-form-grid');
    const expiresAt = input('date', p.expiresAt || '');
    const openedAt = input('date', p.openedAt || '');
    const paoMonths = input('number', p.paoMonths || '');
    paoMonths.min = '1'; paoMonths.step = '1'; paoMonths.placeholder = 'Например, 12';
    dates.append(field('Годен до', expiresAt), field('Дата вскрытия', openedAt), field('Срок после вскрытия, мес.', paoMonths));
    const price = input('number', p.price || '');
    price.min = '0'; price.step = '0.01'; price.placeholder = '₽';
    const volume = input('text', p.volume || '');
    volume.placeholder = 'Например, 30 мл';
    const cost = element('div', '', 'care-form-grid');
    cost.append(field('Цена, ₽', price), field('Объём', volume));
    wrap.append(element('h3', 'Состав (INCI)'), field('Состав (INCI)', inci), actions, field('Источник состава', sourceType), field('Ссылка на источник', sourceUrl), verifiedLabel,
      element('h3', 'Сроки и стоимость'), dates, cost);
    const values = () => ({
      inci: inci.value.trim(), inciSourceType: sourceType.value, inciSourceUrl: sourceUrl.value.trim(),
      inciVerified: verified.checked && !!inci.value.trim(), expiresAt: expiresAt.value, openedAt: openedAt.value,
      paoMonths: paoMonths.value ? Number(paoMonths.value) : null, price: price.value ? Number(price.value) : null, volume: volume.value.trim()
    });
    return values;
  }
  function applyProductData(p, values) {
    Object.assign(p, values);
    write('products', products);
    if (personal) write('archive', archivedProducts);
    renderAll();
  }
  function openProductData(p) {
    const wrap = element('div', '', 'note-form care-product-form');
    const values = productFields(p, wrap);
    if (confirmedInci(p)) wrap.append(button('Разобрать подтверждённый состав', () => {
      const message = analyzeComposition(p.inci);
      window.alert(message);
    }));
    if (p.status === 'Использую' && !p.openedAt) wrap.append(element('p', 'Можно указать дату вскрытия, если она известна.', 'privacy-note'));
    const history = element('section', '', 'care-reactions');
    history.append(element('h3', 'История переносимости'));
    (p.reactions || []).slice().reverse().forEach(reaction => history.append(element('p',
      reaction.date + ' · ' + reaction.rating + (reaction.area ? ' · ' + reaction.area : '') + (reaction.note ? ' · ' + reaction.note : ''))));
    wrap.append(history, button('Добавить наблюдение', () => openReaction(p)));
    const cancel = button('Закрыть', closeModal);
    const save = button('Сохранить', () => { applyProductData(p, values()); closeModal(); toast('Данные средства сохранены'); }, 'primary');
    openModal(p.name, wrap, [cancel, save]);
  }
  function openReaction(p, dateValue = today()) {
    const wrap = element('div', '', 'note-form');
    const date = input('date', dateValue);
    const rating = select([['good', 'Хорошо'], ['mild', 'Лёгкий дискомфорт'], ['irritation', 'Раздражение'], ['stopped', 'Прекращено использование']], '');
    const area = input('text'); area.placeholder = 'Зона, если важно';
    const note = document.createElement('textarea'); note.placeholder = 'Что замечено без предположений о причине';
    const guidance = element('p', 'Если раздражение сохраняется или усиливается — прекрати средство и обратись к врачу.', 'privacy-note');
    guidance.hidden = true;
    rating.addEventListener('change', () => { guidance.hidden = rating.value !== 'irritation'; });
    wrap.append(field('Дата', date), field('Оценка', rating), field('Зона', area), field('Заметка', note), guidance);
    openModal('Наблюдение · ' + p.name, wrap, [button('Отмена', closeModal),
      button('Сохранить', () => {
        p.reactions ||= [];
        p.reactions.push({ id: 'r-' + Date.now(), date: date.value || today(), rating: rating.selectedOptions[0].text,
          area: area.value.trim(), note: note.value.trim() });
        write('products', products);
        if (personal) write('archive', archivedProducts);
        closeModal(); renderAll(); toast('Наблюдение сохранено');
        if (rating.value === 'irritation') window.alert('Если раздражение сохраняется или усиливается — прекрати средство и обратись к врачу.');
      }, 'primary')]);
  }
  function showLowBasket(p) {
    const wrap = element('div', '', 'note-form');
    const name = input('text'); name.placeholder = 'Название средства на замену';
    wrap.append(element('p', 'Новое средство заменит: ' + p.name), field('Будущая покупка', name));
    openModal('Добавить в корзину', wrap, [button('Позже', closeModal), button('Добавить', () => {
      if (!name.value.trim()) { name.focus(); return; }
      basket.push({ id: 'b-' + Date.now(), name: name.value.trim(), category: p.category, replacesId: p.id, status: 'В планах', note: '' });
      write('basket', basket); closeModal(); renderAll(); toast('Добавлено в корзину');
    }, 'primary')]);
  }
  function openBasketData(item) {
    const wrap = element('div', '', 'note-form');
    const inci = document.createElement('textarea'); inci.value = item.inci || ''; inci.rows = 5;
    inci.placeholder = 'Состав из проверенного источника, если известен';
    const verified = input('checkbox'); verified.checked = item.inciVerified === true;
    const mark = element('label', '', 'care-check');
    mark.append(verified, document.createTextNode('Проверено мной по источнику'));
    const price = input('number', item.price || ''); price.min = '0'; price.step = '0.01';
    const volume = input('text', item.volume || ''); volume.placeholder = 'Например, 30 мл';
    const photo = input('file'); photo.accept = 'image/*'; photo.setAttribute('capture', 'environment'); photo.hidden = true;
    const status = element('p', '', 'privacy-note');
    photo.addEventListener('change', async () => {
      if (!photo.files?.[0]) return;
      try { inci.value = (await recognizePhoto(photo.files[0], status)).trim(); status.textContent = 'Проверь распознанный текст по источнику.'; }
      catch { status.textContent = 'Распознавание не удалось; можно ввести состав вручную.'; }
    });
    wrap.append(field('Состав (INCI)', inci), button('Распознать с фото', () => photo.click()), photo, status, mark,
      field('Цена, ₽', price), field('Объём', volume));
    openModal('Данные будущей покупки', wrap, [button('Отмена', closeModal), button('Сохранить', () => {
      item.inci = inci.value.trim(); item.inciVerified = verified.checked && !!item.inci;
      item.price = price.value ? Number(price.value) : null; item.volume = volume.value.trim();
      write('basket', basket); closeModal(); renderBasket(); toast('Данные покупки сохранены');
    }, 'primary')]);
  }
  const originalCard = productCard;
  productCard = function(p, archived) {
    const card = originalCard(p, archived);
    card.dataset.productId = p.id;
    const badge = expiryText(p);
    if (badge) card.append(element('p', badge, 'care-expiry-badge'));
    if (p.finishedAt && p.openedAt && dayDiff(p.finishedAt, p.openedAt) >= 0) {
      const days = dayDiff(p.finishedAt, p.openedAt) + 1;
      card.append(element('p', 'Хватило примерно на ' + days + ' дн.', 'care-soft-note'));
      if (Number(p.price) > 0) card.append(element('p', 'По фактическому сроку: около ' +
        Math.round(Number(p.price) * 30 / days).toLocaleString('ru-RU') + ' ₽ в месяц', 'care-soft-note'));
    }
    if (p.status === 'Использую' && !p.openedAt) card.append(element('p', 'Дата вскрытия не указана', 'care-soft-note'));
    const matches = confirmedInci(p) ? preferenceMatches(p.inci) : { loved: [], avoided: [] };
    if (matches.loved.length) card.append(element('p', 'Отмечено как любимое: ' + matches.loved.join(', '), 'care-soft-note'));
    if (matches.avoided.length) card.append(element('p', 'Обрати внимание на состав: ' + matches.avoided.join(', '), 'care-preference-note'));
    const tools = element('div', '', 'care-card-tools');
    tools.append(button('Состав и данные', () => openProductData(p), 'care-detail-button'),
      button('Реакция', () => openReaction(p), 'care-detail-button'));
    card.append(tools);
    return card;
  };
  const originalAddProduct = openAddProduct;
  openAddProduct = function(...args) {
    const prior = new Set(products.map(p => p.id));
    originalAddProduct(...args);
    const wrap = $('#modalContent .note-form');
    const save = $('#modalActions .primary');
    if (!wrap || !save) return;
    const values = productFields({}, wrap);
    save.addEventListener('click', () => {
      const created = products.find(p => !prior.has(p.id));
      if (created) applyProductData(created, values());
    });
  };
  if (typeof editProduct === 'function') {
    const originalEditProduct = editProduct;
    editProduct = function(p) {
      originalEditProduct(p);
      const wrap = $('#modalContent .note-form');
      const save = $('#modalActions .primary');
      if (!wrap || !save) return;
      const values = productFields(p, wrap);
      save.addEventListener('click', () => applyProductData(p, values()));
    };
  }
  function stockModal(p) {
    const wrap = element('div', '', 'note-form');
    const choices = element('div', '', 'care-inline-actions');
    let level = '';
    const levels = [['full', 'Полный', 100], ['half', 'Половина', 50], ['low', 'Мало', 15], ['empty', 'Закончилось', 0]];
    levels.forEach(([key, title]) => choices.append(button(title, () => {
      level = key;
      exact.value = '';
      choices.querySelectorAll('button').forEach(item => item.classList.toggle('selected', item.textContent === title));
    })));
    const exact = input('number', p.remaining ?? '');
    exact.min = '0'; exact.max = '100'; exact.placeholder = 'Если известен точный остаток, %';
    wrap.append(element('p', 'Выбери уровень вручную. Приложение не меняет остаток автоматически.'), choices, field('Точный остаток, %', exact));
    openModal('Остаток · ' + p.name, wrap, [button('Отмена', closeModal), button('Сохранить', () => {
      if (!level && exact.value === '') { exact.focus(); return; }
      const matched = levels.find(item => item[0] === level);
      p.remaining = exact.value !== '' ? Math.min(100, Math.max(0, Number(exact.value))) : matched[2];
      p.stockLevel = level || '';
      if (level === 'empty') { p.status = 'Закончилось'; p.finishedAt = today(); }
      write('products', products); closeModal(); renderAll();
      if (level === 'low') showLowBasket(p);
      else toast('Остаток сохранён');
    }, 'primary')]);
  }
  openStock = stockModal;
  const originalRenderProducts = renderProducts;
  let productFilter = 'all';
  renderProducts = function() {
    originalRenderProducts();
    const all = $('#allProducts');
    if (!all) return;
    const section = $('#view-products .section-head');
    if (section && !$('#careProductFilters')) {
      const controls = element('div', '', 'care-product-controls');
      controls.id = 'careProductFilters';
      const filter = select([['all', 'Все сроки и составы'], ['missing', 'Без состава'], ['expiry', 'Сроки']], productFilter);
      filter.addEventListener('change', () => { productFilter = filter.value; renderProducts(); });
      controls.append(field('Показать', filter), element('p', '', 'care-count'));
      section.after(controls);
    }
    const count = $('#careProductFilters .care-count');
    if (count) count.textContent = 'Состав внесён: ' + products.filter(p => !!p.inci).length + ' из ' + products.length;
    all.querySelectorAll('.product-card').forEach(card => {
      const p = productById(card.dataset.productId);
      card.hidden = productFilter === 'missing' ? !!p?.inci : productFilter === 'expiry' ? !expiry(p) : false;
    });
  };
  const originalRenderHome = renderHomeRoutines;
  renderHomeRoutines = function() {
    originalRenderHome();
    const home = $('#view-home');
    if (!home) return;
    let reminder = $('#careExpiryReminder');
    if (!reminder) {
      reminder = element('p', '', 'assistant-notice care-reminder');
      reminder.id = 'careExpiryReminder';
      home.insertBefore(reminder, $('.routine-columns', home));
    }
    const due = products.filter(p => expiryText(p));
    reminder.hidden = !due.length;
    reminder.textContent = due.length ? 'Сроки средств: ' + due.map(p => p.name + ' — ' + expiryText(p)).join('; ') : '';
    home.querySelectorAll('.routine-step').forEach(row => {
      const check = $('input[type="checkbox"]', row);
      const step = steps.find(item => check?.id === 'home-' + item.id);
      const p = step && productById(step.productId);
      if (p && !$('.care-reaction-shortcut', row)) row.append(button('Реакция', () => openReaction(p), 'care-reaction-shortcut'));
    });
  };
  function lastCompleted(step, beforeDate) {
    return Object.keys(checks).filter(key => key.endsWith(':' + step.id) && checks[key] && key.slice(0, 10) < beforeDate)
      .map(key => key.slice(0, 10)).sort().at(-1) || '';
  }
  function isScheduled(step, date) {
    const mode = step.frequencyMode || 'weekdays';
    const weekday = new Date(date + 'T12:00:00').getDay();
    if (mode === 'daily' || mode === 'situation') return true;
    if (mode === 'everyN') {
      const anchor = step.frequencyAnchor || today();
      const last = lastCompleted(step, date);
      const interval = Math.max(1, Number(step.frequencyDays) || 1);
      return date >= (last ? addDays(last, interval) : anchor);
    }
    const selected = step.days?.length ? step.days : [0, 1, 2, 3, 4, 5, 6];
    if (selected.includes(weekday)) return true;
    const last = lastCompleted(step, date);
    for (let offset = 1; offset <= 7; offset++) {
      const previous = addDays(date, -offset);
      if (last && previous <= last) break;
      if (selected.includes(new Date(previous + 'T12:00:00').getDay()) && !checks[previous + ':' + step.id]) return true;
    }
    return false;
  }
  const originalStepsFor = stepsFor;
  stepsFor = function(cat, time, day = new Date().getDay()) {
    const base = originalStepsFor(cat, time, day).filter(step => !step.frequencyMode);
    const date = personal && typeof selectedRoutineDate === 'string' && day === new Date(selectedRoutineDate + 'T12:00:00').getDay()
      ? selectedRoutineDate : dateForDay(day);
    const custom = steps.filter(step => step.frequencyMode && !step.productArchived &&
      (cat === 'all' || step.category === cat) && step.time === time &&
      (!personal || !archivedProducts.some(p => p.id === step.productId)) &&
      isScheduled(step, date) && (!step.minBreakDays || !lastCompleted(step, date) ||
        dayDiff(date, lastCompleted(step, date)) >= Number(step.minBreakDays)));
    return base.concat(custom);
  };
  const originalAddStep = openAddStep;
  function frequencyFields(initial, wrap) {
    const mode = select([['daily', 'Каждый день'], ['weekdays', 'По дням недели'], ['everyN', 'Каждые N дней'], ['situation', 'По ситуации']], initial.frequencyMode || 'weekdays');
    const interval = input('number', initial.frequencyDays || '');
    interval.min = '1'; interval.step = '1'; interval.placeholder = 'Например, 3';
    const gap = input('number', initial.minBreakDays || '');
    gap.min = '1'; gap.step = '1'; gap.placeholder = 'Необязательно';
    const intervalField = field('Период, дней', interval);
    const sync = () => { intervalField.hidden = mode.value !== 'everyN'; };
    mode.addEventListener('change', sync); sync();
    wrap.append(element('h3', 'Повторение шага'), field('Режим частоты', mode), intervalField, field('Минимальный перерыв, дней', gap));
    return () => ({
      frequencyMode: mode.value, frequencyDays: mode.value === 'everyN' ? Math.max(1, Number(interval.value) || 1) : null,
      minBreakDays: gap.value ? Number(gap.value) : null, frequencyAnchor: initial.frequencyAnchor || today(),
      optional: mode.value === 'situation' || (!!initial.optional && initial.frequencyMode !== 'situation')
    });
  }
  openAddStep = function(...args) {
    const prior = new Set(steps.map(step => step.id));
    originalAddStep(...args);
    const wrap = $('#modalContent .note-form');
    const save = $('#modalActions .primary');
    if (!wrap || !save) return;
    const values = frequencyFields({}, wrap);
    save.addEventListener('click', () => {
      const created = steps.find(step => !prior.has(step.id));
      if (created) { Object.assign(created, values()); write('steps', steps); renderAll(); }
    });
  };
  function editFrequency(step) {
    const wrap = element('div', '', 'note-form');
    const values = frequencyFields(step, wrap);
    const dayChoices = element('div', '', 'care-inline-actions');
    const dayInputs = [];
    [['Пн', 1], ['Вт', 2], ['Ср', 3], ['Чт', 4], ['Пт', 5], ['Сб', 6], ['Вс', 0]].forEach(([label, day]) => {
      const check = input('checkbox');
      check.checked = !step.days?.length || step.days.includes(day);
      dayInputs.push([day, check]);
      const item = element('label', label, 'care-day');
      item.prepend(check); dayChoices.append(item);
    });
    wrap.append(field('Дни недели для режима «по дням»', dayChoices));
    openModal('Частота · ' + step.name, wrap, [button('Отмена', closeModal), button('Сохранить', () => {
      Object.assign(step, values());
      const selected = dayInputs.filter(([, check]) => check.checked).map(([day]) => day);
      step.days = selected.length ? selected : [0, 1, 2, 3, 4, 5, 6];
      write('steps', steps); closeModal(); renderAll(); toast('Частота сохранена');
    }, 'primary')]);
  }
  function audit(date, time) {
    const day = new Date(date + 'T12:00:00').getDay();
    const list = stepsFor('all', time, day);
    const items = list.map(step => ({ step, product: productById(step.productId) })).filter(item => item.product);
    const known = items.filter(item => confirmedInci(item.product));
    const found = known.map(item => ({ ...item, groups: groupsFor(item.product.inci) }));
    const alerts = [];
    const retinoids = found.filter(item => item.groups.includes('retinoid'));
    const acids = found.filter(item => item.groups.includes('aha') || item.groups.includes('bha'));
    if (retinoids.length > 1) alerts.push('два средства с ретиноидами в один ' + (time === 'am' ? 'утренний' : 'вечерний') + ' период');
    if (retinoids.length && acids.length) alerts.push('ретиноид и AHA/BHA в один ' + (time === 'am' ? 'утренний' : 'вечерний') + ' период');
    for (const rule of rules) {
      const same = found.filter(item => item.groups.includes(rule.id));
      if (same.length > 1) alerts.push('актив «' + rule.label + '» встречается в двух средствах');
    }
    return { alerts: [...new Set(alerts)], unknown: items.length - known.length };
  }
  function duplicateHints() {
    const warnings = [];
    products.forEach((p, index) => products.slice(index + 1).forEach(other => {
      if (normalized(p.name) === normalized(other.name)) warnings.push(p.name + ' / ' + other.name);
      else if (p.role && p.role === other.role && confirmedInci(p) && confirmedInci(other)) {
        const overlap = groupsFor(p.inci).filter(group => groupsFor(other.inci).includes(group));
        if (overlap.length) warnings.push(p.name + ' / ' + other.name);
      }
    }));
    return warnings;
  }
  const baseAnalyze = analyzeComposition;
  analyzeComposition = function(raw) {
    const result = baseAnalyze(raw);
    const matches = preferenceMatches(raw);
    const notes = [];
    if (matches.loved.length) notes.push('Твои отметки «Любимые»: ' + matches.loved.join(', '));
    if (matches.avoided.length) notes.push('Обрати внимание: отмечено как нежелательное — ' + matches.avoided.join(', '));
    return result + (notes.length ? '\n\n' + notes.join('\n') + '\nСовпадение по названию не доказывает реакцию кожи.' : '');
  };
  function openPreferences() {
    const current = preferred();
    const wrap = element('div', '', 'note-form');
    const loved = document.createElement('textarea'); loved.value = (current.loved || []).join(', ');
    const avoided = document.createElement('textarea'); avoided.value = (current.avoided || []).join(', ');
    const hints = element('datalist'); hints.id = 'careIngredientHints';
    rules.flatMap(rule => rule.terms).forEach(term => hints.append(new Option(term)));
    const suggestion = input('text');
    suggestion.setAttribute('list', hints.id);
    suggestion.placeholder = 'Начни вводить, например Retinol';
    const addSuggestion = target => {
      const value = suggestion.value.trim();
      if (!value) return;
      target.value = [target.value.trim(), value].filter(Boolean).join(', ');
      suggestion.value = '';
      suggestion.focus();
    };
    const suggestionActions = element('div', '', 'care-inline-actions');
    suggestionActions.append(button('В любимые', () => addSuggestion(loved)),
      button('В избегаю', () => addSuggestion(avoided)));
    wrap.append(element('p', 'Укажи ингредиенты через запятую. Совпадения показываются как личные пометки, без оценки безопасности.', 'privacy-note'),
      field('Любимые', loved), field('Не подходят / избегаю', avoided),
      field('Подсказки из словаря INCI', suggestion), hints, suggestionActions,
      element('p', 'Примеры: ' + rules.map(rule => rule.terms[0]).join(', '), 'privacy-note'));
    openModal('Мои ингредиенты', wrap, [button('Отмена', closeModal), button('Сохранить', () => {
      const parse = value => value.split(/[,\n;]+/).map(text => text.trim()).filter(Boolean);
      const profile = storage('profile', {});
      profile.ingredientPreferences = { loved: parse(loved.value), avoided: parse(avoided.value) };
      saveStorage('profile', profile);
      closeModal(); renderAll(); toast('Предпочтения сохранены');
    }, 'primary')]);
  }
  const originalRenderRoutine = renderRoutineManager;
  let friendRoutineUndo = null;
  function friendMoveDialog(step, time) {
    const group = step.group || CATS[step.category]?.label || 'Общее';
    const wrap = element('div', '', 'note-form');
    const scope = select([['step', 'Этот шаг'], ['group', 'Весь блок «' + group + '»']], 'step');
    const action = select([['move', 'Перенести — убрать из исходного дня'], ['copy', 'Скопировать — оставить в исходном дне']], 'move');
    const day = select([['1', 'Понедельник'], ['2', 'Вторник'], ['3', 'Среда'], ['4', 'Четверг'],
      ['5', 'Пятница'], ['6', 'Суббота'], ['0', 'Воскресенье']], String((routineDay + 1) % 7));
    const period = select([['am', 'Утро'], ['pm', 'Вечер']], time);
    const info = element('p', '', 'privacy-note');
    const update = () => {
      const source = stepsFor('all', time, routineDay).filter(item =>
        scope.value === 'step' ? item.id === step.id : (item.group || CATS[item.category]?.label || 'Общее') === group);
      info.textContent = 'Источник: ' + ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][routineDay] +
        ' · ' + (time === 'am' ? 'утро' : 'вечер') + ' · ' + group + ' · ' + source.length + ' шаг(ов). ' +
        (action.value === 'move' ? 'Исходные шаги будут убраны.' : 'Исходные шаги останутся.');
    };
    [scope, action, day, period].forEach(control => control.addEventListener('change', update)); update();
    wrap.append(info, field('Что изменить', scope), field('Действие', action), field('Целевой день', day), field('Целевой период', period));
    openModal('Перенос расписания', wrap, [button('Отмена', closeModal), button('Подтвердить', () => {
      const targetDay = Number(day.value), targetTime = period.value;
      if (targetDay === routineDay && targetTime === time) { toast('Выбери другой день или период'); return; }
      const source = stepsFor('all', time, routineDay).filter(item =>
        scope.value === 'step' ? item.id === step.id : (item.group || CATS[item.category]?.label || 'Общее') === group);
      const duplicates = source.filter(item => steps.some(other => !source.some(s => s.id === other.id) &&
        other.time === targetTime && other.name === item.name && other.productId === item.productId &&
        (!other.days?.length || other.days.includes(targetDay))));
      if (duplicates.length) { toast('В целевом дне уже есть такой шаг'); return; }
      friendRoutineUndo = steps.map(item => ({ ...item, days: item.days?.slice() }));
      const selected = new Set(source.map(item => item.id));
      const updated = [];
      steps.forEach(item => {
        if (!selected.has(item.id)) { updated.push(item); return; }
        const days = item.days?.length ? item.days.slice() : [0, 1, 2, 3, 4, 5, 6];
        if (action.value === 'copy') updated.push(item);
        else {
          const remaining = days.filter(value => value !== routineDay);
          if (remaining.length) updated.push({ ...item, days: remaining });
        }
        updated.push({ ...item, id: 'step-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          days: [targetDay], time: targetTime });
      });
      steps = updated; write('steps', steps); closeModal(); renderAll(); toast('Расписание обновлено; действие можно отменить');
    }, 'primary')]);
  }
  renderRoutineManager = function() {
    originalRenderRoutine();
    if (!personal) {
      $('#view-routine .routine-block-mover')?.remove();
      const cards = [...document.querySelectorAll('#routineManager .routine-card')];
      cards.forEach((card, index) => {
        const time = index ? 'pm' : 'am';
        const visible = stepsFor(routineCat, time, routineDay);
        card.querySelectorAll('.step-edit').forEach((row, position) => {
          const step = visible[position];
          if (step) $('.step-name', row)?.append(button('Перенос / копия', () => friendMoveDialog(step, time), 'care-context-button'));
        });
      });
      if (friendRoutineUndo && !$('#careUndoRoutine')) {
        const undo = button('Отменить перенос', () => {
          steps = friendRoutineUndo; friendRoutineUndo = null; write('steps', steps); renderAll(); toast('Перенос отменён');
        }, 'care-context-button');
        undo.id = 'careUndoRoutine'; $('#view-routine .section-head')?.append(undo);
      }
      if (!friendRoutineUndo) $('#careUndoRoutine')?.remove();
    } else $('#view-routine .routine-block-mover')?.remove();
    $('#routineManager')?.querySelectorAll('.step-edit').forEach(row => {
      const title = $('.step-name strong', row)?.textContent;
      const step = steps.find(item => item.name === title);
      if (step && !$('.care-frequency-button', row)) row.append(button('Частота', () => editFrequency(step), 'care-frequency-button'));
    });
    const section = $('#view-routine .section-head');
    if (section && !$('#careRoutineActions')) {
      const actions = element('div', '', 'care-inline-actions');
      actions.id = 'careRoutineActions';
      actions.append(button('Проверить план', showAudit), button('В календарь', exportCalendar));
      section.append(actions);
    }
    let message = $('#careRoutineWarning');
    if (!message) { message = element('p', '', 'care-preference-note'); message.id = 'careRoutineWarning'; section?.after(message); }
    const day = typeof routineDay === 'number' ? routineDay : new Date().getDay();
    const date = dateForDay(day);
    const messages = ['am', 'pm'].flatMap(time => audit(date, time).alerts);
    message.hidden = !messages.length;
    message.textContent = messages.length ? 'Обрати внимание: ' + [...new Set(messages)].join('; ') + '. Сверь с инструкциями средств.' : '';
  };
  const previousHome = renderHomeRoutines;
  renderHomeRoutines = function() {
    const openGroups = personal ? [] : [...document.querySelectorAll('#homeAm details[open],#homePm details[open]')]
      .map(item => [item.closest('#homeAm') ? 'homeAm' : 'homePm', item.querySelector('summary')?.textContent]);
    previousHome();
    openGroups.forEach(([id, title]) => {
      [...document.querySelectorAll('#' + id + ' details')].find(item => item.querySelector('summary')?.textContent === title)?.setAttribute('open', '');
    });
    const shownDate = personal && typeof selectedRoutineDate === 'string' ? selectedRoutineDate : today();
    const notices = ['am', 'pm'].flatMap(time => audit(shownDate, time).alerts);
    let box = $('#careHomeAudit');
    if (!box) { box = element('p', '', 'care-preference-note'); box.id = 'careHomeAudit'; $('#view-home .routine-columns')?.before(box); }
    box.hidden = !notices.length;
    box.textContent = notices.length ? 'Обрати внимание: ' + [...new Set(notices)].join('; ') + '. Сверь с инструкциями средств.' : '';
    if (!personal) {
      const carried = steps.filter(step => step.frequencyMode && step.frequencyMode !== 'daily' &&
        isScheduled(step, today()) && !checks[today() + ':' + step.id] &&
        step.frequencyMode === 'everyN' && step.frequencyAnchor < today());
      let note = $('#careTransferNotice');
      if (!note) { note = document.createElement('details'); note.id = 'careTransferNotice'; note.className = 'assistant-notice'; $('#view-home .routine-columns')?.before(note); }
      note.hidden = !carried.length;
      note.replaceChildren(element('summary', carried.length + ' запланированных шагов ждут выполнения'),
        element('p', carried.map(step => step.name).join('; ') + '. Следующее применение рассчитывается от отметки выполнения и заданного перерыва.'));
    }
  };
  function showAudit() {
    const wrap = element('div', '', 'note-form');
    const date = typeof routineDay === 'number' ? dateForDay(routineDay) : today();
    for (const [time, label] of [['am', 'Утро'], ['pm', 'Вечер']]) {
      const result = audit(date, time);
      wrap.append(element('h3', label));
      wrap.append(element('p', result.alerts.length ? result.alerts.map(text => 'Обрати внимание: ' + text).join('; ') : 'По подтверждённым составам совпадений из короткого справочника не найдено.'));
      if (result.unknown) wrap.append(element('p', 'Нет подтверждённых данных для ' + result.unknown + ' средств.', 'privacy-note'));
      const day = new Date(date + 'T12:00:00').getDay();
      const confirmed = [...new Set(stepsFor('all', time, day).map(step => productById(step.productId)).filter(confirmedInci))];
      confirmed.forEach(product => {
        const details = document.createElement('details');
        details.append(element('summary', 'Разбор: ' + product.name), element('p', analyzeComposition(product.inci), 'analysis-result'));
        wrap.append(details);
      });
    }
    const duplicates = duplicateHints();
    if (duplicates.length) wrap.append(element('p', 'Похоже на дубли: ' + duplicates.join('; '), 'privacy-note'));
    wrap.append(element('p', 'Это проверка внесённых данных. Она не ставит диагноз и не заменяет инструкции средств.', 'privacy-note'));
    openModal('Проверка плана', wrap, [button('Закрыть', closeModal)]);
  }
  if (personal) {
    const priorUsageHistory = renderUsageHistory;
    renderUsageHistory = function() {
      priorUsageHistory();
      const cutoff = addDays(today(), 1 - Number(historyWindow || 30));
      const entries = usageHistory.filter(event => event.date >= cutoff &&
        (historyProduct === 'all' || (event.productIds || []).includes(historyProduct)))
        .slice().sort((a, b) => (b.changedAt || b.date).localeCompare(a.changedAt || a.date));
      document.querySelectorAll('#usageHistoryList .journal-entry').forEach((card, index) => {
        const event = entries[index]; if (!event) return;
        (event.productIds || []).forEach(id => {
          const p = productById(id); if (!p) return;
          (p.reactions || []).filter(reaction => reaction.date === event.date).forEach(reaction => {
            card.append(element('p', 'Наблюдение · ' + p.name + ' · ' + reaction.rating +
              (reaction.area ? ' · ' + reaction.area : '') + (reaction.note ? ' · ' + reaction.note : ''), 'care-reaction-line'));
          });
          card.append(button('Добавить реакцию · ' + p.name, () => openReaction(p, event.date), 'care-reaction-shortcut'));
        });
      });
    };
  }
  const priorRenderJournal = renderJournal;
  renderJournal = function() {
    priorRenderJournal();
    const view = $('#view-journal');
    if (!view) return;
    let panel = $('#careReactionJournal');
    if (!panel) {
      panel = element('section', '', 'panel-card');
      panel.id = 'careReactionJournal';
      view.append(panel);
    }
    panel.replaceChildren(element('h3', 'Реакции на средства'));
    const filter = select([['all', 'Все средства'], ...products.map(p => [p.id, p.name])], panel.dataset.filter || 'all');
    filter.addEventListener('change', () => { panel.dataset.filter = filter.value; renderJournal(); });
    panel.append(field('Средство', filter), button('Добавить реакцию', () => chooseReactionProduct()));
    products.filter(p => filter.value === 'all' || p.id === filter.value).forEach(p => {
      (p.reactions || []).slice().reverse().forEach(reaction => panel.append(element('p',
        reaction.date + ' · ' + p.name + ' · ' + reaction.rating + (reaction.note ? ' · ' + reaction.note : ''), 'care-reaction-line')));
    });
  };
  function chooseReactionProduct() {
    if (!products.length) { toast('Сначала добавь средство'); return; }
    const wrap = element('div', '', 'note-form');
    const choice = select(products.map(p => [p.id, p.name]), products[0].id);
    wrap.append(field('Средство', choice));
    openModal('Добавить реакцию', wrap, [button('Отмена', closeModal), button('Продолжить', () => openReaction(productById(choice.value)), 'primary')]);
  }
  const previousRenderBasket = renderBasket;
  renderBasket = function() {
    previousRenderBasket();
    const view = $('#view-basket');
    let sum = $('#careBasketTotal');
    if (!sum) { sum = element('p', '', 'care-basket-total'); sum.id = 'careBasketTotal'; $('#basketList')?.before(sum); }
    const values = basket.map(item => Number(item.price)).filter(value => Number.isFinite(value) && value >= 0);
    sum.textContent = 'Бюджет по указанным ценам: ' + values.reduce((a, b) => a + b, 0).toLocaleString('ru-RU') + ' ₽ (' + values.length + ' из ' + basket.length + ' позиций)';
    $('#basketList')?.querySelectorAll('.basket-card').forEach((card, index) => {
      const item = basket[index];
      if (!item) return;
      const cost = input('number', item.price || ''); cost.min = '0'; cost.step = '0.01'; cost.placeholder = 'Цена, ₽';
      cost.addEventListener('change', () => { item.price = cost.value ? Number(cost.value) : null; write('basket', basket); renderBasket(); });
      card.append(field('Цена для бюджета', cost));
      card.append(button('Состав и объём', () => openBasketData(item), 'care-detail-button'));
      const source = item.sourceProductId ? productById(item.sourceProductId) : null;
      if (confirmedInci(item) || confirmedInci(source)) {
        const matches = preferenceMatches(confirmedInci(item) ? item.inci : source.inci);
        if (matches.avoided.length) card.append(element('p', 'Обрати внимание: в составе есть отмеченное как нежелательное — ' + matches.avoided.join(', '), 'care-preference-note'));
      }
    });
  };
  function startStepMode() {
    const list = stepsFor('all', 'am').concat(stepsFor('all', 'pm'));
    if (!list.length) { toast('На сегодня шагов нет'); return; }
    let index = 0, timerId;
    const wrap = element('div', '', 'note-form');
    const counter = element('p', '', 'privacy-note');
    const title = element('h3');
    const wait = input('number'); wait.min = '1'; wait.step = '1'; wait.placeholder = 'Необязательно';
    const timerText = element('p', '', 'privacy-note');
    const show = () => {
      if (index >= list.length) { clearInterval(timerId); closeModal(); toast('Шаги просмотрены'); return; }
      counter.textContent = 'Шаг ' + (index + 1) + ' из ' + list.length;
      title.textContent = list[index].name;
    };
    wrap.append(counter, title, field('Таймер ожидания, мин.', wait), timerText,
      button('Запустить таймер', () => {
        const minutes = Number(wait.value);
        if (!Number.isInteger(minutes) || minutes <= 0) { wait.focus(); return; }
        clearInterval(timerId);
        let seconds = minutes * 60;
        timerText.textContent = 'Осталось ' + seconds + ' сек.';
        timerId = setInterval(() => {
          seconds--; timerText.textContent = seconds ? 'Осталось ' + seconds + ' сек.' : 'Время вышло';
          if (!seconds) clearInterval(timerId);
        }, 1000);
      }));
    const next = button('Дальше', () => { clearInterval(timerId); checks[today() + ':' + list[index].id] = true; write('checks', checks); index++; show(); renderAll(); }, 'primary');
    const skip = button('Пропустить', () => { clearInterval(timerId); index++; show(); });
    openModal('Шаг за шагом', wrap, [button('Закрыть', () => { clearInterval(timerId); closeModal(); }), skip, next]);
    show();
  }
  function exportCalendar() {
    const wrap = element('div', '', 'note-form');
    const morning = input('time', storage('profile', {}).calendarMorning || '');
    const evening = input('time', storage('profile', {}).calendarEvening || '');
    wrap.append(element('p', 'Укажи удобное время для двух событий каждого дня недели. Уведомления зависят от календаря телефона.', 'privacy-note'),
      field('Утро', morning), field('Вечер', evening));
    openModal('Расписание для календаря', wrap, [button('Отмена', closeModal), button('Скачать .ics', () => {
      if (!morning.value || !evening.value) { (!morning.value ? morning : evening).focus(); return; }
      const profile = storage('profile', {});
      profile.calendarMorning = morning.value; profile.calendarEvening = evening.value;
      saveStorage('profile', profile);
      const escape = value => String(value).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
      const events = [];
      for (let offset = 0; offset < 7; offset++) {
        const date = addDays(today(), offset);
        const weekday = new Date(date + 'T12:00:00').getDay();
        for (const [time, label, clock] of [['am', 'Утренний уход', morning.value], ['pm', 'Вечерний уход', evening.value]]) {
          const names = stepsFor('all', time, weekday).map(step => step.name);
          if (!names.length) continue;
          const stamp = date.replace(/-/g, '') + 'T' + clock.replace(':', '') + '00';
          events.push(['BEGIN:VEVENT', 'UID:moy-uhod-' + date + '-' + time + '@local', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
            'DTSTART:' + stamp, 'DURATION:PT30M', 'SUMMARY:' + escape(label), 'DESCRIPTION:' + escape(names.join('\n')), 'END:VEVENT'].join('\r\n'));
        }
      }
      const body = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Moy Uhod//Care Planner//RU\r\n' + events.join('\r\n') + '\r\nEND:VCALENDAR\r\n';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
      link.download = 'moy-uhod-week.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      closeModal(); toast('Календарь скачан');
    }, 'primary')]);
  }
  // The shared, empty-start version needs the same four basket entry paths as
  // the personal version. Keep the scan result editable before it is saved.
  if (!personal) {
    openAddBasketItem = function(prefillId = '', initialMode = 'manual') {
      const wrap = element('div', '', 'note-form');
      const mode = select([['manual', 'Ввести вручную'], ['library', 'Выбрать из библиотеки'],
        ['archive', 'Выбрать из архива'], ['ocr', 'Сканировать название']], initialMode);
      const search = input('search'); search.placeholder = 'Поиск по бренду или названию';
      const choice = select([['', 'Выбери средство']], '');
      const name = input('text'); name.placeholder = 'Название будущей покупки';
      const category = select([['', 'Выбери зону'], ...Object.entries(CATS)
        .filter(([key]) => key !== 'general').map(([key, value]) => [key, value.label])], '');
      const replaces = select([['', 'Не заменяет конкретное средство'],
        ...products.filter(p => p.status !== 'Архив').map(p => [p.id, p.name])], prefillId);
      const note = document.createElement('textarea'); note.placeholder = 'Почему рассматриваешь, что проверить';
      const warning = element('p', '', 'care-preference-note'); warning.hidden = true;
      const list = () => products.filter(p => mode.value === 'archive' ? p.status === 'Архив' : p.status !== 'Архив');
      const picked = () => list().find(p => p.id === choice.value);
      const updateWarning = () => {
        const p = picked();
        const avoided = confirmedInci(p) ? preferenceMatches(p.inci).avoided : [];
        warning.hidden = !avoided.length;
        warning.textContent = avoided.length ? 'В подтверждённом составе есть отмеченное как нежелательное: ' + avoided.join(', ') : '';
      };
      const fill = () => {
        const previous = choice.value;
        const query = normalized(search.value.trim());
        choice.replaceChildren(new Option('Выбери средство', ''),
          ...list().filter(p => normalized(p.name).includes(query) || normalized(p.brand).includes(query))
            .map(p => new Option(p.name, p.id)));
        choice.value = [...choice.options].some(o => o.value === previous) ? previous : '';
        const p = picked();
        if (p) { name.value = p.name; category.value = p.category || ''; }
        searchField.hidden = choiceField.hidden = !['library', 'archive'].includes(mode.value);
        scan.hidden = mode.value !== 'ocr';
        nameField.hidden = ['library', 'archive'].includes(mode.value);
        updateWarning();
      };
      const searchField = field('Найти средство', search), choiceField = field('Средство', choice);
      const nameField = field('Название', name);
      const scan = button('Открыть камеру или выбрать фото', () => {
        closeModal(); sessionStorage.setItem('moyuhod:basket-scan', '1');
        go('assistant'); $('[data-assistant-tab="scanner"]')?.click(); $('#scanProductImage')?.click();
      });
      mode.addEventListener('change', () => { search.value = ''; choice.value = ''; name.value = ''; category.value = ''; fill(); });
      search.addEventListener('input', fill);
      choice.addEventListener('change', fill);
      fill();
      wrap.append(field('Источник', mode), searchField, choiceField, nameField,
        field('Зона', category), field('Что заменить', replaces), field('Заметка', note), warning, scan);
      openModal('Будущая покупка', wrap, [button('Отмена', closeModal), button('Добавить в корзину', () => {
        const p = ['library', 'archive'].includes(mode.value) ? picked() : null;
        const itemName = (p?.name || name.value).trim();
        if (!itemName || !category.value) { (!itemName ? (p ? choice : name) : category).focus(); toast('Укажи название и зону'); return; }
        if (basket.some(item => normalized(item.name) === normalized(itemName) && (item.replacesId || '') === replaces.value)) {
          toast('Такая покупка уже есть в корзине'); return;
        }
        basket.push({ id: 'b-' + Date.now(), name: itemName, brand: p?.brand || '',
          category: p?.category || category.value, replacesId: replaces.value, status: 'В планах',
          note: note.value.trim(), sourceProductId: p?.id || null, source: mode.value,
          inci: confirmedInci(p) ? p.inci : '', inciVerified: confirmedInci(p) });
        write('basket', basket); closeModal(); renderBasket(); toast('Добавлено в корзину');
      }, 'primary')]);
    };
    const scanSave = $('#saveScannedProduct');
    if (scanSave && !$('#saveScannedToBasket')) {
      const add = button('Добавить распознанное в корзину', () => {
        const name = $('#scanProductName')?.value.trim();
        const category = $('#scanProductCategory')?.value;
        if (!name || !category) { (!name ? $('#scanProductName') : $('#scanProductCategory'))?.focus(); toast('Проверь название и зону'); return; }
        if (basket.some(item => normalized(item.name) === normalized(name))) { toast('Такая покупка уже есть в корзине'); return; }
        basket.push({ id: 'b-' + Date.now(), name, category, status: 'В планах',
          note: 'Добавлено после распознавания. Название проверено пользователем.', source: 'ocr' });
        write('basket', basket); sessionStorage.removeItem('moyuhod:basket-scan'); renderAll(); go('basket');
        toast('Добавлено в корзину');
      });
      add.id = 'saveScannedToBasket'; scanSave.after(add);
    }
  }
  function installButtons() {
    if (!personal && !$('#careProfileButton')) {
      const control = button('Мой профиль', openPreferences, 'secondary');
      control.id = 'careProfileButton'; $('.top')?.append(control);
    }
    const homeHead = $('#view-home .section-head');
    if (homeHead && !$('#careStepMode')) {
      const control = button('Шаг за шагом', startStepMode, 'secondary');
      control.id = 'careStepMode'; homeHead.append(control);
    }
    const productHead = $('#view-products .section-head');
    if (productHead && !$('#careIngredients')) {
      const control = button('Мои ингредиенты', openPreferences, 'secondary');
      control.id = 'careIngredients'; productHead.append(control);
    }
  }
  installButtons();
  renderAll();
  window.CareFeatures = { confirmedInci, groupsFor, expiry, expiryText, preferenceMatches, openReaction, openPreferences, audit, showAudit };
})();
