// Sprite layout reference: https://github.com/openai/codex/tree/main/codex-rs/tui/src/pets
// The public image stays on OpenAI's CDN; it is not distributed under this project's MIT license.
import { readCustomSkin, writeCustomSkin } from './pet-skin-store.js';
export const petSkins = {
    codex: 'Codex',
    dewey: 'Dewey',
    fireball: 'Fireball',
    rocky: 'Rocky',
    seedy: 'Seedy',
    stacky: 'Stacky',
    bsod: 'BSOD',
    'null-signal': 'Null Signal',
    custom: '自定义图集',
};
const animations = {
    idle: { row: 0, durations: [1680, 660, 660, 840, 840, 1920], loop: true },
    waving: { row: 3, durations: [140, 140, 140, 280], loop: false },
    jumping: { row: 4, durations: [140, 140, 140, 140, 280], loop: false },
    waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260], loop: true },
};

export function mountPet(settings, options, saveSettings) {
    document.body.insertAdjacentHTML('beforeend', '<button type="button" id="gptweb-pet" title="点击和 Codex 打个招呼" aria-label="和 Codex 宠物打招呼" hidden><span id="gptweb-pet-sprite" aria-hidden="true"></span></button>');
    const button = document.querySelector('#gptweb-pet');
    const sprite = document.querySelector('#gptweb-pet-sprite');
    const status = document.querySelector('#gptweb-pet-status');
    const stopButton = document.querySelector('#mes_stop');
    const composer = document.querySelector('#form_sheld');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const upload = document.querySelector('#gptweb-pet-upload');
    const skinSelect = document.querySelector('#gptweb-pet-skin');
    let image;
    let customUrl;
    let requestedSkin;
    let rows = 9;
    let loaded = false;
    let animation;
    let state;
    let interaction = null;

    function refresh() {
        const enabled = settings.enabled && settings.petEnabled;
        button.hidden = !enabled || !loaded;
        if (enabled && requestedSkin !== settings.petSkin) {
            loadSkin();
            button.hidden = true;
        }
        if (button.hidden || document.hidden) {
            animation?.cancel();
            state = undefined;
            return;
        }
        const nextState = interaction || (getComputedStyle(stopButton).display === 'none' ? 'idle' : 'waiting');
        if (nextState === state) return;
        animation?.cancel();
        state = nextState;
        button.dataset.state = state;
        const { row, durations, loop } = animations[state];
        sprite.style.backgroundPosition = `0% ${row / (rows - 1) * 100}%`;
        if (reducedMotion.matches) return;
        const duration = durations.reduce((sum, value) => sum + value, 0);
        let elapsed = 0;
        const frames = durations.map((frameDuration, column) => {
            const keyframe = { backgroundPosition: `${column / 7 * 100}% ${row / (rows - 1) * 100}%`, offset: elapsed / duration, easing: 'steps(1, end)' };
            elapsed += frameDuration;
            return keyframe;
        });
        frames.push({ ...frames.at(-1), offset: 1 });
        animation = sprite.animate(frames, { duration, iterations: loop ? Infinity : 1 });
        animation.onfinish = () => { interaction = null; refresh(); };
    }

    function loadSkin() {
        if (image) { image.onload = null; image.onerror = null; }
        if (customUrl) { URL.revokeObjectURL(customUrl); customUrl = undefined; }
        const loadingImage = new Image();
        loadingImage.referrerPolicy = 'no-referrer';
        image = loadingImage;
        requestedSkin = settings.petSkin;
        loaded = false;
        interaction = null;
        const name = petSkins[requestedSkin];
        const spritesheet = `https://persistent.oaistatic.com/codex/pets/v1/${requestedSkin}-spritesheet-v4.webp`;
        status.textContent = `正在加载 ${name}…`;
        button.title = `点击和 ${name} 打个招呼`;
        button.setAttribute('aria-label', `和 ${name} 宠物打招呼`);
        loadingImage.onload = () => {
            if (loadingImage.naturalWidth !== 1536 || ![1872, 2288].includes(loadingImage.naturalHeight)) {
                status.textContent = `${name} 图集尺寸不匹配，无法显示。`;
                console.error('GPT Web: unexpected pet spritesheet dimensions', loadingImage.naturalWidth, loadingImage.naturalHeight);
                return;
            }
            rows = loadingImage.naturalHeight / 208;
            loaded = true;
            status.textContent = '';
            sprite.style.backgroundSize = `800% ${rows * 100}%`;
            sprite.style.backgroundImage = `url("${loadingImage.src}")`;
            button.dataset.skin = requestedSkin;
            refresh();
        };
        loadingImage.onerror = () => {
            status.textContent = `${name} 加载失败，请检查网络后刷新页面。`;
            console.error('GPT Web: pet image could not load', loadingImage.src);
        };
        if (requestedSkin === 'custom') {
            readCustomSkin().then(file => {
                if (options.signal.aborted || image !== loadingImage) return;
                if (!file) {
                    status.textContent = '还没有自定义图集，请先上传。';
                    return;
                }
                customUrl = URL.createObjectURL(file);
                loadingImage.src = customUrl;
                document.querySelector('#gptweb-pet-custom-name').textContent = `已保存：${file.name}`;
                button.title = `点击和自定义宠物打个招呼：${file.name}`;
            }, error => {
                if (options.signal.aborted || image !== loadingImage) return;
                status.textContent = `读取自定义皮肤失败：${error.message}`;
                console.error('GPT Web: custom skin storage read failed', error);
            });
        } else {
            loadingImage.src = spritesheet;
        }
    }
    upload.addEventListener('change', async () => {
        const file = upload.files[0];
        if (!file) return;
        upload.value = '';
        if (!['image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
            status.textContent = '请选择不超过 20 MB 的 PNG 或 WebP 图集。';
            return;
        }
        upload.disabled = true;
        skinSelect.disabled = true;
        const previewUrl = URL.createObjectURL(file);
        const preview = new Image();
        preview.src = previewUrl;
        try {
            try {
                await preview.decode();
            } catch (error) {
                status.textContent = '无法读取这张图片，请选择有效的 PNG 或 WebP 图集。';
                console.error('GPT Web: custom skin image decode failed', error);
                return;
            }
            if (options.signal.aborted) return;
            if (preview.naturalWidth !== 1536 || ![1872, 2288].includes(preview.naturalHeight)) {
                status.textContent = '图集尺寸须为 1536×1872 或 1536×2288，每格 192×208；当前皮肤未替换。';
                return;
            }
            try {
                await writeCustomSkin(file);
            } catch (error) {
                status.textContent = `保存自定义皮肤失败：${error.message}`;
                console.error('GPT Web: custom skin storage write failed', error);
                return;
            }
            if (options.signal.aborted) return;
            requestedSkin = undefined;
            settings.petSkin = 'custom';
            saveSettings();
        } finally {
            URL.revokeObjectURL(previewUrl);
            upload.disabled = false;
            skinSelect.disabled = false;
        }
    }, options);
    button.addEventListener('pointerenter', event => {
        if (event.pointerType === 'mouse' && !reducedMotion.matches) {
            interaction = 'jumping';
            refresh();
        }
    }, options);
    button.addEventListener('click', () => {
        if (!reducedMotion.matches) {
            interaction = 'waving';
            refresh();
        }
    }, options);
    document.addEventListener('visibilitychange', refresh, options);
    reducedMotion.addEventListener('change', () => { state = undefined; interaction = null; refresh(); }, options);
    const generationObserver = new MutationObserver(refresh);
    generationObserver.observe(stopButton, { attributes: true, attributeFilter: ['style'] });
    const composerObserver = new ResizeObserver(() => {
        document.documentElement.style.setProperty('--gptweb-composer-height', `${composer.getBoundingClientRect().height}px`);
    });
    composerObserver.observe(composer);

    return {
        refresh,
        dispose() {
            if (image) { image.onload = null; image.onerror = null; }
            if (customUrl) URL.revokeObjectURL(customUrl);
            animation?.cancel();
            generationObserver.disconnect();
            composerObserver.disconnect();
            button.remove();
            document.documentElement.style.removeProperty('--gptweb-composer-height');
        },
    };
}
