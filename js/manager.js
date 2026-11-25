/* FC HUB v2 — Manager Career Engine */
const Manager = {
    STORAGE_KEY: 'fchub_v2_manager',
    state: {
        club: 'Sunderland',
        league: 'Championship',
        budget: 15000000,
        formation: '4-2-3-1',
        lineup: [], // array of 11 player IDs
        addedIds: [], // bought players
        removedIds: [], // sold players
        ovrOverrides: {}, // { [id]: customOvr }
        shortlist: [] // array of player IDs
    },
    scoutLimit: 24,
    scoutFiltered: [],
    scoutShortlistOnly: false,
    scoutExpiringOnly: false,
    duelP1: null,
    duelP2: null,

    init() {
        this.loadState();
        this.populateFormations();
        this.populateLeagues();

        // Fallback if saved club doesn't exist
        if (!DataStore.clubLeagueMap.has(this.state.club)) {
            const champClubs = DataStore.clubsByLeague.get('Championship');
            if (champClubs && champClubs.size > 0) {
                this.state.league = 'Championship';
                this.state.club = Array.from(champClubs).sort()[0];
            } else {
                this.state.league = DataStore.leagues[0];
                this.state.club = DataStore.clubs[0];
            }
        } else {
            this.state.league = DataStore.clubLeagueMap.get(this.state.club);
        }

        document.getElementById('leagueFilterSelect').value = this.state.league;
        this.populateClubsForLeague(this.state.league);
        document.getElementById('clubSelect').value = this.state.club;
        document.getElementById('formationSelect').value = this.state.formation;

        if (!this.state.lineup || this.state.lineup.length !== 11) {
            this.autoPickBestXI(true);
        }

        // Default Duel players
        this.duelP1 = DataStore.players[0];
        this.duelP2 = DataStore.players[1];

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
        const sc = document.getElementById('shortlistCount');
        if (sc) sc.textContent = this.state.shortlist.length;
    },

    getEffectiveOvr(p) {
        return this.state.ovrOverrides[p.id] ?? p.ovr;
    },

    getClubSquad() {
        const base = DataStore.players.filter(p => p.club === this.state.club && !this.state.removedIds.includes(p.id));
        const added = this.state.addedIds
            .map(id => DataStore.playersById.get(id))
            .filter(p => p && !base.some(b => b.id === p.id));
        return [...base, ...added].sort((a, b) => this.getEffectiveOvr(b) - this.getEffectiveOvr(a));
    },

    populateFormations() {
        const sel = document.getElementById('formationSelect');
        sel.innerHTML = Object.entries(DataStore.FORMATIONS)
            .map(([k, f]) => `<option value="${k}">${f.name}</option>`).join('');
    },

    populateLeagues() {
        const sel = document.getElementById('leagueFilterSelect');
        const leagues = Array.from(DataStore.clubsByLeague.keys()).sort();
        sel.innerHTML = leagues.map(l => `<option value="${l}">${l}</option>`).join('');
    },

    populateClubsForLeague(league) {
        const sel = document.getElementById('clubSelect');
        const clubs = Array.from(DataStore.clubsByLeague.get(league) || []).sort();
        sel.innerHTML = clubs.map(c => `<option value="${c}">${c}</option>`).join('');
    },

    onLeagueSelectChange() {
        const lg = document.getElementById('leagueFilterSelect').value;
        this.populateClubsForLeague(lg);
        const firstClub = document.getElementById('clubSelect').value;
        if (firstClub) this.selectClub(firstClub);
    },

    selectClub(clubName) {
        this.state.club = clubName;
        this.state.league = DataStore.clubLeagueMap.get(clubName) || '';
        this.state.addedIds = [];
        this.state.removedIds = [];
        this.state.lineup = [];
        this.autoPickBestXI(true);
        this.saveState();
        this.renderAll();
        App.toast(`Загружен клуб: ${clubName}`);
    },

    setFormation(formKey) {
        this.state.formation = formKey;
        this.autoPickBestXI(true);
        this.saveState();
        this.renderClubView();
    },

    autoPickBestXI(silent = false) {
        const squad = this.getClubSquad();
        const form = DataStore.FORMATIONS[this.state.formation];
        const used = new Set();
        const lineup = [];

        form.slots.forEach(slot => {
            const compat = DataStore.POS_COMPAT[slot.pos] || [slot.pos];
            let best = null;
            let bestScore = -1;

            for (const p of squad) {
                if (used.has(p.id)) continue;
                const ovr = this.getEffectiveOvr(p);
                let penalty = 25;
                if (p.pos === slot.pos) penalty = 0;
                else if (p.positions.includes(slot.pos)) penalty = 2;
                else {
                    const idx = compat.findIndex(c => p.positions.includes(c));
                    if (idx !== -1) penalty = 4 + idx * 3;
                }
                if (slot.pos === 'GK' && p.pos !== 'GK') penalty = 60;
                if (slot.pos !== 'GK' && p.pos === 'GK') penalty = 60;

                const score = ovr - penalty;
                if (score > bestScore) {
                    bestScore = score;
                    best = p;
                }
            }
            if (best) {
                used.add(best.id);
                lineup.push(best.id);
            } else {
                lineup.push(null);
            }
        });

        this.state.lineup = lineup;
        this.saveState();
        if (!silent) {
            this.renderClubView();
            App.toast('Стартовый XI подобран автоматически');
        }
    },

    renderAll() {
        this.renderClubView();
        this.renderScout();
        this.renderDuel();
        const sc = document.getElementById('shortlistCount');
        if (sc) sc.textContent = this.state.shortlist.length;
    },

    renderClubView() {
        const squad = this.getClubSquad();
        const starters = this.state.lineup.map(id => DataStore.playersById.get(id)).filter(Boolean);

        document.getElementById('activeClubTitle').textContent = this.state.club;
        document.getElementById('activeClubSub').textContent = `${this.state.league} • ${DataStore.FORMATIONS[this.state.formation].name} (${DataStore.FORMATIONS[this.state.formation].style})`;
        document.getElementById('clubBudgetDisplay').textContent = DataStore.formatMoney(this.state.budget);

        const avgOvr = starters.length ? (starters.reduce((s, p) => s + this.getEffectiveOvr(p), 0) / starters.length).toFixed(1) : '—';
        const avgAge = squad.length ? (squad.reduce((s, p) => s + p.age, 0) / squad.length).toFixed(1) : '—';
        const totalVal = squad.reduce((s, p) => s + p.val, 0);
        const expiring = squad.filter(p => p.contract > 0 && p.contract <= 2026).length;

        document.getElementById('kpiAvgOvr').textContent = avgOvr;
        document.getElementById('kpiAvgAge').textContent = `${avgAge} л.`;
        document.getElementById('kpiSquadValue').textContent = DataStore.formatMoney(totalVal);
        document.getElementById('kpiSquadCount').textContent = `${squad.length} / ${expiring}`;

        this.renderPitch(starters, parseFloat(avgOvr) || 70);
        this.renderAnalysis(squad, starters, parseFloat(avgOvr) || 70);
        this.renderRoster(squad);
    },

    renderPitch(starters, avgOvr) {
        const layer = document.getElementById('pitchTokensLayer');
        const form = DataStore.FORMATIONS[this.state.formation];

        layer.innerHTML = form.slots.map((slot, idx) => {
            const p = DataStore.playersById.get(this.state.lineup[idx]);
            if (!p) {
                return `
                <div class="pitch-token" style="left:${slot.x}%; top:${slot.y}%" onclick="Manager.openSlotModal(${idx})">
                    <div class="pitch-token-circle weak-slot"><span class="text-xs font-bold text-rose-400">+</span></div>
                    <div class="pitch-token-label">${slot.pos}</div>
                </div>`;
            }
            const ovr = this.getEffectiveOvr(p);
            const isWeak = ovr < avgOvr - 3.5;
            const outOfPos = !p.positions.includes(slot.pos);
            const ringClass = isWeak ? 'weak-slot' : (outOfPos ? 'out-of-pos' : '');

            return `
            <div class="pitch-token" style="left:${slot.x}%; top:${slot.y}%" onclick="Manager.openSlotModal(${idx})">
                <div class="pitch-token-circle ${ringClass}">
                    <span class="font-mono text-xs font-extrabold text-white leading-none">${ovr}</span>
                    <span class="pitch-token-pos">${slot.pos}</span>
                </div>
                <div class="pitch-token-label" title="${p.fullName}">${p.name}</div>
            </div>`;
        }).join('');
    },

    renderAnalysis(squad, starters, avgOvr) {
        // Line ratings
        const lines = {
            'Атака': starters.filter(p => ['ST','LW','RW','CF'].includes(p.pos)),
            'Полузащита': starters.filter(p => ['CAM','CM','CDM','LM','RM'].includes(p.pos)),
            'Защита': starters.filter(p => ['CB','LB','RB','LWB','RWB'].includes(p.pos)),
            'Вратарь': starters.filter(p => p.pos === 'GK')
        };

        document.getElementById('lineRatingsBars').innerHTML = Object.entries(lines).map(([label, list]) => {
            const avg = list.length ? Math.round(list.reduce((s, p) => s + this.getEffectiveOvr(p), 0) / list.length) : 0;
            const pct = Math.min(100, Math.max(15, (avg - 45) * 2));
            const color = avg >= avgOvr + 1 ? 'bg-[#00e87b]' : (avg < avgOvr - 2 ? 'bg-rose-500' : 'bg-sky-400');
            return `
            <div>
                <div class="flex justify-between mb-1">
                    <span class="text-slate-300">${label}</span>
                    <span class="font-mono font-bold text-white">${avg || '—'}</span>
                </div>
                <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full ${color} rounded-full transition-all" style="width:${pct}%"></div>
                </div>
            </div>`;
        }).join('');

        // Insights
        const insights = [];
        const form = DataStore.FORMATIONS[this.state.formation];
        const weakSlots = [];
        form.slots.forEach((slot, i) => {
            const p = DataStore.playersById.get(this.state.lineup[i]);
            if (p && this.getEffectiveOvr(p) < avgOvr - 3) {
                weakSlots.push(`${slot.pos} (${p.name}, ${this.getEffectiveOvr(p)})`);
            }
        });

        if (weakSlots.length > 0) {
            insights.push(`<div class="text-rose-400"><i class="fa-solid fa-triangle-exclamation mr-1"></i><b>Слабые зоны:</b> ${weakSlots.slice(0, 3).join(', ')}</div>`);
        } else {
            insights.push(`<div class="text-[#00e87b]"><i class="fa-solid fa-circle-check mr-1"></i><b>Баланс:</b> Стартовый состав ровный, явных провалов нет.</div>`);
        }

        const expiring = squad.filter(p => p.contract > 0 && p.contract <= 2026 && this.getEffectiveOvr(p) >= avgOvr - 2);
        if (expiring.length > 0) {
            insights.push(`<div class="text-amber-400"><i class="fa-solid fa-file-signature mr-1"></i><b>Продлить контракт (≤2026):</b> ${expiring.slice(0, 3).map(p => p.name).join(', ')}</div>`);
        }

        const gems = squad.filter(p => p.age <= 21 && p.pot >= avgOvr + 5).sort((a,b) => b.pot - a.pot);
        if (gems.length > 0) {
            insights.push(`<div class="text-sky-400"><i class="fa-solid fa-gem mr-1"></i><b>Главные таланты:</b> ${gems.slice(0, 3).map(p => `${p.name} (POT ${p.pot})`).join(', ')}</div>`);
        }

        document.getElementById('squadInsightsList').innerHTML = insights.join('');

        // Best formation recommendation
        const hasWing = squad.filter(p => ['LW','RW','LM','RM'].includes(p.pos) && this.getEffectiveOvr(p) >= avgOvr - 3).length >= 2;
        const has2ST = squad.filter(p => p.pos === 'ST' && this.getEffectiveOvr(p) >= avgOvr - 3).length >= 2;
        const recForm = has2ST ? '4-4-2 или 3-5-2' : (hasWing ? '4-2-3-1 / 4-3-3' : '3-4-2-1');
        document.getElementById('bestFormationBadge').textContent = `Оптимум: ${recForm}`;
    },

    renderRoster(squad) {
        document.getElementById('rosterCountLabel').textContent = `${squad.length} игр.`;
        const inLineup = new Set(this.state.lineup);
        document.getElementById('clubRosterList').innerHTML = squad.map(p => {
            const ovr = this.getEffectiveOvr(p);
            const starterBadge = inLineup.has(p.id)
                ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-[#00e87b]/15 text-[#00e87b] font-bold">XI</span>`
                : `<span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">Зап</span>`;
            return `
            <div onclick="Manager.openPlayerModal(${p.id}, true)" class="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#080b11]/60 hover:bg-white/5 cursor-pointer border border-white/5 transition-colors">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="ovr-badge ${DataStore.ovrClass(ovr)}">${ovr}</span>
                    <div class="min-w-0">
                        <div class="text-xs font-bold text-white truncate">${p.name}</div>
                        <div class="text-[11px] text-slate-400">${p.positions.join(', ')} • ${p.age}л • POT ${p.pot}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-[11px] font-mono text-slate-300">${DataStore.formatMoney(p.val)}</span>
                    ${starterBadge}
                </div>
            </div>`;
        }).join('');
    },

    openSlotModal(slotIdx) {
        const form = DataStore.FORMATIONS[this.state.formation];
        const slot = form.slots[slotIdx];
        const current = DataStore.playersById.get(this.state.lineup[slotIdx]);
        const squad = this.getClubSquad();
        const compat = DataStore.POS_COMPAT[slot.pos] || [slot.pos];

        const candidates = squad
            .filter(p => !current || p.id !== current.id)
            .sort((a, b) => {
                const aMatch = a.positions.includes(slot.pos) ? 10 : (compat.includes(a.pos) ? 5 : 0);
                const bMatch = b.positions.includes(slot.pos) ? 10 : (compat.includes(b.pos) ? 5 : 0);
                return (this.getEffectiveOvr(b) + bMatch) - (this.getEffectiveOvr(a) + aMatch);
            })
            .slice(0, 12);

        let html = `
            <div class="mb-3 p-3 rounded-xl bg-[#080b11] border border-white/10 flex items-center justify-between">
                <div>
                    <div class="text-[11px] text-[#00e87b] font-bold">Позиция: ${slot.pos} • Роль FC IQ: ${slot.role}</div>
                    <div class="text-sm font-bold text-white mt-0.5">${current ? `${current.fullName} (OVR ${this.getEffectiveOvr(current)})` : 'Пустой слот'}</div>
                </div>
                <div class="flex gap-1.5">
                    ${current ? `<button onclick="Manager.openPlayerModal(${current.id}, true)" class="btn-secondary !py-1.5 !px-2.5 !text-xs">Профиль</button>` : ''}
                    <button onclick="Manager.findReplacement('${slot.pos}', ${current ? this.getEffectiveOvr(current) : 70})" class="btn-primary !py-1.5 !px-2.5 !text-xs">Найти замену</button>
                </div>
            </div>
            <div class="text-xs font-bold text-slate-400 mb-2">Заменить игроком из состава:</div>
            <div class="space-y-1.5 max-h-[300px] overflow-y-auto">
                ${candidates.map(p => `
                    <div onclick="Manager.assignToSlot(${slotIdx}, ${p.id})" class="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                        <div class="flex items-center gap-2">
                            <span class="ovr-badge ${DataStore.ovrClass(this.getEffectiveOvr(p))}">${this.getEffectiveOvr(p)}</span>
                            <div>
                                <div class="text-xs font-bold text-white">${p.name}</div>
                                <div class="text-[11px] text-slate-400">${p.positions.join(', ')} • ${p.age}л • POT ${p.pot}</div>
                            </div>
                        </div>
                        <span class="text-xs text-[#00e87b] font-bold">Выбрать</span>
                    </div>
                `).join('')}
            </div>`;
        App.openModal(`Слот ${slot.pos}`, html);
    },

    assignToSlot(slotIdx, playerId) {
        const existingIdx = this.state.lineup.indexOf(playerId);
        if (existingIdx !== -1) {
            this.state.lineup[existingIdx] = this.state.lineup[slotIdx];
        }
        this.state.lineup[slotIdx] = playerId;
        this.saveState();
        this.renderClubView();
        App.closeModal();
    },

    findReplacement(pos, currentOvr) {
        App.closeModal();
        App.setTab('manager-scout');
        document.getElementById('scoutPos').value = pos;
        document.getElementById('scoutMaxPrice').value = Math.max(1, Math.round(this.state.budget / 1_000_000));
        document.getElementById('scoutMinPot').value = Math.min(90, currentOvr + 3);
        document.getElementById('scoutMaxAge').value = 24;
        this.scoutShortlistOnly = false;
        this.scoutExpiringOnly = false;
        this.renderScout();
        App.toast(`Скаут: ищем замену на ${pos} в бюджет ${DataStore.formatMoney(this.state.budget)}`);
    },

    openBudgetModal() {
        const m = (this.state.budget / 1_000_000).toFixed(1);
        App.openModal('Трансферный бюджет', `
            <div class="space-y-3">
                <p class="text-xs text-slate-400">Укажи актуальный трансферный бюджет твоего клуба в миллионах евро (€M):</p>
                <input type="number" id="budgetInputM" value="${m}" step="0.5" min="0" class="input-field w-full font-mono text-base">
                <button onclick="Manager.saveBudget()" class="btn-primary w-full">Сохранить бюджет</button>
            </div>
        `);
    },

    saveBudget() {
        const val = parseFloat(document.getElementById('budgetInputM').value) || 0;
        this.state.budget = Math.round(val * 1_000_000);
        this.saveState();
        this.renderClubView();
        App.closeModal();
        App.toast(`Бюджет обновлён: ${DataStore.formatMoney(this.state.budget)}`);
    },

    openPlayerModal(id, inMyClub = false) {
        const p = DataStore.playersById.get(id);
        if (!p) return;
        const ovr = this.getEffectiveOvr(p);
        const isShortlisted = this.state.shortlist.includes(p.id);
        const isMyPlayer = inMyClub || (p.club === this.state.club && !this.state.removedIds.includes(p.id)) || this.state.addedIds.includes(p.id);

        const stats = [
            ['PAC', p.pac], ['SHO', p.sho], ['PAS', p.pas],
            ['DRI', p.dri], ['DEF', p.def], ['PHY', p.phy]
        ];

        const html = `
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <img src="${DataStore.getFaceUrl(p.id)}" onerror="this.style.display='none'" class="w-16 h-16 rounded-2xl bg-white/5 object-cover border border-white/10">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <span class="ovr-badge ${DataStore.ovrClass(ovr)}">${ovr}</span>
                            <span class="text-xs font-mono text-[#00e87b] font-bold">POT ${p.pot} (+${Math.max(0, p.pot - ovr)})</span>
                        </div>
                        <div class="text-base font-extrabold text-white mt-1 truncate">${p.fullName}</div>
                        <div class="text-xs text-slate-400">${p.club} • ${p.league} • ${p.nation}</div>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                    <div class="p-2 rounded-xl bg-white/5"><div class="text-slate-400">Позиции</div><div class="font-bold text-white mt-0.5">${p.positions.join(', ')}</div></div>
                    <div class="p-2 rounded-xl bg-white/5"><div class="text-slate-400">Возраст / Рост</div><div class="font-bold text-white mt-0.5">${p.age}л • ${p.height}см</div></div>
                    <div class="p-2 rounded-xl bg-white/5"><div class="text-slate-400">Нога / Финты / СН</div><div class="font-bold text-white mt-0.5">${p.foot} • ${p.sm}★ / ${p.wf}★</div></div>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                    <div class="p-2 rounded-xl bg-white/5"><div class="text-slate-400">Цена</div><div class="font-mono font-bold text-[#00e87b] mt-0.5">${DataStore.formatMoney(p.val)}</div></div>
                    <div class="p-2 rounded-xl bg-white/5"><div class="text-slate-400">Зарплата</div><div class="font-mono font-bold text-white mt-0.5">${DataStore.formatMoney(p.wage)}/нед</div></div>
                    <div class="p-2 rounded-xl bg-white/5"><div class="text-slate-400">Контракт / Отст.</div><div class="font-mono font-bold text-amber-400 mt-0.5">${p.contract || '—'} / ${p.rc ? DataStore.formatMoney(p.rc) : '—'}</div></div>
                </div>

                <div class="grid grid-cols-6 gap-1.5 text-center">
                    ${stats.map(([k, v]) => `
                        <div class="p-2 rounded-xl bg-[#080b11] border border-white/5">
                            <div class="text-[10px] text-slate-400 font-bold">${k}</div>
                            <div class="font-mono text-sm font-extrabold ${v >= 80 ? 'text-[#00e87b]' : (v >= 70 ? 'text-sky-400' : 'text-white')}">${v}</div>
                        </div>
                    `).join('')}
                </div>

                ${p.playstyles.length ? `
                <div>
                    <div class="text-[11px] text-slate-400 font-bold mb-1.5">PlayStyles:</div>
                    <div class="flex flex-wrap gap-1.5">
                        ${p.playstyles.map(ps => `<span class="text-[11px] px-2 py-0.5 rounded-lg ${ps.includes('+') ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' : 'bg-white/5 text-slate-300'}">${ps}</span>`).join('')}
                    </div>
                </div>` : ''}

                <div class="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                    ${isMyPlayer ? `
                        <button onclick="Manager.adjustPlayerOvr(${p.id}, 1)" class="btn-secondary flex-1">+1 OVR</button>
                        <button onclick="Manager.adjustPlayerOvr(${p.id}, -1)" class="btn-secondary">-1</button>
                        <button onclick="Manager.sellPlayer(${p.id})" class="btn-secondary text-rose-400">Продать</button>
                    ` : `
                        <button onclick="Manager.buyPlayer(${p.id})" class="btn-primary flex-1"><i class="fa-solid fa-cart-plus"></i> Купить в ${this.state.club}</button>
                        <button onclick="Manager.toggleShortlist(${p.id})" class="btn-secondary">${isShortlisted ? '★ В шортлисте' : '☆ В шортлист'}</button>
                    `}
                </div>
            </div>`;
        App.openModal(p.name, html);
    },

    adjustPlayerOvr(id, delta) {
        const p = DataStore.playersById.get(id);
        const cur = this.getEffectiveOvr(p);
        this.state.ovrOverrides[id] = Math.max(45, Math.min(99, cur + delta));
        this.saveState();
        this.renderClubView();
        this.openPlayerModal(id, true);
    },

    buyPlayer(id) {
        const p = DataStore.playersById.get(id);
        if (!p) return;
        if (!this.state.addedIds.includes(id)) this.state.addedIds.push(id);
        this.state.removedIds = this.state.removedIds.filter(x => x !== id);
        this.state.budget = Math.max(0, this.state.budget - p.val);
        this.saveState();
        this.renderClubView();
        App.closeModal();
        App.toast(`Трансфер оформлен: ${p.name} в ${this.state.club}!`);
    },

    sellPlayer(id) {
        const p = DataStore.playersById.get(id);
        if (!p) return;
        this.state.addedIds = this.state.addedIds.filter(x => x !== id);
        if (!this.state.removedIds.includes(id)) this.state.removedIds.push(id);
        this.state.lineup = this.state.lineup.map(x => x === id ? null : x);
        this.state.budget += p.val;
        this.saveState();
        this.renderClubView();
        App.closeModal();
        App.toast(`Продан: ${p.name} (+${DataStore.formatMoney(p.val)})`);
    },

    toggleShortlist(id) {
        if (this.state.shortlist.includes(id)) {
            this.state.shortlist = this.state.shortlist.filter(x => x !== id);
            App.toast('Убрано из шортлиста');
        } else {
            this.state.shortlist.push(id);
            App.toast('Добавлено в шортлист');
        }
        this.saveState();
        this.renderScout();
        this.openPlayerModal(id, false);
    },

    /* ================= SCOUT / TRANSFERS ================= */
    applyScoutPreset(preset) {
        this.resetScoutFilters(true);
        if (preset === 'wonderkids') {
            document.getElementById('scoutMaxAge').value = 21;
            document.getElementById('scoutMinPot').value = 83;
            document.getElementById('scoutSort').value = 'pot';
        } else if (preset === 'championship') {
            document.getElementById('scoutMaxPrice').value = 8;
            document.getElementById('scoutMinPot').value = 78;
            document.getElementById('scoutMaxAge').value = 25;
            document.getElementById('scoutSort').value = 'growth';
        } else if (preset === 'expiring') {
            this.scoutExpiringOnly = true;
            document.getElementById('scoutSort').value = 'ovr';
        } else if (preset === 'shortlist') {
            this.scoutShortlistOnly = true;
        }
        this.renderScout();
    },

    resetScoutFilters(silent = false) {
        document.getElementById('scoutSearch').value = '';
        document.getElementById('scoutPos').value = '';
        document.getElementById('scoutMaxPrice').value = '';
        document.getElementById('scoutMinPot').value = '';
        document.getElementById('scoutMaxAge').value = '';
        document.getElementById('scoutSort').value = 'ovr';
        this.scoutShortlistOnly = false;
        this.scoutExpiringOnly = false;
        if (!silent) this.renderScout();
    },

    renderScout() {
        const q = (document.getElementById('scoutSearch').value || '').trim().toLowerCase();
        const pos = document.getElementById('scoutPos').value;
        const maxPriceM = parseFloat(document.getElementById('scoutMaxPrice').value);
        const minPot = parseInt(document.getElementById('scoutMinPot').value, 10);
        const maxAge = parseInt(document.getElementById('scoutMaxAge').value, 10);
        const sort = document.getElementById('scoutSort').value;

        this.scoutLimit = 24;
        const shortlistSet = new Set(this.state.shortlist);

        let list = DataStore.players.filter(p => {
            if (this.scoutShortlistOnly && !shortlistSet.has(p.id)) return false;
            if (this.scoutExpiringOnly && (!p.contract || p.contract > 2026)) return false;
            if (q && !p.searchKey.includes(q)) return false;
            if (pos && !p.positions.includes(pos)) return false;
            if (!isNaN(maxPriceM) && p.val > maxPriceM * 1_000_000) return false;
            if (!isNaN(minPot) && p.pot < minPot) return false;
            if (!isNaN(maxAge) && p.age > maxAge) return false;
            return true;
        });

        if (sort === 'ovr') list.sort((a, b) => b.ovr - a.ovr);
        else if (sort === 'pot') list.sort((a, b) => b.pot - a.pot);
        else if (sort === 'growth') list.sort((a, b) => (b.pot - b.ovr) - (a.pot - a.ovr));
        else if (sort === 'val_asc') list.sort((a, b) => a.val - b.val);
        else if (sort === 'pac') list.sort((a, b) => b.pac - a.pac);

        this.scoutFiltered = list;
        document.getElementById('scoutResultInfo').textContent = `Найдено игроков: ${list.length.toLocaleString('ru-RU')}`;
        this.drawScoutCards();
    },

    loadMoreScout() {
        this.scoutLimit += 24;
        this.drawScoutCards();
    },

    drawScoutCards() {
        const slice = this.scoutFiltered.slice(0, this.scoutLimit);
        const grid = document.getElementById('scoutResultsGrid');
        const shortlistSet = new Set(this.state.shortlist);

        grid.innerHTML = slice.map(p => `
            <div onclick="Manager.openPlayerModal(${p.id})" class="card p-3 hover:border-[#00e87b]/40 cursor-pointer flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="ovr-badge ${DataStore.ovrClass(p.ovr)}">${p.ovr}</span>
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-white truncate flex items-center gap-1.5">
                            ${p.name}
                            ${shortlistSet.has(p.id) ? '<i class="fa-solid fa-star text-amber-400 text-[10px]"></i>' : ''}
                        </div>
                        <div class="text-[11px] text-slate-400 truncate">${p.positions.join(', ')} • ${p.club} (${p.age}л)</div>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <div class="font-mono text-xs font-bold text-[#00e87b]">POT ${p.pot}</div>
                    <div class="font-mono text-[11px] text-slate-300">${DataStore.formatMoney(p.val)}</div>
                </div>
            </div>
        `).join('');

        const btn = document.getElementById('scoutLoadMoreBtn');
        if (this.scoutFiltered.length > this.scoutLimit) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    },

    /* ================= DUEL 1v1 ================= */
    searchDuelPlayer(slot, query) {
        const box = document.getElementById(`duelSuggest${slot}`);
        const q = query.trim().toLowerCase();
        if (q.length < 2) { box.innerHTML = ''; return; }
        const matches = DataStore.players.filter(p => p.searchKey.includes(q)).slice(0, 5);
        box.innerHTML = matches.map(p => `
            <div onclick="Manager.selectDuelPlayer(${slot}, ${p.id})" class="p-2 rounded-lg bg-[#161d2b] hover:bg-white/10 cursor-pointer flex justify-between text-xs">
                <span class="font-bold text-white">${p.name} <span class="text-slate-400 font-normal">(${p.club})</span></span>
                <span class="font-mono text-[#00e87b]">${p.ovr} / ${p.pot}</span>
            </div>
        `).join('');
    },

    selectDuelPlayer(slot, id) {
        const p = DataStore.playersById.get(id);
        if (slot === 1) this.duelP1 = p; else this.duelP2 = p;
        document.getElementById(`duelSuggest${slot}`).innerHTML = '';
        document.getElementById(`duelSearch${slot}`).value = p.name;
        this.renderDuel();
    },

    renderDuel() {
        const p1 = this.duelP1, p2 = this.duelP2;
        if (!p1 || !p2) return;

        const renderCard = (p) => `
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-base font-extrabold text-white">${p.name}</div>
                    <div class="text-xs text-slate-400">${p.club} • ${p.positions.join(', ')} • ${p.age}л</div>
                </div>
                <div class="text-right">
                    <span class="ovr-badge ${DataStore.ovrClass(p.ovr)}">${p.ovr}</span>
                    <div class="text-[11px] font-mono text-[#00e87b] mt-0.5">POT ${p.pot}</div>
                </div>
            </div>
            <div class="flex justify-between text-xs text-slate-300 mt-3 pt-2 border-t border-white/5">
                <span>Цена: <b class="font-mono text-white">${DataStore.formatMoney(p.val)}</b></span>
                <span>Финты/СН: <b>${p.sm}★ / ${p.wf}★</b></span>
            </div>`;

        document.getElementById('duelCard1').innerHTML = renderCard(p1);
        document.getElementById('duelCard2').innerHTML = renderCard(p2);

        const metrics = [
            ['OVR', p1.ovr, p2.ovr],
            ['Потенциал', p1.pot, p2.pot],
            ['Скорость (PAC)', p1.pac, p2.pac],
            ['Удары (SHO)', p1.sho, p2.sho],
            ['Пасы (PAS)', p1.pas, p2.pas],
            ['Дриблинг (DRI)', p1.dri, p2.dri],
            ['Защита (DEF)', p1.def, p2.def],
            ['Физика (PHY)', p1.phy, p2.phy]
        ];

        document.getElementById('duelBarsContainer').innerHTML = metrics.map(([label, v1, v2]) => `
            <div class="grid grid-cols-12 items-center gap-2 text-xs">
                <div class="col-span-2 text-right font-mono font-bold ${v1 >= v2 ? 'text-[#00e87b]' : 'text-slate-400'}">${v1}</div>
                <div class="col-span-8">
                    <div class="text-center text-[11px] text-slate-400 mb-1">${label}</div>
                    <div class="grid grid-cols-2 gap-1 h-2">
                        <div class="bg-white/5 rounded-l-full flex justify-end overflow-hidden">
                            <div class="h-full ${v1 >= v2 ? 'bg-[#00e87b]' : 'bg-slate-600'}" style="width:${v1}%"></div>
                        </div>
                        <div class="bg-white/5 rounded-r-full overflow-hidden">
                            <div class="h-full ${v2 >= v1 ? 'bg-sky-400' : 'bg-slate-600'}" style="width:${v2}%"></div>
                        </div>
                    </div>
                </div>
                <div class="col-span-2 font-mono font-bold ${v2 >= v1 ? 'text-sky-400' : 'text-slate-400'}">${v2}</div>
            </div>
        `).join('');
    }
};
