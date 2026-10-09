/* GPT Web: an original ChatGPT-inspired shell for SillyTavern 1.19.0. */
// The 1.19.0 context has no current-avatar field; use its verified live export.
import { user_avatar } from '/scripts/personas.js';
import { mountPet, petSkins } from './pet.js';
import { createHistory } from './history.js';
import { mountCharacterPanel } from './character-panel.js';

const root = document.documentElement;
const storageKey = 'gpt-web:settings';
const settings = Object.assign({ enabled: true, theme: 'system', collapsed: false, petEnabled: true, petSkin: 'codex' },
    JSON.parse(localStorage.getItem(storageKey) || '{}'));
const escapeSetting = new URLSearchParams(location.search).get('gptweb');
if (escapeSetting === 'off' || escapeSetting === 'on') {
    settings.enabled = escapeSetting === 'on';
    localStorage.setItem(storageKey, JSON.stringify(settings));
    // ST's base URL and jQuery UI tabs treat query URLs as remote tab pages.
    // Consume our one-shot switch before backgrounds initialize to avoid duplicate host DOM.
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete('gptweb');
    history.replaceState(history.state, '', cleanUrl);
}

const icons = {
    panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
    compose: '<path d="M14 5H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8M13 11l7-7 2 2-7 7-4 1z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
    book: '<path d="M12 6c-3-3-7-3-10-1v15c3-2 7-2 10 1 3-3 7-3 10-1V5c-3-2-7-2-10 1zM12 6v15"/>',
    plug: '<path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
    sliders: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    text: '<path d="M4 5h16M12 5v16M8 21h8"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-7 5 8"/>',
    blocks: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    history: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6M12 7v5l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    chat: '<path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 0 1 1-11 9 9 0 0 1 16 6z"/>',
};
const navigation = [
    ['rightNavHolder', 'users', '角色与群聊'],
    ['WI-SP-button', 'book', '世界书'],
    ['persona-management-button', 'person', '用户设定'],
    ['sys-settings-button', 'plug', '模型连接'],
    ['ai-config-button', 'sliders', '预设与生成参数'],
    ['advanced-formatting-button', 'text', '提示词格式'],
    ['backgrounds-button', 'image', '背景'],
    ['extensions-settings-button', 'blocks', '扩展'],
    ['user-settings-button', 'sliders', '酒馆设置'],
];
let context;
let controller;
let observer;
let frame = 0;
let focusDrawerId = null;
let profileTimer;
let pet;
let recentHistory;
let mounted = false;
let subscriptions = [];
const systemTheme = matchMedia('(prefers-color-scheme: dark)');

function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

function save() {
    localStorage.setItem(storageKey, JSON.stringify(settings));
    applyAppearance();
}

function applyAppearance() {
    root.classList.toggle('gptweb', settings.enabled);
    root.dataset.gptwebTheme = settings.theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : settings.theme;
    root.dataset.gptwebCollapsed = String(settings.collapsed);
    document.querySelector('#gptweb-enabled').checked = settings.enabled;
    document.querySelector('#gptweb-theme').value = settings.theme;
    document.querySelector('#gptweb-pet-enabled').checked = settings.petEnabled;
    document.querySelector('#gptweb-pet-skin').value = settings.petSkin;
    pet.refresh();
    const sidebar = document.querySelector('#gptweb-sidebar');
    sidebar.inert = !settings.enabled || (matchMedia('(max-width: 700px)').matches && root.dataset.gptwebMobile !== 'open');
    document.querySelector('#gptweb-toggle').setAttribute('aria-expanded', String(matchMedia('(max-width: 700px)').matches ? root.dataset.gptwebMobile === 'open' : !settings.collapsed));
}

function closeMobile() {
    root.dataset.gptwebMobile = 'closed';
    applyAppearance();
    resizeViewport();
}

