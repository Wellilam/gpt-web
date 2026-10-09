// Keep native nodes and handlers; restore their exact positions on desktop or disable.
export function mountCharacterPanel(signal) {
    const mobile = matchMedia('(max-width: 700px)');
    let restore = () => {};

    function update() {
        restore();
        if (!mobile.matches) return;
        const positions = [];
        const labels = [];
        const header = document.getElementById('charListFixedTop');
        const actions = document.createElement('div');
        actions.className = 'gptweb-character-actions';
        const tools = document.createElement('details');
        tools.id = 'gptweb-character-tools';
        tools.innerHTML = '<summary>筛选与管理</summary>';
        header.append(actions, tools);

        function move(selector, parent) {
            const node = document.querySelector(selector);
            const slot = document.createComment('gptweb-character-slot');
            node.before(slot);
            positions.push([node, slot]);
            parent.append(node);
        }
        move('#rm_button_bar', tools);
        move('#rm_button_create', actions);
        move('#character_import_button', actions);
        move('#charListFixedTop > .rm_tag_controls', tools);
        move('#rm_print_characters_pagination', tools);

        for (const [selector, text] of [
            ['#rm_button_create', '新建角色'], ['#character_import_button', '导入角色'],
            ['#external_import_button', '链接导入'], ['#rm_button_group_chats', '创建群聊'],
            ['#rm_button_characters', '返回角色列表'], ['#favorite_button', '收藏'],
            ['#advanced_div', '高级设定'], ['#world_button', '角色世界书'],
            ['#avatar_controls .chat_lorebook_button', '聊天世界书'], ['#char_connections_button', '关联人设'],
            ['#export_button', '导出'], ['#dupe_button', '复制'], ['#delete_button', '删除'],
            ['#create_button_label', '保存角色'], ['#rm_button_back', '返回'],
        ]) {
            const label = document.createElement('span');
            label.className = 'gptweb-control-label';
            label.textContent = text;
            document.querySelector(selector).append(label);
            labels.push(label);
        }
        const searchLabel = document.createElement('label');
        searchLabel.className = 'gptweb-search-label';
        searchLabel.htmlFor = 'character_search_bar';
        searchLabel.textContent = '搜索角色';
        document.getElementById('form_character_search_form').prepend(searchLabel);

        restore = () => {
            for (const [node, slot] of positions.reverse()) slot.replaceWith(node);
            for (const label of labels) label.remove();
            searchLabel.remove();
            actions.remove();
            tools.remove();
            restore = () => {};
        };
    }
    mobile.addEventListener('change', update, { signal });
    signal.addEventListener('abort', () => restore(), { once: true });
    update();
}
