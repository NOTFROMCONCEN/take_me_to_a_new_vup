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
    const a11yAnnouncer = document.getElementById('a11y-announcer');

    let countdown = COUNTDOWN_SECONDS;
    let timerId = null;
    let currentVupUrl = '#';
    let allVupsCache = [];
    let countdownTargetUrl = '#';
    let countdownPausedAt = null;
    let activeTag = '全部';

    // ── 无障碍：屏幕阅读器公告 ──
    function announce(message) {
        if (!a11yAnnouncer) return;
        a11yAnnouncer.textContent = '';
        // 强制重绘以触发公告
        setTimeout(() => {
            a11yAnnouncer.textContent = message;
        }, 100);
    }

    // ── 无障碍：管理焦点 ──
    function setFocus(element) {
        if (!element) return;
        element.focus({ preventScroll: false });
    }

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
        // 无障碍：公告主题变更
        announce(next === 'light' ? '已切换到浅色主题' : '已切换到深色主题');
    }

    // ── 语言 ──
    function applyLang() {
        const lang = getLang();
        if (langToggleButton) {
            langToggleButton.textContent = lang === 'zh-CN' ? 'EN' : '中';
            langToggleButton.setAttribute('aria-label', lang === 'zh-CN' ? '切换到英语' : '切换到中文');
        }
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
        // 无障碍：公告语言变更
        announce(next === 'zh-CN' ? '已切换到中文' : 'Switched to English');
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
        
        // 无障碍：公告 VUP 变更
        announce(`已选择 ${vup.name}`);
    }

    // ── "换一个"不刷新页面 ──
    function pickAnother() {
        if (allVupsCache.length === 0) return;

        const lastVupName = nameElement.textContent;
        let available = allVupsCache.filter(v => v.name !== lastVupName);
        if (available.length === 0) available = allVupsCache;

        const selectedVup = available[Math.floor(Math.random() * available.length)];
        localStorage.setItem('lastVupName', selectedVup.name);

        // 卡片切换动画 - 使用 CSS 类优化性能
        const card = document.querySelector('.card');
        card.classList.add('card-exit');
        
        // 使用 requestAnimationFrame 确保动画流畅
        requestAnimationFrame(() => {
            setTimeout(() => {
                updateVupInfo(selectedVup);
                startCountdown(selectedVup.url);
                card.classList.remove('card-exit');
                card.classList.add('card-enter');
                
                // 动画结束后移除类
                setTimeout(() => {
                    card.classList.remove('card-enter');
                    // 无障碍：将焦点移到卡片，便于键盘用户
                    setFocus(card);
                }, 300);
            }, 200);
        });
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
        
        // 设置标签容器的 ARIA 属性
        tagFilterElement.setAttribute('role', 'group');
        tagFilterElement.setAttribute('aria-label', '按标签筛选 VUP');

        // 使用 DocumentFragment 减少 DOM 操作次数
        const fragment = document.createDocumentFragment();

        const allBtn = document.createElement('button');
        allBtn.className = 'tag-btn active';
        allBtn.textContent = t('allTags');
        allBtn.setAttribute('aria-pressed', 'true');
        allBtn.addEventListener('click', () => {
            activeTag = '全部';
            renderVupGrid(allVupsCache);
            updateTagButtons();
            announce(`已显示全部 ${allVupsCache.length} 个 VUP`);
        });
        fragment.appendChild(allBtn);

        for (const tag of tags) {
            const btn = document.createElement('button');
            btn.className = 'tag-btn';
            btn.textContent = tag;
            btn.setAttribute('aria-pressed', 'false');
            btn.addEventListener('click', () => {
                activeTag = tag;
                const filtered = allVupsCache.filter(v =>
                    Array.isArray(v.tags) && v.tags.includes(tag)
                );
                renderVupGrid(filtered);
                updateTagButtons();
                announce(`已筛选标签"${tag}"，共 ${filtered.length} 个 VUP`);
            });
            fragment.appendChild(btn);
        }

        // 一次性添加所有元素到 DOM
        tagFilterElement.appendChild(fragment);
    }

    function updateTagButtons() {
        if (!tagFilterElement) return;
        const buttons = tagFilterElement.querySelectorAll('.tag-btn');
        buttons.forEach(btn => {
            const isActive = (activeTag === '全部' && btn === tagFilterElement.firstElementChild) ||
                btn.textContent === activeTag;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    // ── 搜索 ──
    let searchDebounceTimer = null;
    
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

    // ── VUP 网格渲染（性能优化：使用 DocumentFragment） ──
    function renderVupGrid(vups) {
        vupGridElement.innerHTML = '';
        
        // 设置网格的 ARIA 属性
        vupGridElement.setAttribute('role', 'list');
        vupGridElement.setAttribute('aria-label', `VUP 列表，共 ${vups.length} 个`);

        if (vups.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'vup-grid-empty';
            empty.textContent = '—';
            empty.setAttribute('role', 'status');
            empty.setAttribute('aria-live', 'polite');
            vupGridElement.appendChild(empty);
            return;
        }

        // 使用 DocumentFragment 减少 DOM 操作次数
        const fragment = document.createDocumentFragment();

        for (const vup of vups) {
            const card = document.createElement('a');
            card.className = 'vup-grid-item';
            card.href = vup.url;
            card.target = '_blank';
            card.rel = 'noreferrer noopener';
            card.setAttribute('role', 'listitem');
            card.setAttribute('aria-label', `${vup.name}，${vup.intro || t('clickToVisit')}`);

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
            title.setAttribute('aria-hidden', 'true');

            const intro = document.createElement('span');
            intro.className = 'vup-grid-intro';
            intro.textContent = vup.intro || t('clickToVisit');
            intro.setAttribute('aria-hidden', 'true');

            card.append(image, title, intro);
            fragment.append(card);
        }

        // 一次性添加所有元素到 DOM
        vupGridElement.append(fragment);
    }

    // ── 弹窗 ──
    let focusBeforeOpen = null;

    function openAllVups() {
        pauseCountdown();
        // 保存当前焦点，关闭时恢复
        focusBeforeOpen = document.activeElement;
        overlayElement.classList.add('is-open');
        overlayElement.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        // 将焦点移到搜索框或关闭按钮
        if (searchInputElement) {
            setFocus(searchInputElement);
        } else {
            setFocus(panelCloseButton);
        }
        // 无障碍：公告弹窗打开
        announce('已打开全部 VUP 列表');
    }

    function closeAllVups() {
        overlayElement.classList.remove('is-open');
        overlayElement.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        // 恢复之前的焦点
        if (focusBeforeOpen) {
            setFocus(focusBeforeOpen);
            focusBeforeOpen = null;
        }
        // 无障碍：公告弹窗关闭
        announce('已关闭列表');
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
            // 防抖处理，避免频繁更新
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                const filtered = getFilteredVups();
                renderVupGrid(filtered);
                // 无障碍：公告搜索结果
                const query = searchInputElement.value.trim();
                if (query) {
                    announce(`找到 ${filtered.length} 个匹配"${query}"的结果`);
                } else {
                    announce(`显示 ${filtered.length} 个 VUP`);
                }
            }, 300);
        });
        
        // 支持键盘 Enter 键触发搜索
        searchInputElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                clearTimeout(searchDebounceTimer);
                const filtered = getFilteredVups();
                renderVupGrid(filtered);
                const query = searchInputElement.value.trim();
                announce(query ? `找到 ${filtered.length} 个结果` : `显示 ${filtered.length} 个 VUP`);
            }
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
