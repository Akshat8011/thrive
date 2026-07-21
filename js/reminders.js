/* ============================================================
   THRIVE v2 — Reminders Module
   CRUD reminders with date/time, upcoming popup, notifications
   ============================================================ */

const RemindersModule = (() => {

    async function init() {
        await renderReminders();
        wireEvents();
        scheduleNotifications();
    }

    async function renderReminders() {
        const all = await ThriveDB.getAll('reminders');
        const now = new Date();
        const upcoming = all.filter(r => !r.done && new Date(r.datetime) > now).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        const past = all.filter(r => r.done || new Date(r.datetime) <= now).sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

        renderList('upcoming-reminders', upcoming, false);
        renderList('past-reminders', past, true);

        // Update notif badge
        const badge = document.getElementById('notif-badge');
        if (upcoming.length > 0) { badge.textContent = upcoming.length; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
    }

    function renderList(containerId, items, isPast) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        if (items.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding:16px;"><p class="empty-state-text">${isPast ? 'No past reminders.' : 'No upcoming reminders. Set one!'}</p></div>`;
            return;
        }
        items.forEach(r => {
            const dt = new Date(r.datetime);
            const card = Utils.el('div', { className: `reminder-card ${isPast ? 'past' : ''} ${r.done ? 'done' : ''}` },
                Utils.el('div', { className: 'reminder-icon', textContent: r.done ? '✅' : '🔔' }),
                Utils.el('div', { className: 'reminder-info' },
                    Utils.el('div', { className: 'reminder-title-text', textContent: r.title }),
                    Utils.el('div', { className: 'reminder-datetime', textContent: dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ' • ' + Utils.formatTime(dt.getHours().toString().padStart(2, '0') + ':' + dt.getMinutes().toString().padStart(2, '0')) }),
                    r.note ? Utils.el('div', { className: 'reminder-note', textContent: r.note }) : document.createTextNode('')
                ),
                Utils.el('div', { className: 'reminder-actions' },
                    !r.done ? Utils.el('button', { textContent: '✓', title: 'Mark Done', onClick: async () => {
                        r.done = true; await ThriveDB.put('reminders', r); Utils.toast('Reminder done!', 'success'); renderReminders();
                    }}) : document.createTextNode(''),
                    Utils.el('button', { textContent: '✏️', onClick: () => showEditReminderModal(r) }),
                    Utils.el('button', { textContent: '🗑️', onClick: async () => {
                        await ThriveDB.remove('reminders', r.id); Utils.toast('Reminder deleted', 'warning'); renderReminders();
                    }})
                )
            );
            container.appendChild(card);
        });
    }

    function showAddReminderModal() {
        const nowDate = Utils.todayStr();
        const nowTime = Utils.nowTime24();
        Utils.showModal('New Reminder', `<form id="reminder-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
            <input type="text" id="rem-title" placeholder="Reminder title" required maxlength="80">
            <input type="date" id="rem-date" value="${nowDate}" required>
            <input type="time" id="rem-time" value="${nowTime}" required>
            <textarea id="rem-note" placeholder="Note (optional)" rows="3" style="resize:vertical;"></textarea>
            <button type="submit" class="btn-primary">Set Reminder 🔔</button></form>`);
        document.getElementById('reminder-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const date = document.getElementById('rem-date').value;
            const time = document.getElementById('rem-time').value;
            await ThriveDB.put('reminders', {
                id: Utils.uid(), title: document.getElementById('rem-title').value.trim(),
                date, time, datetime: `${date}T${time}`, note: document.getElementById('rem-note').value.trim(),
                done: false, createdAt: Date.now()
            });
            Utils.closeModal(); Utils.toast('Reminder set! 🔔', 'success'); renderReminders(); scheduleNotifications();
        });
    }

    function showEditReminderModal(r) {
        const dt = new Date(r.datetime);
        const dateStr = dt.toISOString().split('T')[0];
        const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        Utils.showModal('Edit Reminder', `<form id="edit-rem-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
            <input type="text" id="rem-title" value="${r.title}" required maxlength="80">
            <input type="date" id="rem-date" value="${dateStr}" required>
            <input type="time" id="rem-time" value="${timeStr}" required>
            <textarea id="rem-note" rows="3" style="resize:vertical;">${r.note || ''}</textarea>
            <button type="submit" class="btn-primary">Save ✓</button></form>`);
        document.getElementById('edit-rem-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const date = document.getElementById('rem-date').value;
            const time = document.getElementById('rem-time').value;
            r.title = document.getElementById('rem-title').value.trim();
            r.date = date; r.time = time; r.datetime = `${date}T${time}`;
            r.note = document.getElementById('rem-note').value.trim();
            await ThriveDB.put('reminders', r);
            Utils.closeModal(); Utils.toast('Reminder updated!', 'success'); renderReminders(); scheduleNotifications();
        });
    }

    async function scheduleNotifications() {
        const all = await ThriveDB.getAll('reminders');
        const now = new Date();
        all.filter(r => !r.done && new Date(r.datetime) > now).forEach(r => {
            const dt = new Date(r.datetime);
            const delay = dt - now;
            if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
                setTimeout(() => {
                    Utils.sendNotification('🔔 Reminder', r.title, 'reminder-' + r.id);
                    Utils.toast('⏰ ' + r.title, 'warning', 4000);
                }, delay);
            }
        });
    }

    function wireEvents() {
        document.getElementById('btn-add-reminder').addEventListener('click', showAddReminderModal);
    }

    return { init };
})();
