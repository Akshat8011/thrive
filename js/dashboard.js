/* ============================================================
   THRIVE v2 — Dashboard Module
   Editable milestones, multi-tier goals with CRUD,
   activity→goal progress linking, completed goals section
   ============================================================ */

const DashboardModule = (() => {
    const RING_CIRCUM = 2 * Math.PI * 70;
    let _currentTier = 'daily';
    let _goalCalendarYear = new Date().getFullYear();
    let _goalCalendarMonth = new Date().getMonth();
    let _goalCalendarSelectedDate = Utils.todayStr();

    async function init() {
        renderGreeting();
        await renderDailyProgress();
        await renderMilestones();
        await renderGoals();
        await renderCompletedGoals();
        await renderPeriodChart('daily');
        await renderActivityLog();
        await renderGoalCalendar();
        await renderGoalCalendarDetail(_goalCalendarSelectedDate);
        wireEvents();
    }

    async function refresh() {
        await renderDailyProgress();
        await renderMilestones();
        await renderGoals();
        await renderCompletedGoals();
        await renderActivityLog();
    }

    function renderGreeting() {
        document.getElementById('greeting-text').textContent = Utils.getGreeting() + ', Akshat';
        const motivations = [
            "Let's make today count.", "Your future self is watching.", "One step at a time.",
            "Progress over perfection.", "Discipline = Freedom.", "You've got this. 💪",
            "Show up. Do the work.", "Consistency is the key.", "Today's effort, tomorrow's success."
        ];
        document.getElementById('greeting-sub').textContent = motivations[new Date().getDate() % motivations.length];
    }

    // ===== Daily Progress =====
    async function renderDailyProgress() {
        const today = Utils.todayStr();
        const activities = await ThriveDB.getAll('activities', 'by_date', today);
        const todos = await ThriveDB.getAll('todos', 'by_date', today);
        const totalTasks = activities.length + todos.length;
        const completedTasks = activities.length + todos.filter(t => t.done).length;
        const percent = totalTasks > 0 ? Math.round((completedTasks / Math.max(totalTasks, 1)) * 100) : 0;

        Utils.animateRing(document.getElementById('ring-progress'), percent, RING_CIRCUM);
        document.getElementById('ring-percent').textContent = percent + '%';
        document.getElementById('stat-completed').textContent = completedTasks;
        document.getElementById('stat-total').textContent = totalTasks || '—';

        const streak = await calculateStreak();
        document.getElementById('stat-streak').textContent = streak;

        await ThriveDB.put('dailyLog', { date: today, completed: completedTasks, total: totalTasks, percent });
    }

    async function calculateStreak() {
        let streak = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        for (let i = 0; i < 365; i++) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            const log = await ThriveDB.get('dailyLog', d.toISOString().split('T')[0]);
            if (i === 0 && !log) continue;
            if (log && log.percent >= 50) streak++;
            else if (i > 0) break;
        }
        return streak;
    }

    // ===== Milestones (CRUD) =====
    async function renderMilestones() {
        const milestones = await ThriveDB.getAll('milestones');
        const grid = document.getElementById('milestone-grid');
        grid.innerHTML = '';
        milestones.sort((a, b) => Utils.daysUntil(a.targetDate) - Utils.daysUntil(b.targetDate));
        milestones.forEach(m => {
            const days = Utils.daysUntil(m.targetDate);
            const card = Utils.el('div', { className: `milestone-card ${m.color}` },
                Utils.el('div', { className: 'milestone-emoji', textContent: m.emoji }),
                Utils.el('div', { className: `milestone-days ${m.color}`, textContent: Math.max(0, days) }),
                Utils.el('div', { className: 'milestone-unit', textContent: days === 1 ? 'day' : 'days' }),
                Utils.el('div', { className: 'milestone-name', textContent: m.name }),
                Utils.el('div', { className: 'milestone-actions' },
                    Utils.el('button', { textContent: '✏️', onClick: () => showEditMilestoneModal(m) }),
                    Utils.el('button', { textContent: '🗑️', onClick: async () => {
                        await ThriveDB.remove('milestones', m.id);
                        Utils.toast('Milestone removed', 'warning');
                        renderMilestones();
                    }})
                )
            );
            grid.appendChild(card);
        });
    }

    function showAddMilestoneModal() {
        Utils.showModal('Add Milestone', `
            <form id="milestone-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
                <input type="text" id="ms-name" placeholder="Milestone name" required maxlength="40">
                <input type="date" id="ms-date" required>
                <input type="text" id="ms-emoji" placeholder="Emoji (e.g. 🎯)" maxlength="4" value="🎯">
                <select id="ms-color"><option value="blue">🔵 Blue</option><option value="purple">🟣 Purple</option><option value="green">🟢 Green</option><option value="amber">🟡 Amber</option><option value="red">🔴 Red</option></select>
                <button type="submit" class="btn-primary">Add Milestone</button>
            </form>`);
        document.getElementById('milestone-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await ThriveDB.put('milestones', {
                id: Utils.uid(), name: document.getElementById('ms-name').value.trim(),
                targetDate: document.getElementById('ms-date').value, emoji: document.getElementById('ms-emoji').value || '🎯',
                color: document.getElementById('ms-color').value
            });
            Utils.closeModal(); Utils.toast('Milestone added! 🎯', 'success'); renderMilestones();
        });
    }

    function showEditMilestoneModal(m) {
        Utils.showModal('Edit Milestone', `
            <form id="milestone-edit-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
                <input type="text" id="ms-name" value="${m.name}" required maxlength="40">
                <input type="date" id="ms-date" value="${m.targetDate}" required>
                <input type="text" id="ms-emoji" value="${m.emoji}" maxlength="4">
                <select id="ms-color"><option value="blue" ${m.color==='blue'?'selected':''}>🔵 Blue</option><option value="purple" ${m.color==='purple'?'selected':''}>🟣 Purple</option><option value="green" ${m.color==='green'?'selected':''}>🟢 Green</option><option value="amber" ${m.color==='amber'?'selected':''}>🟡 Amber</option><option value="red" ${m.color==='red'?'selected':''}>🔴 Red</option></select>
                <button type="submit" class="btn-primary">Save Changes</button>
            </form>`);
        document.getElementById('milestone-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            m.name = document.getElementById('ms-name').value.trim();
            m.targetDate = document.getElementById('ms-date').value;
            m.emoji = document.getElementById('ms-emoji').value;
            m.color = document.getElementById('ms-color').value;
            await ThriveDB.put('milestones', m);
            Utils.closeModal(); Utils.toast('Milestone updated! ✏️', 'success'); renderMilestones();
        });
    }

    // ===== Goals (Multi-Tier CRUD) =====
    async function renderGoals() {
        const all = await ThriveDB.getAll('goals');
        const goals = all.filter(g => g.tier === _currentTier && !g.completed);
        const container = document.getElementById('goal-trackers');
        container.innerHTML = '';

        if (goals.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">🎯</div><p class="empty-state-text">No ' + _currentTier + ' goals yet. Tap ＋ to add!</p></div>';
            return;
        }

        goals.forEach(goal => {
            const pct = Math.round((goal.current / goal.total) * 100);
            const item = Utils.el('div', { className: 'goal-item' },
                Utils.el('div', { className: 'goal-header' },
                    Utils.el('span', { className: 'goal-name', textContent: goal.name }),
                    Utils.el('span', { className: 'goal-percent', textContent: pct + '%' })
                ),
                Utils.el('div', { className: 'goal-bar-bg' },
                    Utils.el('div', { className: `goal-bar-fill ${_currentTier}`, style: { width: pct + '%' } })
                ),
                Utils.el('div', { className: 'goal-detail', textContent: `${goal.current} / ${goal.total} ${goal.unit}` }),
                Utils.el('div', { className: 'goal-actions' },
                    Utils.el('button', { className: 'goal-log-btn', textContent: '＋ Log', onClick: () => showLogProgressModal(goal) }),
                    Utils.el('button', { textContent: '✏️', onClick: () => showEditGoalModal(goal) }),
                    Utils.el('button', { textContent: pct >= 100 ? '✅ Complete' : '🏁', onClick: async () => {
                        goal.completed = true; goal.completedAt = Date.now();
                        await ThriveDB.put('goals', goal);
                        Utils.toast('🎉 Goal completed!', 'success'); renderGoals(); renderCompletedGoals(); renderDailyProgress();
                    }}),
                    Utils.el('button', { textContent: '🗑️', onClick: async () => {
                        await ThriveDB.remove('goals', goal.id);
                        Utils.toast('Goal removed', 'warning'); renderGoals();
                    }})
                )
            );
            container.appendChild(item);
        });
    }

    async function renderCompletedGoals() {
        const all = await ThriveDB.getAll('goals');
        const completed = all.filter(g => g.completed);
        const container = document.getElementById('completed-goals');
        container.innerHTML = '';
        const section = document.getElementById('completed-goals-section');

        if (completed.length === 0) { section.style.display = 'none'; return; }
        section.style.display = 'block';

        completed.forEach(goal => {
            const item = Utils.el('div', { className: 'goal-item completed' },
                Utils.el('div', { className: 'goal-header' },
                    Utils.el('span', { className: 'goal-name', textContent: '✅ ' + goal.name }),
                    Utils.el('span', { className: 'goal-percent', textContent: '100%', style: { color: 'var(--success-light)' } })
                ),
                Utils.el('div', { className: 'goal-bar-bg' }, Utils.el('div', { className: 'goal-bar-fill', style: { width: '100%' } }) ),
                Utils.el('div', { className: 'goal-detail', textContent: `${goal.total} / ${goal.total} ${goal.unit} — ${Utils.GOAL_TIER_LABELS[goal.tier] || goal.tier}` })
            );
            container.appendChild(item);
        });
    }

    function showAddGoalModal() {
        Utils.showModal('Add Goal', `
            <form id="goal-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
                <input type="text" id="g-name" placeholder="Goal name" required maxlength="60">
                <input type="number" id="g-total" placeholder="Target (e.g. 120)" required min="1">
                <input type="text" id="g-unit" placeholder="Unit (e.g. lectures, hours)" required maxlength="30">
                <select id="g-tier"><option value="daily">📅 Daily</option><option value="weekly">📆 Weekly</option><option value="monthly">🗓️ Monthly</option><option value="yearly">🎯 Yearly</option></select>
                <button type="submit" class="btn-primary">Add Goal</button>
            </form>`);
        document.getElementById('goal-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await ThriveDB.put('goals', {
                id: Utils.uid(), name: document.getElementById('g-name').value.trim(),
                current: 0, total: parseInt(document.getElementById('g-total').value),
                unit: document.getElementById('g-unit').value.trim(), tier: document.getElementById('g-tier').value,
                completed: false, createdAt: Date.now()
            });
            Utils.closeModal(); Utils.toast('Goal added! 🎯', 'success'); renderGoals();
        });
    }

    function showEditGoalModal(goal) {
        Utils.showModal('Edit Goal', `
            <form id="goal-edit-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
                <input type="text" id="g-name" value="${goal.name}" required maxlength="60">
                <div style="display:flex;gap:8px;">
                    <input type="number" id="g-current" value="${goal.current}" min="0" placeholder="Current">
                    <input type="number" id="g-total" value="${goal.total}" min="1" placeholder="Total">
                </div>
                <input type="text" id="g-unit" value="${goal.unit}" maxlength="30">
                <select id="g-tier"><option value="daily" ${goal.tier==='daily'?'selected':''}>📅 Daily</option><option value="weekly" ${goal.tier==='weekly'?'selected':''}>📆 Weekly</option><option value="monthly" ${goal.tier==='monthly'?'selected':''}>🗓️ Monthly</option><option value="yearly" ${goal.tier==='yearly'?'selected':''}>🎯 Yearly</option></select>
                <button type="submit" class="btn-primary">Save</button>
            </form>`);
        document.getElementById('goal-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            goal.name = document.getElementById('g-name').value.trim();
            goal.current = parseInt(document.getElementById('g-current').value) || 0;
            goal.total = parseInt(document.getElementById('g-total').value);
            goal.unit = document.getElementById('g-unit').value.trim();
            goal.tier = document.getElementById('g-tier').value;
            await ThriveDB.put('goals', goal);
            Utils.closeModal(); Utils.toast('Goal updated! ✏️', 'success'); renderGoals();
        });
    }

    function showLogProgressModal(goal) {
        Utils.showModal('Log Progress: ' + goal.name, `
            <form id="log-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
                <p style="color:var(--text-secondary);font-size:0.85rem;">Current: ${goal.current} / ${goal.total} ${goal.unit}</p>
                <input type="number" id="log-amount" placeholder="How many ${goal.unit}?" required min="1" value="1">
                <input type="text" id="log-note" placeholder="What did you do? (optional)" maxlength="80">
                <button type="submit" class="btn-primary">Log ✓</button>
            </form>`);
        document.getElementById('log-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseInt(document.getElementById('log-amount').value) || 1;
            const note = document.getElementById('log-note').value.trim();
            goal.current = Math.min(goal.current + amount, goal.total);
            await ThriveDB.put('goals', goal);

            // Also log as activity
            await ThriveDB.put('activities', {
                id: Utils.uid(), type: 'study', name: note || `+${amount} ${goal.unit} (${goal.name})`,
                duration: 0, date: Utils.todayStr(), timeStr: Utils.nowTime(),
                timestamp: Date.now(), goalId: goal.id
            });

            // Log to goalLogs for calendar
            await ThriveDB.put('goalLogs', {
                id: Utils.uid(), goalId: goal.id, goalName: goal.name,
                amount, date: Utils.todayStr(), timestamp: Date.now()
            });

            Utils.closeModal();
            Utils.toast(`+${amount} ${goal.unit}! (${goal.current}/${goal.total})`, 'success');
            if (goal.current >= goal.total) Utils.toast('🎉 Goal target reached!', 'success', 3000);
            renderGoals(); renderDailyProgress(); renderActivityLog();
        });
    }

    // ===== Period Chart =====
    async function renderPeriodChart(period) {
        const chart = document.getElementById('period-chart');
        chart.innerHTML = '';
        let labels = [], data = [];

        if (period === 'daily') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }).charAt(0));
                const log = await ThriveDB.get('dailyLog', d.toISOString().split('T')[0]);
                data.push(log ? log.percent : 0);
            }
        } else if (period === 'weekly') {
            for (let w = 3; w >= 0; w--) {
                const start = new Date(); start.setDate(start.getDate() - (w * 7 + start.getDay() - 1));
                let total = 0, count = 0;
                for (let d = 0; d < 7; d++) {
                    const day = new Date(start); day.setDate(day.getDate() + d);
                    const log = await ThriveDB.get('dailyLog', day.toISOString().split('T')[0]);
                    if (log) { total += log.percent; count++; }
                }
                labels.push(`W${4 - w}`); data.push(count > 0 ? Math.round(total / count) : 0);
            }
        } else if (period === 'monthly') {
            for (let m = 5; m >= 0; m--) {
                const d = new Date(); d.setMonth(d.getMonth() - m);
                labels.push(d.toLocaleDateString('en-IN', { month: 'short' }).slice(0, 3));
                data.push(0); // Will accumulate over time
            }
        } else { labels = ['2025', '2026']; data = [0, 0]; }

        const maxVal = Math.max(...data, 1);
        data.forEach((val, i) => {
            const height = Math.max((val / maxVal) * 100, 4);
            const bg = val > 0 ? 'linear-gradient(180deg, var(--primary), var(--accent))' : 'var(--border)';
            const bar = Utils.el('div', { className: 'chart-bar', style: { height: height + '%', background: bg } },
                Utils.el('span', { className: 'chart-tooltip', textContent: val + '%' }),
                Utils.el('span', { className: 'chart-bar-label', textContent: labels[i] })
            );
            chart.appendChild(bar);
        });
    }

    // ===== Activity Log =====
    async function renderActivityLog() {
        const today = Utils.todayStr();
        const activities = await ThriveDB.getAll('activities', 'by_date', today);
        const container = document.getElementById('activity-log');
        container.innerHTML = '';
        if (activities.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">📝</div><p class="empty-state-text">No activities today. Tap ＋ to add!</p></div>';
            return;
        }
        activities.sort((a, b) => b.timestamp - a.timestamp);
        activities.forEach(act => {
            const emoji = Utils.ACTIVITY_EMOJIS[act.type] || '⚡';
            
            let durationStr = '';
            if (act.duration) {
                const h = Math.floor(act.duration / 60);
                const m = Math.floor(act.duration % 60);
                const s = Math.round((act.duration % 1) * 60);
                if (h > 0) durationStr += `${h}h `;
                if (m > 0 || (h === 0 && s === 0)) durationStr += `${m}m `;
                if (h === 0 && s > 0) durationStr += `${s}s`;
                durationStr = durationStr.trim();
            }

            const item = Utils.el('div', { className: 'activity-item' },
                Utils.el('span', { className: 'activity-emoji', textContent: emoji }),
                Utils.el('div', { className: 'activity-info' },
                    Utils.el('div', { className: 'activity-name', textContent: act.name }),
                    Utils.el('div', { className: 'activity-time', textContent: act.timeStr }),
                    act.goalId ? Utils.el('div', { className: 'activity-goal-link', textContent: '🎯 Linked to goal' }) : document.createTextNode('')
                ),
                Utils.el('span', { className: 'activity-duration', textContent: durationStr }),
                Utils.el('button', { className: 'activity-delete', textContent: '✕', onClick: async () => {
                    await ThriveDB.remove('activities', act.id);
                    Utils.toast('Activity removed', 'warning'); renderActivityLog(); renderDailyProgress();
                }})
            );
            container.appendChild(item);
        });
    }

    function showAddActivityModal() {
        const types = Object.entries(Utils.ACTIVITY_EMOJIS);
        const typeOpts = types.map(([v, e]) => `<option value="${v}">${e} ${v.replace(/_/g, ' ')}</option>`).join('');

        // Get active goals for linking
        ThriveDB.getAll('goals').then(goals => {
            const activeGoals = goals.filter(g => !g.completed);
            const goalOpts = '<option value="">— No goal link —</option>' + activeGoals.map(g => `<option value="${g.id}">${g.name} (${g.current}/${g.total})</option>`).join('');

            Utils.showModal('Log Activity', `
                <form id="activity-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
                    <select id="act-type" style="text-transform:capitalize;">${typeOpts}</select>
                    <input type="text" id="act-name" placeholder="What did you do?" required maxlength="80">
                    <input type="number" id="act-duration" placeholder="Duration (minutes)" min="1" max="600">
                    <select id="act-goal">${goalOpts}</select>
                    <input type="number" id="act-goal-progress" placeholder="Progress to add to goal" min="1" class="hidden">
                    <button type="submit" class="btn-primary">Log ✓</button>
                </form>`);

            document.getElementById('act-goal').addEventListener('change', (e) => {
                document.getElementById('act-goal-progress').classList.toggle('hidden', !e.target.value);
            });

            document.getElementById('activity-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const type = document.getElementById('act-type').value;
                const name = document.getElementById('act-name').value.trim();
                const duration = parseInt(document.getElementById('act-duration').value) || 0;
                const goalId = document.getElementById('act-goal').value;
                const goalProgress = parseInt(document.getElementById('act-goal-progress').value) || 0;
                if (!name) return;

                await ThriveDB.put('activities', {
                    id: Utils.uid(), type, name, duration, date: Utils.todayStr(),
                    timeStr: Utils.nowTime(), timestamp: Date.now(), goalId: goalId || null
                });

                // Update linked goal progress
                if (goalId && goalProgress > 0) {
                    const goal = await ThriveDB.get('goals', goalId);
                    if (goal) {
                        goal.current = Math.min(goal.current + goalProgress, goal.total);
                        await ThriveDB.put('goals', goal);
                        await ThriveDB.put('goalLogs', {
                            id: Utils.uid(), goalId, goalName: goal.name,
                            amount: goalProgress, date: Utils.todayStr(), timestamp: Date.now()
                        });
                        Utils.toast(`+${goalProgress} ${goal.unit} added to "${goal.name}"`, 'success');
                    }
                }

                Utils.closeModal(); Utils.toast('Activity logged! 🎉', 'success');
                renderActivityLog(); renderDailyProgress(); renderGoals();
            });
        });
    }

    // ===== Goal History Calendar =====
    async function renderGoalCalendar() {
        const label = new Date(_goalCalendarYear, _goalCalendarMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const titleEl = document.getElementById('goal-cal-month-label');
        if (titleEl) titleEl.textContent = label;

        const container = document.getElementById('goal-cal-cells');
        if (!container) return;
        
        container.innerHTML = '';

        const firstDay = Utils.getFirstDayOfMonth(_goalCalendarYear, _goalCalendarMonth);
        const daysInMonth = Utils.getDaysInMonth(_goalCalendarYear, _goalCalendarMonth);
        const daysInPrev = _goalCalendarMonth > 0 ? Utils.getDaysInMonth(_goalCalendarYear, _goalCalendarMonth - 1) : Utils.getDaysInMonth(_goalCalendarYear - 1, 11);
        const todayStr = Utils.todayStr();

        // Fetch goal logs for the month
        const monthStr = `${_goalCalendarYear}-${String(_goalCalendarMonth + 1).padStart(2, '0')}`;
        const allLogs = await ThriveDB.getAll('goalLogs', 'by_date');
        const monthLogs = {};
        
        allLogs.forEach(log => {
            if (log.date && log.date.startsWith(monthStr)) {
                if (!monthLogs[log.date]) monthLogs[log.date] = [];
                monthLogs[log.date].push(log);
            }
        });

        // Prev padding
        const mondayFirst = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = mondayFirst - 1; i >= 0; i--) {
            container.appendChild(Utils.el('div', { className: 'cal-cell other-month', textContent: daysInPrev - i }));
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${_goalCalendarYear}-${String(_goalCalendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === _goalCalendarSelectedDate;
            const logs = monthLogs[dateStr] || [];

            let cls = 'cal-cell';
            if (isToday) cls += ' today';
            if (isSelected) cls += ' selected';

            const cell = Utils.el('div', { 
                className: cls, 
                onClick: () => selectGoalCalendarDate(dateStr),
                style: { position: 'relative' }
            },
                Utils.el('span', { textContent: d, style: { fontSize: '0.85rem' } }),
                logs.length > 0 ? Utils.el('span', { 
                    className: 'cal-goal-dot', 
                    title: `${logs.length} goal(s)`,
                    style: { 
                        width: '6px', 
                        height: '6px', 
                        background: 'var(--success)', 
                        borderRadius: '50%',
                        display: 'inline-block',
                        margin: '2px'
                    } 
                }) : null
            );
            container.appendChild(cell);
        }
    }

    async function selectGoalCalendarDate(dateStr) {
        _goalCalendarSelectedDate = dateStr;
        await renderGoalCalendarDetail(dateStr);
        renderGoalCalendar();
    }

    async function renderGoalCalendarDetail(dateStr) {
        const container = document.getElementById('goal-cal-detail');
        if (!container) return;

        container.innerHTML = '';
        
        const formattedDate = Utils.formatDateLong(dateStr);
        container.appendChild(Utils.el('h4', { 
            textContent: formattedDate,
            style: { marginBottom: '12px', color: 'var(--primary-light)' }
        }));

        const goalLogs = await ThriveDB.getAll('goalLogs', 'by_date', dateStr);
        
        if (goalLogs.length === 0) {
            container.innerHTML += '<p style="color: var(--text-muted); font-size: 0.9rem;">No goals logged for this date.</p>';
            return;
        }

        goalLogs.forEach(log => {
            const item = Utils.el('div', { 
                className: 'goal-log-item',
                style: {
                    padding: '8px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    marginBottom: '6px',
                    fontSize: '0.9rem'
                }
            },
                Utils.el('div', { textContent: `🎯 ${log.goalName}`, style: { fontWeight: '600', marginBottom: '4px' } }),
                Utils.el('div', { textContent: `+${log.amount} ${log.goalId ? '(logged)' : '(manual)'}`, style: { color: 'var(--success)', fontSize: '0.85rem' } })
            );
            container.appendChild(item);
        });
    }

    // ===== Wire Events =====
    function wireEvents() {
        document.getElementById('btn-add-activity').addEventListener('click', showAddActivityModal);
        document.getElementById('btn-add-milestone').addEventListener('click', showAddMilestoneModal);
        document.getElementById('btn-add-goal').addEventListener('click', showAddGoalModal);

        // Goal calendar navigation
        const goalCalPrev = document.getElementById('goal-cal-prev');
        const goalCalNext = document.getElementById('goal-cal-next');
        if (goalCalPrev) {
            goalCalPrev.addEventListener('click', () => {
                _goalCalendarMonth--; 
                if (_goalCalendarMonth < 0) { 
                    _goalCalendarMonth = 11; 
                    _goalCalendarYear--; 
                }
                renderGoalCalendar();
            });
        }
        if (goalCalNext) {
            goalCalNext.addEventListener('click', () => {
                _goalCalendarMonth++; 
                if (_goalCalendarMonth > 11) { 
                    _goalCalendarMonth = 0; 
                    _goalCalendarYear++; 
                }
                renderGoalCalendar();
            });
        }

        document.querySelectorAll('.tier-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tier-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                _currentTier = tab.dataset.tier;
                renderGoals();
            });
        });

        document.querySelectorAll('.period-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderPeriodChart(tab.dataset.period);
            });
        });
    }

    return { init, refresh };
})();