function toggleSidebar() {
    if (matchMedia('(max-width: 700px)').matches) {
        root.dataset.gptwebMobile = root.dataset.gptwebMobile === 'open' ? 'closed' : 'open';
        applyAppearance();
    } else {
        settings.collapsed = !settings.collapsed;
        save();
    }
}

function openDrawer(id) {
    const toggle = document.querySelector(`#${id} > .drawer-toggle`);
    focusDrawerId = toggle.parentElement.querySelector('.drawer-content').classList.contains('openDrawer') ? null : id;
    toggle.click();
    closeMobile();
}

function closeDrawers() {
    const panels = document.querySelectorAll('#top-settings-holder > .drawer > .drawer-content.openDrawer');
    for (const panel of panels) {
        panel.parentElement.querySelector('.drawer-toggle').click();
    }
    focusDrawerId = null;
    if (panels.length) document.querySelector('#gptweb-toggle').focus();
}

function scheduleRefresh() {
    if (!mounted) return;
    if (!frame) frame = requestAnimationFrame(refresh);
}

function resizeViewport() {
    if (matchMedia('(max-width: 700px)').matches) {
        root.style.setProperty('--gptweb-height', `${visualViewport.height}px`);
        root.style.setProperty('--gptweb-top', `${visualViewport.offsetTop}px`);
    } else {
        root.style.removeProperty('--gptweb-height');
        root.style.removeProperty('--gptweb-top');
    }
}

function refreshProfile() {
    const current = SillyTavern.getContext();
    const hour = new Date().getHours();
    const greeting = hour < 5 || hour >= 23 ? '夜深了'
        : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    document.querySelector('#gptweb-greeting').textContent = `${greeting}，${current.name1}。`;
    document.querySelector('#gptweb-profile-name').textContent = current.name1;
    document.querySelector('#gptweb-profile-avatar').src = current.getThumbnailUrl('persona', user_avatar);
    const profileButton = document.querySelector('#gptweb-profile');
    profileButton.title = current.name1;
    profileButton.setAttribute('aria-label', `打开用户设定：${current.name1}`);
}

function refresh() {
    frame = 0;
    refreshProfile();
    const current = SillyTavern.getContext();
    const hasCharacter = current.characterId !== undefined || Boolean(current.groupId);
    const welcome = !hasCharacter && !current.chat.some(message =>
        !message.is_system && message.extra?.type !== 'assistant_message');
    root.dataset.gptwebWelcome = String(welcome);
    document.querySelector('#gptweb-title').textContent = hasCharacter ? current.name2 : 'GPT Web';
    document.querySelector('#gptweb-status').textContent = current.onlineStatus === 'no_connection' ? '连接模型以开始' : 'SillyTavern';

    const panel = document.querySelector('#top-settings-holder > .drawer > .drawer-content.openDrawer');
    root.dataset.gptwebDrawer = String(Boolean(panel));
    document.querySelector('#gptweb-close-drawer').hidden = !panel;
    if (panel && panel.parentElement.id === focusDrawerId) {
        document.querySelector('#gptweb-close-drawer').focus();
        focusDrawerId = null;
    }
    for (const button of document.querySelectorAll('#gptweb-navigation [data-drawer]')) {
        button.setAttribute('aria-expanded', String(Boolean(panel && button.dataset.drawer === panel.parentElement.id)));
    }

    const list = document.querySelector('#gptweb-characters');
    const entries = current.characters.map((character, id) => ({ character, id }))
        .sort((a, b) => Number(b.character.date_last_chat || 0) - Number(a.character.date_last_chat || 0))
        .slice(0, 8);
    const signature = JSON.stringify(entries.map(({ character, id }) => [id, character.name]));
    if (list.dataset.signature !== signature) {
        const focusedId = document.activeElement.closest('#gptweb-characters [data-character]')?.dataset.character;
        list.replaceChildren();
        for (const { character, id } of entries) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'gptweb-row gptweb-character';
            button.dataset.character = String(id);
            button.title = character.name;
            const avatar = document.createElement('span');
            avatar.className = 'gptweb-initial';
            avatar.textContent = character.name.slice(0, 1);
            const label = document.createElement('span');
            label.textContent = character.name;
            button.append(avatar, label);
            list.append(button);
            if (String(id) === focusedId) button.focus();
        }
        list.dataset.signature = signature;
    }
    for (const button of list.children) {
        button.setAttribute('aria-current', String(String(current.characterId) === button.dataset.character));
    }
    document.querySelector('#gptweb-characters-empty').hidden = entries.length > 0;
}

