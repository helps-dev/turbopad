/* Workspace navigation and command search. */
(() => {
  const sidebar = document.querySelector('.sidebar');
  sidebar.id = 'workspaceSidebar';
  const header = document.querySelector('header');
  const source = document.querySelector('#source');
  const chainIcons = {
    'All chains': '<circle cx="8" cy="8" r="4"/><circle cx="24" cy="8" r="4"/><circle cx="8" cy="24" r="4"/><circle cx="24" cy="24" r="4"/>',
    Solana: '<path fill="#75e5c2" d="M8 6h20l-4 5H4z"/><path fill="#b293f5" d="M4 14h20l4 5H8z"/><path fill="#75e5c2" d="M8 22h20l-4 5H4z"/>',
    Base: '<circle fill="#0052ff" cx="16" cy="16" r="14"/><path stroke="white" stroke-width="3" d="M2 16h22"/>',
    Ethereum: '<path fill="#b6b9e7" d="m16 2 9 15-9 5-9-5z"/><path fill="#777eae" d="m16 24 9-5-9 11-9-11z"/>',
    'BNB Chain': '<path fill="#f0b90b" d="m16 2 7 7-4 4-3-3-3 3-4-4zm-9 9 5 5-5 5-5-5zm18 0 5 5-5 5-5-5zm-9 11 3-3 4 4-7 7-7-7 4-4zm0-10 4 4-4 4-4-4z"/>',
    Robinhood: '<path fill="#b5e852" d="M6 28c2-8 5-15 12-20L28 3l-2 9-6 2 5 1-5 6-6-1 3 3-7 3-2 4z"/>',
    RWA: '<path fill="none" stroke="currentColor" stroke-width="2" d="m4 10 12-7 12 7M6 12v13m7-13v13m6-13v13m7-13v13M3 28h26"/>',
  };
  const chainFilter = document.createElement('div'); chainFilter.className = 'chain-filter';
  const chainTrigger = document.createElement('button'); chainTrigger.type = 'button'; chainTrigger.className = 'chain-trigger';
  chainTrigger.setAttribute('aria-haspopup', 'true'); chainTrigger.setAttribute('aria-expanded', 'false');
  const chainMenu = document.createElement('div'); chainMenu.className = 'chain-menu'; chainMenu.hidden = true;
  chainMenu.id = 'chain-options'; chainTrigger.setAttribute('aria-controls', chainMenu.id);
  const officialChainAssets = { Solana: 'solana', Base: 'base', Ethereum: 'ethereum', 'BNB Chain': 'bnb' };
  function chainLabel(name) {
    const asset = officialChainAssets[name];
    const icon = asset ? `<img src="chains/${asset}.svg" alt="" width="20" height="20">`
      : name === 'Robinhood' ? '<span class="chain-logo-pending" aria-hidden="true"></span>'
      : `<svg viewBox="0 0 32 32" aria-hidden="true">${chainIcons[name]}</svg>`;
    return `${icon}<span>${name === 'Robinhood' ? 'Robinhood Chain' : name}</span>`;
  }
  function closeChains() { chainMenu.hidden = true; chainTrigger.setAttribute('aria-expanded', 'false'); }
  function paintChains() {
    chainTrigger.innerHTML = chainLabel(source.value) + '<span aria-hidden="true">⌄</span>';
    chainTrigger.setAttribute('aria-label', `Filter chain: ${source.value}`);
    chainMenu.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.chain === source.value)));
  }
  Array.from(source.options).forEach(option => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.chain = option.value;
    button.innerHTML = chainLabel(option.value); button.onclick = () => {
      source.value = option.value; source.dispatchEvent(new Event('change', {bubbles:true})); paintChains(); closeChains(); chainTrigger.focus();
    }; chainMenu.append(button);
  });
  chainTrigger.onclick = () => { chainMenu.hidden = !chainMenu.hidden; chainTrigger.setAttribute('aria-expanded', String(!chainMenu.hidden)); if (!chainMenu.hidden) chainMenu.querySelector('button').focus(); };
  chainMenu.addEventListener('keydown', event => {
    const buttons = Array.from(chainMenu.querySelectorAll('button')); const index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus(); }
  });
  document.addEventListener('click', event => { if (!chainFilter.contains(event.target)) closeChains(); });
  chainFilter.addEventListener('keydown', event => { if (event.key === 'Escape') { closeChains(); chainTrigger.focus(); } });
  source.hidden = true; source.after(chainFilter); chainFilter.append(chainTrigger, chainMenu); paintChains();
  document.addEventListener('turbopad:render', paintChains);
  const promo = document.querySelector('.launch-promo');
  promo.innerHTML = '<span class="eyebrow">CREATE ON ROBINHOOD</span><h3>Launch a token</h3><p>A fixed-supply token, owned by your wallet.</p><button class="lime" type="button" data-launch>Create token <span aria-hidden="true">↗</span></button>';
  const badge = document.querySelector('.live-badge');
  badge.setAttribute('role', 'status');
  function paintMarketStatus() {
    const state = window.TurboPad?.state;
    const label = state?.loading ? 'Updating markets' : state?.error ? 'Markets unavailable' : state?.updatedAt ? 'Markets updated' : 'Connecting';
    badge.replaceChildren();
    const dot = document.createElement('i'); dot.className = 'live-dot';
    const text = document.createElement('span'); text.textContent = label;
    badge.append(dot, text);
    badge.dataset.status = state?.error ? 'error' : state?.updatedAt ? 'ready' : 'loading';
    badge.title = state?.updatedAt ? `Last updated ${state.updatedAt.toLocaleTimeString()}` : label;
  }
  document.addEventListener('turbopad:render', paintMarketStatus);
  paintMarketStatus();
  const toggle = document.createElement('button');
  toggle.className = 'sidebar-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', sidebar.id);
  toggle.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>';
  header.prepend(toggle);
  let hidden = matchMedia('(max-width:720px)').matches;
  const backdrop = document.createElement('button');
  backdrop.className = 'sidebar-backdrop'; backdrop.type = 'button'; backdrop.setAttribute('aria-label', 'Close sidebar');
  document.body.append(backdrop);
  backdrop.onclick = () => { hidden = true; paintSidebar(); toggle.focus(); };
  try { hidden = hidden || localStorage.getItem('turbopad.sidebar.hidden') === 'true'; } catch {}
  function paintSidebar() {
    document.body.classList.toggle('sidebar-hidden', hidden);
    sidebar.inert = hidden;
    toggle.setAttribute('aria-expanded', String(!hidden));
    toggle.setAttribute('aria-label', hidden ? 'Show sidebar' : 'Hide sidebar');
  }
  toggle.onclick = () => {
    hidden = !hidden;
    try { localStorage.setItem('turbopad.sidebar.hidden', String(hidden)); } catch {}
    paintSidebar();
  };
  paintSidebar();
  document.querySelector('#nav').addEventListener('click', event => {
    if (event.target.closest('button') && matchMedia('(max-width:720px)').matches) { hidden = true; paintSidebar(); toggle.focus(); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !hidden && matchMedia('(max-width:720px)').matches) { hidden = true; paintSidebar(); toggle.focus(); }
  });
  const trigger = document.createElement('button');
  trigger.className = 'command-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-label', 'Search markets and pages');
  trigger.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><span>Search tokens, markets…</span><kbd>⌘ K</kbd>';
  header.insertBefore(trigger, header.querySelector('.header-right'));
  const palette = document.createElement('dialog');
  palette.className = 'command-palette';
  palette.setAttribute('aria-label', 'Search TurboPad');
  palette.innerHTML = '<div class="command-input"><input type="search" placeholder="Search tokens, tickers or pages…" aria-label="Search TurboPad" autocomplete="off"><button type="button" aria-label="Close search">Esc</button></div><div class="command-results" role="listbox" aria-label="Search results"></div><footer>↑ ↓ to move · Enter to open · Esc to close</footer>';
  document.body.append(palette);
  const input = palette.querySelector('input');
  const results = palette.querySelector('.command-results');
  let selected = 0, choices = [];
  const views = Array.from(document.querySelectorAll('#nav [data-view]'), button => button.dataset.view);
  function render() {
    const query = input.value.trim().toLowerCase();
    const markets = window.TurboPad?.markets || [];
    choices = query ? markets.filter(m => `${m.name} ${m.symbol} ${m.source}`.toLowerCase().includes(query)).slice(0, 8).map(m => ({label: m.name, note: `${m.symbol} · ${m.source}`, id: m.id})) : [];
    choices.push(...views.filter(v => !query || v.toLowerCase().includes(query)).map(v => ({label:v, note:'Workspace', view:v})));
    selected = Math.min(selected, Math.max(choices.length - 1, 0));
    results.replaceChildren();
    choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === selected));
      button.id = `command-choice-${index}`;
      const title = document.createElement('span'); title.textContent = choice.label;
      const note = document.createElement('small'); note.textContent = choice.note;
      button.append(title, note);
      button.onclick = () => choose(index);
      results.append(button);
    });
    if (!choices.length) results.textContent = 'No matches in loaded markets. Try a different ticker.';
    if (choices.length) input.setAttribute('aria-activedescendant', `command-choice-${selected}`);
    else input.removeAttribute('aria-activedescendant');
  }
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  results.id = 'command-results';
  input.setAttribute('aria-controls', results.id);
  function choose(index) {
    const choice = choices[index]; if (!choice) return;
    palette.close();
    if (choice.view) window.TurboPad.setView(choice.view);
    else window.TurboPad.detail(choice.id);
  }
  function open() { input.value = ''; selected = 0; render(); if (!palette.open) palette.showModal(); input.focus(); }
  trigger.onclick = open;
  palette.querySelector('button').onclick = () => palette.close();
  palette.addEventListener('click', event => { if (event.target === palette) palette.close(); });
  palette.addEventListener('close', () => trigger.focus());
  input.oninput = () => { selected = 0; render(); };
  input.onkeydown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % (choices.length || 1); render();
    }
    if (event.key === 'Enter') { event.preventDefault(); choose(selected); }
  };
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
  });
  document.addEventListener('turbopad:render', () => { if (palette.open) render(); });
  document.querySelectorAll('#nav button').forEach(button => button.setAttribute('aria-label', button.dataset.view));
})();
