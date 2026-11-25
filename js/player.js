/* FC HUB v2 — Player Career Engine */
const PlayerCareer = {
    STORAGE_KEY: 'fchub_v2_player',
    state: {
        name: 'Степан Про',
        pos: 'ST',
        club: 'Sunderland',
        ovr: 74,
        age: 19,
        season: 1,
        matches: [] // { opp, g, a, r, res }
    },

    init() {
        this.loadState();
        this.populateBuilds();
        this.renderAll();
    },

    loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
            if (saved) this.state = { ...this.state, ...saved };
        } catch (e) {}
    },

    saveState() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    },

    renderAll() {
        document.getElementById('pcNameDisplay').textContent = this.state.name;
        document.getElementById('pcSubDisplay').textContent =
            `${this.state.pos} • OVR ${this.state.ovr} • ${this.state.club} • Возраст ${this.state.age} • Сезон ${this.state.season}`;

        const m = this.state.matches;
        const totalG = m.reduce((s, x) => s + x.g, 0);
        const totalA = m.reduce((s, x) => s + x.a, 0);
        const avgR = m.length ? (m.reduce((s, x) => s + x.r, 0) / m.length).toFixed(1) : '0.0';
        const ratio = m.length ? ((totalG + totalA) / m.length).toFixed(2) : '0.00';

        document.getElementById('pcStatMatches').textContent = m.length;
        document.getElementById('pcStatGA').textContent = `${totalG} / ${totalA}`;
        document.getElementById('pcStatRating').textContent = avgR;
        document.getElementById('pcStatRatio').textContent = ratio;

        this.renderMatches();
        this.renderClubRecommendations();
    },

    openProfileModal() {
        const s = this.state;
        App.openModal('Профиль Карьеры игрока', `
            <div class="space-y-3">
                <div>
                    <label class="text-xs text-slate-400">Имя игрока</label>
                    <input type="text" id="pcEditName" value="${s.name}" class="input-field w-full mt-1">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-xs text-slate-400">Позиция</label>
                        <select id="pcEditPos" class="input-field w-full mt-1">
                            ${['ST','LW','RW','CAM','CM','CDM','LB','RB','CB','GK'].map(p => `<option value="${p}" ${p===s.pos?'selected':''}>${p}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-slate-400">Текущий OVR</label>
                        <input type="number" id="pcEditOvr" value="${s.ovr}" min="50" max="99" class="input-field w-full mt-1">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <div>
                        <label class="text-xs text-slate-400">Клуб</label>
                        <input type="text" id="pcEditClub" value="${s.club}" class="input-field w-full mt-1">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400">Возраст</label>
                        <input type="number" id="pcEditAge" value="${s.age}" min="16" max="40" class="input-field w-full mt-1">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400">Сезон</label>
                        <input type="number" id="pcEditSeason" value="${s.season}" min="1" max="15" class="input-field w-full mt-1">
                    </div>
                </div>
                <button onclick="PlayerCareer.saveProfile()" class="btn-primary w-full">Сохранить профиль</button>
            </div>
        `);
    },

    saveProfile() {
        this.state.name = document.getElementById('pcEditName').value.trim() || 'Мой Игрок';
        this.state.pos = document.getElementById('pcEditPos').value;
        this.state.ovr = parseInt(document.getElementById('pcEditOvr').value, 10) || 74;
        this.state.club = document.getElementById('pcEditClub').value.trim() || 'Club';
        this.state.age = parseInt(document.getElementById('pcEditAge').value, 10) || 19;
        this.state.season = parseInt(document.getElementById('pcEditSeason').value, 10) || 1;
        this.saveState();
        this.renderAll();
        App.closeModal();
        App.toast('Профиль игрока обновлён');
    },

    addMatch() {
        const opp = document.getElementById('pcMatchOpp').value.trim() || 'Соперник';
        const g = parseInt(document.getElementById('pcMatchGoals').value, 10) || 0;
        const a = parseInt(document.getElementById('pcMatchAssists').value, 10) || 0;
        const r = parseFloat(document.getElementById('pcMatchRating').value) || 7.0;
        const res = document.getElementById('pcMatchResult').value;

        this.state.matches.unshift({ opp, g, a, r, res });
        document.getElementById('pcMatchOpp').value = '';
        this.saveState();
        this.renderAll();
        App.toast(`Матч против ${opp} добавлен!`);
    },

    deleteMatch(idx) {
        this.state.matches.splice(idx, 1);
        this.saveState();
        this.renderAll();
    },

    renderMatches() {
        const box = document.getElementById('pcMatchesList');
        if (!this.state.matches.length) {
            box.innerHTML = `<div class="text-xs text-slate-500 text-center py-4">Пока нет записанных матчей</div>`;
            return;
        }
        const badge = { W: 'text-[#00e87b] bg-[#00e87b]/15', D: 'text-amber-400 bg-amber-400/15', L: 'text-rose-400 bg-rose-400/15' };
        box.innerHTML = this.state.matches.map((m, i) => `
            <div class="flex items-center justify-between p-2 rounded-xl bg-[#080b11]/60 border border-white/5 text-xs">
                <div class="flex items-center gap-2">
                    <span class="px-1.5 py-0.5 rounded font-mono font-bold ${badge[m.res]}">${m.res}</span>
                    <span class="font-bold text-white">${m.opp}</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-mono text-slate-300">⚽ ${m.g} • 👟 ${m.a}</span>
                    <span class="font-mono font-bold text-amber-400">${m.r.toFixed(1)}</span>
                    <button onclick="PlayerCareer.deleteMatch(${i})" class="text-slate-500 hover:text-rose-400"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    },

    renderClubRecommendations() {
        const myOvr = this.state.ovr;
        const myPos = this.state.pos;
        const clubBest = new Map();

        for (const p of DataStore.players) {
            if (p.club === 'Free Agent' || p.club === this.state.club) continue;
            if (!p.positions.includes(myPos)) continue;
            const prev = clubBest.get(p.club);
            if (!prev || p.ovr > prev.ovr) {
                clubBest.set(p.club, { club: p.club, league: p.league, rival: p.name, ovr: p.ovr });
            }
        }

        // Clubs where current starter on your position is between myOvr - 4 and myOvr + 1
        const matches = Array.from(clubBest.values())
            .filter(c => c.ovr >= myOvr - 4 && c.ovr <= myOvr + 1)
            .sort(() => Math.random() - 0.5)
            .slice(0, 6);

        const box = document.getElementById('pcNextClubsList');
        if (!matches.length) {
            box.innerHTML = `<div class="text-xs text-slate-400">Подходящих клубов не найдено — попробуй изменить OVR.</div>`;
            return;
        }

        box.innerHTML = matches.map(c => `
            <div class="p-3 rounded-xl bg-[#080b11]/70 border border-white/5 flex items-center justify-between gap-2">
                <div>
                    <div class="text-sm font-bold text-white">${c.club}</div>
                    <div class="text-[11px] text-slate-400">${c.league} • Конкурент: ${c.rival} (OVR ${c.ovr})</div>
                </div>
                <span class="text-[11px] font-mono px-2 py-1 rounded-lg ${c.ovr <= myOvr ? 'bg-[#00e87b]/15 text-[#00e87b]' : 'bg-amber-500/15 text-amber-400'} font-bold">
                    ${c.ovr <= myOvr ? 'Основа' : 'Борьба'}
                </span>
            </div>
        `).join('');
    },

    populateBuilds() {
        const sel = document.getElementById('pcBuildSelect');
        sel.innerHTML = Object.entries(DataStore.PLAYER_BUILDS)
            .map(([k, b]) => `<option value="${k}">${b.title}</option>`).join('');
        this.renderBuild(Object.keys(DataStore.PLAYER_BUILDS)[0]);
    },

    renderBuild(key) {
        const b = DataStore.PLAYER_BUILDS[key];
        if (!b) return;
        document.getElementById('pcBuildDetails').innerHTML = `
            <div class="p-3 rounded-xl bg-[#080b11]/70 border border-white/5 text-xs space-y-2">
                <div class="font-bold text-[#00e87b]">${b.body}</div>
                <div>
                    <div class="text-slate-400 mb-1">Приоритет прокачки:</div>
                    <ul class="list-disc list-inside text-slate-200 space-y-0.5">
                        ${b.focus.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
                <div>
                    <div class="text-slate-400 mb-1">Топ PlayStyles:</div>
                    <div class="flex flex-wrap gap-1.5">
                        ${b.playstyles.map(ps => `<span class="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">${ps}</span>`).join('')}
                    </div>
                </div>
                <div class="pt-2 border-t border-white/5 text-slate-300"><i class="fa-solid fa-lightbulb text-[#00e87b] mr-1"></i>${b.tip}</div>
            </div>
        `;
    },

    rollChallenge() {
        const ch = DataStore.CHALLENGES[Math.floor(Math.random() * DataStore.CHALLENGES.length)];
        document.getElementById('challengeCard').innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#00e87b]/15 text-[#00e87b]">${ch.mode}</span>
            </div>
            <div class="font-display text-base font-extrabold text-white">${ch.title}</div>
            <p class="text-xs text-slate-300 leading-relaxed">${ch.rule}</p>
            <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                <b>Ограничение:</b> ${ch.constraint}
            </div>
        `;
    }
};
