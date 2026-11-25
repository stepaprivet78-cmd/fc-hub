/* FC HUB v2 — Main App Controller & Telegram Mini App Bridge */
const App = {
    mode: 'manager', // 'manager' | 'player'
    tab: 'manager-club',

    TABS: {
        manager: [
            { id: 'manager-club',  label: 'Мой клуб',   icon: 'fa-shield-halved' },
            { id: 'manager-scout', label: 'Скаут 18K+', icon: 'fa-magnifying-glass' },
            { id: 'manager-duel',  label: 'Дуэль 1v1',  icon: 'fa-scale-balanced' }
        ],
        player: [
            { id: 'player-hub',    label: 'Карьера',    icon: 'fa-futbol' },
            { id: 'player-builds', label: 'Билды и Сюжет', icon: 'fa-bolt' }
        ]
    },

    async init() {
        // Telegram Mini App integration
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();
            try { tg.setHeaderColor('#080b11'); tg.setBackgroundColor('#080b11'); } catch (e) {}
        }

        try {
            await DataStore.load();
            document.getElementById('dbMetaBadge').textContent =
                `${DataStore.meta.count.toLocaleString('ru-RU')} игроков • ${DataStore.meta.clubsCount} клубов`;

            Manager.init();
            PlayerCareer.init();
            this.setMode('manager');

            document.getElementById('appLoader').classList.add('hidden');
        } catch (err) {
            console.error(err);
            document.getElementById('loaderStatus').innerHTML =
                `<span class="text-rose-400">Ошибка загрузки базы. Запустите проект через локальный сервер (Live Server / Python / GitHub Pages).</span>`;
        }
    },

    setMode(newMode) {
        this.mode = newMode;
        document.getElementById('modeBtnManager').classList.toggle('active', newMode === 'manager');
        document.getElementById('modeBtnPlayer').classList.toggle('active', newMode === 'player');
        this.renderNav();
        this.setTab(this.TABS[newMode][0].id);
    },

    renderNav() {
        const items = this.TABS[this.mode];
        document.getElementById('desktopNavTabs').innerHTML = items.map(t => `
            <button onclick="App.setTab('${t.id}')" data-tab="${t.id}" class="nav-item px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                <i class="fa-solid ${t.icon}"></i> ${t.label}
            </button>
        `).join('');

        document.getElementById('mobileBottomNav').innerHTML = items.map(t => `
            <button onclick="App.setTab('${t.id}')" data-tab="${t.id}" class="mobile-nav-item flex flex-col items-center justify-center py-1.5 px-4 gap-1">
                <i class="fa-solid ${t.icon} text-base"></i>
                <span class="text-[10px] font-bold">${t.label}</span>
            </button>
        `).join('');
    },

    setTab(tabId) {
        this.tab = tabId;
        document.querySelectorAll('.app-view').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`view-${tabId}`);
        if (target) target.classList.remove('hidden');

        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    openModal(title, bodyHtml) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHtml;
        document.getElementById('modalBackdrop').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('modalBackdrop').classList.add('hidden');
    },

    toast(msg) {
        const container = document.getElementById('toastContainer');
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 220); }, 2600);
    },

    exportSave() {
        const payload = {
            manager: Manager.state,
            player: PlayerCareer.state,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `fc-hub-save-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        this.toast('Бэкап сохранения скачан!');
    },

    importSave(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.manager) { Manager.state = { ...Manager.state, ...data.manager }; Manager.saveState(); }
                if (data.player) { PlayerCareer.state = { ...PlayerCareer.state, ...data.player }; PlayerCareer.saveState(); }
                Manager.init();
                PlayerCareer.init();
                this.toast('Сохранение успешно восстановлено!');
            } catch (err) {
                this.toast('Ошибка чтения файла сохранения');
            }
        };
        reader.readAsText(file);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
