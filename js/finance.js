/* ============================================================
   THRIVE v2 — Finance Module
   Dynamic history, Date-picker calendar, Expense editing
   Week/Month/Year views, expense filtering
   ============================================================ */

const FinanceModule = (() => {
    let _debtView = 'lent';
    let _debtPeriod = 'month'; // month, week, year
    let _year, _month, _selectedDate;
    let _viewMode = 'month'; // month, week, year

    async function init() {
        const now = new Date();
        _year = now.getFullYear();
        _month = now.getMonth();
        _selectedDate = Utils.todayStr();

        await renderOverview();
        await renderSpendingChart(7);
        await renderDayContent();
        await renderDebtList();
        await renderDebtStats();
        wireEvents();
    }

    /* ===== SPENDING TREND CHART ===== */
    async function renderSpendingChart(range) {
        const container = document.getElementById('fin-spending-chart');
        if (!container) return;

        const days = [];
        const today = new Date();
        for (let i = range - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }

        const amounts = [];
        for (const dateStr of days) {
            const dayExp = await ThriveDB.getAll('expenses', 'by_date', dateStr);
            amounts.push(dayExp.reduce((s, e) => s + e.amount, 0));
        }

        const maxAmount = Math.max(...amounts, 1);

        container.innerHTML = days.map((dateStr, i) => {
            const pct = (amounts[i] / maxAmount) * 100;
            const d = new Date(dateStr);
            const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const isToday = dateStr === Utils.todayStr();
            return `
                <div class="fin-bar-col">
                    <div class="fin-bar-tooltip">₹${amounts[i].toLocaleString('en-IN')}</div>
                    <div class="fin-bar${isToday ? ' today' : ''}" style="height: ${Math.max(pct, 3)}%;"></div>
                    <span class="fin-bar-label">${label}</span>
                </div>`;
        }).join('');
    }

    /* ===== DEBT STATS (simplified) ===== */
    async function renderDebtStats() {
        const allDebts = await getAllDebts();
        let lentTotal = 0, borrowedTotal = 0, settledTotal = 0;
        allDebts.forEach(d => {
            if (d.settled) settledTotal += d.amount;
            else if (d.debtType === 'lent') lentTotal += d.amount;
            else borrowedTotal += d.amount;
        });
        const fmt = v => '₹' + v.toLocaleString('en-IN');
        const el = id => document.getElementById(id);
        if (el('debt-stat-lent')) el('debt-stat-lent').textContent = fmt(lentTotal);
        if (el('debt-stat-borrowed')) el('debt-stat-borrowed').textContent = fmt(borrowedTotal);
        if (el('debt-stat-settled')) el('debt-stat-settled').textContent = fmt(settledTotal);
    }

    async function getAllDebts() {
        try {
            const db = await ThriveDB.open();
            return new Promise(resolve => {
                const tx = db.transaction('debts', 'readonly');
                const req = tx.objectStore('debts').getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        } catch { return []; }
    }

    async function renderOverview() {
        const month = `${_year}-${String(_month + 1).padStart(2, '0')}`;
        const monthExp = await ThriveDB.getAll('expenses', 'by_month', month);
        const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0);

        const monthInc = await ThriveDB.getAll('income', 'by_month', month);
        const incomeTotal = monthInc.reduce((s, i) => s + i.amount, 0);

        const budgets = await ThriveDB.getAll('budgets', 'by_month', month);
        const budget = budgets.length > 0 ? budgets[0].amount : 0;
        const budgetLeft = budget > 0 ? budget - monthTotal : 0;

        // Weekly stats
        const weekStart = new Date(_year, _month, _selectedDate.split('-')[2]);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        let weekTotal = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayExp = await ThriveDB.getAll('expenses', 'by_date', dateStr);
            weekTotal += dayExp.reduce((s, e) => s + e.amount, 0);
        }

        document.getElementById('month-spend').textContent = '₹' + monthTotal.toLocaleString('en-IN');
        document.getElementById('month-income').textContent = '₹' + incomeTotal.toLocaleString('en-IN');
        document.getElementById('budget-left').textContent = budget > 0 ? '₹' + budgetLeft.toLocaleString('en-IN') : '₹—';
        document.getElementById('budget-left').className = 'finance-value ' + (budgetLeft < 0 ? 'expense' : 'income');
        
        // Add weekly stat display
        const weekDisplay = document.getElementById('week-spend');
        if (weekDisplay) weekDisplay.textContent = '₹' + weekTotal.toLocaleString('en-IN');
    }

    async function renderCalendar() {
        if (_viewMode === 'week') {
            await renderWeekView();
        } else if (_viewMode === 'year') {
            await renderYearView();
        } else {
            // Month view (default)
            await renderMonthView();
        }
    }

    async function renderMonthView() {
        const label = new Date(_year, _month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        document.getElementById('fin-cal-month-label').textContent = label;

        const container = document.getElementById('fin-cal-cells');
        container.innerHTML = '';

        const firstDay = Utils.getFirstDayOfMonth(_year, _month);
        const daysInMonth = Utils.getDaysInMonth(_year, _month);
        const daysInPrev = _month > 0 ? Utils.getDaysInMonth(_year, _month - 1) : Utils.getDaysInMonth(_year - 1, 11);
        const todayStr = Utils.todayStr();

        const monthStr = `${_year}-${String(_month + 1).padStart(2, '0')}`;
        const monthExpenses = await ThriveDB.getAll('expenses', 'by_month', monthStr);
        const dayTotals = {};
        monthExpenses.forEach(e => {
            dayTotals[e.date] = (dayTotals[e.date] || 0) + e.amount;
        });

        // Prev padding (Monday start)
        const mondayFirst = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = mondayFirst - 1; i >= 0; i--) {
            container.appendChild(Utils.el('div', { className: 'cal-cell other-month', textContent: daysInPrev - i }));
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${_year}-${String(_month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === _selectedDate;
            const total = dayTotals[dateStr] || 0;

            let cls = 'cal-cell';
            if (isToday) cls += ' today';
            if (isSelected) cls += ' selected';

            const cell = Utils.el('div', { className: cls, onClick: () => selectDate(dateStr) },
                Utils.el('span', { textContent: d }),
                total > 0 ? Utils.el('span', { className: 'cal-dot activity', style: { width: '4px', height: '4px' } }) : null
            );
            container.appendChild(cell);
        }
    }

    async function selectDate(dateStr) {
        _selectedDate = dateStr;
        renderCalendar();
        renderDayContent();
    }

    async function renderWeekView() {
        const weekStart = new Date(_year, _month, 1);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        
        const label = new Date(_year, _month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        document.getElementById('fin-cal-month-label').textContent = `${label} (Week View)`;

        const container = document.getElementById('fin-cal-cells');
        container.innerHTML = '';

        // Fetch all expenses for the month
        const monthStr = `${_year}-${String(_month + 1).padStart(2, '0')}`;
        const monthExpenses = await ThriveDB.getAll('expenses', 'by_month', monthStr);
        const dayTotals = {};
        monthExpenses.forEach(e => { dayTotals[e.date] = (dayTotals[e.date] || 0) + e.amount; });

        const todayStr = Utils.todayStr();
        let weekNum = 0;

        for (let w = 0; w <= 5; w++) {
            const currentWeekStart = new Date(weekStart);
            currentWeekStart.setDate(currentWeekStart.getDate() + w * 7);

            if (currentWeekStart.getMonth() !== _month) break;

            const weekBox = Utils.el('div', { className: 'week-box', style: { padding: '8px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px' } },
                Utils.el('div', { className: 'week-label', textContent: `Week ${++weekNum}`, style: { fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' } })
            );

            let weekTotal = 0;
            for (let d = 0; d < 7; d++) {
                const day = new Date(currentWeekStart);
                day.setDate(day.getDate() + d);
                const dateStr = day.toISOString().split('T')[0];
                const dayAmount = dayTotals[dateStr] || 0;
                weekTotal += dayAmount;

                const isSelected = dateStr === _selectedDate;
                const cell = Utils.el('span', { 
                    className: `cal-cell ${isSelected ? 'selected' : ''} ${dateStr === todayStr ? 'today' : ''}`,
                    textContent: day.getDate(),
                    onClick: () => selectDate(dateStr),
                    style: { 
                        display: 'inline-block', 
                        width: '28px', 
                        height: '28px', 
                        margin: '2px',
                        textAlign: 'center',
                        lineHeight: '28px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        background: dayAmount > 0 ? 'var(--border)' : 'transparent'
                    }
                });
                weekBox.appendChild(cell);
            }

            const weekTotalSpan = Utils.el('div', { 
                textContent: `Week Total: ₹${weekTotal.toLocaleString('en-IN')}`,
                style: { fontSize: '0.8rem', color: 'var(--success)', marginTop: '6px', fontWeight: '600' }
            });
            weekBox.appendChild(weekTotalSpan);
            container.appendChild(weekBox);
        }
    }

    async function renderYearView() {
        const label = `Year ${_year}`;
        document.getElementById('fin-cal-month-label').textContent = label;

        const container = document.getElementById('fin-cal-cells');
        container.innerHTML = '';

        let yearTotal = 0;
        for (let m = 0; m < 12; m++) {
            const monthStr = `${_year}-${String(m + 1).padStart(2, '0')}`;
            const monthExp = await ThriveDB.getAll('expenses', 'by_month', monthStr);
            const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0);
            yearTotal += monthTotal;

            const monthName = new Date(_year, m).toLocaleDateString('en-IN', { month: 'short' });
            const monthBox = Utils.el('div', { 
                className: 'month-box',
                style: {
                    padding: '10px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    transition: 'all var(--duration-fast)'
                },
                onClick: () => { _month = m; _viewMode = 'month'; renderCalendar(); renderDayContent(); renderOverview(); }
            },
                Utils.el('div', { textContent: monthName, style: { fontWeight: '600', marginBottom: '4px' } }),
                Utils.el('div', { textContent: '₹' + monthTotal.toLocaleString('en-IN'), style: { fontSize: '0.9rem', color: 'var(--success)' } })
            );
            container.appendChild(monthBox);
        }

        const yearTotalBox = Utils.el('div', {
            style: {
                padding: '12px',
                background: 'var(--primary-glow)',
                borderRadius: '8px',
                marginTop: '12px',
                textAlign: 'center',
                fontWeight: '700'
            }
        },
            Utils.el('div', { textContent: 'Total Year Spending', style: { fontSize: '0.85rem', color: 'var(--text-muted)' } }),
            Utils.el('div', { textContent: '₹' + yearTotal.toLocaleString('en-IN'), style: { fontSize: '1.2rem', color: 'var(--primary-light)' } })
        );
        container.appendChild(yearTotalBox);
    }

    async function renderDayContent() {
        const expenses = await ThriveDB.getAll('expenses', 'by_date', _selectedDate);
        const total = expenses.reduce((s, e) => s + e.amount, 0);

        // Update Labels
        const isToday = _selectedDate === Utils.todayStr();
        document.getElementById('expense-history-title').textContent = isToday ? "Today's Expenses" : `Expenses on ${Utils.formatDate(_selectedDate)}`;
        document.getElementById('day-spend').textContent = '₹' + total.toLocaleString('en-IN');

        // Render History
        const container = document.getElementById('expense-history');
        container.innerHTML = '';
        if (expenses.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">💸</div><p class="empty-state-text">No expenses recorded for this day.</p></div>';
        } else {
            expenses.sort((a, b) => b.timestamp - a.timestamp);
            expenses.forEach(exp => {
                const emoji = Utils.CATEGORY_EMOJIS[exp.category] || '📦';
                const item = Utils.el('div', { className: 'expense-item' },
                    Utils.el('span', { className: 'expense-icon', textContent: emoji }),
                    Utils.el('div', { className: 'expense-info' },
                        Utils.el('div', { className: 'expense-desc', textContent: exp.description }),
                        Utils.el('div', { className: 'expense-time', textContent: exp.timeStr })
                    ),
                    Utils.el('span', { className: 'expense-amount', textContent: '₹' + exp.amount.toLocaleString('en-IN') }),
                    Utils.el('button', { className: 'activity-delete', textContent: '✕', onClick: async () => {
                        await ThriveDB.remove('expenses', exp.id);
                        Utils.toast('Expense removed', 'warning'); renderDayContent(); renderOverview(); renderCalendar(); renderCategoryChart();
                    }})
                );
                // Simple edit click
                item.addEventListener('dblclick', () => showEditExpenseModal(exp));
                container.appendChild(item);
            });
        }

        renderCategoryChart();
    }

    async function renderCategoryChart() {
        const month = `${_year}-${String(_month + 1).padStart(2, '0')}`;
        const expenses = await ThriveDB.getAll('expenses', 'by_month', month);
        const catTotals = {};
        expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
        const container = document.getElementById('category-chart');
        container.innerHTML = '';
        const maxCat = Math.max(...Object.values(catTotals), 1);
        const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

        if (entries.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">No spending data yet for this month.</p>';
            return;
        }

        entries.forEach(([cat, total]) => {
            const emoji = Utils.CATEGORY_EMOJIS[cat] || '📦';
            const pct = (total / maxCat) * 100;
            const item = Utils.el('div', { className: 'cat-bar-item' },
                Utils.el('span', { className: 'cat-bar-emoji', textContent: emoji }),
                Utils.el('div', { className: 'cat-bar-info' },
                    Utils.el('div', { className: 'cat-bar-name', textContent: cat }),
                    Utils.el('div', { className: 'cat-bar-bg' }, Utils.el('div', { className: 'cat-bar-fill', style: { width: pct + '%' } }))
                ),
                Utils.el('span', { className: 'cat-bar-amount', textContent: '₹' + total.toLocaleString('en-IN') })
            );
            container.appendChild(item);
        });
    }

    // Debt statistics calculation
    async function getDebtStatsForPeriod() {
        const allDebts = await ThriveDB.getAll('debts');
        const now = new Date();
        let relevantDebts = [];

        if (_debtPeriod === 'month') {
            const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            relevantDebts = allDebts.filter(d => {
                const date = new Date(d.createdAt);
                const debtMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                return debtMonth === monthStr;
            });
        } else if (_debtPeriod === 'week') {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            relevantDebts = allDebts.filter(d => {
                const date = new Date(d.createdAt);
                return date >= weekStart && date < weekEnd;
            });
        } else if (_debtPeriod === 'year') {
            const yearStr = now.getFullYear().toString();
            relevantDebts = allDebts.filter(d => {
                const date = new Date(d.createdAt);
                return date.getFullYear().toString() === yearStr;
            });
        }

        const stats = {
            totalLent: 0,
            totalBorrowed: 0,
            totalSettled: 0,
            lentCount: 0,
            borrowedCount: 0,
            settledCount: 0
        };

        relevantDebts.forEach(debt => {
            if (debt.settled) {
                stats.totalSettled += debt.amount;
                stats.settledCount += 1;
            } else if (debt.debtType === 'lent') {
                stats.totalLent += debt.amount;
                stats.lentCount += 1;
            } else if (debt.debtType === 'borrowed') {
                stats.totalBorrowed += debt.amount;
                stats.borrowedCount += 1;
            }
        });

        return stats;
    }

    async function renderDebtStatsRing() {
        try {
            const stats = await getDebtStatsForPeriod();
            const total = stats.totalLent + stats.totalBorrowed + stats.totalSettled;

            // Update stat displays
            document.getElementById('debt-stat-lent').textContent = '₹' + stats.totalLent.toLocaleString('en-IN');
            document.getElementById('debt-stat-borrowed').textContent = '₹' + stats.totalBorrowed.toLocaleString('en-IN');
            document.getElementById('debt-stat-settled').textContent = '₹' + stats.totalSettled.toLocaleString('en-IN');

            // Update ring visualization
            const ring = document.getElementById('debt-ring-lent');
            if (ring && total > 0) {
                const ratio = stats.totalLent / total;
                const circumference = 2 * Math.PI * 70;
                const offset = circumference - (ratio * circumference);
                ring.setAttribute('stroke-dasharray', circumference.toString());
                ring.setAttribute('stroke-dashoffset', offset.toString());
            }
        } catch (e) {
            console.warn('[Finance] Debt stats error:', e);
        }
    }

    // Debt & Income (preserved)
    async function renderDebtList() {
        let debts;
        if (_debtView === 'settled') {
            debts = (await ThriveDB.getAll('debts')).filter(d => d.settled);
        } else {
            debts = (await ThriveDB.getAll('debts', 'by_type', _debtView)).filter(d => !d.settled);
        }
        const container = document.getElementById('debt-list');
        container.innerHTML = '';
        if (debts.length === 0) {
            const label = _debtView === 'settled' ? 'settled debts' : _debtView === 'lent' ? 'money lent' : 'debts owed';
            container.innerHTML = `<div class="empty-state"><div class="empty-state-emoji">${_debtView === 'settled' ? '✅' : '💰'}</div><p class="empty-state-text">No ${label}. Clean slate! ✨</p></div>`;
            return;
        }
        debts.forEach(debt => {
            const initials = debt.personName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const amtClass = debt.settled ? 'settled-amount' : _debtView === 'lent' ? 'lent' : 'borrowed';
            const createdDate = new Date(debt.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
            const createdTime = new Date(debt.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const dateDisplay = debt.settled ? 
                `📅 Given: ${createdDate} | ✅ Settled: ${new Date(debt.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${new Date(debt.settledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` :
                `📅 ${createdDate} at ${createdTime}`;
            
            const card = Utils.el('div', { className: `debt-card ${debt.settled ? 'past' : ''}` },
                Utils.el('div', { className: 'debt-avatar', textContent: initials }),
                Utils.el('div', { className: 'debt-info' },
                    Utils.el('div', { className: 'debt-name', textContent: debt.personName }),
                    Utils.el('div', { className: 'debt-reason', textContent: debt.reason || '—' }),
                    Utils.el('div', { className: 'debt-date', textContent: dateDisplay, style: { fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '4px' } })
                ),
                Utils.el('span', { className: `debt-amount ${amtClass}`, textContent: '₹' + debt.amount.toLocaleString('en-IN') }),
                !debt.settled ? Utils.el('button', { className: 'btn-settle', textContent: '✓ Settle', onClick: () => settleDebt(debt) }) : document.createTextNode('')
            );
            container.appendChild(card);
        });
    }

    async function settleDebt(debt) {
        debt.settled = true; debt.settledAt = new Date().toISOString();
        await ThriveDB.put('debts', debt);
        const overlay = Utils.el('div', { className: 'settled-overlay' }, Utils.el('div', { className: 'settled-text', textContent: '✓ SETTLED!' }));
        document.body.appendChild(overlay); setTimeout(() => overlay.remove(), 1600);
        Utils.toast(`Debt with ${debt.personName} settled! 🎉`, 'success');
        renderDebtList();
        renderDebtStatsRing();
    }

    function showEditExpenseModal(exp) {
        Utils.showModal('Edit Expense', `<form id="edit-expense-form" style="display:flex;flex-direction:column;gap:10px;">
            <input type="number" id="edit-amount" value="${exp.amount}" required min="1">
            <input type="text" id="edit-desc" value="${exp.description}" required maxlength="80">
            <select id="edit-cat">
                ${Object.entries(Utils.CATEGORY_EMOJIS).map(([k,v]) => `<option value="${k}" ${exp.category === k ? 'selected' : ''}>${v} ${k.toUpperCase()}</option>`).join('')}
            </select>
            <button type="submit" class="btn-primary">Save Changes</button>
        </form>`);
        document.getElementById('edit-expense-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updated = {...exp, amount: parseInt(document.getElementById('edit-amount').value), description: document.getElementById('edit-desc').value.trim(), category: document.getElementById('edit-cat').value };
            await ThriveDB.put('expenses', updated);
            Utils.closeModal(); Utils.toast('Expense updated!', 'info');
            renderDayContent(); renderOverview(); renderCalendar();
        });
    }

    function wireEvents() {
        document.getElementById('expense-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseInt(document.getElementById('expense-amount').value);
            const description = document.getElementById('expense-desc').value.trim();
            const category = document.getElementById('expense-category').value;
            const timestamp = Date.now();
            const isToday = _selectedDate === Utils.todayStr();
            
            // Record for selected date, but use current time if it's today
            await ThriveDB.put('expenses', { 
                id: Utils.uid(), 
                amount, 
                description, 
                category, 
                date: _selectedDate, 
                month: _selectedDate.substring(0, 7), 
                timeStr: isToday ? Utils.nowTime() : "Recorded Later", 
                timestamp: timestamp 
            });
            
            document.getElementById('expense-form').reset();
            Utils.toast('Expense logged! 💸', 'info'); 
            renderDayContent(); renderOverview(); renderCalendar();
        });

        document.getElementById('income-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseInt(document.getElementById('income-amount').value);
            const source = document.getElementById('income-source').value.trim();
            if (!amount || !source) return;
            const monthStr = _selectedDate.substring(0, 7);
            await ThriveDB.put('income', { id: Utils.uid(), amount, source, date: _selectedDate, month: monthStr, timestamp: Date.now() });
            document.getElementById('income-form').reset();
            Utils.toast('Income added! 💰', 'success'); renderOverview();
        });

        document.getElementById('budget-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseInt(document.getElementById('budget-amount').value);
            const monthStr = _selectedDate.substring(0, 7);
            await ThriveDB.put('budgets', { id: 'budget_' + monthStr, amount, month: monthStr });
            document.getElementById('budget-form').reset();
            Utils.toast('Budget set for month! 📊', 'success'); renderOverview();
        });

        // Removed dead calendar listeners

        document.getElementById('btn-add-debt').addEventListener('click', () => {
            const now = new Date();
            const todayDate = now.toISOString().split('T')[0];
            const todayTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            Utils.showModal('Add Debt', `<form id="debt-form" style="display:flex;flex-direction:column;gap:10px;">
                <select id="debt-type" style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: white;">
                    <option value="lent">💰 Money I Lent</option>
                    <option value="borrowed">🏦 Money I Borrowed</option>
                </select>
                <input type="text" id="debt-person" placeholder="Person's name" required style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: white;">
                <input type="number" id="debt-amount" placeholder="Amount (₹)" required style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: white;">
                <div style="display: flex; gap: 8px;">
                    <input type="date" id="debt-date" value="${todayDate}" required style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: white;">
                    <input type="time" id="debt-time" value="${todayTime}" required style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: white;">
                </div>
                <input type="text" id="debt-reason" placeholder="Reason (optional)" style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: white;">
                <button type="submit" class="btn-primary">Add</button></form>`);
            document.getElementById('debt-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const dateStr = document.getElementById('debt-date').value;
                const timeStr = document.getElementById('debt-time').value;
                const debtDateTime = new Date(`${dateStr}T${timeStr}`).getTime();
                
                await ThriveDB.put('debts', { 
                    id: Utils.uid(), 
                    debtType: document.getElementById('debt-type').value, 
                    personName: document.getElementById('debt-person').value.trim(), 
                    amount: parseInt(document.getElementById('debt-amount').value), 
                    reason: document.getElementById('debt-reason').value.trim(), 
                    settled: false, 
                    createdAt: debtDateTime, 
                    date: _selectedDate 
                });
                Utils.closeModal(); 
                renderDebtList();
                renderDebtStatsRing();
            });
        });

        document.querySelectorAll('.fin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.fin-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.fin-form').forEach(f => f.classList.remove('active'));
                tab.classList.add('active');
                document.querySelector(`.fin-form[data-fintab="${tab.dataset.fintab}"]`).classList.add('active');
            });
        });

        document.querySelectorAll('.debt-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.debt-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active'); _debtView = tab.dataset.debt; renderDebtList();
            });
        });

        // Spending chart tabs
        document.querySelectorAll('.fin-chart-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.fin-chart-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderSpendingChart(parseInt(tab.dataset.range));
            });
        });
    }

    return { init };
})();
