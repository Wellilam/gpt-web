// SillyTavern 1.19.0: same recent-chat endpoint and entity activation as welcome-screen.js.
import { isGenerating, setActiveCharacter, setActiveGroup } from '/script.js';
import { openGroupById } from '/scripts/group-chats.js';

export function createHistory() {
    let activePopup;

    async function open() {
        if (activePopup) return;
        const ctx = SillyTavern.getContext();
        const view = document.createElement('section');
        view.id = 'gptweb-history-view';
        view.innerHTML = `<h3>最近聊天</h3>
            <p class="gptweb-history-status" role="status">正在读取对话记录…</p>
            <div class="gptweb-history-list"></div>
            <button type="button" class="menu_button gptweb-history-retry" hidden>重新加载</button>`;
        const status = view.querySelector('[role=status]');
        const list = view.querySelector('.gptweb-history-list');
        const retry = view.querySelector('.gptweb-history-retry');
        const request = new AbortController();
        const popup = new ctx.Popup(view, ctx.POPUP_TYPE.TEXT, '', {
            okButton: '关闭', wide: true, leftAlign: true, allowVerticalScrolling: true,
            onClose: () => { request.abort(); activePopup = undefined; },
        });
        popup.dlg.classList.add('gptweb-history-dialog');
        activePopup = popup;
        popup.show();

        async function load() {
            retry.hidden = true;
            list.replaceChildren();
            status.textContent = '正在读取对话记录…';
            try {
                const response = await fetch('/api/chats/recent', {
                    method: 'POST', headers: ctx.getRequestHeaders(), body: '{}',
                    cache: 'no-cache', signal: request.signal,
                });
                if (!response.ok) throw new Error(`读取失败（HTTP ${response.status}）`);
                const chats = await response.json();
                const current = SillyTavern.getContext();
                for (const chat of chats) {
                    const characterId = current.characters.findIndex(character => character.avatar === chat.avatar);
                    const group = current.groups.find(group => group.id === chat.group);
                    const entity = group || current.characters[characterId];
                    // Recent files can outlive their character or group, as in the native welcome screen.
                    if (!entity) continue;
                    const file = chat.file_name.replace(/\.jsonl$/, '');
                    const row = document.createElement('button');
                    row.type = 'button';
                    row.className = 'gptweb-history-row';
                    row.dataset.file = file;
                    row.dataset.entity = group ? group.id : chat.avatar;
                    const heading = document.createElement('span');
                    heading.className = 'gptweb-history-entity';
                    heading.textContent = `${entity.name}${group ? ' · 群聊' : ''}`;
                    const title = document.createElement('span');
                    title.className = 'gptweb-history-title';
                    title.textContent = file;
                    const preview = document.createElement('span');
                    preview.className = 'gptweb-history-preview';
                    preview.textContent = chat.mes;
                    const time = document.createElement('span');
                    time.className = 'gptweb-history-time';
                    time.textContent = current.timestampToMoment(chat.last_mes).format('YYYY-MM-DD HH:mm');
                    row.append(heading, title, preview, time);
                    row.addEventListener('click', async () => {
                        if (isGenerating()) {
                            status.textContent = '正在生成回复，请先停止生成再切换聊天。';
                            return;
                        }
                        list.inert = true;
                        status.textContent = '正在打开聊天…';
                        try {
                            const current = SillyTavern.getContext();
                            if (current.characterId !== undefined || current.groupId) await current.saveChat();
                            if (request.signal.aborted) return;
                            if (group) {
                                if (current.groupId !== group.id && !await openGroupById(group.id)) throw new Error('群聊未能打开，请稍后重试。');
                                setActiveGroup(group.id);
                                if (SillyTavern.getContext().getCurrentChatId() !== file) await current.openGroupChat(group.id, file);
                            } else {
                                await current.selectCharacterById(characterId, { switchMenu: false });
                                if (SillyTavern.getContext().characterId !== String(characterId)) throw new Error('角色未能打开，请稍后重试。');
                                setActiveCharacter(chat.avatar);
                                if (SillyTavern.getContext().getCurrentChatId() !== file) await current.openCharacterChat(file);
                            }
                            current.saveSettingsDebounced();
                            await popup.complete(ctx.POPUP_RESULT.AFFIRMATIVE);
                        } catch (error) {
                            console.error('[GPT Web] Open recent chat failed', error);
                            status.textContent = `打开聊天失败：${error.message}`;
                        } finally {
                            list.inert = false;
                        }
                    });
                    list.append(row);
                }
                status.textContent = list.children.length ? '按最近更新排序，包含角色聊天和群聊。' : '还没有聊天记录。开始一段对话后，会显示在这里。';
            } catch (error) {
                if (request.signal.aborted) return;
                console.error('[GPT Web] Load recent chats failed', error);
                status.textContent = `无法加载最近聊天：${error.message}`;
                retry.hidden = false;
            }
        }
        retry.addEventListener('click', load);
        await load();
    }

    return {
        open,
        dispose() {
            if (activePopup) activePopup.complete(SillyTavern.getContext().POPUP_RESULT.CANCELLED);
        },
    };
}
