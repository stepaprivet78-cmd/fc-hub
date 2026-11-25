/* FC HUB v2 — DataStore & Static Game Knowledge (EA FC 26) */
const DataStore = {
    meta: null,
    leagues: [],
    clubs: [],
    nations: [],
    players: [],
    playersById: new Map(),
    clubsByLeague: new Map(),
    clubLeagueMap: new Map(),

    async load() {
        const res = await fetch('data/players.json');
        if (!res.ok) throw new Error('Не удалось загрузить data/players.json');
        const raw = await res.json();

        this.meta = raw.meta;
        this.leagues = raw.leagues;
        this.clubs = raw.clubs;
        this.nations = raw.nations;

        this.players = raw.players.map(r => {
            const league = this.leagues[r[11]] || 'Other';
            const club = this.clubs[r[12]] || 'Free Agent';
            const nation = this.nations[r[13]] || '';
            const positions = (r[3] || '').split(',').map(s => s.trim()).filter(Boolean);
            const p = {
                id: r[0],
                name: r[1],
                fullName: r[2] || r[1],
                pos: positions[0] || 'CM',
                positions,
                ovr: r[4],
                pot: r[5],
                age: r[6],
                val: r[7],
                wage: r[8],
                rc: r[9],
                contract: r[10],
                league,
                club,
                nation,
                foot: r[14],
                wf: r[15],
                sm: r[16],
                height: r[17],
                pac: r[18],
                sho: r[19],
                pas: r[20],
                dri: r[21],
                def: r[22],
                phy: r[23],
                playstyles: r[24] ? r[24].split(',').map(s => s.trim()).filter(Boolean) : [],
                searchKey: `${r[1]} ${r[2]} ${club} ${league} ${r[24]}`.toLowerCase()
            };
            this.playersById.set(p.id, p);

            if (club !== 'Free Agent') {
                if (!this.clubsByLeague.has(league)) this.clubsByLeague.set(league, new Set());
                this.clubsByLeague.get(league).add(club);
                if (!this.clubLeagueMap.has(club)) this.clubLeagueMap.set(club, league);
            }
            return p;
        });

        return this;
    },

    getFaceUrl(id) {
        const str = String(id).padStart(6, '0');
        return `https://cdn.sofifa.net/players/${str.slice(0, 3)}/${str.slice(3)}/26_120.png`;
    },

    formatMoney(val) {
        if (!val || val <= 0) return '€0';
        if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `€${Math.round(val / 1_000)}K`;
        return `€${val}`;
    },

    ovrClass(ovr) {
        if (ovr >= 83) return 'ovr-elite';
        if (ovr >= 75) return 'ovr-good';
        if (ovr >= 68) return 'ovr-mid';
        return 'ovr-low';
    },

    // Tactical Formations with coordinates (x%, y%) and FC IQ roles
    FORMATIONS: {
        '4-2-3-1': {
            name: '4-2-3-1 (Широкая)',
            style: 'Сбалансированная / Контроль',
            slots: [
                { pos: 'GK',  x: 50, y: 90, role: 'Sweeper Keeper' },
                { pos: 'LB',  x: 15, y: 74, role: 'Fullback' },
                { pos: 'CB',  x: 37, y: 76, role: 'Defender' },
                { pos: 'CB',  x: 63, y: 76, role: 'Ball-Playing Def' },
                { pos: 'RB',  x: 85, y: 74, role: 'Wingback' },
                { pos: 'CDM', x: 36, y: 56, role: 'Holding' },
                { pos: 'CDM', x: 64, y: 56, role: 'Deep-Lying Playmaker' },
                { pos: 'LM',  x: 17, y: 35, role: 'Inside Forward' },
                { pos: 'CAM', x: 50, y: 36, role: 'Playmaker' },
                { pos: 'RM',  x: 83, y: 35, role: 'Inside Forward' },
                { pos: 'ST',  x: 50, y: 15, role: 'Advanced Forward' }
            ]
        },
        '4-3-3 Holding': {
            name: '4-3-3 (Опорник)',
            style: 'Высокий прессинг / Фланги',
            slots: [
                { pos: 'GK',  x: 50, y: 90, role: 'Sweeper Keeper' },
                { pos: 'LB',  x: 15, y: 74, role: 'Wingback' },
                { pos: 'CB',  x: 37, y: 76, role: 'Defender' },
                { pos: 'CB',  x: 63, y: 76, role: 'Defender' },
                { pos: 'RB',  x: 85, y: 74, role: 'Fullback' },
                { pos: 'CDM', x: 50, y: 58, role: 'Holding' },
                { pos: 'CM',  x: 30, y: 45, role: 'Box-to-Box' },
                { pos: 'CM',  x: 70, y: 45, role: 'Playmaker' },
                { pos: 'LW',  x: 18, y: 22, role: 'Inside Forward' },
                { pos: 'ST',  x: 50, y: 15, role: 'Poacher' },
                { pos: 'RW',  x: 82, y: 22, role: 'Winger' }
            ]
        },
        '4-3-3 Attack': {
            name: '4-3-3 (Атака)',
            style: 'Быстрые атаки / Доминация',
            slots: [
                { pos: 'GK',  x: 50, y: 90, role: 'Goalkeeper' },
                { pos: 'LB',  x: 15, y: 74, role: 'Fullback' },
                { pos: 'CB',  x: 37, y: 76, role: 'Defender' },
                { pos: 'CB',  x: 63, y: 76, role: 'Defender' },
                { pos: 'RB',  x: 85, y: 74, role: 'Fullback' },
                { pos: 'CM',  x: 32, y: 55, role: 'Box-to-Box' },
                { pos: 'CM',  x: 68, y: 55, role: 'Holding' },
                { pos: 'CAM', x: 50, y: 37, role: 'Shadow Striker' },
                { pos: 'LW',  x: 18, y: 21, role: 'Inside Forward' },
                { pos: 'ST',  x: 50, y: 14, role: 'Advanced Forward' },
                { pos: 'RW',  x: 82, y: 21, role: 'Inside Forward' }
            ]
        },
        '4-4-2': {
            name: '4-4-2 (Классика)',
            style: 'Контратаки / Чемпионшип',
            slots: [
                { pos: 'GK', x: 50, y: 90, role: 'Goalkeeper' },
                { pos: 'LB', x: 15, y: 74, role: 'Fullback' },
                { pos: 'CB', x: 37, y: 76, role: 'Defender' },
                { pos: 'CB', x: 63, y: 76, role: 'Defender' },
                { pos: 'RB', x: 85, y: 74, role: 'Fullback' },
                { pos: 'LM', x: 16, y: 46, role: 'Winger' },
                { pos: 'CM', x: 38, y: 50, role: 'Box-to-Box' },
                { pos: 'CM', x: 62, y: 50, role: 'Holding' },
                { pos: 'RM', x: 84, y: 46, role: 'Winger' },
                { pos: 'ST', x: 37, y: 17, role: 'Advanced Forward' },
                { pos: 'ST', x: 63, y: 17, role: 'Target Forward' }
            ]
        },
        '3-5-2': {
            name: '3-5-2 (Владение)',
            style: 'Перегруз центра / Фланги',
            slots: [
                { pos: 'GK',  x: 50, y: 90, role: 'Sweeper Keeper' },
                { pos: 'CB',  x: 25, y: 75, role: 'Stopper' },
                { pos: 'CB',  x: 50, y: 77, role: 'Ball-Playing Def' },
                { pos: 'CB',  x: 75, y: 75, role: 'Stopper' },
                { pos: 'CDM', x: 38, y: 57, role: 'Holding' },
                { pos: 'CDM', x: 62, y: 57, role: 'Deep-Lying Playmaker' },
                { pos: 'LM',  x: 14, y: 44, role: 'Wide Midfielder' },
                { pos: 'CAM', x: 50, y: 37, role: 'Playmaker' },
                { pos: 'RM',  x: 86, y: 44, role: 'Wide Midfielder' },
                { pos: 'ST',  x: 37, y: 16, role: 'Poacher' },
                { pos: 'ST',  x: 63, y: 16, role: 'Advanced Forward' }
            ]
        },
        '3-4-2-1': {
            name: '3-4-2-1 (Современная)',
            style: 'Агрессивный прессинг',
            slots: [
                { pos: 'GK',  x: 50, y: 90, role: 'Sweeper Keeper' },
                { pos: 'CB',  x: 25, y: 75, role: 'Defender' },
                { pos: 'CB',  x: 50, y: 77, role: 'Ball-Playing Def' },
                { pos: 'CB',  x: 75, y: 75, role: 'Defender' },
                { pos: 'LM',  x: 14, y: 50, role: 'Wingback' },
                { pos: 'CM',  x: 38, y: 53, role: 'Box-to-Box' },
                { pos: 'CM',  x: 62, y: 53, role: 'Holding' },
                { pos: 'RM',  x: 86, y: 50, role: 'Wingback' },
                { pos: 'CAM', x: 33, y: 31, role: 'Shadow Striker' },
                { pos: 'CAM', x: 67, y: 31, role: 'Playmaker' },
                { pos: 'ST',  x: 50, y: 14, role: 'Advanced Forward' }
            ]
        }
    },

    // Position compatibility map
    POS_COMPAT: {
        GK:  ['GK'],
        LB:  ['LB', 'LWB', 'LM', 'CB'],
        RB:  ['RB', 'RWB', 'RM', 'CB'],
        CB:  ['CB', 'CDM', 'LB', 'RB'],
        CDM: ['CDM', 'CM', 'CB'],
        CM:  ['CM', 'CDM', 'CAM', 'LM', 'RM'],
        CAM: ['CAM', 'CM', 'LW', 'RW', 'ST'],
        LM:  ['LM', 'LW', 'LB', 'CAM', 'RM'],
        RM:  ['RM', 'RW', 'RB', 'CAM', 'LM'],
        LW:  ['LW', 'LM', 'RW', 'ST', 'CAM'],
        RW:  ['RW', 'RM', 'LW', 'ST', 'CAM'],
        ST:  ['ST', 'LW', 'RW', 'CAM']
    },

    PLAYER_BUILDS: {
        'st_speed': {
            title: '⚡ Взрывной финишер (ST)',
            pos: 'ST',
            body: 'Рост: 178–183 см • Вес: 70–75 кг',
            focus: ['Скорость (Рывки + Ускорение)', 'Завершение и Позиция', 'Ловкость и Баланс'],
            playstyles: ['Quick Step+', 'Finesse Shot+', 'Rapid', 'First Touch'],
            tip: 'Идеален для контратак и забеганий за спину защитникам. Качай 5★ слабую ногу как можно раньше.'
        },
        'lw_meta': {
            title: '🔥 Инсайд-вингер (LW / RW)',
            pos: 'LW',
            body: 'Рост: 172–177 см • Вес: 64–70 кг',
            focus: ['Дриблинг и Реакция', 'Скорость', 'Подкрутка (Finesse) и Короткий пас'],
            playstyles: ['Technical+', 'Trickster', 'Finesse Shot', 'Quick Step'],
            tip: 'Смещайся с фланга в центр под сильную ногу и бей обводящим (R1/RB + удар).'
        },
        'cam_maestro': {
            title: '🧠 Свободный художник (CAM)',
            pos: 'CAM',
            body: 'Рост: 175–180 см • Вес: 68–73 кг',
            focus: ['Видение поля и Разрезающие пасы', 'Контроль мяча', 'Дальние удары'],
            playstyles: ['Incisive Pass+', 'Tiki Taka', 'Technical', 'Dead Ball'],
            tip: 'Раздавай треугольники (L1+△) на фланги и открывайся вторым темпом на линии штрафной.'
        },
        'cm_b2b': {
            title: '⚙️ Мотор Box-to-Box (CM)',
            pos: 'CM',
            body: 'Рост: 180–186 см • Вес: 75–80 кг',
            focus: ['Выносливость (90+)', 'Короткий и длинный пас', 'Отбор и Перехваты'],
            playstyles: ['Relentless+', 'Intercept', 'Pinged Pass', 'Bruiser'],
            tip: 'Ключевой игрок в центре: помогает в отборе и подключается в штрафную на 85-й минуте без потери сил.'
        },
        'cb_wall': {
            title: '🛡️ Стена-ЦЗ (CB)',
            pos: 'CB',
            body: 'Рост: 189–195 см • Вес: 84–90 кг',
            focus: ['Отбор стоя и Перехваты', 'Сила и Прыжки', 'Рывки (чтобы не убегали)'],
            playstyles: ['Anticipate+', 'Aerial', 'Jockey', 'Bruiser'],
            tip: 'Не выдергивайся лишний раз — держи линию и используй жокей (L2/LT) против быстрых форвардов.'
        }
    },

    CHALLENGES: [
        {
            title: 'Возрождение спящего гиганта',
            mode: 'Тренер',
            rule: 'Возьми клуб из Чемпионшипа (Sunderland, Leeds, Sheffield Utd или Blackburn) и верни его в ЛЧ за 4 сезона.',
            constraint: 'Нельзя покупать игроков старше 24 лет. Минимум 3 воспитанника академии в заявке.'
        },
        {
            title: 'Правило Бильбао (Локальный состав)',
            mode: 'Тренер',
            rule: 'Выбери любой середняк или клуб 2-го дивизиона и подпиши контракт с самим собой: только игроки одной национальности.',
            constraint: 'Всех легионеров нужно продать в течение 2 трансферных окон.'
        },
        {
            title: 'Манибол (Moneyball)',
            mode: 'Тренер',
            rule: 'Бюджетный скаутинг: ты можешь покупать только игроков с истекающим контрактом (≤ 2026) или дешевле €5M.',
            constraint: 'Если приходит предложение от топ-клуба за твоего лидера выше его рыночной цены на 30% — ты ОБЯЗАН продать.'
        },
        {
            title: 'Путь андердога',
            mode: 'Игрок',
            rule: 'Начни карьеру игрока в Лиге 1/Чемпионшипе (OVR ≤ 70) и доберись до «Золотого мяча» без симуляции матчей.',
            constraint: 'Переходить в новый клуб можно только раз в 2 сезона и только на 1 ступень выше.'
        },
        {
            title: 'Свободные агенты и аренды',
            mode: 'Тренер',
            rule: 'Клуб на грани банкротства: трансферный бюджет = €0 на первые 2 сезона.',
            constraint: 'Усиление только через аренды, свободных агентов и академию.'
        }
    ]
};
