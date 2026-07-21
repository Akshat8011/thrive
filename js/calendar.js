/* ============================================================
   THRIVE v2 — Calendar Module
   Month view with goals, reminders, activities, holidays
   ============================================================ */

const CalendarModule = (() => {
    let _year, _month, _selectedDate = null;

    function init() {
        const today = new Date();
        _year = today.getFullYear();
        _month = today.getMonth();
        _selectedDate = Utils.todayStr();
        renderCalendar();
        renderDayDetail(_selectedDate);
        wireEvents();
    }

    async function renderCalendar() {
        const label = new Date(_year, _month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        document.getElementById('cal-month-label').textContent = label;

        const container = document.getElementById('cal-cells');
        container.innerHTML = '';

        const firstDay = Utils.getFirstDayOfMonth(_year, _month);
        const daysInMonth = Utils.getDaysInMonth(_year, _month);
        const daysInPrev = _month > 0 ? Utils.getDaysInMonth(_year, _month - 1) : Utils.getDaysInMonth(_year - 1, 11);
        const today = Utils.todayStr();

        // Pre-fetch data for this month
        const monthStr = `${_year}-${String(_month + 1).padStart(2, '0')}`;
        const reminders = await ThriveDB.getAll('reminders');
        const goalLogs = await ThriveDB.getAll('goalLogs');
        const activities = await ThriveDB.getAll('activities');

        const reminderDates = new Set(reminders.map(r => r.date));
        const goalDates = new Set(goalLogs.map(g => g.date));
        const activityDates = new Set(activities.map(a => a.date));
        const holidayDates = new Set(Utils.PUBLIC_HOLIDAYS_2026.map(h => h.date));

        // Previous month padding
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrev - i;
            const cell = Utils.el('div', { className: 'cal-cell other-month', textContent: day });
            container.appendChild(cell);
        }

        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${_year}-${String(_month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isSelected = dateStr === _selectedDate;
            const isHoliday = holidayDates.has(dateStr);
            let cls = 'cal-cell';
            if (isToday) cls += ' today';
            if (isSelected) cls += ' selected';
            if (isHoliday) cls += ' holiday';

            const dots = Utils.el('div', { className: 'cal-dot-row' });
            if (reminderDates.has(dateStr)) dots.appendChild(Utils.el('span', { className: 'cal-dot reminder' }));
            if (goalDates.has(dateStr)) dots.appendChild(Utils.el('span', { className: 'cal-dot goal' }));
            if (activityDates.has(dateStr)) dots.appendChild(Utils.el('span', { className: 'cal-dot activity' }));
            if (isHoliday) dots.appendChild(Utils.el('span', { className: 'cal-dot holiday-dot' }));

            const cell = Utils.el('div', { className: cls, onClick: () => selectDate(dateStr) },
                Utils.el('span', { textContent: d }),
                dots
            );
            container.appendChild(cell);
        }

        // Next month padding
        const totalCells = firstDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            const cell = Utils.el('div', { className: 'cal-cell other-month', textContent: i });
            container.appendChild(cell);
        }
    }

    function selectDate(dateStr) {
        _selectedDate = dateStr;
        renderCalendar();
        renderDayDetail(dateStr);
    }

    async function renderDayDetail(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const dayName = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('cal-detail-date').textContent = dayName;

        const container = document.getElementById('cal-detail-items');
        container.innerHTML = '';

        // Holiday
        const holiday = Utils.getHoliday(dateStr);
        if (holiday) {
            let badgeCls = 'holiday'; // danger (red)
            if (holiday.type.includes('Restricted')) badgeCls = 'reminder'; // warning (yellow)
            if (holiday.type.includes('Observance')) badgeCls = 'activity'; // primary (blue)
            
            const icon = holiday.type.includes('Gazetted') ? '🇮🇳 ' : '🎉 ';
            container.appendChild(Utils.el('div', { className: 'cal-detail-item' },
                Utils.el('span', { className: `cal-detail-badge ${badgeCls}`, textContent: holiday.type || 'Holiday' }),
                Utils.el('span', { textContent: icon + holiday.name })
            ));
        }

        // Reminders for this date
        const reminders = await ThriveDB.getAll('reminders', 'by_date', dateStr);
        reminders.forEach(r => {
            container.appendChild(Utils.el('div', { className: 'cal-detail-item' },
                Utils.el('span', { className: 'cal-detail-badge reminder', textContent: '🔔' }),
                Utils.el('span', { textContent: r.title + (r.time ? ' — ' + Utils.formatTime(r.time) : '') })
            ));
        });

        // Goal Logs for this date
        const goalLogs = await ThriveDB.getAll('goalLogs', 'by_date', dateStr);
        goalLogs.forEach(gl => {
            container.appendChild(Utils.el('div', { className: 'cal-detail-item' },
                Utils.el('span', { className: 'cal-detail-badge goal', textContent: '🎯' }),
                Utils.el('span', { textContent: `+${gl.amount} — ${gl.goalName}` })
            ));
        });

        // Activities for this date
        const activities = await ThriveDB.getAll('activities', 'by_date', dateStr);
        activities.forEach(a => {
            const emoji = Utils.ACTIVITY_EMOJIS[a.type] || '⚡';
            container.appendChild(Utils.el('div', { className: 'cal-detail-item' },
                Utils.el('span', { className: 'cal-detail-badge activity', textContent: emoji }),
                Utils.el('span', { textContent: a.name + (a.duration ? ` (${a.duration}m)` : '') })
            ));
        });

        // Daily progress
        const log = await ThriveDB.get('dailyLog', dateStr);
        if (log) {
            container.appendChild(Utils.el('div', { className: 'cal-detail-item' },
                Utils.el('span', { className: 'cal-detail-badge activity', textContent: '📊' }),
                Utils.el('span', { textContent: `Daily Progress: ${log.percent}% (${log.completed}/${log.total} tasks)` })
            ));
        }

        // Todos for this date
        const todos = await ThriveDB.getAll('todos', 'by_date', dateStr);
        todos.forEach(t => {
            container.appendChild(Utils.el('div', { className: 'cal-detail-item' },
                Utils.el('span', { className: 'cal-detail-badge ' + (t.done ? 'goal' : 'reminder'), textContent: t.done ? '✅' : '📋' }),
                Utils.el('span', { textContent: t.text, style: t.done ? { textDecoration: 'line-through', opacity: '0.6' } : {} })
            ));
        });

        if (container.children.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">Nothing recorded for this day.</p>';
        }
    }

    function wireEvents() {
        document.getElementById('cal-prev').addEventListener('click', () => {
            _month--;
            if (_month < 0) { _month = 11; _year--; }
            renderCalendar();
        });
        document.getElementById('cal-next').addEventListener('click', () => {
            _month++;
            if (_month > 11) { _month = 0; _year++; }
            renderCalendar();
        });
        document.getElementById('cal-today-btn').addEventListener('click', () => {
            const now = new Date();
            _year = now.getFullYear(); _month = now.getMonth();
            _selectedDate = Utils.todayStr();
            renderCalendar(); renderDayDetail(_selectedDate);
        });
    }

    return { init };
})();
