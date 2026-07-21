/* ============================================================
   THRIVE — GATE 2027 Study Tracker Module
   Personalized for Electrical Engineering
   ============================================================ */

const StudyModule = (() => {
    const GATE_DATE = new Date('2027-02-01T09:30:00+05:30');
    const DAILY_TARGET_HRS = 4;
    const WEEKLY_TARGET_HRS = 28;

    const SUBJECTS = [
        { id: 'network',     name: 'Network Theory',        emoji: '🔌', targetHrs: 60,  color: '#8B5CF6' },
        { id: 'signals',     name: 'Signals & Systems',     emoji: '📡', targetHrs: 70,  color: '#06D6A0' },
        { id: 'control',     name: 'Control Systems',       emoji: '🎛️', targetHrs: 65,  color: '#FF6B35' },
        { id: 'machines',    name: 'Electrical Machines',    emoji: '⚡', targetHrs: 80,  color: '#FFB347' },
        { id: 'power_sys',   name: 'Power Systems',         emoji: '🏗️', targetHrs: 75,  color: '#EC4899' },
        { id: 'power_elec',  name: 'Power Electronics',     emoji: '🔋', targetHrs: 60,  color: '#3B82F6' },
        { id: 'analog',      name: 'Analog Electronics',    emoji: '📻', targetHrs: 55,  color: '#F59E0B' },
        { id: 'digital',     name: 'Digital Electronics',   emoji: '💻', targetHrs: 50,  color: '#10B981' },
        { id: 'emt',         name: 'EMT',                   emoji: '🧲', targetHrs: 55,  color: '#A78BFA' },
        { id: 'measurements',name: 'Measurements',          emoji: '📏', targetHrs: 40,  color: '#F472B6' },
        { id: 'maths',       name: 'Engg Mathematics',      emoji: '📐', targetHrs: 80,  color: '#06B6D4' },
        { id: 'aptitude',    name: 'General Aptitude',       emoji: '🧠', targetHrs: 30,  color: '#84CC16' }
    ];

    const HABITS = [
        { id: 'study_4hr',     name: 'Study 4 hrs',     emoji: '📚', target: 4,  unit: 'hrs' },
        { id: 'revise_ch',     name: 'Revise 1 chapter', emoji: '📖', target: 1,  unit: 'ch' },
        { id: 'problems_10',   name: 'Solve 10 problems', emoji: '✏️', target: 10, unit: 'done' },
        { id: 'exercise_30',   name: 'Exercise 30 min',  emoji: '🏃', target: 30, unit: 'min' }
    ];

    let _countdownInterval = null;
    let _activeSession = null;
    let _sessionTimer = null;
    let _sessionSeconds = 0;

    async function init() {
        startCountdown();
        await renderAll();
        wireEvents();
    }

    /* ===== COUNTDOWN ===== */
    function startCountdown() {
        updateCountdown();
        _countdownInterval = setInterval(updateCountdown, 1000);
    }

    function updateCountdown() {
        const now = new Date();
        const diff = GATE_DATE - now;
        if (diff <= 0) {
            document.getElementById('cd-days').textContent = '0';
            document.getElementById('cd-hours').textContent = '00';
            document.getElementById('cd-mins').textContent = '00';
            document.getElementById('cd-secs').textContent = '00';
            return;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hrs = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        document.getElementById('cd-days').textContent = days;
        document.getElementById('cd-hours').textContent = String(hrs).padStart(2, '0');
        document.getElementById('cd-mins').textContent = String(mins).padStart(2, '0');
        document.getElementById('cd-secs').textContent = String(secs).padStart(2, '0');
    }

    /* ===== RENDER ALL ===== */
    async function renderAll() {
        await renderTodayStats();
        await renderHeatmap();
        renderSubjects();
        await renderHabits();
        await renderSessions();
    }

    /* ===== TODAY STATS ===== */
    async function renderTodayStats() {
        const today = Utils.todayStr();
        const allSessions = await ThriveDB.getAll('studySessions', 'by_date', today);
        const todayMins = allSessions.reduce((s, x) => s + (x.duration || 0), 0);
        const todayHrs = (todayMins / 60).toFixed(1);

        // Weekly
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        let weekMins = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const daySessions = await ThriveDB.getAll('studySessions', 'by_date', dateStr);
            weekMins += daySessions.reduce((s, x) => s + (x.duration || 0), 0);
        }
        const weekHrs = (weekMins / 60).toFixed(1);

        // Top Subject
        const allAll = await getAllSessions();
        const subjectMap = {};
        allAll.forEach(s => {
            subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.duration;
        });
        let topSubject = '—';
        let topMins = 0;
        Object.entries(subjectMap).forEach(([subj, mins]) => {
            if (mins > topMins) { topMins = mins; topSubject = subj; }
        });
        const subjectInfo = SUBJECTS.find(s => s.id === topSubject);
        const topName = subjectInfo ? subjectInfo.emoji : topSubject;

        // Streak
        const streak = await calcStreak();

        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('study-today-hrs', todayHrs);
        el('study-week-hrs', weekHrs);
        el('study-top-subject', topName);
        el('study-streak', streak);
    }

    async function getAllSessions() {
        try {
            const db = await ThriveDB.open();
            return new Promise((resolve) => {
                const tx = db.transaction('studySessions', 'readonly');
                const store = tx.objectStore('studySessions');
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        } catch { return []; }
    }

    async function calcStreak() {
        let streak = 0;
        const d = new Date();
        for (let i = 0; i < 365; i++) {
            const dateStr = d.toISOString().split('T')[0];
            const sessions = await ThriveDB.getAll('studySessions', 'by_date', dateStr);
            const totalMins = sessions.reduce((s, x) => s + (x.duration || 0), 0);
            if (totalMins >= DAILY_TARGET_HRS * 60) {
                streak++;
            } else if (i > 0) {
                break;
            }
            d.setDate(d.getDate() - 1);
        }
        return streak;
    }

    /* ===== HEATMAP ===== */
    async function renderHeatmap() {
        const container = document.getElementById('study-heatmap');
        if (!container) return;
        container.innerHTML = '';

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const sessions = await ThriveDB.getAll('studySessions', 'by_date', dateStr);
            const mins = sessions.reduce((s, x) => s + (x.duration || 0), 0);
            const hrs = (mins / 60).toFixed(1);
            const pct = Math.min(mins / (DAILY_TARGET_HRS * 60), 1);
            const isToday = dateStr === Utils.todayStr();

            const el = document.createElement('div');
            el.className = 'study-heatmap-day' + (isToday ? ' today' : '');
            el.innerHTML = `
                <span class="study-hm-label">${days[i]}</span>
                <div class="study-hm-bar-bg">
                    <div class="study-hm-bar-fill" style="height: ${pct * 100}%;"></div>
                </div>
                <span class="study-hm-val">${hrs}h</span>
            `;
            container.appendChild(el);
        }
    }

    /* ===== SUBJECTS ===== */
    async function renderSubjects() {
        const container = document.getElementById('study-subjects');
        if (!container) return;

        const allSessions = await getAllSessions();
        const subjectMins = {};
        allSessions.forEach(s => {
            subjectMins[s.subject] = (subjectMins[s.subject] || 0) + s.duration;
        });

        container.innerHTML = SUBJECTS.map(subj => {
            const mins = subjectMins[subj.id] || 0;
            const hrs = (mins / 60).toFixed(1);
            const pct = Math.min((mins / 60) / subj.targetHrs, 1);
            const circumference = 2 * Math.PI * 28;
            const offset = circumference * (1 - pct);
            return `
            <div class="study-subject-card" data-subject="${subj.id}" style="--subj-color: ${subj.color}">
                <svg class="study-subj-ring" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>
                    <circle cx="32" cy="32" r="28" fill="none" stroke="${subj.color}" stroke-width="4" stroke-linecap="round"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 32 32)"
                        style="transition: stroke-dashoffset 0.8s ease; filter: drop-shadow(0 0 4px ${subj.color}40);"/>
                </svg>
                <div class="study-subj-emoji">${subj.emoji}</div>
                <div class="study-subj-info">
                    <span class="study-subj-name">${subj.name}</span>
                    <span class="study-subj-hrs">${hrs} / ${subj.targetHrs} hrs</span>
                </div>
            </div>`;
        }).join('');
    }

    /* ===== HABITS ===== */
    async function renderHabits() {
        const container = document.getElementById('study-habits');
        if (!container) return;

        const today = Utils.todayStr();
        const todaySessions = await ThriveDB.getAll('studySessions', 'by_date', today);
        const studyHrs = (todaySessions.reduce((s, x) => s + (x.duration || 0), 0) / 60);

        // Get habit progress from db
        const habitData = {};
        try {
            const allHabits = await ThriveDB.getAll('studyHabits', 'by_date', today);
            allHabits.forEach(h => { habitData[h.habitId] = h.current; });
        } catch {}

        container.innerHTML = HABITS.map(hab => {
            let current = habitData[hab.id] || 0;
            if (hab.id === 'study_4hr') current = Math.min(studyHrs, hab.target);
            const pct = Math.min(current / hab.target, 1);
            const circumference = 2 * Math.PI * 22;
            const offset = circumference * (1 - pct);
            const done = pct >= 1;
            return `
            <div class="study-habit-card ${done ? 'done' : ''}" data-habit="${hab.id}">
                <svg class="study-habit-ring" viewBox="0 0 52 52">
                    <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3.5"/>
                    <circle cx="26" cy="26" r="22" fill="none" stroke="${done ? '#06D6A0' : '#8B5CF6'}" stroke-width="3.5" stroke-linecap="round"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 26 26)"
                        style="transition: stroke-dashoffset 0.6s ease; filter: drop-shadow(0 0 4px ${done ? 'rgba(6,214,160,0.4)' : 'rgba(139,92,246,0.3)'});"/>
                </svg>
                <span class="study-habit-emoji">${hab.emoji}</span>
                <span class="study-habit-name">${hab.name}</span>
                <span class="study-habit-prog">${Math.round(current)}/${hab.target} ${hab.unit}</span>
                ${hab.id !== 'study_4hr' ? `<button class="study-habit-inc" data-habit="${hab.id}" data-target="${hab.target}">+</button>` : ''}
            </div>`;
        }).join('');
    }

    /* ===== SESSIONS LIST ===== */
    async function renderSessions() {
        const container = document.getElementById('study-sessions');
        if (!container) return;

        const allSessions = await getAllSessions();
        const recent = allSessions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0)).slice(0, 10);

        if (recent.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">📚</div><div class="empty-state-text">No study sessions yet. Start studying!</div></div>';
            return;
        }

        container.innerHTML = recent.map(s => {
            const subj = SUBJECTS.find(x => x.id === s.subject);
            const mins = s.duration || 0;
            const hrsStr = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
            return `
            <div class="study-session-item" style="--session-color: ${subj?.color || '#8B5CF6'}">
                <span class="study-session-emoji">${subj?.emoji || '📚'}</span>
                <div class="study-session-info">
                    <span class="study-session-subj">${subj?.name || s.subject}</span>
                    <span class="study-session-date">${s.date}</span>
                </div>
                <span class="study-session-dur">${hrsStr}</span>
            </div>`;
        }).join('');
    }

    /* ===== STUDY SESSION TIMER ===== */
    function showStudyModal() {
        const options = SUBJECTS.map(s => `<option value="${s.id}">${s.emoji} ${s.name}</option>`).join('');
        const modalBody = `
            <div class="study-timer-body">
                <select id="study-subject-select" class="study-subject-select">${options}</select>
                <div class="study-timer-controls" style="margin-top: 24px; display: flex; justify-content: center;">
                    <button id="study-timer-start" class="btn-primary btn-large" style="width: 100%;">▶ Launch Focus Session</button>
                </div>
            </div>
        `;
        Utils.showModal('📚 Choose Subject', modalBody, '');
        
        document.getElementById('study-timer-start').addEventListener('click', () => {
            const subjectId = document.getElementById('study-subject-select').value;
            const subject = SUBJECTS.find(s => s.id === subjectId);
            Utils.closeModal();
            
            // Navigate to Focus tab
            const navBtn = document.getElementById('nav-pomodoro');
            if (navBtn) navBtn.click();
            
            // Give UI a moment to switch tabs, then start Pomodoro
            setTimeout(() => {
                if (typeof PomodoroModule !== 'undefined' && PomodoroModule.startForSubject) {
                    PomodoroModule.startForSubject(subject.id, subject.name);
                }
            }, 300);
        });
    }

    /* ===== EVENTS ===== */
    function wireEvents() {
        const startBtn = document.getElementById('btn-start-study');
        if (startBtn) startBtn.addEventListener('click', showStudyModal);

        // Habit increment buttons
        document.getElementById('study-habits')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('.study-habit-inc');
            if (!btn) return;
            const habitId = btn.dataset.habit;
            const target = parseInt(btn.dataset.target) || 1;
            const today = Utils.todayStr();

            const existing = await ThriveDB.getAll('studyHabits', 'by_date', today);
            const found = existing.find(h => h.habitId === habitId);
            const current = found ? found.current : 0;
            const newVal = Math.min(current + 1, target);

            await ThriveDB.put('studyHabits', {
                id: found?.id || `sh_${habitId}_${today}`,
                habitId, date: today, current: newVal
            });
            await renderHabits();
            if (newVal >= target) Utils.toast('🎉 Habit completed!', 'success');
        });
    }

    return { init };
})();
