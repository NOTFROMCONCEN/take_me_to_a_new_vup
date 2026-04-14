/**
 * @author Huameitang
 * @description 纯静态前端入口。
 *              页面从 /vup.json 获取全部数据，在浏览器端完成随机选择、
 *              连续去重、倒计时跳转与头像回退逻辑，兼容本地 Node 预览与 EdgeOne 静态部署。
 */

document.addEventListener('DOMContentLoaded', () => {
    // 定义常量，避免魔法数字
    const COUNTDOWN_SECONDS = 10;

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

    const CIRCUMFERENCE = 339.3;
    let countdown = COUNTDOWN_SECONDS;
    let timerId;
    let currentVupUrl = '#';
    let allVupsCache = [];

    /**
     * @author Huameitang
     * @description 拉取全量 VUP 数据并在浏览器端挑选当前展示项。
     */
    async function loadVup() {
        try {
            const response = await fetch('/vup.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const allVups = await response.json();

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
        }
    }

    /**
     * @author Huameitang
     * @description 更新页面上的VUP信息。
     * @param {object} vup - 包含VUP信息的对象 (name, url, avatar, intro)。
     *              此函数将从传入的vup对象中提取信息，并更新到对应的HTML元素中。
     *              将更新DOM的操作封装成一个独立的函数，提高了代码的复用性和可读性。
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
        clearInterval(timerId);
        overlayElement.classList.add('is-open');
        overlayElement.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }

    function closeAllVups() {
        overlayElement.classList.remove('is-open');
        overlayElement.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
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
     * @author Huameitang
     * @description 启动倒计时，并在结束后跳转到指定URL。
     * @param {string} url - 倒计时结束后要跳转的目标URL。
     *              使用setInterval来实现每秒更新倒计时显示。
     *              当倒计时为0时，清除定时器并执行页面跳转。
     *              这种方式可以精确地控制定时任务，并且可以在需要时通过clearInterval停止它。
     */
    function startCountdown(url) {
        clearInterval(timerId);
        countdown = COUNTDOWN_SECONDS;
        ringEl.style.strokeDashoffset = 0;
        countdownElement.textContent = countdown;
        timerId = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            ringEl.style.strokeDashoffset = CIRCUMFERENCE * (COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS;
            if (countdown <= 0) {
                clearInterval(timerId);
                window.location.href = url;
            }
        }, 1000);
    }

    // 页面加载完成后，立即加载VUP信息
    loadVup();
    updateClock();
    window.setInterval(updateClock, 1000);

    /**
     * @author Huameitang
     * @description 为“换一个”按钮添加点击事件监听器。
     *              直接刷新页面即可重新抽取一个 VUP。
     */
    changeButton.addEventListener('click', (event) => {
        event.preventDefault(); // 阻止<a>标签的默认跳转行为
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
