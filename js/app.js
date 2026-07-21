/* ============================================================
   THRIVE v2 — Core App Controller
   ============================================================ */

const ThriveApp = (() => {
    let _currentPage = 'dashboard';

    async function init() {
        await ThriveDB.open();
        await seedDefaults();

        // Apply saved theme
        const theme = Utils.getTheme();
        Utils.setTheme(theme);
        document.getElementById('theme-icon').textContent = theme === 'dark' ? '🌙' : '☀️';

        wireNavigation();
        wireThemeToggle();
        wireSyncToggle();
        wireModalClose();
        updateTopDate();

        // Splash → App
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            splash.classList.add('fade-out');
            document.getElementById('app-shell').classList.remove('hidden');
            setTimeout(() => splash.remove(), 600);
        }, 1200);

        // Init modules
        if (typeof DashboardModule !== 'undefined') DashboardModule.init();
        if (typeof CreativeModule !== 'undefined') CreativeModule.init();
        if (typeof FinanceModule !== 'undefined') FinanceModule.init();
        if (typeof PomodoroModule !== 'undefined') PomodoroModule.init();
        if (typeof ChecklistModule !== 'undefined') ChecklistModule.init();
        if (typeof RemindersModule !== 'undefined') RemindersModule.init();
        if (typeof CalendarModule !== 'undefined') CalendarModule.init();
        if (typeof StudyModule !== 'undefined') StudyModule.init();

        Utils.requestNotifPermission();
        setupPushNotifications();
        scheduleBeforeLeavingReminder();

        // Show upcoming reminder popup
        setTimeout(() => showReminderPopup(), 1800);

        console.log('[Thrive] ✅ Life OS v2 initialized.');
    }

    async function seedDefaults() {
        const hasSeeded = await ThriveDB.get('appState', 'seeded_v2');
        if (hasSeeded) return;

        const milestones = [
            { id: 'gate2027', name: 'GATE 2027', targetDate: '2027-02-01', emoji: '🎯', color: 'blue' },
            { id: 'birthday', name: 'Birthday', targetDate: '2026-08-11', emoji: '🎂', color: 'purple' },
            { id: 'newyear', name: 'New Year 2027', targetDate: '2027-01-01', emoji: '🎆', color: 'amber' },
            { id: 'semester', name: 'Semester End', targetDate: '2026-06-15', emoji: '🎓', color: 'green' }
        ];
        await ThriveDB.putBatch('milestones', milestones);

        const goals = [
            { id: 'lectures', name: 'Complete EE Lectures', current: 0, total: 120, unit: 'lectures', tier: 'yearly', completed: false, createdAt: Date.now() },
            { id: 'notes', name: 'EE Notes Revision', current: 0, total: 50, unit: 'chapters', tier: 'yearly', completed: false, createdAt: Date.now() },
            { id: 'problems', name: 'Practice Problems', current: 0, total: 500, unit: 'problems', tier: 'yearly', completed: false, createdAt: Date.now() },
            { id: 'daily_study', name: 'Study 4 hours', current: 0, total: 4, unit: 'hours', tier: 'daily', completed: false, createdAt: Date.now() },
            { id: 'daily_exercise', name: 'Exercise 30 min', current: 0, total: 30, unit: 'minutes', tier: 'daily', completed: false, createdAt: Date.now() },
            { id: 'weekly_revision', name: 'Revise 5 chapters', current: 0, total: 5, unit: 'chapters', tier: 'weekly', completed: false, createdAt: Date.now() },
            { id: 'monthly_project', name: 'Complete 1 project', current: 0, total: 1, unit: 'project', tier: 'monthly', completed: false, createdAt: Date.now() }
        ];
        await ThriveDB.putBatch('goals', goals);

        const checklistItems = [
            { id: 'cl_phone', listType: 'leaving', text: '📱 Phone', checked: false, order: 0 },
            { id: 'cl_wallet', listType: 'leaving', text: '💳 Wallet & Cash', checked: false, order: 1 },
            { id: 'cl_keys', listType: 'leaving', text: '🔑 Keys', checked: false, order: 2 },
            { id: 'cl_bottle', listType: 'leaving', text: '🍶 Water Bottle', checked: false, order: 3 },
            { id: 'cl_charger', listType: 'leaving', text: '🔌 Charger', checked: false, order: 4 },
            { id: 'cl_earbuds', listType: 'leaving', text: '🎧 Earbuds', checked: false, order: 5 }
        ];
        await ThriveDB.putBatch('checklist', checklistItems);

        await ThriveDB.put('pomodoroConfig', { id: 'default', focusMin: 25, breakMin: 5, longBreakMin: 15, sessionsBeforeLong: 4 });
        await ThriveDB.put('appState', { key: 'seeded_v2', value: true });
    }

    function wireNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.page');
        navItems.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.page;
                if (target === _currentPage) return;
                navItems.forEach(n => n.classList.remove('active'));
                btn.classList.add('active');
                pages.forEach(p => p.classList.remove('active'));
                document.getElementById(`page-${target}`).classList.add('active');
                _currentPage = target;
                if (navigator.vibrate) navigator.vibrate(10);
            });
        });
    }

    function wireThemeToggle() {
        document.getElementById('btn-theme-toggle').addEventListener('click', () => {
            const next = Utils.toggleTheme();
            document.getElementById('theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';
            Utils.toast(next === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode', 'info', 1500);
        });
    }

    function wireSyncToggle() {
        const btn = document.getElementById('btn-sync');
        if (!btn) return;
        
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                // Show menu with backup/restore options
                const existingMenu = document.getElementById('sync-menu');
                if (existingMenu) {
                    existingMenu.remove();
                    return;
                }

                const menu = Utils.el('div', { 
                    id: 'sync-menu',
                    className: 'sync-menu',
                    style: {
                        position: 'fixed',
                        top: '50px',
                        right: '10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        zIndex: '9999',
                        overflow: 'hidden',
                        minWidth: '200px'
                    }
                });

                const backup = Utils.el('button', {
                    textContent: '💾 Backup Data',
                    onclick: async () => {
                        try {
                            menu.remove();
                            btn.style.opacity = '0.5';
                            Utils.toast('Creating backup...', 'info');
                            await ThriveDB.syncToCloud();
                            btn.style.opacity = '1';
                        } catch (err) {
                            btn.style.opacity = '1';
                            Utils.toast('Backup error: ' + err.message, 'danger');
                            console.error('[Sync] Backup error:', err);
                        }
                    },
                    style: {
                        display: 'block',
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        transition: 'background var(--duration-fast)'
                    }
                });

                const restore = Utils.el('button', {
                    textContent: '📂 Restore from Backup',
                    onclick: async () => {
                        try {
                            menu.remove();
                            Utils.toast('Select backup file...', 'info');
                            await ThriveDB.pullFromCloud();
                        } catch (err) {
                            Utils.toast('Restore error: ' + err.message, 'danger');
                            console.error('[Sync] Restore error:', err);
                        }
                    },
                    style: {
                        display: 'block',
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        borderTop: '1px solid var(--border)',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        transition: 'background var(--duration-fast)'
                    }
                });

                backup.onmouseover = () => backup.style.background = 'var(--bg-secondary)';
                backup.onmouseout = () => backup.style.background = 'transparent';
                restore.onmouseover = () => restore.style.background = 'var(--bg-secondary)';
                restore.onmouseout = () => restore.style.background = 'transparent';

                menu.appendChild(backup);
                menu.appendChild(restore);
                document.body.appendChild(menu);

                // Close menu on outside click
                setTimeout(() => {
                    document.addEventListener('click', function closeMenu(e) {
                        if (menu && menu.parentNode && !menu.contains(e.target) && e.target !== btn) {
                            if (menu.parentNode) menu.remove();
                            document.removeEventListener('click', closeMenu);
                        }
                    });
                }, 100);
            } catch (err) {
                console.error('[Sync] Menu creation error:', err);
                Utils.toast('Menu error: ' + err.message, 'danger');
            }
        });
    }

    function wireModalClose() {
        document.getElementById('modal-close').addEventListener('click', Utils.closeModal);
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) Utils.closeModal();
        });
    }

    function updateTopDate() {
        const dateEl = document.getElementById('current-date');
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
        setTimeout(() => {
            updateTopDate();
            if (typeof DashboardModule !== 'undefined') DashboardModule.refresh();
            if (typeof ChecklistModule !== 'undefined') ChecklistModule.resetDaily();
        }, msToMidnight);
    }

    async function showReminderPopup() {
        try {
            const all = await ThriveDB.getAll('reminders');
            const now = new Date();
            const upcoming = all.filter(r => !r.done && new Date(r.datetime) > now)
                .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
                .slice(0, 3);

            if (upcoming.length === 0) return;

            const body = document.getElementById('reminder-popup-body');
            body.innerHTML = '';
            upcoming.forEach(r => {
                const dt = new Date(r.datetime);
                const div = Utils.el('div', { className: 'reminder-popup-item' },
                    Utils.el('div', { textContent: r.title, style: { fontWeight: '600' } }),
                    Utils.el('div', { className: 'reminder-popup-time', textContent: dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ' at ' + Utils.formatTime(dt.getHours().toString().padStart(2, '0') + ':' + dt.getMinutes().toString().padStart(2, '0')) })
                );
                body.appendChild(div);
            });

            document.getElementById('reminder-popup').classList.remove('hidden');
            document.getElementById('reminder-popup-close').addEventListener('click', () => {
                document.getElementById('reminder-popup').classList.add('hidden');
            });

            // Auto-hide after 8 seconds
            setTimeout(() => {
                document.getElementById('reminder-popup').classList.add('hidden');
            }, 8000);
        } catch (e) {
            console.warn('[Thrive] Reminder popup error:', e);
        }
    }

    function scheduleBeforeLeavingReminder() {
        const scheduleAt = (hour) => {
            const now = new Date();
            let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
            if (target <= now) target.setDate(target.getDate() + 1);
            setTimeout(() => {
                Utils.sendNotification('🚪 Before Leaving!', 'Check your checklist — phone, wallet, keys?', 'leaving-reminder');
                scheduleBeforeLeavingReminder();
            }, target - now);
        };
        scheduleAt(8);
        scheduleAt(13);
    }

    async function setupPushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
            
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Fetch public key from server
                const keyRes = await fetch('/api/vapid_public_key');
                if (!keyRes.ok) return;
                const keyData = await keyRes.json();
                if (!keyData.public_key) return;
                
                const responseStr = keyData.public_key;
                const padding = '='.repeat((4 - responseStr.length % 4) % 4);
                const base64 = (responseStr + padding).replace(/\-/g, '+').replace(/_/g, '/');
                const rawData = window.atob(base64);
                const outputArray = new Uint8Array(rawData.length);
                for (let i = 0; i < rawData.length; ++i) {
                    outputArray[i] = rawData.charCodeAt(i);
                }
                
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: outputArray
                });
            }
            
            // Send subscription to server
            await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'Akshat', subscription: subscription })
            });

        } catch (e) {
            console.error('[Thrive] Push registration failed', e);
        }
    }

    function navigateTo(pageName) {
        const btn = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (btn) btn.click();
    }

    return { init, navigateTo };
})();

document.addEventListener('DOMContentLoaded', () => ThriveApp.init());