function mount() {
    if (mounted) return;
    mounted = true;
    controller = new AbortController();
    recentHistory = createHistory();
    const options = { signal: controller.signal };
    mountCharacterPanel(controller.signal);
    root.dataset.gptwebMobile = 'closed';

    for (const [id, title] of [['left-nav-panel', '预设与生成参数'], ['right-nav-panel', '角色与群聊']]) {
        const heading = document.createElement('h2');
        heading.className = 'gptweb-panel-heading';
        heading.textContent = title;
        document.getElementById(id).prepend(heading);
    }

    document.body.insertAdjacentHTML('beforeend', `
        <aside id="gptweb-sidebar" aria-label="酒馆导航">
            <div class="gptweb-brand"><span class="gptweb-brand-mark">${icon('chat')}</span><span>GPT Web</span>
                <button type="button" id="gptweb-sidebar-close" class="gptweb-icon-button" title="收起侧栏" aria-label="收起侧栏">${icon('panel')}</button>
            </div>
            <div class="gptweb-sidebar-content">
            <button type="button" id="gptweb-new-chat" class="gptweb-row">${icon('compose')}<span>新对话</span></button>
            <button type="button" id="gptweb-history" class="gptweb-row">${icon('history')}<span>对话记录</span></button>
            <div class="gptweb-section-label">酒馆</div>
            <nav id="gptweb-navigation">${navigation.map(([id, symbol, label]) => `<button type="button" class="gptweb-row" data-drawer="${id}" title="${label}" aria-expanded="false">${icon(symbol)}<span>${label}</span></button>`).join('')}</nav>
            <div class="gptweb-section-label">最近使用的角色</div>
            <div id="gptweb-characters"></div>
            <p id="gptweb-characters-empty">导入一张角色卡，开始你的故事。</p>
            </div>
            <div class="gptweb-sidebar-footer">
                <div class="gptweb-profile-row">
                    <button type="button" id="gptweb-profile" class="gptweb-row">
                        <img id="gptweb-profile-avatar" alt="" width="32" height="32">
                        <span class="gptweb-profile-copy"><span id="gptweb-profile-name"></span><small>用户设定</small></span>
                    </button>
                    <button type="button" id="gptweb-theme-cycle" class="gptweb-icon-button" title="切换浅色或深色" aria-label="切换浅色或深色">${icon('sun')}</button>
                </div>
                <span class="gptweb-footer-note">SillyTavern · GPT Web</span>
            </div>
        </aside>
        <button type="button" id="gptweb-scrim" aria-label="关闭导航"></button>
        <header id="gptweb-topbar">
            <button type="button" id="gptweb-toggle" class="gptweb-icon-button" aria-label="切换侧栏" aria-controls="gptweb-sidebar">${icon('panel')}</button>
            <div class="gptweb-heading"><span id="gptweb-title">GPT Web</span><span id="gptweb-status">SillyTavern</span></div>
            <button type="button" id="gptweb-close-drawer" class="gptweb-icon-button" aria-label="关闭设置面板" title="关闭设置面板" hidden>${icon('close')}</button>
            <button type="button" id="gptweb-top-new" class="gptweb-icon-button" aria-label="新对话" title="新对话">${icon('compose')}</button>
        </header>`);
    document.querySelector('#sheld').insertAdjacentHTML('afterbegin', `
        <section id="gptweb-welcome" aria-label="欢迎">
            <span class="gptweb-welcome-mark">${icon('chat')}</span>
            <p class="gptweb-eyebrow">A SPACE FOR YOUR STORIES</p>
            <h1 id="gptweb-greeting"></h1>
            <p class="gptweb-welcome-description">今天，想进入谁的故事？</p>
            <div class="gptweb-welcome-actions">
                <button type="button" data-drawer="rightNavHolder">${icon('users')}<span>选择角色<small>从一个熟悉的名字开始</small></span></button>
                <button type="button" data-drawer="sys-settings-button">${icon('plug')}<span>连接模型<small>使用你的酒馆 API 设置</small></span></button>
                <button type="button" data-drawer="WI-SP-button">${icon('book')}<span>世界书<small>为故事准备背景与设定</small></span></button>
            </div>
        </section>`);
    document.querySelector('#form_sheld').insertAdjacentHTML('beforeend', '<div id="gptweb-composer-note">GPT Web · 你的角色，你的故事</div>');
    document.querySelector('#extensions_settings2').insertAdjacentHTML('beforeend', `
        <div id="gptweb-settings" class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header"><b>GPT Web</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
            <div class="inline-drawer-content">
                <label class="checkbox_label"><input id="gptweb-enabled" type="checkbox"><span>启用 GPT Web 界面</span></label>
                <label for="gptweb-theme">主题</label><select id="gptweb-theme" class="text_pole"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select>
                <label class="checkbox_label"><input id="gptweb-pet-enabled" type="checkbox"><span>显示 Codex 宠物</span></label>
                <label for="gptweb-pet-skin">宠物皮肤</label>
                <select id="gptweb-pet-skin" class="text_pole">${Object.entries(petSkins).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select>
                <label for="gptweb-pet-upload">上传自定义皮肤</label>
                <input id="gptweb-pet-upload" type="file" accept="image/png,image/webp" class="text_pole">
                <p id="gptweb-pet-custom-name"></p>
                <p>支持 PNG/WebP，最多 20 MB。使用 1536×1872（8×9）或 1536×2288（8×11）图集，每格 192×208。图片保存在当前浏览器，上传后立即换肤。</p>
                <p id="gptweb-pet-status" role="status"></p>
                <p>保留酒馆原生聊天与模型连接。修改立即生效。</p>
            </div>
        </div>`);
    pet = mountPet(settings, options, save);

    for (const container of ['#gptweb-navigation', '#gptweb-welcome']) {
        document.querySelector(container).addEventListener('click', event => {
            const button = event.target.closest('[data-drawer]');
            if (button) openDrawer(button.dataset.drawer);
        }, options);
    }
    document.querySelector('#gptweb-characters').addEventListener('click', async event => {
        const button = event.target.closest('[data-character]');
        if (!button) return;
        await SillyTavern.getContext().selectCharacterById(Number(button.dataset.character), { switchMenu: false });
        closeMobile();
        scheduleRefresh();
    }, options);
    for (const id of ['#gptweb-new-chat', '#gptweb-top-new']) {
        document.querySelector(id).addEventListener('click', () => {
            document.querySelector('#option_start_new_chat').click();
            closeMobile();
        }, options);
    }
    document.querySelector('#gptweb-history').addEventListener('click', () => {
        closeMobile();
        closeDrawers();
        recentHistory.open();
    }, options);
    document.querySelector('#gptweb-toggle').addEventListener('click', toggleSidebar, options);
    document.querySelector('#gptweb-sidebar-close').addEventListener('click', toggleSidebar, options);
    document.querySelector('#gptweb-scrim').addEventListener('click', closeMobile, options);
    document.querySelector('#gptweb-close-drawer').addEventListener('click', closeDrawers, options);
    document.querySelector('#gptweb-profile').addEventListener('click', () => openDrawer('persona-management-button'), options);
    document.querySelector('#gptweb-theme-cycle').addEventListener('click', () => {
        settings.theme = root.dataset.gptwebTheme === 'dark' ? 'light' : 'dark';
        save();
    }, options);
    document.querySelector('#gptweb-enabled').addEventListener('change', event => {
        settings.enabled = event.target.checked;
        save();
    }, options);
    document.querySelector('#gptweb-theme').addEventListener('change', event => {
        settings.theme = event.target.value;
        save();
    }, options);
    document.querySelector('#gptweb-pet-enabled').addEventListener('change', event => {
        settings.petEnabled = event.target.checked;
        save();
    }, options);
    document.querySelector('#gptweb-pet-skin').addEventListener('change', event => {
        settings.petSkin = event.target.value;
        save();
    }, options);
    document.addEventListener('keydown', event => {
        if (settings.enabled && event.key === 'Escape') {
            const openSelect = document.querySelector('select.select2-hidden-accessible:has(+ .select2-container--open)');
            if (openSelect) {
                event.preventDefault();
                event.stopPropagation();
                jQuery(openSelect).select2('close');
                openSelect.nextElementSibling.querySelector('.select2-selection').focus();
                return;
            }
            if (document.querySelector('dialog[open]') || event.target.closest('.select2-container')) return;
            const mobileWasOpen = root.dataset.gptwebMobile === 'open';
            closeMobile();
            closeDrawers();
            if (mobileWasOpen) document.querySelector('#gptweb-toggle').focus();
        }
    }, { ...options, capture: true });
    systemTheme.addEventListener('change', applyAppearance, options);
    matchMedia('(max-width: 700px)').addEventListener('change', closeMobile, options);
    visualViewport.addEventListener('resize', resizeViewport, options);
    visualViewport.addEventListener('scroll', resizeViewport, options);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refreshProfile();
    }, options);

    observer = new MutationObserver(scheduleRefresh);
    for (const panel of document.querySelectorAll('#top-settings-holder > .drawer > .drawer-content')) {
        observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
    }
    observer.observe(document.querySelector('#your_name'), { childList: true, characterData: true, subtree: true });
    observer.observe(document.querySelector('#user_avatar_block'), { childList: true, subtree: true });
    applyAppearance();
    resizeViewport();
    refresh();
    profileTimer = setInterval(refreshProfile, 60_000);
}

