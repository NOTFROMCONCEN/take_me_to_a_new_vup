/**
 * @author Huameitang
 * @description 纯静态前端入口。
 *              页面从 /vup.json 获取全部数据，在浏览器端完成随机选择、
 *              连续去重、倒计时跳转与头像回退逻辑，兼容本地 Node 预览与 EdgeOne 静态部署。
 */

document.addEventListener('DOMContentLoaded', () => {
    // 定义常量，避免魔法数字
    const COUNTDOWN_SECONDS = 10;
    const CIRCUMFERENCE = 2 * Math.PI * 54; // ≈ 339.29，与 CSS stroke-dasharray 一致

    // 获取页面元素
    const avatarElement = document.getElementById('avatar');
    const nameElement = document.getElementById('name');
    const introElement = document.getElementById('intro');
    const countdownElement = document.getElementById('countdown');
    const jumpButton = document.getElementById('jump-button');
    const changeButton = document.getElementById('change-button');
    const ringEl = document.getElementById('countdown-ring');
    const showAllButton = document.getElementById('show-all-btn');
    const overlayElement = document.getElementById('all-vup-overlay');
    const panelCloseButton = document.getElementById('panel-close-btn');
    const vupGridElement = document.getElementById('vup-grid');
    const clockChipElement = document.getElementById('clock-chip');

    let countdown = COUNTDOWN_SECONDS;
    let timerId = null;
    let currentVupUrl = '#';
    let allVupsCache = [];
    let countdownTargetUrl = '#';
    let countdownPausedAt = null; // 记录暂停时剩余秒数

    /**
     * @description 拉取全量 VUP 数据并在浏览器端挑选当前展示项。
     */
    async function loadVup() {
        try {
            const response = await fetch('/vup.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const allVups = await response.json();

            if (!Array.isArray(allVups) || allVups.length === 0) {
                throw new Error('VUP 数据为空或格式不正确');
            }

            // 用 localStorage 记录上次展示的 VUP，避免连续重复。
            const lastVupName = localStorage.getItem('lastVupName');
            let available = allVups;
            if (lastVupName) {
                const filtered = allVups.filter(v => v.name !== lastVupName);
                if (filtered.length > 0) available = filtered;
            }
            const selectedVup = available[Math.floor(Math.random() * available.length)];
            localStorage.setItem('lastVupName', selectedVup.name);
            allVupsCache = allVups;

            updateVupInfo(selectedVup);
            renderVupGrid(allVups);
            startCountdown(selectedVup.url);
        } catch (error) {
            console.error('获取VUP数据失败:', error);
            nameElement.textContent = '加载失败';
            introElement.textContent = '无法获取VUP信息，请检查网络连接或联系管理员。';
            countdownElement.textContent = '--';
        }
    }

    /**
     * @description 更新页面上的VUP信息。
     * @param {object} vup - 包含VUP信息的对象 (name, url, avatar, intro)。
     */
    function updateVupInfo(vup) {
        const localAvatarPath = `/face_img/${encodeURIComponent(vup.name)}.jpg`;

        avatarElement.alt = `${vup.name}的头像`;
        avatarElement.src = localAvatarPath;
        avatarElement.onerror = () => {
            if (vup.avatar && avatarElement.src !== vup.avatar) {
                avatarElement.src = vup.avatar.replace(/^http:\/\//, 'https://');
            }
            avatarElement.onerror = null;
        };
        nameElement.textContent = vup.name;
        introElement.textContent = vup.intro || '这个 VUP 暂时还没有填写简介。';
        jumpButton.href = vup.url;
        currentVupUrl = vup.url;
    }

    function renderVupGrid(vups) {
        vupGridElement.innerHTML = '';

        for (const vup of vups) {
            const card = document.createElement('a');
            card.className = 'vup-grid-item';
            card.href = vup.url;
            card.target = '_blank';
            card.rel = 'noreferrer noopener';

            const image = document.createElement('img');
            image.className = 'vup-grid-avatar';
            image.src = `/face_img/${encodeURIComponent(vup.name)}.jpg`;
            image.alt = `${vup.name} 的头像`;
            image.loading = 'lazy';
            image.onerror = () => {
                if (vup.avatar && image.src !== vup.avatar) {
                    image.src = vup.avatar.replace(/^http:\/\//, 'https://');
                }
                image.onerror = null;
            };

            const title = document.createElement('span');
            title.className = 'vup-grid-name';
            title.textContent = vup.name;

            const intro = document.createElement('span');
            intro.className = 'vup-grid-intro';
            intro.textContent = vup.intro || '点击前往主页';

            card.append(image, title, intro);
            vupGridElement.append(card);
        }
    }

    function openAllVups() {
        pauseCountdown();
        overlayElement.classList.add('is-open');
        overlayElement.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        // 聚焦到关闭按钮，方便键盘操作
        panelCloseButton.focus();
    }

    function closeAllVups() {
        overlayElement.classList.remove('is-open');
        overlayElement.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        resumeCountdown();
        // 焦点回到触发按钮
        showAllButton.focus();
    }

    function updateClock() {
        const now = new Date();
        clockChipElement.textContent = now.toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * @description 暂停倒计时（弹窗打开或页面隐藏时调用）。
     */
    function pauseCountdown() {
        if (timerId !== null) {
            clearInterval(timerId);
            timerId = null;
            countdownPausedAt = countdown;
        }
    }

    /**
     * @description 恢复倒计时（弹窗关闭或页面重新可见时调用）。
     */
    function resumeCountdown() {
        if (countdownPausedAt !== null && countdownPausedAt > 0) {
            countdown = countdownPausedAt;
            countdownPausedAt = null;
            startCountdown(countdownTargetUrl);
        }
    }

    /**
     * @description 启动倒计时，并在结束后跳转到指定URL。
     * @param {string} url - 倒计时结束后要跳转的目标URL。
     */
    function startCountdown(url) {
        clearInterval(timerId);
        countdownTargetUrl = url;
        countdown = COUNTDOWN_SECONDS;
        ringEl.style.strokeDashoffset = 0;
        countdownElement.textContent = countdown;
        timerId = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            ringEl.style.strokeDashoffset = CIRCUMFERENCE * (COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS;
            if (countdown <= 0) {
                clearInterval(timerId);
                timerId = null;
                countdownPausedAt = null;
                window.location.href = url;
            }
        }, 1000);
    }

    // ── 页面可见性：标签页隐藏时暂停倒计时，恢复时继续 ──
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseCountdown();
        } else {
            // 仅在弹窗未打开时恢复
            if (!overlayElement.classList.contains('is-open')) {
                resumeCountdown();
            }
        }
    });

    // 页面加载完成后，立即加载VUP信息
    loadVup();
    updateClock();
    window.setInterval(updateClock, 1000);

    // ── 事件绑定 ──

    changeButton.addEventListener('click', (event) => {
        event.preventDefault();
        location.reload();
    });

    showAllButton.addEventListener('click', () => {
        if (allVupsCache.length === 0) return;
        openAllVups();
    });

    panelCloseButton.addEventListener('click', closeAllVups);

    overlayElement.addEventListener('click', (event) => {
        if (event.target === overlayElement) {
            closeAllVups();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAllVups();
        }
    });

    jumpButton.addEventListener('click', (event) => {
        if (!currentVupUrl || currentVupUrl === '#') {
            event.preventDefault();
        }
    });
});
