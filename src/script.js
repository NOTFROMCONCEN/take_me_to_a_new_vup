/**
 * @author Huameitang
 * @description 纯静态前端入口。
 *              页面从 /vup.json 获取全部数据，在浏览器端完成随机选择、
 *              连续去重、倒计时跳转与头像回退逻辑，兼容本地 Node 预览与 EdgeOne 静态部署。
 *              支持：标签筛选、搜索、主题切换、国际化、离线缓存。
 */

(function () {
    'use strict';

    // ── 国际化 ──
    const i18n = {
        'zh-CN': {
            title: '带我去一个VUP主页',
            loading: '加载中…',
            loadFailed: '加载失败',
            loadFailedDesc: '无法获取VUP信息，请检查网络连接或联系管理员。',
            jumpNow: '立即跳转',
            changeOne: '换一个',
            secondsLeft: '秒后跳转',
            showAll: '展示所有 VUP',
            allVupTitle: '全部 VUP / VTB',
            searchPlaceholder: '搜索名称或简介…',
            allTags: '全部',
            noIntro: '这个 VUP 暂时还没有填写简介。',
            clickToVisit: '点击前往主页',
            themeLight: '浅色',
            themeDark: '深色'
        },
        'en': {
            title: 'Take me to a VUP page',
            loading: 'Loading…',
            loadFailed: 'Failed to load',
            loadFailedDesc: 'Unable to fetch VUP data. Please check your network connection.',
            jumpNow: 'Jump Now',
            changeOne: 'Next',
            secondsLeft: 's to jump',
            showAll: 'Show All VUP',
            allVupTitle: 'All VUP / VTB',
            searchPlaceholder: 'Search by name or bio…',
            allTags: 'All',
            noIntro: 'This VUP has not written a bio yet.',
            clickToVisit: 'Visit profile',
            themeLight: 'Light',
            themeDark: 'Dark'
        }
    };

    function getLang() {
        const stored = localStorage.getItem('lang');
        if (stored) return stored;
        const nav = navigator.language || 'zh-CN';
        return nav.startsWith('zh') ? 'zh-CN' : 'en';
    }

    function t(key) {
        return (i18n[getLang()] || i18n['zh-CN'])[key] || key;
    }

    // ── 常量 ──
    const COUNTDOWN_SECONDS = 10;
    const CIRCUMFERENCE = 2 * Math.PI * 54;

    // ── DOM 元素 ──
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
    const searchInputElement = document.getElementById('vup-search');
    const tagFilterElement = document.getElementById('tag-filter');
    const themeToggleButton = document.getElementById('theme-toggle');
    const langToggleButton = document.getElementById('lang-toggle');
    const jumpButtonLabel = document.getElementById('jump-label');
    const changeButtonLabel = document.getElementById('change-label');
    const showAllLabel = document.getElementById('show-all-label');
    const countdownLabel = document.getElementById('countdown-label');
    const panelTitleElement = document.getElementById('panel-title');

    let countdown = COUNTDOWN_SECONDS;
    let timerId = null;
    let currentVupUrl = '#';
    let allVupsCache = [];
    let countdownTargetUrl = '#';
    let countdownPausedAt = null;
    let activeTag = '全部';

    // ── 主题 ──
    function getPreferredTheme() {
        const stored = localStorage.getItem('theme');
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeToggleButton) {
            themeToggleButton.textContent = theme === 'light' ? '🌙' : '☀️';
            themeToggleButton.setAttribute('aria-label', theme === 'light' ? t('themeDark') : t('themeLight'));
        }
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        applyTheme(next);
    }

    // ── 语言 ──
    function applyLang() {
        const lang = getLang();
        if (langToggleButton) langToggleButton.textContent = lang === 'zh-CN' ? 'EN' : '中';
        document.title = t('title');
        if (nameElement.textContent === '加载中…' || nameElement.textContent === 'Loading…') {
            nameElement.textContent = t('loading');
        }
        if (jumpButtonLabel) jumpButtonLabel.textContent = t('jumpNow');
        if (changeButtonLabel) changeButtonLabel.textContent = t('changeOne');
        if (showAllLabel) showAllLabel.textContent = t('showAll');
        if (countdownLabel) countdownLabel.textContent = t('secondsLeft');
        if (panelTitleElement) panelTitleElement.textContent = t('allVupTitle');
        if (searchInputElement) searchInputElement.placeholder = t('searchPlaceholder');
        // 重新渲染网格以更新翻译
        if (allVupsCache.length > 0) {
            renderTagFilter();
            renderVupGrid(allVupsCache);
        }
    }

    function toggleLang() {
        const current = getLang();
        const next = current === 'zh-CN' ? 'en' : 'zh-CN';
        localStorage.setItem('lang', next);
        applyLang();
    }

    // ── 头像路径（基于 UID，支持 WebP 和多尺寸） ──
    function localAvatarPath(vup, size = 'card') {
        const uid = vup.uid || '';
        if (!uid) return '';
        // 优先使用 WebP，回退到 JPG
        const suffix = size === 'thumb' ? '@72w' : (size === 'card' ? '@140w' : '');
        return `/face_img/${uid}${suffix}.webp`;
    }

    function localAvatarFallback(vup) {
        const uid = vup.uid || '';
        return uid ? `/face_img/${uid}.jpg` : '';
    }

    // ── 数据加载 ──
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
            renderTagFilter();
            renderVupGrid(allVups);
            startCountdown(selectedVup.url);
        } catch (error) {
            console.error('获取VUP数据失败:', error);
            nameElement.textContent = t('loadFailed');
            introElement.textContent = t('loadFailedDesc');
            countdownElement.textContent = '--';
        }
    }

    function updateVupInfo(vup) {
        const avatarPath = localAvatarPath(vup, 'card');
        const avatarFallback = localAvatarFallback(vup);

        avatarElement.alt = `${vup.name}的头像`;
        // 使用 picture 元素的 srcset 逻辑（通过 data 属性）
        avatarElement.dataset.src = avatarPath;
        avatarElement.dataset.fallback = avatarFallback;
        avatarElement.src = avatarPath;
        
        let errorCount = 0;
        avatarElement.onerror = () => {
            errorCount++;
            if (errorCount === 1 && avatarFallback) {
                // WebP 失败，尝试本地 JPG
                avatarElement.src = avatarFallback;
            } else if (errorCount === 2 && vup.avatar && avatarElement.src !== vup.avatar) {
                // 本地 JPG 失败，尝试 B 站 CDN
                avatarElement.src = vup.avatar.replace(/^http:\/\//, 'https://');
            } else {
                avatarElement.onerror = null;
            }
        };
        nameElement.textContent = vup.name;
        introElement.textContent = vup.intro || t('noIntro');
        jumpButton.href = vup.url;
        currentVupUrl = vup.url;
    }

    // ── "换一个"不刷新页面 ──
    function pickAnother() {
        if (allVupsCache.length === 0) return;

        const lastVupName = nameElement.textContent;
        let available = allVupsCache.filter(v => v.name !== lastVupName);
        if (available.length === 0) available = allVupsCache;

        const selectedVup = available[Math.floor(Math.random() * available.length)];
        localStorage.setItem('lastVupName', selectedVup.name);

        // 卡片切换动画
        const card = document.querySelector('.card');
        card.style.opacity = '0';
        card.style.transform = 'translateY(15px)';

        setTimeout(() => {
            updateVupInfo(selectedVup);
            startCountdown(selectedVup.url);
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 200);
    }

    // ── 标签筛选 ──
    function getAllTags(vups) {
        const tagSet = new Set();
        for (const vup of vups) {
            if (Array.isArray(vup.tags)) {
                for (const tag of vup.tags) {
                    tagSet.add(tag);
                }
            }
        }
        return Array.from(tagSet).sort();
    }

    function renderTagFilter() {
        if (!tagFilterElement) return;
        const tags = getAllTags(allVupsCache);
        tagFilterElement.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = 'tag-btn active';
        allBtn.textContent = t('allTags');
        allBtn.addEventListener('click', () => {
            activeTag = '全部';
            renderVupGrid(allVupsCache);
            updateTagButtons();
        });
        tagFilterElement.appendChild(allBtn);

        for (const tag of tags) {
            const btn = document.createElement('button');
            btn.className = 'tag-btn';
            btn.textContent = tag;
            btn.addEventListener('click', () => {
                activeTag = tag;
                const filtered = allVupsCache.filter(v =>
                    Array.isArray(v.tags) && v.tags.includes(tag)
                );
                renderVupGrid(filtered);
                updateTagButtons();
            });
            tagFilterElement.appendChild(btn);
        }
    }

    function updateTagButtons() {
        if (!tagFilterElement) return;
        const buttons = tagFilterElement.querySelectorAll('.tag-btn');
        buttons.forEach(btn => {
            const isActive = (activeTag === '全部' && btn === tagFilterElement.firstElementChild) ||
                btn.textContent === activeTag;
            btn.classList.toggle('active', isActive);
        });
    }

    // ── 搜索 ──
    function getFilteredVups() {
        const query = (searchInputElement ? searchInputElement.value : '').trim().toLowerCase();
        let vups = allVupsCache;

        if (activeTag !== '全部') {
            vups = vups.filter(v => Array.isArray(v.tags) && v.tags.includes(activeTag));
        }

        if (query) {
            vups = vups.filter(v =>
                v.name.toLowerCase().includes(query) ||
                (v.intro || '').toLowerCase().includes(query)
            );
        }

        return vups;
    }

    // ── VUP 网格渲染 ──
    function renderVupGrid(vups) {
        vupGridElement.innerHTML = '';

        if (vups.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'vup-grid-empty';
            empty.textContent = '—';
            vupGridElement.appendChild(empty);
            return;
        }

        for (const vup of vups) {
            const card = document.createElement('a');
            card.className = 'vup-grid-item';
            card.href = vup.url;
            card.target = '_blank';
            card.rel = 'noreferrer noopener';

            const image = document.createElement('img');
            image.className = 'vup-grid-avatar';
            const avatarPath = localAvatarPath(vup, 'thumb');
            const avatarFallback = localAvatarFallback(vup);
            image.src = avatarPath;
            image.alt = `${vup.name} 的头像`;
            image.loading = 'lazy';
            image.dataset.fallback = avatarFallback;
            let errorCount = 0;
            image.onerror = () => {
                errorCount++;
                if (errorCount === 1 && avatarFallback) {
                    image.src = avatarFallback;
                } else if (errorCount === 2 && vup.avatar && image.src !== vup.avatar) {
                    image.src = vup.avatar.replace(/^http:\/\//, 'https://');
                } else {
                    image.onerror = null;
                }
            };

            const title = document.createElement('span');
            title.className = 'vup-grid-name';
            title.textContent = vup.name;

            const intro = document.createElement('span');
            intro.className = 'vup-grid-intro';
            intro.textContent = vup.intro || t('clickToVisit');

            card.append(image, title, intro);
            vupGridElement.append(card);
        }
    }

    // ── 弹窗 ──
    function openAllVups() {
        pauseCountdown();
        overlayElement.classList.add('is-open');
        overlayElement.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        panelCloseButton.focus();
        if (searchInputElement) searchInputElement.focus();
    }

    function closeAllVups() {
        overlayElement.classList.remove('is-open');
        overlayElement.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        resumeCountdown();
        showAllButton.focus();
    }

    // ── 时钟 ──
    function updateClock() {
        const now = new Date();
        clockChipElement.textContent = now.toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // ── 倒计时 ──
    function pauseCountdown() {
        if (timerId !== null) {
            clearInterval(timerId);
            timerId = null;
            countdownPausedAt = countdown;
        }
    }

    function resumeCountdown() {
        if (countdownPausedAt !== null && countdownPausedAt > 0) {
            countdown = countdownPausedAt;
            countdownPausedAt = null;
            startCountdown(countdownTargetUrl);
        }
    }

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

    // ── 页面可见性 ──
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseCountdown();
        } else {
            if (!overlayElement.classList.contains('is-open')) {
                resumeCountdown();
            }
        }
    });

    // ── 初始化 ──
    applyTheme(getPreferredTheme());
    loadVup();
    updateClock();
    window.setInterval(updateClock, 1000);

    // ── 事件绑定 ──
    changeButton.addEventListener('click', (event) => {
        event.preventDefault();
        pickAnother();
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

    if (searchInputElement) {
        searchInputElement.addEventListener('input', () => {
            renderVupGrid(getFilteredVups());
        });
    }

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    }

    if (langToggleButton) {
        langToggleButton.addEventListener('click', toggleLang);
    }

    // ── Service Worker 注册 ──
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Service Worker 注册失败，不影响页面功能
        });
    }
})();