export function onActivate() {
    context = SillyTavern.getContext();
    const events = [context.eventTypes.CHAT_CHANGED, context.eventTypes.CHARACTER_MESSAGE_RENDERED,
        context.eventTypes.USER_MESSAGE_RENDERED, context.eventTypes.CHARACTER_PAGE_LOADED,
        context.eventTypes.ONLINE_STATUS_CHANGED, context.eventTypes.PERSONA_CHANGED,
        context.eventTypes.PERSONA_RENAMED, context.eventTypes.PERSONA_UPDATED];
    subscriptions = events.map(event => [event, scheduleRefresh]);
    subscriptions.push([context.eventTypes.APP_READY, mount]);
    for (const [event, listener] of subscriptions) context.eventSource.on(event, listener);
}

export function onDisable() {
    for (const [event, listener] of subscriptions) context.eventSource.removeListener(event, listener);
    subscriptions = [];
    if (!mounted) return;
    controller.abort();
    recentHistory.dispose();
    pet.dispose();
    observer.disconnect();
    clearInterval(profileTimer);
    cancelAnimationFrame(frame);
    frame = 0;
    focusDrawerId = null;
    document.querySelectorAll('.gptweb-panel-heading').forEach(heading => heading.remove());
    for (const id of ['gptweb-sidebar', 'gptweb-scrim', 'gptweb-topbar', 'gptweb-welcome', 'gptweb-composer-note', 'gptweb-settings']) document.getElementById(id).remove();
    root.classList.remove('gptweb');
    root.style.removeProperty('--gptweb-height');
    root.style.removeProperty('--gptweb-top');
    for (const key of ['gptwebTheme', 'gptwebCollapsed', 'gptwebMobile', 'gptwebWelcome', 'gptwebDrawer']) delete root.dataset[key];
    mounted = false;
}
