/* Contextual advice from the user's own library. No remote calls or invented products. */
(() => {
  const source = {
    order: 'https://www.aad.org/public/everyday-care/skin-care-basics/care/apply-skin-care-certain-order',
    dry: 'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    test: 'https://www.aad.org/public/everyday-care/skin-care-secrets/prevent-skin-problems/test-skin-care-products/',
    retinoid: 'https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/retinoid-retinol/',
  };
  const available = new Set(['Использую', 'Куплено', 'Заканчивается']);
  const norm = value => String(value || '').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const roleOf = product => {
    if (product.role && product.role !== 'other') return product.role;
    const label = norm(`${product.name} ${product.kind || ''}`);
    if (/крем|cream|лосьон|lotion|увлажняющ/.test(label)) return 'moisturizer';
    if (/сыворот|serum|бустер|booster|ампул/.test(label)) return 'serum';
    if (/шампун|shampoo/.test(label)) return 'shampoo';
    if (/очищ|cleanser|умыван/.test(label)) return 'cleanser';
    return 'other';
  };
  const isActive = product => /retinol|retinal|ретинол|ретиналь|\b(?:aha|bha|pha)\b|кислот|пилинг|peeling|exfoliat|foreo|\bbear\b/i.test(
    `${product.name || ''} ${product.kind || ''} ${product.inciVerified ? product.inci || '' : ''}`);
  const verifiedInci = product => product.inciVerified === true && !!String(product.inci || '').trim();
  const preferred = profile => profile?.ingredientPreferences || { loved: [], avoided: [] };
  const listPref = input => Array.isArray(input) ? input.map(norm).filter(Boolean) : [];
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const stepProduct = (step, products) => products.find(product => product.id === step.productId);
  const namedProduct = (query, products) => products
    .filter(product => norm(product.name).length > 5 && norm(query).includes(norm(product.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  const identifiableProduct = (query, products) => {
    const exact = namedProduct(query, products);
    if (exact) return exact;
    const words = norm(query).split(' ').filter(word => word.length > 3 && !/^(найди|замену|заменить|средство|подбери|похожий|похожую)$/.test(word));
    const scores = products.map(product => ({ product, score: words.reduce((count, word) => count + (norm(product.name).split(' ').includes(word) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
    return scores[0]?.score > 0 && scores[0].score > (scores[1]?.score ?? 0) ? scores[0].product : null;
  };
  const missing = product => !verifiedInci(product) ? 'состав не подтверждён' : 'состав внесён и подтверждён пользователем';
  const productLine = product => `${product.name} (${product.status || 'статус не указан'}; ${missing(product)})`;
  const profileLine = profile => {
    const facts = [];
    if (profile?.skin) facts.push(`тип кожи: ${profile.skin}`);
    if (profile?.goals) facts.push(`цель: ${profile.goals}`);
    if (profile?.sensitivities) facts.push(`отмеченные реакции/ограничения: ${profile.sensitivities}`);
    return facts.length ? facts.join('; ') : 'профиль ухода пока не заполнен';
  };
  const compareCreams = (query, ctx) => {
    const candidates = ctx.products.filter(product => product.category === 'face' && roleOf(product) === 'moisturizer' && product.status !== 'Архив');
    const basketCreams = ctx.basket.filter(item => item.category === 'face' && roleOf(item) === 'moisturizer');
    if (!candidates.length && !basketCreams.length) return 'В косметичке и корзине пока нет кремов для лица. Добавь названия рассматриваемых средств и их составы: тогда можно сравнить их по твоей цели и отмеченным ограничениям. Я не стану придумывать товар для покупки.';
    const named = namedProduct(query, candidates);
    const shortlist = named ? [named, ...candidates.filter(product => product.id !== named.id)] : candidates;
    const profile = ctx.profile || {};
    const avoided = listPref(preferred(profile).avoided);
    const sensitive = /sensitive|чувств|реактив|раздраж/i.test(`${profile.skin || ''} ${profile.sensitivities || ''}`);
    const dry = /dry|сух/i.test(`${profile.skin || ''} ${profile.goals || ''}`);
    const lines = shortlist.slice(0, 6).map(product => {
      const notes = [];
      const inci = norm(product.inci);
      const kind = norm(`${product.name} ${product.kind || ''}`);
      if (verifiedInci(product)) {
        const conflicts = avoided.filter(word => inci.includes(word));
        if (conflicts.length) notes.push(`есть компонент из твоего списка «избегать»: ${conflicts.join(', ')}`);
        if (sensitive && /\bparfum\b|\bfragrance\b/.test(inci)) notes.push('в подтверждённом INCI есть parfum/fragrance');
      }
      if (sensitive && /без отдуш|fragrance free/.test(kind)) notes.push('на карточке указано «без отдушки»');
      if (dry && /\bcream\b|\bкрем\b/.test(kind)) notes.push('формат крема может быть удобнее при сухости; ощущения индивидуальны');
      return `• ${productLine(product)}${notes.length ? ' — ' + notes.join('; ') : ''}`;
    });
    const gaps = [];
    if (!profile.skin && !profile.goals) gaps.push('тип кожи и цель ухода');
    if (shortlist.some(product => !verifiedInci(product))) gaps.push('полный INCI рассматриваемых кремов');
    if (basketCreams.length) lines.push(`Кандидаты в корзине: ${basketCreams.slice(0, 4).map(item => item.name).join(', ')}. Покупка не считается подтверждённой.`);
    const conclusion = shortlist.length === 1
      ? 'Сейчас есть только один крем для сравнения; назвать его лучшим без альтернативы нельзя.'
      : 'По названию и статусу нельзя честно выбрать «лучший». Сначала исключи отмеченные нежелательные компоненты, затем сравни подтверждённые составы и личную переносимость.';
    return `Сравниваю твои варианты, а не весь рынок. ${profileLine(profile)}.\n${lines.join('\n')}\n\n${conclusion}${gaps.length ? ` Для более точного ответа добавь: ${gaps.join('; ')}.` : ''}\nПри сухой или чувствительной коже дерматологи советуют ориентироваться на мягкий уход и маркировку без отдушки; новый продукт стоит проверять на переносимость. Источники: ${source.dry} ${source.test}`;
  };
  const replaceSerum = (query, ctx) => {
    const serums = ctx.products.filter(product => product.category === 'face' && roleOf(product) === 'serum' && product.status !== 'Архив');
    const current = namedProduct(query, serums) || (serums.filter(product => available.has(product.status)).length === 1 ? serums.find(product => available.has(product.status)) : null);
    if (!current) return serums.length
      ? `Укажи, какую сыворотку заменяем: ${serums.slice(0, 7).map(product => product.name).join('; ')}. В библиотеке их несколько, а замена зависит от цели и переносимости.`
      : 'В библиотеке пока нет сыворотки, которую можно определить как текущую. Добавь её название, цель использования и состав с упаковки.';
    const planned = ctx.basket.filter(item => item.replacesId === current.id || (item.category === 'face' && roleOf(item) === 'serum'));
    const existing = serums.filter(product => product.id !== current.id && available.has(product.status));
    const candidates = [...planned.map(item => ({ ...item, status: item.status || 'В планах' })), ...existing];
    if (!candidates.length) return `Текущая сыворотка: ${productLine(current)}. Подтверждённой замены в косметичке или корзине пока нет. Добавь один-два кандидата, их INCI и свою цель ухода; я сравню их без выдуманной покупки.`;
    const notes = candidates.slice(0, 6).map(product => {
      const direct = product.replacesId === current.id ? 'в корзине отмечена как замена' : 'средство той же категории';
      const caution = isActive(product) || isActive(current) ? '; это активный уход, частоту нельзя переносить автоматически' : '';
      return `• ${productLine(product)} — ${direct}${caution}`;
    });
    return `Заменяем: ${productLine(current)}. ${profileLine(ctx.profile)}.\nКандидаты из твоих данных:\n${notes.join('\n')}\n\nЗамена не означает одинаковое действие: проверь цель, полный состав, инструкцию и переносимость. Я не добавляю кандидата в ежедневный план до твоего выбора.${isActive(current) ? ` Для ретиноидов особенно важна инструкция и переносимость. Источник: ${source.retinoid}` : ''}`;
  };
  const productGroups = [
    [/румян|blush/i, /румян|blush/i, 'blush'],
    [/сыворот|serum|бустер/i, /сыворот|serum|бустер|ампул/i, 'serum'],
    [/bb.?крем|bb.?cream/i, /bb.?крем|bb.?cr[eè]me|bb.?cream/i, 'bb cream'],
    [/консилер|concealer/i, /консилер|concealer/i, 'concealer'],
    [/крем|cream|лосьон|lotion/i, /крем|cream|лосьон|lotion/i, 'cream'],
    [/шампун|shampoo/i, /шампун|shampoo/i, 'shampoo'],
    [/тонер|тоник|toner/i, /тонер|тоник|toner/i, 'toner'],
    [/маск|mask/i, /маск|mask/i, 'mask'],
    [/тушь|mascara/i, /тушь|mascara/i, 'mascara'],
    [/помад|lipstick/i, /помад|lipstick/i, 'lipstick'],
    [/spf|солнцезащ/i, /spf|солнцезащ/i, 'sunscreen'],
    [/гель|gel/i, /гель|gel/i, 'gel'],
    [/пилинг|peeling|скраб/i, /пилинг|peeling|скраб/i, 'peeling'],
    [/дезодорант|deodorant/i, /дезодорант|deodorant/i, 'deodorant'],
    [/прибор|foreo|bear/i, /прибор|foreo|bear/i, 'device'],
    [/витамин|добавк|коллаген/i, /витамин|добавк|коллаген/i, 'supplement'],
  ];
  const catalogQuery = (query, ctx) => {
    if (!/замен|вместо|аналог|подоб|похож/i.test(query) && !(ctx.history||[]).some(item=>item.role==='user'&&/замен|вместо|аналог/i.test(item.text||''))) return '';
    const recent = (ctx.history||[]).filter(item=>item.role==='user').slice(-5).reverse().map(item=>item.text||'');
    const focus = [query,...recent].find(text=>productGroups.some(([pattern])=>pattern.test(text)))||query;
    const group = productGroups.find(([pattern])=>pattern.test(focus));
    if (group && !['device','supplement'].includes(group[2])) return group[2];
    const named = identifiableProduct(focus,ctx.products||[]);
    if (!named) return '';
    const matched = productGroups.find(([,pattern,term])=>!['device','supplement'].includes(term)&&pattern.test(`${named.name} ${named.kind||''}`));
    return matched?.[2] || {moisturizer:'cream',serum:'serum',cleanser:'cleanser',shampoo:'shampoo'}[roleOf(named)] || '';
  };
  const replaceProduct = (query, ctx) => {
    const active = ctx.products.filter(product => available.has(product.status));
    const history = (ctx.history || []).filter(item => item.role === 'user').map(item => item.text || '');
    const earlier = history.length > 1 ? history.slice(0, -1).reverse() : [];
    const focus = [query, ...earlier].find(value => productGroups.some(([pattern]) => pattern.test(value)) || namedProduct(value, active)) || query;
    const named = identifiableProduct(focus, active);
    const group = productGroups.find(([pattern]) => pattern.test(focus));
    const matched = named ? [named] : group ? active.filter(product => group[1].test(`${product.name} ${product.kind || ''}`)) : [];
    if (!matched.length) return `В библиотеке этого браузера я не нашла средство, которое можно уверенно определить по запросу «${query.trim().slice(0, 90)}». Назови его или добавь карточку; профиль и покупки с другого телефона здесь появятся только после переноса данных.`;
    if (matched.length > 1) return `В библиотеке несколько подходящих средств: ${matched.slice(0, 8).map(product => product.name).join('; ')}. Укажи, какое именно заменяем, и я сравню его с имеющимися вариантами и корзиной.`;
    const current = matched[0];
    const planned = ctx.basket.filter(item => item.replacesId === current.id || (item.category === current.category && group?.[1].test(`${item.name} ${item.kind || ''}`)));
    const shade = current.shade || /оттенок\s*(?:№|#)?\s*([\p{L}\p{N}-]+)/iu.exec(current.kind || '')?.[1];
    const knownShade = shade && !/^не$/i.test(shade) ? shade : null;
    const colorQuestion = /цвет|оттенок|такой же|близкий|похож/i.test(query);
    const need = colorQuestion || /румян|blush|консилер|bb.?крем/i.test(`${current.name} ${current.kind || ''}`)
      ? knownShade ? `В карточке указан оттенок ${knownShade}; совпадение с другим средством нужно сверить по номеру или свотчу.` : 'В карточке нет точного оттенка. Для близкой по цвету замены добавь номер оттенка или свотч при дневном свете.'
      : 'Для точной замены укажи, какую задачу должно выполнять новое средство, и проверь его состав и инструкцию.';
    const options = planned.length ? `В корзине есть варианты: ${planned.slice(0, 5).map(item => item.name).join(', ')}. Их ещё нужно сравнить; покупка не подтверждена.` : 'В корзине пока нет подтверждённого варианта на замену.';
    return `Сейчас у тебя ${productLine(current)}.${current.reactionPause?.active?' После отметки о реакции средство временно убрано из плана.':''} ${options} ${need} Я не стану придумывать товар или обещать одинаковый результат без данных о конкретном кандидате.`;
  };
  const reactionAdvice = ctx => {
    const paused = ctx.products.filter(product => product.reactionPause?.active);
    if (!paused.length) return 'В этом браузере нет средств, приостановленных после реакции. Добавь наблюдение через кнопку «Реакция» у конкретного продукта в рутине или карточке; тогда ближайший план обновится. Наблюдение само по себе не устанавливает причину симптомов.';
    return `В плане сейчас приостановлены: ${paused.map(product=>product.name).join(', ')}. При раздражении активные процедуры той же зоны также временно скрыты. Проверь журнал применения и инструкцию; запись не доказывает, какое средство вызвало реакцию. Если симптомы выражены или сохраняются, обратись к медицинскому специалисту. Источник: ${source.test}`;
  };
  const todayRoutine = ctx => {
    const date = ctx.date || new Date();
    const day = date.getDay();
    const paused = new Set(ctx.products.filter(product => product.reactionPause?.active).map(product => product.id));
    const heldZones = new Set(ctx.products.filter(product => product.reactionPause?.active && ['irritation','stopped'].includes(product.reactionPause.level)).map(product => ['makeup','devices'].includes(product.category)?'face':product.category));
    const today = ctx.steps.filter(step => {const product=stepProduct(step,ctx.products);const zone=['makeup','devices'].includes(step.category)?'face':step.category;return (!step.days?.length || step.days.includes(day)) && (!step.productId || available.has(product?.status)) && !paused.has(step.productId) && !(heldZones.has(zone) && (isActive(product||{}) || /retinol|retinal|ретинол|ретиналь|bha|aha|кислот|пилинг|foreo|микроток/i.test(step.name||'')));});
    if (!today.length) {
      const base = ctx.products.filter(product => available.has(product.status) && ['am', 'pm', 'both'].includes(product.routineTime) && roleOf(product) !== 'other' && !isActive(product));
      if (!base.length) return 'На сегодня ещё нет подтверждённого плана. Добавь свои средства, отметь их тип и время по инструкции. После этого кнопка «Составить план из моей библиотеки» покажет черновик, который ты сможешь исправить.';
      const order = { cleanser: 1, toner: 2, serum: 3, moisturizer: 4, spf: 5, shampoo: 1, conditioner: 2, hair_leavein: 3 };
      const lines = ['am', 'pm'].map(time => {
        const chosen = base.filter(product => product.routineTime === time || product.routineTime === 'both').sort((a, b) => (order[roleOf(a)] || 9) - (order[roleOf(b)] || 9));
        return `${time === 'am' ? 'Утро' : 'Вечер'}: ${chosen.length ? chosen.map(product => product.name).join(' → ') : 'подтверждённых шагов пока нет'}`;
      });
      return `Черновик на сегодня только из твоих имеющихся средств:\n${lines.join('\n')}\nАктивные средства и добавки не назначаю по ежедневному шаблону. Проверь порядок и частоту на упаковке, затем сохрани подходящие шаги. Общий порядок ухода: очищение → уходовое средство → увлажнение/солнцезащита. Источник: ${source.order}`;
    }
    const lines = ['am', 'pm'].map(time => {
      const sequence = today.filter(step => step.time === time);
      return `${time === 'am' ? '☀ Утро' : '☾ Вечер'}\n${sequence.length ? sequence.map((step, index) => `${index + 1}. ${ctx.checks[`${dateKey(date)}:${step.id}`] ? '✓ ' : ''}${step.name}${step.optional ? ' (по желанию)' : ''}`).join('\n') : 'Пока нет шагов.'}`;
    });
    const unscheduled = ctx.products.filter(product => available.has(product.status) && !product.reactionPause?.active && isActive(product) && !today.some(step => step.productId === product.id));
    return `План на ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} из твоей сохранённой рутины:\n${lines.join('\n\n')}${unscheduled.length ? `\n\nАктивные средства без шага сегодня: ${unscheduled.slice(0, 6).map(product => product.name).join(', ')}. Не добавляю их автоматически: сверяй отдельный график и инструкцию.` : ''}\nГалочки в приложении показывают уже выполненное; этот ответ не меняет расписание.`;
  };
  const reply = (query, ctx) => {
    const text = norm(query);
    if (!text) return '';
    if (/реакц|раздраж|покрасн|жжени|сыпь/.test(text)) return reactionAdvice(ctx);
    const recent = (ctx.history || []).filter(item => item.role === 'user').slice(-5).some(item => /замен|вместо|аналог|подоб|похож/i.test(item.text || ''));
    if (/замен|вместо|аналог|подоб|похож/.test(text) || recent && /цвет|оттенок|такой же|близкий|похож|этот|его|ее/.test(text)) return replaceProduct(query, ctx);
    if (/крем|увлажняющ/.test(text) && /подход|лучше|выбрать|сравн|какой/.test(text)) return compareCreams(query, ctx);
    if (/замен|вместо|аналог/.test(text) && /сыворот|serum|бустер/.test(text)) return replaceSerum(query, ctx);
    if (/рутин|план|уход на день|сегодня|утро и вечер|расписание/.test(text)) return todayRoutine(ctx);
    return '';
  };
  window.CareAdvisor = { reply, catalogQuery };

  if (document.documentElement.dataset.appMode !== 'friends') return;
  const assistant = document.getElementById('view-assistant');
  const tabs = assistant?.querySelector('.assistant-tabs');
  if (!tabs) return;
  const panel = document.createElement('div'); panel.className = 'assistant-notice';
  const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = 'Мой профиль для подбора';
  const caption = document.createElement('p'); caption.textContent = 'Для сравнения средств укажи цель ухода и только те реакции, которые знаешь. Данные останутся в браузере этого телефона.';
  panel.append(caption, button); assistant.insertBefore(panel, tabs);
  button.addEventListener('click', () => {
    const prefix = document.documentElement.dataset.storagePrefix || 'moyuhod-friend';
    const key = `${prefix}:profile`;
    let profile = {}; try { profile = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* Start with an empty form. */ }
    const wrap = document.createElement('div'); wrap.className = 'note-form';
    const skin = document.createElement('select');
    [['', 'Не знаю / не указываю'], ['dry', 'Сухая'], ['normal', 'Обычная'], ['oily', 'Жирная'], ['combination', 'Комбинированная'], ['sensitive', 'Чувствительная']].forEach(([value, label]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = label; skin.append(option);
    }); skin.value = profile.skin || '';
    const goals = document.createElement('textarea'); goals.value = profile.goals || ''; goals.placeholder = 'Например: меньше сухости, проще рутина';
    const sensitivities = document.createElement('textarea'); sensitivities.value = profile.sensitivities || ''; sensitivities.placeholder = 'Только известные тебе реакции и ограничения';
    wrap.append(formField('Тип кожи', skin), formField('Цель ухода', goals), formField('Известные реакции и ограничения', sensitivities));
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'secondary'; cancel.textContent = 'Закрыть'; cancel.addEventListener('click', closeModal);
    const save = document.createElement('button'); save.type = 'button'; save.className = 'primary'; save.textContent = 'Сохранить'; save.addEventListener('click', () => {
      localStorage.setItem(key, JSON.stringify({ ...profile, skin: skin.value, goals: goals.value.trim(), sensitivities: sensitivities.value.trim() }));
      closeModal(); toast('Профиль сохранён на этом устройстве');
    });
    openModal('Профиль для подбора', wrap, [cancel, save]);
  });
})();
