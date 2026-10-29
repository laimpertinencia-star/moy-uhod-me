(() => {
  const PREFIX = document.documentElement.dataset.storagePrefix || 'moyuhod';
  const KEY = `${PREFIX}:consentRecord`;
  const VERSION = '3.0';
  const LEGAL_BASE = document.documentElement.dataset.legalBase || './';
  const style = document.createElement('style');
  style.textContent = `.modal-backdrop{z-index:9999!important}.consent-onboarding{display:grid;gap:12px;max-height:min(68vh,620px);overflow:auto;padding:2px}.consent-onboarding>p{margin:0;line-height:1.5}.consent-onboarding a,.consent-settings-link{color:var(--purple);font-weight:600}.consent-row{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface,#fff);line-height:1.45;cursor:pointer}.consent-row input{flex:0 0 18px;width:18px;height:18px;margin:2px 0 0;accent-color:var(--purple)}.modal-actions button:disabled{opacity:.45;cursor:not-allowed}.consent-settings-link{border:0;background:transparent;padding:0;font:inherit;cursor:pointer}`;
  document.head.append(style);
  const read = key => { try { return JSON.parse(localStorage.getItem(`${PREFIX}:${key}`) || 'null'); } catch { return null; } };
  const write = (key, value) => localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
  const safeLink = (text, href) => {
    const link = document.createElement('a'); link.textContent = text; link.href = href;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
  };
  const row = (labelText, checked = false, required = false) => {
    const label = document.createElement('label'); label.className = 'consent-row';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked;
    input.required = required; label.append(input, document.createTextNode(labelText)); return { label, input };
  };
  const setInert = value => {
    const app = document.querySelector('.app');
    if (app) app.inert = value;
  };
  const open = ({ firstRun = false } = {}) => {
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) return;
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    const actions = document.getElementById('modalActions');
    const oldPrivacy = read('privacy') || {};
    const oldAssistant = read('assistantConsent') || {};
    const oldRecord = read('consentRecord') || {};
    const body = document.createElement('div'); body.className = 'consent-onboarding';
    const intro = document.createElement('p');
    const personal = document.documentElement.dataset.appMode === 'personal';
    const cloudEnabled = personal && document.documentElement.dataset.cloud !== 'off';
    intro.textContent = personal
      ? cloudEnabled
        ? 'Косметичка, расписание, дневник и отметки сохраняются в браузере и могут синхронизироваться через защищённое облако личной версии. Фото карточек также передаются в облако для синхронизации и не отправляются помощнику.'
        : 'Данные хранятся в этом браузере. Чтобы перенести их на другое устройство, сохрани резервную копию и восстанови её там. Фото карточек не отправляются помощнику.'
      : 'Косметичка, расписание, дневник и отметки сохраняются только в хранилище браузера на этом устройстве. Синхронизации между устройствами нет. Фото продукта не отправляются помощнику.';
    const policy = document.createElement('p');
    policy.append(safeLink('Согласие на обработку', `${LEGAL_BASE}consent.html`), document.createTextNode(' · '), safeLink('Политика обработки данных', `${LEGAL_BASE}privacy.html`), document.createTextNode(' · '), safeLink('Правила тестового приложения', `${LEGAL_BASE}terms.html`));
    const local = row('Подтверждаю ознакомление с уведомлением и даю согласие на обработку данных, добавляемых в приложение для хранения косметички, рутины и заметок на этом устройстве.', !!oldRecord.localStorage, true);
    const cloud = row('Для личной версии: разрешаю хранить и синхронизировать список средств, корзину будущих покупок, рутину, отметки, дневник и фотографии карточек в закрытом облаке, чтобы пользоваться ими на моих устройствах. Ответы анкеты и история помощника не синхронизируются.', !!oldRecord.cloudSync);
    const external = row('Разрешаю отправлять текст моего отдельного вопроса через сервер приложения в OpenAI для ответа с веб-поиском. Каждый вопрос будет подтверждаться отдельно.', !!oldAssistant.external);
    const context = row('Разрешаю добавлять к вопросу только подходящие данные из моей косметички и рутины. Без этой отметки отправляется только текст вопроса.', !!oldAssistant.context);
    const note = document.createElement('p'); note.className = 'privacy-note';
    note.textContent = 'Два последних согласия необязательны и по умолчанию выключены. Их можно отозвать в настройках помощника. Не вводи медицинские документы, адрес, телефон и другие данные, которые не нужны для ухода.';
    const warning = document.createElement('p'); warning.className = 'privacy-note';
    warning.textContent = 'Перед публичным тестированием оператору нужно заполнить реквизиты и контактные данные в политике. Не вводи данные до заполнения помеченных полей.';
    if (personal) body.append(intro, policy, local.label, ...(cloudEnabled ? [cloud.label] : []), external.label, context.label, note, warning);
    else body.append(intro, policy, local.label, external.label, context.label, note, warning);
    title.textContent = firstRun ? 'Перед началом' : 'Согласия и приватность';
    content.replaceChildren(body);
    const save = document.createElement('button'); save.type = 'button'; save.className = 'primary'; save.textContent = 'Сохранить выбор'; save.disabled = !local.input.checked;
    const close = document.createElement('button'); close.type = 'button'; close.className = 'secondary'; close.textContent = firstRun ? 'Выйти' : 'Закрыть';
    const clearData = document.createElement('button'); clearData.type = 'button'; clearData.className = 'icon-btn'; clearData.textContent = 'Удалить мои данные и отозвать согласие'; clearData.hidden = firstRun || document.documentElement.dataset.appMode !== 'friends';
    clearData.addEventListener('click', () => {
      if (!window.confirm('Удалить косметичку, рутину, отметки, корзину и дневник из этого браузера? Это действие нельзя отменить.')) return;
      for (const key of Object.keys(localStorage)) if (key.startsWith(`${PREFIX}:`)) localStorage.removeItem(key);
      window.location.reload();
    });
    local.input.addEventListener('change', () => { save.disabled = !local.input.checked; });
    close.addEventListener('click', () => {
      if (close.dataset.refusal === '1') { open({ firstRun: true }); return; }
      if (firstRun && !read('consentRecord')?.localStorage) {
        title.textContent = 'Без согласия приложение не запустится';
        content.replaceChildren(document.createTextNode('Данные остаются на этом устройстве, но приложение использует хранилище браузера для сохранения изменений. Можно закрыть вкладку или вернуться и выбрать согласие.'));
        close.textContent = 'Вернуться к выбору'; close.dataset.refusal = '1';
        save.hidden = true; return;
      }
      backdrop.classList.remove('open'); delete backdrop.dataset.consentModal; setInert(false);
    });
    save.addEventListener('click', () => {
      if (!local.input.checked) return;
      const now = new Date().toISOString();
      const previous = read('consentRecord') || {};
      write('consentRecord', { localStorage: true, cloudSync: cloudEnabled && cloud.input.checked, noticeVersion: VERSION, acceptedAt: previous.acceptedAt || now, updatedAt: now });
      write('privacy-intro-v1', '1');
      write('assistantConsent', { external: external.input.checked, context: external.input.checked && context.input.checked, noticeVersion: VERSION, updatedAt: now });
      const privacy = read('privacy') || {};
      write('privacy', { ...privacy, localStorageConsent: true, aiConsent: external.input.checked, healthConsent: external.input.checked && context.input.checked, updatedAt: now, noticeVersion: VERSION });
      backdrop.classList.remove('open'); delete backdrop.dataset.consentModal; setInert(false);
      document.dispatchEvent(new CustomEvent('moyuhod:consent-updated'));
    });
    actions.replaceChildren(clearData, close, save);
    backdrop.dataset.consentModal = '1'; backdrop.classList.add('open');
    setInert(true);
    close.focus();
  };

  document.addEventListener('DOMContentLoaded', () => {
    const previous = read('consentRecord') || {};
    if (document.documentElement.dataset.appMode === 'personal' && document.documentElement.dataset.cloud === 'off' && previous.cloudSync) {
      write('consentRecord', { ...previous, cloudSync: false });
    }
    const firstRun = !previous.localStorage;
    if (firstRun) open({ firstRun: true });
    else if (document.documentElement.dataset.appMode === 'personal' && previous.noticeVersion !== VERSION) open({ firstRun: false });
    window.MoyUhodConsent = { open: () => open({ firstRun: false }) };
    const settings = document.createElement('button');
    settings.type = 'button'; settings.className = 'consent-settings-link'; settings.textContent = 'Согласия и данные';
    settings.addEventListener('click', () => open({ firstRun: false }));
    const footer = document.querySelector('.footer');
    if (footer) { footer.append(document.createTextNode(' · '), safeLink('Согласия', `${LEGAL_BASE}consent.html`), document.createTextNode(' · '), safeLink('Политика данных', `${LEGAL_BASE}privacy.html`), document.createTextNode(' · '), settings); }
    document.addEventListener('keydown', event => {
      if (backdropOpen() && event.key === 'Escape') {
        if (!read('consentRecord')?.localStorage) { event.preventDefault(); event.stopImmediatePropagation(); }
        else delete document.getElementById('modalBackdrop').dataset.consentModal;
      }
    }, true);
    document.getElementById('modalBackdrop')?.addEventListener('click', event => {
      if (event.target.id === 'modalBackdrop' && !read('consentRecord')?.localStorage) event.stopImmediatePropagation();
      else if (event.target.id === 'modalBackdrop') { const backdrop = event.currentTarget; queueMicrotask(() => { if (!backdrop.classList.contains('open')) delete backdrop.dataset.consentModal; }); }
    }, true);
  });
  function backdropOpen() { return document.getElementById('modalBackdrop')?.classList.contains('open') && document.getElementById('modalBackdrop')?.dataset.consentModal === '1'; }
})();
