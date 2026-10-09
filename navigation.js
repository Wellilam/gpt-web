// Proxy standard top-bar actions without moving plugin-owned elements or handlers.
export function mountPluginNavigation(knownIds, openDrawer, closeMobile, scheduleRefresh, signal) {
    const holder = document.querySelector('#top-settings-holder');
    const section = document.querySelector('#gptweb-plugin-section');
    const list = document.querySelector('#gptweb-plugin-navigation');
    const entries = new Map();

    function sync() {
        const active = new Set();
        for (const item of holder.children) {
            if (knownIds.includes(item.id)) continue;
            const toggle = item.matches('.drawer') ? item.querySelector(':scope > .drawer-toggle')
                : item.matches('button, a, [role="button"], .menu_button') ? item
                    : item.querySelector(':scope > button, :scope > a, :scope > [role="button"], :scope > .menu_button');
            if (!toggle) continue;
            active.add(toggle);
            let button = entries.get(toggle);
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'gptweb-row';
                button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12h8m-4-4v8"/></svg><span></span>';
                button.addEventListener('click', () => {
                    if (item.matches('.drawer') && item.querySelector(':scope > .drawer-content')) openDrawer(toggle);
                    else { toggle.click(); closeMobile(); }
                }, { signal });
                entries.set(toggle, button);
                list.append(button);
                toggle.setAttribute('data-gptweb-proxied', '');
            }
            const label = toggle.getAttribute('aria-label') || toggle.title
                || toggle.querySelector('[title]')?.title || item.title || toggle.textContent.trim() || item.id || '插件入口';
            button.querySelector('span').textContent = label;
            button.title = label;
            button.hidden = item.hidden || toggle.hidden || item.style.display === 'none' || toggle.style.display === 'none'
                || item.matches('.displayNone, .hidden') || toggle.matches('.displayNone, .hidden');
            button.disabled = toggle.matches(':disabled, [aria-disabled="true"], .disabled');
            const panel = item.querySelector(':scope > .drawer-content');
            if (panel) button.setAttribute('aria-expanded', String(panel.classList.contains('openDrawer')));
        }
        for (const [toggle, button] of entries) {
            if (active.has(toggle)) continue;
            toggle.removeAttribute('data-gptweb-proxied');
            button.remove();
            entries.delete(toggle);
        }
        section.hidden = ![...entries.values()].some(button => !button.hidden);
        scheduleRefresh();
    }
    const observer = new MutationObserver(records => {
        // Ignore plugin form/content mutations; only discover top-bar controls and panel state.
        if (records.some(({ target }) => target === holder || target.parentElement === holder
            || target.matches('#top-settings-holder > .drawer > .drawer-content')
            || !target.closest('.drawer-content'))) sync();
    });
    observer.observe(holder, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled', 'aria-label', 'title'] });
    sync();
    signal.addEventListener('abort', () => {
        observer.disconnect();
        for (const toggle of entries.keys()) toggle.removeAttribute('data-gptweb-proxied');
        entries.clear();
    }, { once: true });
}
