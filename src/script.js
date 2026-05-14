/**
 * @author Huameitang
 * @description 纯静态前端入口。
 *              页面从 /vup.json 获取全部数据，在浏览器端完成随机选择、
 *              连续去重、倒计时跳转与头像回退逻辑，兼容本地 Node 预览与 EdgeOne 静态部署。
 *              支持：标签筛选、搜索、主题切换、国际化、离线缓存。
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // 模块：国际化 (i18n)
    // ═══════════════════════════════════════════════════════════
    const I18N = {
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
            themeDark: '深色',
            toastPaused: '倒计时已暂停',
            toastResumed: '倒计时已恢复',
            toastCopied: '链接已复制到剪贴板',
            toastShareSuccess: '分享成功',
            toastCopyFailed: '复制失败，请手动复制',
            toastNoShare: '暂无可分享的 VUP',
            announcePaused: '倒计时已暂停',
            announceResumed: '倒计时已恢复'
        },
        en: {
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
            themeDark: 'Dark',
            toastPaused: 'Countdown paused',
            toastResumed: 'Countdown resumed',
            toastCopied: 'Link copied to clipboard',
            toastShareSuccess: 'Shared successfully',
            toastCopyFailed: 'Copy failed, please copy manually',
            toastNoShare: 'No VUP to share',
            announcePaused: 'Countdown paused',
            announceResumed: 'Countdown resumed'
        }
    };

    function getLang() {
        const stored = localStorage.getItem('lang');
        if (stored) {
            return stored;
        }
        const nav = navigator.language || 'zh-CN';
        return nav.startsWith('zh') ? 'zh-CN' : 'en';
    }

    function t(key) {
        return (I18N[getLang()] || I18N['zh-CN'])[key] || key;
    }

    // ═══════════════════════════════════════════════════════════
    // 模块：DOM 工具
    // ═══════════════════════════════════════════════════════════
    const DOM = {
        $: (id) => document.getElementById(id),
        announce: (msg) => {
            const el = document.getElementById('a11y-announcer');
            if (!el) {
                return;
            }
            el.textContent = '';
            setTimeout(() => {
                el.textContent = msg;
            }, 100);
        },
        setFocus: (el) => {
            if (el) {
                el.focus({ preventScroll: false });
            }
        },
        showToast: (message, type = 'info', duration = 2500) => {
            const container = document.getElementById('toast-container');
            if (!container) {
                return;
            }
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('is-visible'));
            setTimeout(() => {
                toast.classList.remove('is-visible');
                setTimeout(() => toast.parentNode?.removeChild(toast), 300);
            }, duration);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：主题
    // ═══════════════════════════════════════════════════════════
    const Theme = {
        get: () => {
            const stored = localStorage.getItem('theme');
            if (stored) {
                return stored;
            }
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        },
        apply: (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            const btn = document.getElementById('theme-toggle');
            if (btn) {
                btn.textContent = theme === 'light' ? '🌙' : '☀️';
                btn.setAttribute('aria-label', theme === 'light' ? t('themeDark') : t('themeLight'));
            }
        },
        toggle: () => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            Theme.apply(next);
            DOM.announce(next === 'light' ? '已切换到浅色主题' : '已切换到深色主题');
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：语言
    // ═══════════════════════════════════════════════════════════
    const Lang = {
        apply: () => {
            const lang = getLang();
            const btn = document.getElementById('lang-toggle');
            if (btn) {
                btn.textContent = lang === 'zh-CN' ? 'EN' : '中';
                btn.setAttribute('aria-label', lang === 'zh-CN' ? '切换到英语' : '切换到中文');
            }
            document.title = t('title');
            const nameEl = document.getElementById('name');
            if (nameEl && (nameEl.textContent === '加载中…' || nameEl.textContent === 'Loading…')) {
                nameEl.textContent = t('loading');
            }
            ['jump-label', 'change-label', 'show-all-label', 'countdown-label', 'panel-title'].forEach((id) => {
                const el = document.getElementById(id);
                const keyMap = {
                    'jump-label': 'jumpNow',
                    'change-label': 'changeOne',
                    'show-all-label': 'showAll',
                    'countdown-label': 'secondsLeft',
                    'panel-title': 'allVupTitle'
                };
                if (el) {
                    el.textContent = t(keyMap[id]);
                }
            });
            const searchInput = document.getElementById('vup-search');
            if (searchInput) {
                searchInput.placeholder = t('searchPlaceholder');
            }
            if (window.__allVupsCache?.length > 0) {
                VupGrid.renderTagFilter();
                VupGrid.render(window.__allVupsCache);
            }
        },
        toggle: () => {
            const current = getLang();
            const next = current === 'zh-CN' ? 'en' : 'zh-CN';
            localStorage.setItem('lang', next);
            Lang.apply();
            DOM.announce(next === 'zh-CN' ? '已切换到中文' : 'Switched to English');
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：头像路径
    // ═══════════════════════════════════════════════════════════
    const Avatar = {
        path: (vup, size = 'card') => {
            const uid = vup.uid || '';
            if (!uid) {
                return '';
            }
            const suffix = size === 'thumb' ? '@72w' : size === 'card' ? '@140w' : '';
            return `/face_img/${uid}${suffix}.webp`;
        },
        fallback: (vup) => {
            const uid = vup.uid || '';
            return uid ? `/face_img/${uid}.jpg` : '';
        },
        setupErrorHandler: (imgEl, vup) => {
            let errorCount = 0;
            const avatarFallback = Avatar.fallback(vup);
            imgEl.onerror = () => {
                errorCount++;
                if (errorCount === 1 && avatarFallback) {
                    imgEl.src = avatarFallback;
                } else if (errorCount === 2 && vup.avatar && imgEl.src !== vup.avatar) {
                    imgEl.src = vup.avatar.replace(/^http:\/\//, 'https://');
                } else {
                    imgEl.onerror = null;
                }
            };
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：倒计时
    // ═══════════════════════════════════════════════════════════
    const COUNTDOWN_SECONDS = 10;
    const CIRCUMFERENCE = 2 * Math.PI * 54;

    const Countdown = {
        _timerId: null,
        _value: COUNTDOWN_SECONDS,
        _targetUrl: '#',
        _pausedAt: null,
        _isPaused: false,

        get isRunning() {
            return this._timerId !== null;
        },

        start: (url) => {
            Countdown.stop();
            Countdown._targetUrl = url;
            Countdown._value = COUNTDOWN_SECONDS;
            Countdown._isPaused = false;
            Countdown._pausedAt = null;
            Countdown._updateUI(false);
            const ring = document.getElementById('countdown-ring');
            if (ring) {
                ring.style.strokeDashoffset = 0;
            }
            const num = document.getElementById('countdown');
            if (num) {
                num.textContent = Countdown._value;
            }

            Countdown._timerId = setInterval(() => {
                Countdown._value--;
                const n = document.getElementById('countdown');
                if (n) {
                    n.textContent = Countdown._value;
                }
                const r = document.getElementById('countdown-ring');
                if (r) {
                    r.style.strokeDashoffset =
                        (CIRCUMFERENCE * (COUNTDOWN_SECONDS - Countdown._value)) / COUNTDOWN_SECONDS;
                }
                if (Countdown._value <= 0) {
                    Countdown.stop();
                    window.location.href = Countdown._targetUrl;
                }
            }, 1000);
        },

        stop: () => {
            if (Countdown._timerId) {
                clearInterval(Countdown._timerId);
                Countdown._timerId = null;
            }
        },

        pause: () => {
            if (Countdown._timerId) {
                clearInterval(Countdown._timerId);
                Countdown._timerId = null;
                Countdown._pausedAt = Countdown._value;
            }
        },

        resume: () => {
            if (Countdown._pausedAt !== null && Countdown._pausedAt > 0) {
                Countdown._value = Countdown._pausedAt;
                Countdown._pausedAt = null;
                Countdown.start(Countdown._targetUrl);
            }
        },

        toggle: () => {
            if (Countdown._isPaused) {
                Countdown._isPaused = false;
                Countdown.resume();
                Countdown._updateUI(false);
                DOM.showToast(t('toastResumed'), 'info', 1500);
                DOM.announce(t('announceResumed'));
            } else {
                Countdown._isPaused = true;
                Countdown.pause();
                Countdown._updateUI(true);
                DOM.showToast(t('toastPaused'), 'info', 1500);
                DOM.announce(t('announcePaused'));
            }
        },

        _updateUI: (paused) => {
            const btn = document.getElementById('pause-btn');
            if (!btn) {
                return;
            }
            btn.classList.toggle('is-paused', paused);
            const label = paused ? '恢复倒计时' : '暂停倒计时';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
            btn.innerHTML = paused
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>';
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：时钟
    // ═══════════════════════════════════════════════════════════
    const Clock = {
        start: () => {
            Clock.update();
            window.setInterval(Clock.update, 1000);
        },
        update: () => {
            const el = document.getElementById('clock-chip');
            if (el) {
                el.textContent = new Date().toLocaleTimeString('zh-CN', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：VUP 网格（展示全部弹窗）
    // ═══════════════════════════════════════════════════════════
    const VupGrid = {
        _activeTag: '全部',
        _focusBeforeOpen: null,

        getTags: (vups) => {
            const set = new Set();
            for (const v of vups) {
                if (Array.isArray(v.tags)) {
                    v.tags.forEach((tag) => set.add(tag));
                }
            }
            return Array.from(set).sort();
        },

        renderTagFilter: () => {
            const container = document.getElementById('tag-filter');
            if (!container) {
                return;
            }
            const tags = VupGrid.getTags(window.__allVupsCache || []);
            container.innerHTML = '';
            container.setAttribute('role', 'group');
            container.setAttribute('aria-label', '按标签筛选 VUP');

            const fragment = document.createDocumentFragment();
            const allBtn = document.createElement('button');
            allBtn.className = 'tag-btn active';
            allBtn.textContent = t('allTags');
            allBtn.setAttribute('aria-pressed', 'true');
            allBtn.addEventListener('click', () => {
                VupGrid._activeTag = '全部';
                VupGrid.render(window.__allVupsCache);
                VupGrid._updateButtons();
                DOM.announce(`已显示全部 ${window.__allVupsCache.length} 个 VUP`);
            });
            fragment.appendChild(allBtn);

            for (const tag of tags) {
                const btn = document.createElement('button');
                btn.className = 'tag-btn';
                btn.textContent = tag;
                btn.setAttribute('aria-pressed', 'false');
                btn.addEventListener('click', () => {
                    VupGrid._activeTag = tag;
                    const filtered = window.__allVupsCache.filter((v) => Array.isArray(v.tags) && v.tags.includes(tag));
                    VupGrid.render(filtered);
                    VupGrid._updateButtons();
                    DOM.announce(`已筛选标签"${tag}"，共 ${filtered.length} 个 VUP`);
                });
                fragment.appendChild(btn);
            }
            container.appendChild(fragment);
        },

        _updateButtons: () => {
            const container = document.getElementById('tag-filter');
            if (!container) {
                return;
            }
            container.querySelectorAll('.tag-btn').forEach((btn, idx) => {
                const isActive = (VupGrid._activeTag === '全部' && idx === 0) || btn.textContent === VupGrid._activeTag;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        },

        render: (vups) => {
            const grid = document.getElementById('vup-grid');
            if (!grid) {
                return;
            }
            grid.innerHTML = '';
            grid.setAttribute('role', 'list');
            grid.setAttribute('aria-label', `VUP 列表，共 ${vups.length} 个`);

            if (vups.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'vup-grid-empty';
                empty.textContent = '—';
                empty.setAttribute('role', 'status');
                empty.setAttribute('aria-live', 'polite');
                grid.appendChild(empty);
                return;
            }

            const fragment = document.createDocumentFragment();
            for (const vup of vups) {
                const card = document.createElement('a');
                card.className = 'vup-grid-item';
                card.href = vup.url;
                card.target = '_blank';
                card.rel = 'noreferrer noopener';
                card.setAttribute('role', 'listitem');
                card.setAttribute('aria-label', `${vup.name}，${vup.intro || t('clickToVisit')}`);

                const img = document.createElement('img');
                img.className = 'vup-grid-avatar';
                img.src = Avatar.path(vup, 'thumb');
                img.alt = `${vup.name} 的头像`;
                img.loading = 'lazy';
                Avatar.setupErrorHandler(img, vup);

                const title = document.createElement('span');
                title.className = 'vup-grid-name';
                title.textContent = vup.name;
                title.setAttribute('aria-hidden', 'true');

                const intro = document.createElement('span');
                intro.className = 'vup-grid-intro';
                intro.textContent = vup.intro || t('clickToVisit');
                intro.setAttribute('aria-hidden', 'true');

                card.append(img, title, intro);
                fragment.appendChild(card);
            }
            grid.append(fragment);
        },

        open: () => {
            Countdown.pause();
            VupGrid._focusBeforeOpen = document.activeElement;
            const overlay = document.getElementById('all-vup-overlay');
            if (overlay) {
                overlay.classList.add('is-open');
                overlay.setAttribute('aria-hidden', 'false');
            }
            document.body.classList.add('modal-open');
            const searchInput = document.getElementById('vup-search');
            DOM.setFocus(searchInput || document.getElementById('panel-close-btn'));
            DOM.announce('已打开全部 VUP 列表');
        },

        close: () => {
            const overlay = document.getElementById('all-vup-overlay');
            if (overlay) {
                overlay.classList.remove('is-open');
                overlay.setAttribute('aria-hidden', 'true');
            }
            document.body.classList.remove('modal-open');
            if (VupGrid._focusBeforeOpen) {
                DOM.setFocus(VupGrid._focusBeforeOpen);
                VupGrid._focusBeforeOpen = null;
            }
            DOM.announce('已关闭列表');
            Countdown.resume();
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：搜索索引（倒排索引，支撑大规模搜索）
    // ═══════════════════════════════════════════════════════════
    const SearchIndex = {
        _index: new Map(),

        tokenize: (text) => {
            if (!text) {
                return [];
            }
            // 按非字母数字中文字符分割
            const tokens = text
                .toLowerCase()
                .split(/[^a-z0-9\u4e00-\u9fff]+/)
                .filter((t) => t.length > 0);
            // 额外提取连续中文子串（支持前缀匹配）
            const chineseTokens = text.match(/[\u4e00-\u9fff]{1,}/g) || [];
            return [...new Set([...tokens, ...chineseTokens])];
        },

        build: (vups) => {
            SearchIndex._index.clear();
            for (let i = 0; i < vups.length; i++) {
                const vup = vups[i];
                const text = `${vup.name} ${vup.intro || ''}`;
                const tokens = SearchIndex.tokenize(text);
                for (const token of tokens) {
                    if (!SearchIndex._index.has(token)) {
                        SearchIndex._index.set(token, new Set());
                    }
                    SearchIndex._index.get(token).add(i);
                }
            }
            return SearchIndex._index.size;
        },

        search: (query) => {
            const q = query.trim().toLowerCase();
            if (!q) {
                return null;
            } // null 表示无搜索词，返回全部

            // 精确词匹配
            if (SearchIndex._index.has(q)) {
                return Array.from(SearchIndex._index.get(q));
            }

            // 前缀匹配
            const results = new Set();
            for (const [token, indices] of SearchIndex._index) {
                if (token.startsWith(q) || q.startsWith(token)) {
                    for (const idx of indices) {
                        results.add(idx);
                    }
                }
            }

            // 子串回退
            if (results.size === 0) {
                for (const [token, indices] of SearchIndex._index) {
                    if (token.includes(q) || q.includes(token)) {
                        for (const idx of indices) {
                            results.add(idx);
                        }
                    }
                }
            }

            return results.size > 0 ? Array.from(results) : [];
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：搜索
    // ═══════════════════════════════════════════════════════════
    const Search = {
        _debounceTimer: null,

        getFiltered: () => {
            const input = document.getElementById('vup-search');
            const query = (input ? input.value : '').trim();
            let vups = window.__allVupsCache || [];
            if (VupGrid._activeTag !== '全部') {
                vups = vups.filter((v) => Array.isArray(v.tags) && v.tags.includes(VupGrid._activeTag));
            }
            if (query) {
                const indices = SearchIndex.search(query);
                if (indices !== null) {
                    vups = indices.map((i) => window.__allVupsCache[i]).filter(Boolean);
                }
            }
            return vups;
        },

        onInput: () => {
            clearTimeout(Search._debounceTimer);
            Search._debounceTimer = setTimeout(() => {
                const filtered = Search.getFiltered();
                VupGrid.render(filtered);
                const input = document.getElementById('vup-search');
                const query = input ? input.value.trim() : '';
                DOM.announce(
                    query ? `找到 ${filtered.length} 个匹配"${query}"的结果` : `显示 ${filtered.length} 个 VUP`
                );
            }, 300);
        },

        onEnter: () => {
            clearTimeout(Search._debounceTimer);
            const filtered = Search.getFiltered();
            VupGrid.render(filtered);
            const input = document.getElementById('vup-search');
            const query = input ? input.value.trim() : '';
            DOM.announce(query ? `找到 ${filtered.length} 个结果` : `显示 ${filtered.length} 个 VUP`);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：分享
    // ═══════════════════════════════════════════════════════════
    const Share = {
        currentVupUrl: '#',

        share: () => {
            const nameEl = document.getElementById('name');
            const vupName = nameEl ? nameEl.textContent : '';
            if (!vupName || vupName === t('loading') || vupName === t('loadFailed')) {
                DOM.showToast(t('toastNoShare'), 'info', 1500);
                return;
            }
            const text = `${vupName} 的 Bilibili 主页：${Share.currentVupUrl}`;
            if (navigator.share) {
                navigator
                    .share({ title: `${vupName} - Bilibili`, text, url: Share.currentVupUrl })
                    .then(() => DOM.showToast(t('toastShareSuccess'), 'success', 1500))
                    .catch(() => {});
            } else if (navigator.clipboard?.writeText) {
                navigator.clipboard
                    .writeText(text)
                    .then(() => DOM.showToast(`已复制 ${vupName} 的链接`, 'success', 2000))
                    .catch(() => Share._fallback(text));
            } else {
                Share._fallback(text);
            }
        },

        _fallback: (text) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                DOM.showToast(t('toastCopied'), 'success', 2000);
            } catch {
                DOM.showToast(t('toastCopyFailed'), 'error', 2000);
            }
            document.body.removeChild(ta);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：主 VUP 卡片
    // ═══════════════════════════════════════════════════════════
    const Card = {
        currentUrl: '#',
        lastVupName: localStorage.getItem('lastVupName') || '',

        update: (vup) => {
            const avatarEl = document.getElementById('avatar');
            const nameEl = document.getElementById('name');
            const introEl = document.getElementById('intro');
            const jumpBtn = document.getElementById('jump-button');

            if (avatarEl) {
                avatarEl.alt = `${vup.name}的头像`;
                avatarEl.src = Avatar.path(vup, 'card');
                Avatar.setupErrorHandler(avatarEl, vup);
            }
            if (nameEl) {
                nameEl.textContent = vup.name;
            }
            if (introEl) {
                introEl.textContent = vup.intro || t('noIntro');
            }
            if (jumpBtn) {
                jumpBtn.href = vup.url;
            }

            Card.currentUrl = vup.url;
            Share.currentVupUrl = vup.url;
            DOM.announce(`已选择 ${vup.name}`);
        },

        pickAnother: () => {
            const cache = window.__allVupsCache;
            if (!cache || cache.length === 0) {
                return;
            }
            const nameEl = document.getElementById('name');
            const lastName = nameEl ? nameEl.textContent : '';
            let available = cache.filter((v) => v.name !== lastName);
            if (available.length === 0) {
                available = cache;
            }
            const selected = available[Math.floor(Math.random() * available.length)];
            localStorage.setItem('lastVupName', selected.name);

            const card = document.querySelector('.card');
            if (card) {
                card.classList.add('card-exit');
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        Card.update(selected);
                        Countdown.start(selected.url);
                        card.classList.remove('card-exit');
                        card.classList.add('card-enter');
                        setTimeout(() => {
                            card.classList.remove('card-enter');
                            DOM.setFocus(card);
                        }, 300);
                    }, 200);
                });
            } else {
                Card.update(selected);
                Countdown.start(selected.url);
            }
        },

        load: async () => {
            try {
                const res = await fetch('/vup.json');
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const allVups = await res.json();
                if (!Array.isArray(allVups) || allVups.length === 0) {
                    throw new Error('VUP 数据为空或格式不正确');
                }

                const lastName = localStorage.getItem('lastVupName');
                let available = allVups;
                if (lastName) {
                    const filtered = allVups.filter((v) => v.name !== lastName);
                    if (filtered.length > 0) {
                        available = filtered;
                    }
                }
                const selected = available[Math.floor(Math.random() * available.length)];
                localStorage.setItem('lastVupName', selected.name);
                window.__allVupsCache = allVups;

                // 使用 requestIdleCallback 在空闲时建立搜索索引
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(() => SearchIndex.build(allVups), { timeout: 2000 });
                } else {
                    setTimeout(() => SearchIndex.build(allVups), 100);
                }

                Card.update(selected);
                VupGrid.renderTagFilter();
                VupGrid.render(allVups);
                Countdown.start(selected.url);
            } catch (err) {
                console.error('获取VUP数据失败:', err);
                const nameEl = document.getElementById('name');
                const introEl = document.getElementById('intro');
                const countdownEl = document.getElementById('countdown');
                if (nameEl) {
                    nameEl.textContent = t('loadFailed');
                }
                if (introEl) {
                    introEl.textContent = t('loadFailedDesc');
                }
                if (countdownEl) {
                    countdownEl.textContent = '--';
                }
                DOM.showToast(t('loadFailed'), 'error', 4000);
            }
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：键盘快捷键
    // ═══════════════════════════════════════════════════════════
    const Shortcuts = {
        init: () => {
            document.addEventListener('keydown', (e) => {
                const searchInput = document.getElementById('vup-search');
                const isSearchFocused = document.activeElement === searchInput;

                if (e.key === 'Escape') {
                    VupGrid.close();
                    return;
                }
                if (isSearchFocused) {
                    return;
                }
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return;
                }

                switch (e.key.toLowerCase()) {
                    case ' ':
                    case 'n':
                        e.preventDefault();
                        Card.pickAnother();
                        break;
                    case 'p':
                        e.preventDefault();
                        Countdown.toggle();
                        break;
                    case 'l':
                        e.preventDefault();
                        if (window.__allVupsCache?.length > 0) {
                            VupGrid.open();
                        }
                        break;
                    case 's':
                        e.preventDefault();
                        Share.share();
                        break;
                    case 'enter':
                        if (Card.currentUrl && Card.currentUrl !== '#') {
                            window.location.href = Card.currentUrl;
                        }
                        break;
                }
            });
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：页面可见性
    // ═══════════════════════════════════════════════════════════
    const Visibility = {
        init: () => {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    Countdown.pause();
                } else {
                    const overlay = document.getElementById('all-vup-overlay');
                    if (!overlay?.classList.contains('is-open')) {
                        Countdown.resume();
                    }
                }
            });
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 模块：事件绑定
    // ═══════════════════════════════════════════════════════════
    const Events = {
        init: () => {
            const changeBtn = document.getElementById('change-button');
            if (changeBtn) {
                changeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    Card.pickAnother();
                });
            }

            const pauseBtn = document.getElementById('pause-btn');
            if (pauseBtn) {
                pauseBtn.addEventListener('click', Countdown.toggle);
            }

            const shareBtn = document.getElementById('share-button');
            if (shareBtn) {
                shareBtn.addEventListener('click', Share.share);
            }

            const showAllBtn = document.getElementById('show-all-btn');
            if (showAllBtn) {
                showAllBtn.addEventListener('click', () => {
                    if (window.__allVupsCache?.length > 0) {
                        VupGrid.open();
                    }
                });
            }

            const closeBtn = document.getElementById('panel-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', VupGrid.close);
            }

            const overlay = document.getElementById('all-vup-overlay');
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        VupGrid.close();
                    }
                });
            }

            const searchInput = document.getElementById('vup-search');
            if (searchInput) {
                searchInput.addEventListener('input', Search.onInput);
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        Search.onEnter();
                    }
                });
            }

            const themeBtn = document.getElementById('theme-toggle');
            if (themeBtn) {
                themeBtn.addEventListener('click', Theme.toggle);
            }

            const langBtn = document.getElementById('lang-toggle');
            if (langBtn) {
                langBtn.addEventListener('click', Lang.toggle);
            }

            const jumpBtn = document.getElementById('jump-button');
            if (jumpBtn) {
                jumpBtn.addEventListener('click', (e) => {
                    if (!Card.currentUrl || Card.currentUrl === '#') {
                        e.preventDefault();
                    }
                });
            }
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 初始化入口
    // ═══════════════════════════════════════════════════════════
    function init() {
        Theme.apply(Theme.get());
        Lang.apply();
        Card.load();
        Clock.start();
        Events.init();
        Shortcuts.init();
        Visibility.init();

        // Service Worker 注册
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
    }

    init();
})();
