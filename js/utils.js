/* ============================================================
   THRIVE — Utilities v2 (utils.js)
   Expanded: theme toggle, calendar helpers, modal system v2
   ============================================================ */

const Utils = (() => {
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    }

    function todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    function monthStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    function formatDateLong(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const hr = parseInt(h);
        const ampm = hr >= 12 ? 'PM' : 'AM';
        return `${hr % 12 || 12}:${m} ${ampm}`;
    }

    function nowTime() {
        return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    function nowTime24() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function daysUntil(targetDateStr) {
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const target = new Date(targetDateStr + 'T00:00:00'); target.setHours(0, 0, 0, 0);
        return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    }

    function getGreeting() {
        const h = new Date().getHours();
        if (h < 5) return 'Night Owl Mode 🦉';
        if (h < 12) return 'Good Morning ☀️';
        if (h < 17) return 'Good Afternoon 🌤️';
        if (h < 21) return 'Good Evening 🌅';
        return 'Night Mode 🌙';
    }

    function weekStart() {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().split('T')[0];
    }

    function weekEnd() {
        const d = new Date(weekStart() + 'T00:00:00');
        d.setDate(d.getDate() + 6);
        return d.toISOString().split('T')[0];
    }

    function monthStart() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }

    function monthEnd() {
        const d = new Date();
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return last.toISOString().split('T')[0];
    }

    function yearStart() { return `${new Date().getFullYear()}-01-01`; }
    function yearEnd() { return `${new Date().getFullYear()}-12-31`; }

    function getWeekNumber(d) {
        const date = new Date(d + 'T00:00:00');
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    // ===== DOM =====
    function el(tag, attrs = {}, ...children) {
        const element = document.createElement(tag);
        Object.entries(attrs).forEach(([key, val]) => {
            if (key === 'className') element.className = val;
            else if (key === 'textContent') element.textContent = val;
            else if (key === 'innerHTML') element.innerHTML = val;
            else if (key.startsWith('on') && key.length > 2) element.addEventListener(key.slice(2).toLowerCase(), val);
            else if (key === 'style' && typeof val === 'object') Object.assign(element.style, val);
            else if (key === 'dataset' && typeof val === 'object') Object.assign(element.dataset, val);
            else element.setAttribute(key, val);
        });
        children.forEach(child => {
            if (typeof child === 'string') element.appendChild(document.createTextNode(child));
            else if (child instanceof Node) element.appendChild(child);
        });
        return element;
    }

    function toast(message, type = 'info', duration = 2500) {
        const container = document.getElementById('toast-container');
        const t = el('div', { className: `toast ${type}`, textContent: message });
        container.appendChild(t);
        setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, duration);
    }

    function showModal(title, bodyHTML, footerHTML = '') {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('modal-footer').innerHTML = footerHTML;
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }

    function animateValue(element, start, end, duration = 600) {
        const range = end - start;
        const startTime = performance.now();
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            element.textContent = Math.round(start + range * eased);
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    function animateRing(circleEl, percent, circumference) {
        const target = circumference - (percent / 100) * circumference;
        const current = parseFloat(circleEl.getAttribute('stroke-dashoffset')) || circumference;
        const diff = current - target;
        const startTime = performance.now();
        function frame(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / 800, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            circleEl.setAttribute('stroke-dashoffset', current - diff * eased);
            if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    const CATEGORY_EMOJIS = {
        food: '🍕', transport: '🚌', stationery: '📝', recharge: '📱',
        shopping: '🛍️', entertainment: '🎬', health: '💊', education: '📚',
        rent: '🏠', subscription: '💳', gift: '🎁', other: '📦'
    };

    const ACTIVITY_EMOJIS = {
        study: '📚', '3d_modeling': '🎨', coding: '💻', exercise: '🏋️',
        chore: '🧹', reading: '📖', meditation: '🧘', writing: '✍️',
        lecture: '🎓', problems: '🧮', revision: '📋', project: '🔧', other: '⚡'
    };

    const GOAL_TIER_LABELS = {
        daily: '📅 Daily', weekly: '📆 Weekly', monthly: '🗓️ Monthly', yearly: '🎯 Yearly'
    };

    const GOAL_TIER_COLORS = {
        daily: 'var(--primary)', weekly: 'var(--accent)', monthly: 'var(--success)', yearly: 'var(--warning)'
    };

    // ===== Theme =====
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('thrive-theme', theme);
    }

    function getTheme() {
        return localStorage.getItem('thrive-theme') || 'dark';
    }

    function toggleTheme() {
        const current = getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
        return next;
    }

    // ===== Notifications =====
    async function requestNotifPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            return (await Notification.requestPermission()) === 'granted';
        }
        return Notification.permission === 'granted';
    }

    function sendNotification(title, body, tag = 'thrive') {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag, vibrate: [200, 100, 200] });
        }
    }

    const PUBLIC_HOLIDAYS_2026 = [
        { date: '2026-01-01', name: "New Year's Day", type: 'Restricted Holiday' },
        { date: '2026-01-03', name: "Hazarat Ali's Birthday", type: 'Restricted Holiday' },
        { date: '2026-01-14', name: "Pongal / Makar Sankranti", type: 'Restricted Holiday' },
        { date: '2026-01-23', name: "Vasant Panchami", type: 'Restricted Holiday' },
        { date: '2026-01-26', name: "Republic Day", type: 'Gazetted Holiday' },
        { date: '2026-02-01', name: "Guru Ravidas Jayanti", type: 'Restricted Holiday' },
        { date: '2026-02-12', name: "Maharishi Dayanand Saraswati Jayanti", type: 'Restricted Holiday' },
        { date: '2026-02-14', name: "Valentine's Day", type: 'Observance' },
        { date: '2026-02-15', name: "Maha Shivaratri", type: 'Restricted Holiday' },
        { date: '2026-02-17', name: "Lunar New Year", type: 'Observance' },
        { date: '2026-02-19', name: "Ramadan Start / Shivaji Jayanti", type: 'Observance' },
        { date: '2026-03-03', name: "Holika Dahana", type: 'Restricted Holiday' },
        { date: '2026-03-04', name: "Holi", type: 'Gazetted Holiday' },
        { date: '2026-03-19', name: "Ugadi / Gudi Padwa", type: 'Restricted Holiday' },
        { date: '2026-03-20', name: "Jamat Ul-Vida / March Equinox", type: 'Restricted Holiday' },
        { date: '2026-03-21', name: "Ramzan Id", type: 'Gazetted Holiday' },
        { date: '2026-03-26', name: "Rama Navami", type: 'Gazetted Holiday' },
        { date: '2026-03-31', name: "Mahavir Jayanti", type: 'Gazetted Holiday' },
        { date: '2026-04-02', name: "First day of Passover / Maundy Thursday", type: 'Observance' },
        { date: '2026-04-03', name: "Good Friday", type: 'Gazetted Holiday' },
        { date: '2026-04-05', name: "Easter Day", type: 'Restricted Holiday' },
        { date: '2026-04-14', name: "Vaisakhi / Mesadi / Ambedkar Jayanti", type: 'Restricted Holiday' },
        { date: '2026-04-15', name: "Bahag Bihu", type: 'Restricted Holiday' },
        { date: '2026-05-01', name: "International Worker's Day / Buddha Purnima", type: 'Gazetted Holiday' },
        { date: '2026-05-09', name: "Birthday of Rabindranath", type: 'Restricted Holiday' },
        { date: '2026-05-10', name: "Mother's Day", type: 'Observance' },
        { date: '2026-05-27', name: "Bakrid (Tentative Date)", type: 'Gazetted Holiday' },
        { date: '2026-06-21', name: "Father's Day / June Solstice", type: 'Observance' },
        { date: '2026-06-26', name: "Muharram/Ashura (Tentative Date)", type: 'Gazetted Holiday' },
        { date: '2026-07-16', name: "Rath Yatra", type: 'Restricted Holiday' },
        { date: '2026-08-02', name: "Friendship Day", type: 'Observance' },
        { date: '2026-08-15', name: "Independence Day", type: 'Gazetted Holiday' },
        { date: '2026-08-26', name: "Milad un-Nabi / Onam", type: 'Gazetted Holiday' },
        { date: '2026-08-28', name: "Raksha Bandhan", type: 'Restricted Holiday' },
        { date: '2026-09-04', name: "Janmashtami", type: 'Gazetted Holiday' },
        { date: '2026-09-14', name: "Ganesh Chaturthi", type: 'Restricted Holiday' },
        { date: '2026-09-23', name: "September Equinox", type: 'Season' },
        { date: '2026-10-02', name: "Mahatma Gandhi Jayanti", type: 'Gazetted Holiday' },
        { date: '2026-10-11', name: "First Day of Sharad Navratri", type: 'Observance' },
        { date: '2026-10-17', name: "First Day of Durga Puja", type: 'Observance' },
        { date: '2026-10-18', name: "Maha Saptami", type: 'Restricted Holiday' },
        { date: '2026-10-19', name: "Maha Ashtami", type: 'Restricted Holiday' },
        { date: '2026-10-20', name: "Dussehra", type: 'Gazetted Holiday' },
        { date: '2026-10-26', name: "Maharishi Valmiki Jayanti", type: 'Restricted Holiday' },
        { date: '2026-10-29', name: "Karaka Chaturthi", type: 'Restricted Holiday' },
        { date: '2026-10-31', name: "Halloween", type: 'Observance' },
        { date: '2026-11-08', name: "Naraka Chaturdasi / Diwali", type: 'Gazetted Holiday' },
        { date: '2026-11-09', name: "Govardhan Puja", type: 'Restricted Holiday' },
        { date: '2026-11-11', name: "Bhai Duj", type: 'Restricted Holiday' },
        { date: '2026-11-15', name: "Chhat Puja", type: 'Restricted Holiday' },
        { date: '2026-11-24', name: "Guru Nanak Jayanti / Guru Tegh Bahadur's Martyrdom Day", type: 'Gazetted Holiday' },
        { date: '2026-12-05', name: "First Day of Hanukkah", type: 'Observance' },
        { date: '2026-12-12', name: "Last day of Hanukkah", type: 'Observance' },
        { date: '2026-12-22', name: "December Solstice", type: 'Season' },
        { date: '2026-12-23', name: "Hazarat Ali's Birthday", type: 'Restricted Holiday' },
        { date: '2026-12-24', name: "Christmas Eve", type: 'Restricted Holiday' },
        { date: '2026-12-25', name: "Christmas", type: 'Gazetted Holiday' },
        { date: '2026-12-31', name: "New Year's Eve", type: 'Observance' }
    ];

    function getHoliday(dateStr) {
        return PUBLIC_HOLIDAYS_2026.find(h => h.date === dateStr);
    }

    return {
        uid, todayStr, monthStr, formatDate, formatDateLong, formatTime, nowTime, nowTime24,
        daysUntil, getGreeting, weekStart, weekEnd, monthStart, monthEnd, yearStart, yearEnd,
        getWeekNumber, getDaysInMonth, getFirstDayOfMonth,
        el, toast, showModal, closeModal, animateValue, animateRing,
        CATEGORY_EMOJIS, ACTIVITY_EMOJIS, GOAL_TIER_LABELS, GOAL_TIER_COLORS,
        setTheme, getTheme, toggleTheme,
        requestNotifPermission, sendNotification, PUBLIC_HOLIDAYS_2026, getHoliday
    };
})();
