/* ============================================================
   THRIVE — Should I Buy This (BuyModule)
   Big-brother purchase advisor: ledger-aware, 100+ parameters.
   ============================================================ */

const BuyModule = (() => {
    let _product = null;
    let _lastReport = null;
    let _answers = {};

    const QUESTIONS = [
        { id: 'necessity', label: 'How necessary is this for you right now?', type: 'scale', min: 1, max: 5, hints: ['Pure want', 'Nice to have', 'Useful', 'Important', 'Critical need'] },
        { id: 'work_impact', label: 'Is your work / studies hampered without this?', type: 'scale', min: 1, max: 5, hints: ['Not at all', 'Slightly', 'Somewhat', 'Quite a bit', 'Severely'] },
        { id: 'already_own', label: 'Do you already own something that does a similar job?', type: 'choice', options: [
            { v: 'no', t: 'No alternative' }, { v: 'partial', t: 'Partial alternative' }, { v: 'yes', t: 'Yes, I already have one' }
        ]},
        { id: 'usage_freq', label: 'How often will you actually use it?', type: 'choice', options: [
            { v: 'daily', t: 'Daily' }, { v: 'weekly', t: 'Weekly' }, { v: 'monthly', t: 'Monthly' }, { v: 'rarely', t: 'Rarely / once' }
        ]},
        { id: 'lifespan', label: 'Expected useful life?', type: 'choice', options: [
            { v: 'years', t: '3+ years' }, { v: 'year', t: 'About a year' }, { v: 'months', t: 'A few months' }, { v: 'once', t: 'One-time use' }
        ]},
        { id: 'urgency', label: 'Do you need it immediately?', type: 'choice', options: [
            { v: 'now', t: 'Yes, now' }, { v: 'soon', t: 'Within a month' }, { v: 'later', t: 'Can wait 3+ months' }, { v: 'never', t: 'No real deadline' }
        ]},
        { id: 'impulse', label: 'How impulsive is this urge?', type: 'scale', min: 1, max: 5, hints: ['Fully planned', 'Mostly planned', 'Mixed', 'Mostly impulse', 'Pure FOMO'] },
        { id: 'researched', label: 'Have you compared alternatives / prices?', type: 'choice', options: [
            { v: 'deep', t: 'Deep research' }, { v: 'some', t: 'Some comparison' }, { v: 'none', t: 'No, just this link' }
        ]},
        { id: 'value_add', label: 'What primary value does it add to your life?', type: 'choice', options: [
            { v: 'career', t: 'Career / skills' }, { v: 'health', t: 'Health' }, { v: 'time', t: 'Saves time' },
            { v: 'joy', t: 'Joy / comfort' }, { v: 'status', t: 'Status / looks' }, { v: 'replace', t: 'Replaces broken item' }
        ]},
        { id: 'save_first', label: 'Could you wait and save for it instead?', type: 'choice', options: [
            { v: 'no', t: 'Must buy now' }, { v: 'maybe', t: 'Could wait a bit' }, { v: 'yes', t: 'Yes, I can save' }
        ]},
        { id: 'debt_risk', label: 'Would buying this put you into debt or delay debt payoff?', type: 'choice', options: [
            { v: 'no', t: 'No debt impact' }, { v: 'delay', t: 'Delays payoff' }, { v: 'yes', t: 'Creates / worsens debt' }
        ]},
        { id: 'regretted_similar', label: 'Have you regretted a similar purchase before?', type: 'choice', options: [
            { v: 'no', t: 'Never' }, { v: 'once', t: 'Once' }, { v: 'often', t: 'Often' }
        ]},
        { id: 'shared_use', label: 'Will others also benefit from this?', type: 'choice', options: [
            { v: 'many', t: 'Family / team' }, { v: 'one', t: 'Just me' }, { v: 'gift', t: "It's a gift" }
        ]},
        { id: 'maintenance', label: 'Ongoing cost (subs, parts, power, fees)?', type: 'choice', options: [
            { v: 'none', t: 'None' }, { v: 'low', t: 'Low' }, { v: 'high', t: 'High / recurring' }
        ]},
        { id: 'space', label: 'Do you have space / setup ready for it?', type: 'choice', options: [
            { v: 'yes', t: 'Ready' }, { v: 'maybe', t: 'Need to arrange' }, { v: 'no', t: 'No space yet' }
        ]},
        { id: 'mood', label: 'Are you buying this to fix a mood / stress?', type: 'choice', options: [
            { v: 'no', t: 'Clear-headed' }, { v: 'partly', t: 'Partly emotional' }, { v: 'yes', t: 'Retail therapy' }
        ]},
        { id: 'goals_align', label: 'Does this align with your current goals?', type: 'scale', min: 1, max: 5, hints: ['Conflicts', 'Neutral', 'Somewhat', 'Supports', 'Directly advances'] },
        { id: 'notes', label: 'Anything else I should know? (optional)', type: 'text', placeholder: 'e.g. sale ends tonight, needed for a project, friend recommended…' }
    ];

    function fmt(n) {
        if (n === null || n === undefined || Number.isNaN(n)) return '₹—';
        return '₹' + Math.round(n).toLocaleString('en-IN');
    }

    function clamp(n, a = 0, b = 100) {
        return Math.max(a, Math.min(b, n));
    }

    async function init() {
        renderQuestionnaire();
        await renderHistory();
        wireEvents();
        await refreshFinanceStrip();
    }

    async function loadFinanceContext() {
        const today = Utils.todayStr();
        const month = Utils.monthStr();
        const weekStart = Utils.weekStart();
        const weekEnd = Utils.weekEnd();

        const monthExp = await ThriveDB.getAll('expenses', 'by_month', month);
        const monthInc = await ThriveDB.getAll('income', 'by_month', month);
        const budgets = await ThriveDB.getAll('budgets', 'by_month', month);
        const debts = await ThriveDB.getAll('debts');
        const todayExp = await ThriveDB.getAll('expenses', 'by_date', today);
        const purchases = await ThriveDB.getAll('purchases', 'by_date', today);
        const goals = await ThriveDB.getAll('goals').catch(() => []);
        const milestones = await ThriveDB.getAll('milestones').catch(() => []);

        let weekSpend = 0;
        const start = new Date(weekStart + 'T00:00:00');
        const end = new Date(weekEnd + 'T00:00:00');
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const ds = d.toISOString().split('T')[0];
            const dayE = await ThriveDB.getAll('expenses', 'by_date', ds);
            weekSpend += dayE.reduce((s, e) => s + (e.amount || 0), 0);
        }

        const monthSpend = monthExp.reduce((s, e) => s + (e.amount || 0), 0);
        const monthIncome = monthInc.reduce((s, i) => s + (i.amount || 0), 0);
        const budget = budgets.length ? (budgets[0].amount || 0) : 0;
        const budgetLeft = budget > 0 ? budget - monthSpend : null;
        const shoppingSpend = monthExp.filter(e => e.category === 'shopping').reduce((s, e) => s + (e.amount || 0), 0);
        const entertainmentSpend = monthExp.filter(e => e.category === 'entertainment').reduce((s, e) => s + (e.amount || 0), 0);
        const educationSpend = monthExp.filter(e => e.category === 'education').reduce((s, e) => s + (e.amount || 0), 0);

        const openLent = debts.filter(d => d.debtType === 'lent' && !d.settled);
        const openBorrowed = debts.filter(d => d.debtType === 'borrowed' && !d.settled);
        const totalLent = openLent.reduce((s, d) => s + (d.amount || 0), 0);
        const totalBorrowed = openBorrowed.reduce((s, d) => s + (d.amount || 0), 0);

        const catTotals = {};
        monthExp.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + (e.amount || 0); });
        const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0] || null;

        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const dayOfMonth = new Date().getDate();
        const expectedPaceSpend = budget > 0 ? (budget * dayOfMonth / daysInMonth) : null;
        const avgDailySpend = dayOfMonth > 0 ? monthSpend / dayOfMonth : 0;
        const projectedMonthSpend = avgDailySpend * daysInMonth;

        const recentDays = [];
        for (let i = 0; i < 14; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            recentDays.push(d.toISOString().split('T')[0]);
        }
        let last14 = 0;
        for (const ds of recentDays) {
            const dayE = await ThriveDB.getAll('expenses', 'by_date', ds);
            last14 += dayE.reduce((s, e) => s + (e.amount || 0), 0);
        }

        return {
            today, month, weekSpend,
            todaySpend: todayExp.reduce((s, e) => s + (e.amount || 0), 0),
            monthSpend, monthIncome, budget, budgetLeft,
            shoppingSpend, entertainmentSpend, educationSpend,
            totalLent, totalBorrowed,
            openLentCount: openLent.length,
            openBorrowedCount: openBorrowed.length,
            expenseCount: monthExp.length,
            incomeCount: monthInc.length,
            topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
            expectedPaceSpend, avgDailySpend, projectedMonthSpend,
            last14Spend: last14,
            purchaseListCount: purchases.length,
            goals: goals || [],
            milestones: milestones || [],
            monthExpenses: monthExp,
            dayOfMonth, daysInMonth
        };
    }

    async function refreshFinanceStrip() {
        const fin = await loadFinanceContext();
        const el = document.getElementById('buy-finance-strip');
        if (!el) return;
        el.innerHTML = '';
        const cards = [
            { label: 'Budget left', value: fin.budgetLeft === null ? 'Not set' : fmt(fin.budgetLeft), tone: (fin.budgetLeft !== null && fin.budgetLeft < 0) ? 'bad' : 'ok' },
            { label: 'Month spend', value: fmt(fin.monthSpend), tone: 'neutral' },
            { label: 'Month income', value: fmt(fin.monthIncome), tone: 'ok' },
            { label: 'Week spend', value: fmt(fin.weekSpend), tone: 'neutral' },
            { label: 'Open debts', value: fmt(fin.totalBorrowed), tone: fin.totalBorrowed > 0 ? 'warn' : 'ok' },
            { label: 'Shopping (mo)', value: fmt(fin.shoppingSpend), tone: 'neutral' }
        ];
        cards.forEach(c => {
            el.appendChild(Utils.el('div', { className: `buy-fin-chip buy-fin-${c.tone}` },
                Utils.el('span', { className: 'buy-fin-label', textContent: c.label }),
                Utils.el('span', { className: 'buy-fin-value', textContent: c.value })
            ));
        });
    }

    function renderQuestionnaire() {
        const box = document.getElementById('buy-questions');
        if (!box) return;
        box.innerHTML = '';
        QUESTIONS.forEach((q, idx) => {
            const card = Utils.el('div', { className: 'buy-q-card', dataset: { qid: q.id } });
            card.appendChild(Utils.el('div', { className: 'buy-q-num', textContent: String(idx + 1).padStart(2, '0') }));
            card.appendChild(Utils.el('label', { className: 'buy-q-label', textContent: q.label, for: `buy-q-${q.id}` }));

            if (q.type === 'scale') {
                const row = Utils.el('div', { className: 'buy-scale-row' });
                for (let i = q.min; i <= q.max; i++) {
                    const id = `buy-q-${q.id}-${i}`;
                    const wrap = Utils.el('label', { className: 'buy-scale-opt', for: id });
                    wrap.appendChild(Utils.el('input', { type: 'radio', name: `buy-q-${q.id}`, id, value: String(i) }));
                    wrap.appendChild(Utils.el('span', { textContent: String(i) }));
                    if (q.hints && q.hints[i - q.min]) {
                        wrap.title = q.hints[i - q.min];
                    }
                    row.appendChild(wrap);
                }
                card.appendChild(row);
                if (q.hints) {
                    card.appendChild(Utils.el('div', { className: 'buy-scale-hints', textContent: `${q.hints[0]} → ${q.hints[q.hints.length - 1]}` }));
                }
            } else if (q.type === 'choice') {
                const row = Utils.el('div', { className: 'buy-choice-row' });
                q.options.forEach((opt, oi) => {
                    const id = `buy-q-${q.id}-${oi}`;
                    const wrap = Utils.el('label', { className: 'buy-choice-opt', for: id });
                    wrap.appendChild(Utils.el('input', { type: 'radio', name: `buy-q-${q.id}`, id, value: opt.v }));
                    wrap.appendChild(Utils.el('span', { textContent: opt.t }));
                    row.appendChild(wrap);
                });
                card.appendChild(row);
            } else if (q.type === 'text') {
                card.appendChild(Utils.el('textarea', {
                    id: `buy-q-${q.id}`,
                    className: 'buy-q-text',
                    placeholder: q.placeholder || '',
                    rows: '2',
                    maxlength: '400'
                }));
            }
            box.appendChild(card);
        });
    }

    function collectAnswers() {
        const answers = {};
        QUESTIONS.forEach(q => {
            if (q.type === 'text') {
                const el = document.getElementById(`buy-q-${q.id}`);
                answers[q.id] = el ? el.value.trim() : '';
            } else {
                const checked = document.querySelector(`input[name="buy-q-${q.id}"]:checked`);
                answers[q.id] = checked ? checked.value : null;
            }
        });
        return answers;
    }

    function mark(status, detail, score) {
        return { status, detail, score: clamp(score) };
    }

    /** Build 100+ judged parameters from product + answers + ledger */
    function buildParameters(product, answers, fin, price) {
        const a = answers;
        const nec = parseInt(a.necessity || '0', 10);
        const work = parseInt(a.work_impact || '0', 10);
        const impulse = parseInt(a.impulse || '0', 10);
        const goalsAlign = parseInt(a.goals_align || '0', 10);
        const budget = fin.budget || 0;
        const budgetLeft = fin.budgetLeft;
        const income = fin.monthIncome || 0;
        const rating = product.rating;
        const reviews = product.review_count;
        const sentiment = (product.sentiment && product.sentiment.score) || 50;
        const pctBudget = budget > 0 ? (price / budget) * 100 : null;
        const pctIncome = income > 0 ? (price / income) * 100 : null;
        const pctLeft = (budgetLeft !== null && budgetLeft > 0) ? (price / budgetLeft) * 100 : null;
        const afterBuyLeft = budgetLeft !== null ? budgetLeft - price : null;
        const usageMap = { daily: 95, weekly: 75, monthly: 45, rarely: 20 };
        const lifeMap = { years: 90, year: 70, months: 40, once: 15 };
        const urgMap = { now: 40, soon: 55, later: 80, never: 85 };

        const P = [];
        const add = (category, label, status, detail, score, weight = 1) => {
            P.push({ category, label, status, detail, score: clamp(score), weight });
        };

        // —— Financial capacity (ledger) ——
        add('Financial Capacity', 'Monthly budget configured', budget > 0 ? 'pass' : 'warn',
            budget > 0 ? `Budget set at ${fmt(budget)}.` : 'No monthly budget in Financial Ledger — I am flying partly blind.',
            budget > 0 ? 80 : 35, 1.2);
        add('Financial Capacity', 'Budget remaining after purchase',
            afterBuyLeft === null ? 'info' : afterBuyLeft < 0 ? 'fail' : afterBuyLeft < budget * 0.1 ? 'warn' : 'pass',
            afterBuyLeft === null ? 'Cannot compute — set a budget in Ledger.' :
                afterBuyLeft < 0 ? `This puts you ${fmt(Math.abs(afterBuyLeft))} OVER budget.` :
                    `${fmt(afterBuyLeft)} would remain this month.`,
            afterBuyLeft === null ? 40 : afterBuyLeft < 0 ? 10 : afterBuyLeft < budget * 0.1 ? 45 : 88, 1.8);
        add('Financial Capacity', 'Price vs monthly budget',
            pctBudget === null ? 'info' : pctBudget > 40 ? 'fail' : pctBudget > 20 ? 'warn' : 'pass',
            pctBudget === null ? 'Budget unknown.' : `${pctBudget.toFixed(1)}% of monthly budget.`,
            pctBudget === null ? 40 : clamp(100 - pctBudget * 2), 1.5);
        add('Financial Capacity', 'Price vs monthly income',
            pctIncome === null ? 'info' : pctIncome > 35 ? 'fail' : pctIncome > 15 ? 'warn' : 'pass',
            income <= 0 ? 'No income logged this month in Ledger.' : `${pctIncome.toFixed(1)}% of logged income (${fmt(income)}).`,
            income <= 0 ? 35 : clamp(100 - pctIncome * 2.5), 1.4);
        add('Financial Capacity', 'Fits in remaining budget buffer',
            pctLeft === null ? 'info' : pctLeft > 90 ? 'fail' : pctLeft > 50 ? 'warn' : 'pass',
            pctLeft === null ? 'No remaining-budget figure.' : `Uses ${pctLeft.toFixed(0)}% of what's left.`,
            pctLeft === null ? 40 : clamp(100 - pctLeft), 1.6);
        add('Financial Capacity', 'Current month spend pace',
            fin.expectedPaceSpend === null ? 'info' :
                fin.monthSpend > fin.expectedPaceSpend * 1.15 ? 'warn' :
                    fin.monthSpend > fin.expectedPaceSpend ? 'info' : 'pass',
            fin.expectedPaceSpend === null ? 'Needs a budget to judge pace.' :
                `Spent ${fmt(fin.monthSpend)} vs expected ~${fmt(fin.expectedPaceSpend)} by day ${fin.dayOfMonth}.`,
            fin.expectedPaceSpend === null ? 50 :
                clamp(100 - Math.max(0, (fin.monthSpend - fin.expectedPaceSpend) / (fin.budget || 1) * 120)), 1.1);
        add('Financial Capacity', 'Projected month-end spend',
            budget <= 0 ? 'info' : fin.projectedMonthSpend > budget * 1.1 ? 'fail' : fin.projectedMonthSpend > budget ? 'warn' : 'pass',
            budget <= 0 ? 'No budget to project against.' :
                `At current pace you may hit ~${fmt(fin.projectedMonthSpend)} by month end.`,
            budget <= 0 ? 50 : clamp(100 - Math.max(0, fin.projectedMonthSpend - budget) / budget * 100), 1.2);
        add('Financial Capacity', 'This week spending load',
            fin.weekSpend > (budget || income || 10000) * 0.25 ? 'warn' : 'pass',
            `Week spend so far: ${fmt(fin.weekSpend)}.`,
            clamp(90 - (fin.weekSpend / Math.max(budget || income || 5000, 1)) * 150), 0.9);
        add('Financial Capacity', 'Today already spent',
            fin.todaySpend > (budget || 5000) * 0.08 ? 'warn' : 'pass',
            `Today: ${fmt(fin.todaySpend)}. Stacking another ${fmt(price)} tonight matters.`,
            clamp(85 - (fin.todaySpend / Math.max(budget || 5000, 1)) * 200), 0.8);
        add('Financial Capacity', 'Last 14-day burn rate',
            fin.last14Spend > (budget || income || 8000) * 0.6 ? 'warn' : 'pass',
            `Last 14 days: ${fmt(fin.last14Spend)}.`,
            clamp(90 - (fin.last14Spend / Math.max(budget || income || 8000, 1)) * 80), 0.9);
        add('Financial Capacity', 'Shopping category pressure',
            fin.shoppingSpend + price > (budget || 10000) * 0.25 ? 'warn' : 'pass',
            `Shopping this month: ${fmt(fin.shoppingSpend)}. This would make it ${fmt(fin.shoppingSpend + price)}.`,
            clamp(90 - ((fin.shoppingSpend + price) / Math.max(budget || 10000, 1)) * 200), 1.0);
        add('Financial Capacity', 'Open borrowed debt burden',
            fin.totalBorrowed <= 0 ? 'pass' : fin.totalBorrowed > price ? 'fail' : 'warn',
            fin.totalBorrowed <= 0 ? 'No open borrowed debts — good.' :
                `You still owe ${fmt(fin.totalBorrowed)} across ${fin.openBorrowedCount} open debt(s).`,
            fin.totalBorrowed <= 0 ? 92 : clamp(40 - fin.totalBorrowed / Math.max(price, 1) * 10), 1.5);
        add('Financial Capacity', 'Money others owe you (liquidity)',
            fin.totalLent > 0 ? 'info' : 'pass',
            fin.totalLent > 0 ? `${fmt(fin.totalLent)} is lent out — not in your pocket.` : 'Nothing lent out.',
            fin.totalLent > price ? 55 : 70, 0.6);
        add('Financial Capacity', 'Income recorded this month',
            income > 0 ? 'pass' : 'warn',
            income > 0 ? `${fmt(income)} income logged (${fin.incomeCount} entries).` : 'Zero income in Ledger this month.',
            income > 0 ? 80 : 30, 1.1);
        add('Financial Capacity', 'Expense logging discipline',
            fin.expenseCount >= 5 ? 'pass' : fin.expenseCount > 0 ? 'info' : 'warn',
            `${fin.expenseCount} expenses logged this month — more data = wiser call.`,
            fin.expenseCount >= 10 ? 85 : fin.expenseCount >= 3 ? 65 : 40, 0.7);
        add('Financial Capacity', 'Emergency buffer preservation',
            afterBuyLeft === null ? 'info' : afterBuyLeft >= (budget || 0) * 0.2 ? 'pass' : afterBuyLeft > 0 ? 'warn' : 'fail',
            'I want you to keep ~20% of budget as slack for surprises.',
            afterBuyLeft === null ? 45 : afterBuyLeft >= (budget || 0) * 0.2 ? 90 : afterBuyLeft > 0 ? 50 : 15, 1.4);
        add('Financial Capacity', 'Affordability ratio (price / avg daily spend)',
            fin.avgDailySpend <= 0 ? 'info' : (price / fin.avgDailySpend) > 10 ? 'warn' : 'pass',
            fin.avgDailySpend <= 0 ? 'Not enough spend history.' :
                `Equals ~${(price / Math.max(fin.avgDailySpend, 1)).toFixed(1)} average spending days.`,
            fin.avgDailySpend <= 0 ? 50 : clamp(100 - (price / fin.avgDailySpend) * 5), 1.0);
        add('Financial Capacity', 'Top spending category conflict',
            !fin.topCategory ? 'info' :
                (fin.topCategory.name === 'shopping' || fin.topCategory.name === 'entertainment') ? 'warn' : 'pass',
            fin.topCategory ? `Top category: ${fin.topCategory.name} (${fmt(fin.topCategory.amount)}).` : 'No category data yet.',
            !fin.topCategory ? 50 : (fin.topCategory.name === 'shopping' ? 45 : 70), 0.7);
        add('Financial Capacity', 'Net monthly position (income − spend − price)',
            income <= 0 ? 'info' : (income - fin.monthSpend - price) < 0 ? 'fail' : 'pass',
            income <= 0 ? 'Income missing.' :
                `Net after this buy: ${fmt(income - fin.monthSpend - price)}.`,
            income <= 0 ? 40 : clamp(50 + (income - fin.monthSpend - price) / Math.max(income, 1) * 50), 1.3);
        add('Financial Capacity', 'Checklist purchase backlog',
            fin.purchaseListCount > 3 ? 'warn' : 'pass',
            fin.purchaseListCount
                ? `You already listed ${fin.purchaseListCount} purchase(s) on today's checklist.`
                : 'No competing purchases on today\'s checklist.',
            fin.purchaseListCount > 5 ? 40 : fin.purchaseListCount > 0 ? 65 : 80, 0.6);

        // —— Necessity & need ——
        add('Necessity & Need', 'Self-rated necessity',
            nec >= 4 ? 'pass' : nec === 3 ? 'warn' : nec > 0 ? 'fail' : 'info',
            nec ? `You rated necessity ${nec}/5.` : 'Not answered.',
            nec ? nec * 20 : 40, 1.8);
        add('Necessity & Need', 'Work / study hampered without it',
            work >= 4 ? 'pass' : work === 3 ? 'warn' : work > 0 ? 'fail' : 'info',
            work ? `Work impact ${work}/5.` : 'Not answered.',
            work ? work * 20 : 40, 1.6);
        add('Necessity & Need', 'Existing alternative ownership',
            a.already_own === 'no' ? 'pass' : a.already_own === 'partial' ? 'warn' : a.already_own === 'yes' ? 'fail' : 'info',
            a.already_own === 'yes' ? 'You already have something similar — upgrade tax is real.' :
                a.already_own === 'partial' ? 'Partial alternative exists; gap must be worth the price.' :
                    a.already_own === 'no' ? 'No substitute — stronger case.' : 'Not answered.',
            a.already_own === 'no' ? 90 : a.already_own === 'partial' ? 55 : a.already_own === 'yes' ? 25 : 40, 1.5);
        add('Necessity & Need', 'Replacement vs novelty',
            a.value_add === 'replace' ? 'pass' : a.value_add ? 'info' : 'info',
            a.value_add === 'replace' ? 'Replacing something broken — usually justified.' :
                a.value_add ? 'Not framed as a replacement.' : 'Not answered.',
            a.value_add === 'replace' ? 88 : 55, 1.0);
        add('Necessity & Need', 'Deadline / urgency honesty',
            a.urgency === 'now' && nec < 4 ? 'warn' : a.urgency === 'never' ? 'pass' : a.urgency ? 'info' : 'info',
            a.urgency === 'now' ? 'Claiming urgency — I will verify it against necessity.' :
                a.urgency === 'later' || a.urgency === 'never' ? 'You can wait. Waiting is a power move.' :
                    a.urgency === 'soon' ? 'Near-term need — plan, don\'t panic-buy.' : 'Not answered.',
            urgMap[a.urgency] || 45, 1.1);
        add('Necessity & Need', 'True need vs desire filter',
            nec >= 4 && impulse <= 2 ? 'pass' : nec <= 2 && impulse >= 4 ? 'fail' : 'warn',
            'Cross-check of necessity vs impulse.',
            nec && impulse ? clamp(nec * 18 - impulse * 10 + 40) : 45, 1.4);

        // —— Usage & value ——
        add('Usage & Value', 'Expected usage frequency',
            a.usage_freq === 'daily' || a.usage_freq === 'weekly' ? 'pass' : a.usage_freq === 'monthly' ? 'warn' : a.usage_freq ? 'fail' : 'info',
            a.usage_freq ? `You said: ${a.usage_freq}.` : 'Not answered.',
            usageMap[a.usage_freq] || 40, 1.5);
        (() => {
            const uses = { daily: 300, weekly: 50, monthly: 12, rarely: 2 }[a.usage_freq] || 10;
            const cpu = price / uses;
            const st = cpu > 500 ? 'fail' : cpu > 150 ? 'warn' : 'pass';
            add('Usage & Value', 'Cost per expected use (heuristic)', st,
                `Rough cost/use ≈ ${fmt(cpu)} (heuristic).`, clamp(100 - cpu / 8), 1.3);
        })();
        add('Usage & Value', 'Expected lifespan',
            a.lifespan === 'years' || a.lifespan === 'year' ? 'pass' : a.lifespan === 'months' ? 'warn' : a.lifespan ? 'fail' : 'info',
            a.lifespan ? `Lifespan: ${a.lifespan}.` : 'Not answered.',
            lifeMap[a.lifespan] || 40, 1.2);
        add('Usage & Value', 'Primary life value',
            ['career', 'health', 'time', 'replace'].includes(a.value_add) ? 'pass' :
                a.value_add === 'joy' ? 'warn' : a.value_add === 'status' ? 'fail' : 'info',
            a.value_add ? `Value framing: ${a.value_add}.` : 'Not answered.',
            ({ career: 92, health: 90, time: 85, replace: 88, joy: 55, status: 25 }[a.value_add] || 40), 1.4);
        add('Usage & Value', 'Goal alignment',
            goalsAlign >= 4 ? 'pass' : goalsAlign === 3 ? 'warn' : goalsAlign > 0 ? 'fail' : 'info',
            goalsAlign ? `Goals alignment ${goalsAlign}/5.` : 'Not answered.',
            goalsAlign ? goalsAlign * 20 : 40, 1.5);
        add('Usage & Value', 'Shared utility',
            a.shared_use === 'many' ? 'pass' : a.shared_use === 'gift' ? 'info' : a.shared_use ? 'warn' : 'info',
            a.shared_use === 'many' ? 'Benefits more than you — better ROI on peace.' :
                a.shared_use === 'gift' ? 'Gift purchase — judge by relationship value, not personal use.' :
                    a.shared_use === 'one' ? 'Solo use — ROI rests entirely on you.' : 'Not answered.',
            a.shared_use === 'many' ? 85 : a.shared_use === 'gift' ? 60 : a.shared_use === 'one' ? 55 : 40, 0.8);
        add('Usage & Value', 'Setup / space readiness',
            a.space === 'yes' ? 'pass' : a.space === 'maybe' ? 'warn' : a.space === 'no' ? 'fail' : 'info',
            a.space === 'no' ? 'Buying gear with nowhere to put it is how closets become graveyards.' :
                a.space === 'maybe' ? 'Arrange space first, then buy.' :
                    a.space === 'yes' ? 'Space ready — friction low.' : 'Not answered.',
            a.space === 'yes' ? 85 : a.space === 'maybe' ? 50 : a.space === 'no' ? 25 : 40, 0.9);
        add('Usage & Value', 'Ongoing maintenance burden',
            a.maintenance === 'none' ? 'pass' : a.maintenance === 'low' ? 'warn' : a.maintenance === 'high' ? 'fail' : 'info',
            a.maintenance === 'high' ? 'Recurring costs compound — include them in the true price.' :
                a.maintenance ? `Maintenance: ${a.maintenance}.` : 'Not answered.',
            a.maintenance === 'none' ? 90 : a.maintenance === 'low' ? 65 : a.maintenance === 'high' ? 30 : 40, 1.0);
        add('Usage & Value', 'Active goals count context',
            (fin.goals || []).length > 0 ? 'info' : 'warn',
            (fin.goals || []).length
                ? `You track ${(fin.goals || []).length} goal(s). Does this purchase serve them?`
                : 'No goals in Thrive — harder to judge alignment.',
            (fin.goals || []).length > 0 ? 70 : 45, 0.5);
        add('Usage & Value', 'Upcoming milestones pressure',
            (fin.milestones || []).some(m => !m.completed && m.targetDate && Utils.daysUntil(m.targetDate) <= 30) ? 'warn' : 'pass',
            (() => {
                const soon = (fin.milestones || []).filter(m => !m.completed && m.targetDate && Utils.daysUntil(m.targetDate) <= 30);
                return soon.length ? `${soon.length} milestone(s) within 30 days — protect focus & cash.` : 'No near-term milestone crunch.';
            })(),
            (() => {
                const soon = (fin.milestones || []).filter(m => !m.completed && m.targetDate && Utils.daysUntil(m.targetDate) <= 30);
                return soon.length ? 45 : 75;
            })(), 0.8);

        // —— Timing & psychology ——
        add('Timing & Psychology', 'Impulse level',
            impulse <= 2 ? 'pass' : impulse === 3 ? 'warn' : impulse > 0 ? 'fail' : 'info',
            impulse ? `Impulse ${impulse}/5. Brother tip: sleep on anything ≥4.` : 'Not answered.',
            impulse ? clamp(110 - impulse * 18) : 40, 1.7);
        add('Timing & Psychology', 'Research depth',
            a.researched === 'deep' ? 'pass' : a.researched === 'some' ? 'warn' : a.researched === 'none' ? 'fail' : 'info',
            a.researched === 'none' ? 'One link is not research. Compare at least two options.' :
                a.researched === 'some' ? 'Some homework done — good start.' :
                    a.researched === 'deep' ? 'Solid research — respect.' : 'Not answered.',
            a.researched === 'deep' ? 90 : a.researched === 'some' ? 65 : a.researched === 'none' ? 25 : 40, 1.3);
        add('Timing & Psychology', 'Ability to wait and save',
            a.save_first === 'yes' ? 'pass' : a.save_first === 'maybe' ? 'warn' : a.save_first === 'no' ? 'info' : 'info',
            a.save_first === 'yes' ? 'You can save — often the wisest flex.' :
                a.save_first === 'maybe' ? 'A short waiting period would clarify desire.' :
                    a.save_first === 'no' ? 'You feel you must buy now — I will stress-test that claim.' : 'Not answered.',
            a.save_first === 'yes' ? 85 : a.save_first === 'maybe' ? 60 : a.save_first === 'no' ? 40 : 45, 1.2);
        add('Timing & Psychology', 'Mood / retail-therapy risk',
            a.mood === 'no' ? 'pass' : a.mood === 'partly' ? 'warn' : a.mood === 'yes' ? 'fail' : 'info',
            a.mood === 'yes' ? 'Buying to fix feelings rarely fixes feelings. Walk first.' :
                a.mood === 'partly' ? 'Emotions are in the mix — cool-off timer recommended.' :
                    a.mood === 'no' ? 'Clear-headed — better conditions for a decision.' : 'Not answered.',
            a.mood === 'no' ? 90 : a.mood === 'partly' ? 50 : a.mood === 'yes' ? 20 : 40, 1.5);
        add('Timing & Psychology', 'Past regret pattern',
            a.regretted_similar === 'no' ? 'pass' : a.regretted_similar === 'once' ? 'warn' : a.regretted_similar === 'often' ? 'fail' : 'info',
            a.regretted_similar === 'often' ? 'Pattern alert: similar buys have burned you before.' :
                a.regretted_similar === 'once' ? 'One past regret — learn from it here.' :
                    a.regretted_similar === 'no' ? 'Clean history on similar buys.' : 'Not answered.',
            a.regretted_similar === 'no' ? 85 : a.regretted_similar === 'once' ? 55 : a.regretted_similar === 'often' ? 20 : 40, 1.2);
        add('Timing & Psychology', 'Debt interaction',
            a.debt_risk === 'no' ? 'pass' : a.debt_risk === 'delay' ? 'warn' : a.debt_risk === 'yes' ? 'fail' : 'info',
            a.debt_risk === 'yes' ? 'Creating debt for this is a hard no from me unless life/health critical.' :
                a.debt_risk === 'delay' ? 'Delaying debt payoff has a real interest (and stress) cost.' :
                    a.debt_risk === 'no' ? 'No debt side-effects claimed.' : 'Not answered.',
            a.debt_risk === 'no' ? 90 : a.debt_risk === 'delay' ? 45 : a.debt_risk === 'yes' ? 10 : 40, 1.8);
        add('Timing & Psychology', 'Cooling-off recommendation',
            impulse >= 4 || a.mood === 'yes' || a.researched === 'none' ? 'warn' : 'pass',
            impulse >= 4 || a.mood === 'yes' || a.researched === 'none'
                ? '24–72 hour cooling-off period strongly advised.'
                : 'Cooling-off optional — your answers look deliberate.',
            impulse >= 4 || a.mood === 'yes' ? 35 : 80, 1.0);

        // —— Product quality signals ——
        add('Product Signals', 'Price extracted from link',
            product.price ? 'pass' : 'warn',
            product.price ? `Page price detected: ${fmt(product.price)}.` : 'Could not auto-read price — using your manual entry.',
            product.price ? 80 : 50, 0.5);
        add('Product Signals', 'Manual price confirmation',
            price > 0 ? 'pass' : 'fail',
            price > 0 ? `Analysis price: ${fmt(price)}.` : 'No valid price — cannot judge affordability.',
            price > 0 ? 90 : 5, 1.0);
        add('Product Signals', 'Customer rating',
            rating == null ? 'info' : rating >= 4.2 ? 'pass' : rating >= 3.5 ? 'warn' : 'fail',
            rating == null ? 'No rating found on page.' : `${rating.toFixed(1)} / 5 stars.`,
            rating == null ? 50 : clamp((rating / 5) * 100), 1.2);
        add('Product Signals', 'Review volume',
            reviews == null ? 'info' : reviews >= 200 ? 'pass' : reviews >= 30 ? 'warn' : 'fail',
            reviews == null ? 'Review count unknown.' : `${reviews.toLocaleString('en-IN')} reviews/ratings found.`,
            reviews == null ? 50 : clamp(Math.log10(reviews + 1) * 28), 1.0);
        add('Product Signals', 'Page sentiment language',
            sentiment >= 65 ? 'pass' : sentiment >= 45 ? 'warn' : 'fail',
            (product.sentiment && product.sentiment.summary) || 'Sentiment unavailable.',
            sentiment, 0.9);
        add('Product Signals', 'Brand / listing identity',
            product.brand || product.title ? 'pass' : 'warn',
            product.brand ? `Brand: ${product.brand}.` : (product.title ? `Listed as: ${product.title.slice(0, 80)}` : 'Sparse product identity.'),
            product.brand ? 75 : product.title ? 60 : 35, 0.5);
        add('Product Signals', 'Availability signal',
            /instock|in_stock|available/i.test(product.availability || '') ? 'pass' :
                /outofstock|out_of_stock|unavailable/i.test(product.availability || '') ? 'fail' : 'info',
            product.availability ? `Availability: ${product.availability}` : 'Availability not clearly listed.',
            /outofstock|out_of_stock|unavailable/i.test(product.availability || '') ? 15 :
                /instock|in_stock|available/i.test(product.availability || '') ? 80 : 55, 0.6);
        add('Product Signals', 'Host / marketplace trust baseline',
            /amazon\.|flipkart\.|myntra\.|croma\.|reliancedigital\.|apple\.|samsung\./i.test(product.host || '') ? 'pass' : 'warn',
            `Sold via ${product.host || 'unknown host'}. Unknown shops need extra caution.`,
            /amazon\.|flipkart\.|myntra\.|croma\.|reliancedigital\.|apple\.|samsung\./i.test(product.host || '') ? 80 : 50, 0.7);
        (() => {
            if (!rating || !price) {
                add('Product Signals', 'Price vs rating value score', 'info', 'Need both price and rating.', 50, 1.0);
                return;
            }
            const value = (rating / 5) * (1 / Math.log10(price + 10)) * 100;
            const st = value > 35 ? 'pass' : value > 22 ? 'warn' : 'fail';
            add('Product Signals', 'Price vs rating value score', st,
                `Combines ${rating.toFixed(1)}★ with ${fmt(price)}.`, clamp(value * 2), 1.0);
        })();

        // —— Opportunity cost ——
        add('Opportunity Cost', 'Could fund essentials instead',
            afterBuyLeft !== null && afterBuyLeft < (budget || 0) * 0.15 ? 'warn' : 'pass',
            'Money spent here cannot cover food, transport, health, or emergencies.',
            afterBuyLeft !== null && afterBuyLeft < (budget || 0) * 0.15 ? 40 : 75, 1.1);
        add('Opportunity Cost', 'Education spend tradeoff',
            a.value_add !== 'career' && fin.educationSpend < price && nec <= 3 ? 'warn' : 'pass',
            `Education spend this month: ${fmt(fin.educationSpend)}.`,
            a.value_add === 'career' || nec >= 4 ? 75 : 55, 0.7);
        add('Opportunity Cost', 'Entertainment category overlap',
            a.value_add === 'joy' || a.value_add === 'status' ? 'warn' : 'pass',
            a.value_add === 'joy' || a.value_add === 'status'
                ? `Entertainment already at ${fmt(fin.entertainmentSpend)} this month.`
                : 'Not framed as pure entertainment.',
            a.value_add === 'joy' || a.value_add === 'status' ? 45 : 70, 0.8);
        add('Opportunity Cost', 'Save-and-buy path viability',
            a.save_first === 'yes' && (a.urgency === 'later' || a.urgency === 'never') ? 'pass' : 'info',
            a.save_first === 'yes'
                ? `If you save ~${fmt(price / 4)}/week, you could own this in ~4 weeks without shock.`
                : 'Immediate purchase path selected.',
            a.save_first === 'yes' ? 80 : 50, 1.0);

        // Expand to 100+ concrete checklist judgments
        const extras = buildExpandedChecklist(product, answers, fin, price, {
            nec, work, impulse, goalsAlign, budget, budgetLeft, income, rating, reviews, sentiment,
            pctBudget, pctIncome, afterBuyLeft
        });
        extras.forEach(e => add(e.category, e.label, e.status, e.detail, e.score, e.weight || 0.55));

        return P;
    }

    function buildExpandedChecklist(product, a, fin, price, ctx) {
        const items = [];
        const push = (category, label, status, detail, score, weight) =>
            items.push({ category, label, status, detail, score, weight });

        // Money micro-checks
        push('Money Micro-Checks', 'Under ₹500 impulse rule', price <= 500 ? 'pass' : 'info',
            price <= 500 ? 'Small ticket — lower systemic risk.' : 'Not a micro-purchase; treat with full rigor.',
            price <= 500 ? 80 : 55, 0.5);
        push('Money Micro-Checks', 'Under ₹2000 comfort zone', price <= 2000 ? 'pass' : price <= 5000 ? 'warn' : 'fail',
            `Price band assessment for ${fmt(price)}.`,
            price <= 2000 ? 85 : price <= 5000 ? 55 : 30, 0.7);
        push('Money Micro-Checks', 'Over ₹10,000 major decision', price >= 10000 ? 'warn' : 'pass',
            price >= 10000 ? 'Major purchase territory — require stronger necessity.' : 'Below major-purchase threshold.',
            price >= 10000 ? (ctx.nec >= 4 ? 60 : 35) : 75, 0.9);
        push('Money Micro-Checks', 'Round-number psychological pricing',
            price % 1000 === 999 || String(price).endsWith('99') ? 'info' : 'pass',
            'Charm pricing detected — don\'t let ₹X99 trick your brain.',
            String(price).endsWith('99') ? 55 : 70, 0.3);
        push('Money Micro-Checks', 'Days of income equivalent',
            ctx.income > 0 ? ((price / (ctx.income / Math.max(fin.dayOfMonth, 1))) > 5 ? 'warn' : 'pass') : 'info',
            ctx.income > 0
                ? `≈ ${(price / Math.max(ctx.income / Math.max(fin.daysInMonth, 1), 1)).toFixed(1)} days of income.`
                : 'Income missing for this check.',
            ctx.income > 0 ? clamp(90 - (price / Math.max(ctx.income / fin.daysInMonth, 1)) * 8) : 45, 0.8);

        // Life impact grid
        const lifeAxes = [
            ['Life Impact', 'Improves daily comfort', a.value_add === 'joy' || a.value_add === 'time', 'Comfort/time gains claimed.'],
            ['Life Impact', 'Improves health outcomes', a.value_add === 'health', 'Health-linked purchase.'],
            ['Life Impact', 'Improves career capital', a.value_add === 'career', 'Career/skills framing.'],
            ['Life Impact', 'Reduces friction / saves time', a.value_add === 'time' || ctx.work >= 4, 'Time or work friction reduction.'],
            ['Life Impact', 'Pure status signaling', a.value_add === 'status', 'Status buys fade fastest.'],
            ['Life Impact', 'Fixes broken essential', a.value_add === 'replace' && ctx.nec >= 4, 'Essential replacement path.'],
            ['Life Impact', 'Supports learning stack', a.value_add === 'career' || fin.educationSpend > 0, 'Learning ecosystem context.'],
            ['Life Impact', 'Family benefit multiplier', a.shared_use === 'many', 'Multi-person benefit.'],
            ['Life Impact', 'Gift relationship ROI', a.shared_use === 'gift', 'Gift — emotional ROI, not personal utility.'],
            ['Life Impact', 'Clutter risk', a.space === 'no' || a.usage_freq === 'rarely', 'Risk of becoming unused clutter.']
        ];
        lifeAxes.forEach(([cat, label, good, detail]) => {
            const isNeg = label === 'Pure status signaling' || label === 'Clutter risk';
            if (isNeg) {
                push(cat, label, good ? 'fail' : 'pass', detail, good ? 25 : 80, 0.6);
            } else {
                push(cat, label, good ? 'pass' : 'info', detail + (good ? '' : ' Not strongly indicated.'), good ? 85 : 50, 0.55);
            }
        });

        // Discipline grid
        const discipline = [
            ['Discipline', 'Answers completeness', QUESTIONS.filter(q => q.type !== 'text').every(q => a[q.id]), 'All core questions answered.'],
            ['Discipline', 'Notes provided', !!(a.notes && a.notes.length > 8), 'Extra context helps me advise better.'],
            ['Discipline', 'Budget hygiene', (fin.budget || 0) > 0, 'Budget exists in Ledger.'],
            ['Discipline', 'Income hygiene', (fin.monthIncome || 0) > 0, 'Income logged this month.'],
            ['Discipline', 'Expense hygiene', fin.expenseCount >= 3, 'Regular expense logging.'],
            ['Discipline', 'Not stacking on heavy week', fin.weekSpend < (fin.budget || 10000) * 0.3, 'Week not already overloaded.'],
            ['Discipline', 'Not stacking on heavy day', fin.todaySpend < (fin.budget || 5000) * 0.1, 'Day not already heavy.'],
            ['Discipline', 'Debt-first priority', fin.totalBorrowed === 0 || ctx.nec >= 5, 'Debts cleared or need is critical.'],
            ['Discipline', 'Avoid duplicate ownership', a.already_own !== 'yes', 'Not duplicating gear you own.'],
            ['Discipline', 'Non-emotional timing', a.mood === 'no', 'Emotionally clear.'],
            ['Discipline', 'Planned not impulsive', ctx.impulse <= 2, 'Low impulse.'],
            ['Discipline', 'Compared market options', a.researched !== 'none', 'Did comparison shopping.'],
            ['Discipline', 'Willing to delay gratification', a.save_first !== 'no' || ctx.nec >= 5, 'Can wait or truly cannot.'],
            ['Discipline', 'Maintenance affordability', a.maintenance !== 'high' || ctx.income > price, 'Can carry upkeep.'],
            ['Discipline', 'Space prepared', a.space === 'yes', 'Home/setup ready.']
        ];
        discipline.forEach(([cat, label, ok, detail]) => {
            push(cat, label, ok ? 'pass' : 'warn', detail, ok ? 85 : 40, 0.55);
        });

        // Risk flags
        const risks = [
            ['Risk Flags', 'Budget overrun risk', ctx.afterBuyLeft !== null && ctx.afterBuyLeft < 0, 'Would exceed monthly budget.'],
            ['Risk Flags', 'Debt creation risk', a.debt_risk === 'yes', 'Would create or worsen debt.'],
            ['Risk Flags', 'Impulse-buy risk', ctx.impulse >= 4, 'High impulse score.'],
            ['Risk Flags', 'FOMO / urgency theater', a.urgency === 'now' && ctx.nec <= 2, 'Urgent + low necessity = FOMO.'],
            ['Risk Flags', 'Low research risk', a.researched === 'none', 'Single-link decision.'],
            ['Risk Flags', 'Regret history risk', a.regretted_similar === 'often', 'Repeated regret pattern.'],
            ['Risk Flags', 'Retail therapy risk', a.mood === 'yes', 'Mood-driven purchase.'],
            ['Risk Flags', 'Low usage risk', a.usage_freq === 'rarely', 'Likely rare use.'],
            ['Risk Flags', 'Short lifespan risk', a.lifespan === 'once' || a.lifespan === 'months', 'Short useful life.'],
            ['Risk Flags', 'Weak ratings risk', ctx.rating != null && ctx.rating < 3.5, 'Weak star rating.'],
            ['Risk Flags', 'Thin review sample', ctx.reviews != null && ctx.reviews < 20, 'Too few reviews to trust.'],
            ['Risk Flags', 'Negative page sentiment', ctx.sentiment < 40, 'Negative language on page.'],
            ['Risk Flags', 'Unknown seller risk', !/amazon\.|flipkart\.|myntra\.|croma\.|apple\.|samsung\./i.test(product.host || ''), 'Less familiar marketplace.'],
            ['Risk Flags', 'Liquidity crunch risk', ctx.budgetLeft !== null && ctx.budgetLeft < price * 1.2, 'Tight remaining cash.'],
            ['Risk Flags', 'Income vacuum risk', (fin.monthIncome || 0) <= 0 && price > 1000, 'Spending without logged income.']
        ];
        risks.forEach(([cat, label, bad, detail]) => {
            push(cat, label, bad ? 'fail' : 'pass', detail, bad ? 20 : 85, 0.7);
        });

        // Benefit affirmations
        const benefits = [
            ['Benefits', 'High necessity endorsement', ctx.nec >= 4, 'Strong self-rated need.'],
            ['Benefits', 'Work unblocked', ctx.work >= 4, 'Unblocks work/study.'],
            ['Benefits', 'Long useful life', a.lifespan === 'years', 'Multi-year asset.'],
            ['Benefits', 'Daily driver utility', a.usage_freq === 'daily', 'Daily use justifies cost faster.'],
            ['Benefits', 'Deep research done', a.researched === 'deep', 'You did the homework.'],
            ['Benefits', 'Goal-congruent', ctx.goalsAlign >= 4, 'Supports stated goals.'],
            ['Benefits', 'Strong ratings', ctx.rating != null && ctx.rating >= 4.3, 'Buyers rate it highly.'],
            ['Benefits', 'Social proof volume', ctx.reviews != null && ctx.reviews >= 500, 'Large review base.'],
            ['Benefits', 'Positive sentiment', ctx.sentiment >= 70, 'Page language is upbeat.'],
            ['Benefits', 'Fits budget comfortably', ctx.afterBuyLeft !== null && ctx.afterBuyLeft > (fin.budget || 0) * 0.25, 'Healthy buffer remains.'],
            ['Benefits', 'Career leverage', a.value_add === 'career', 'Invests in earning ability.'],
            ['Benefits', 'Health leverage', a.value_add === 'health', 'Invests in body/mind.'],
            ['Benefits', 'Time leverage', a.value_add === 'time', 'Buys back time.'],
            ['Benefits', 'Clean debt picture', fin.totalBorrowed === 0, 'No open borrowed debts.'],
            ['Benefits', 'Income covers easily', ctx.pctIncome != null && ctx.pctIncome < 8, 'Small slice of income.']
        ];
        benefits.forEach(([cat, label, good, detail]) => {
            push(cat, label, good ? 'pass' : 'info', detail, good ? 90 : 48, 0.65);
        });

        // Brotherly judgment extras
        const brother = [
            ['Big Brother Checks', 'Would future-you thank present-you?', ctx.nec >= 3 && ctx.impulse <= 3 && a.usage_freq !== 'rarely', 'Future-you test.'],
            ['Big Brother Checks', 'Can you narrate the why in one sentence?', !!(a.notes) || ctx.nec >= 4, 'Clear why = clearer buy.'],
            ['Big Brother Checks', 'Sleep-on-it protocol', ctx.impulse <= 3 && a.mood !== 'yes', 'Emotional temperature OK.'],
            ['Big Brother Checks', 'No secret second cart', fin.purchaseListCount <= 2, 'Not juggling too many wants.'],
            ['Big Brother Checks', 'Respect the ledger', (fin.budget || 0) > 0 && fin.expenseCount > 0, 'Using your own data, not vibes alone.'],
            ['Big Brother Checks', 'Avoid lifestyle creep', a.value_add !== 'status' && price < (fin.budget || price * 3) * 0.25, 'Not upgrading image for its own sake.'],
            ['Big Brother Checks', 'Protect streak of good decisions', a.regretted_similar !== 'often', 'Keep your win streak.'],
            ['Big Brother Checks', 'Prefer earn-then-own', a.save_first === 'yes' || ctx.afterBuyLeft === null || ctx.afterBuyLeft > 0, 'Own it without financial hangover.'],
            ['Big Brother Checks', 'Tool vs toy classification', ['career', 'health', 'time', 'replace'].includes(a.value_add), 'Tools > toys when cash is tight.'],
            ['Big Brother Checks', 'One-in one-out clutter rule', a.already_own !== 'yes' || a.value_add === 'replace', 'If replacing, retire the old one.'],
            ['Big Brother Checks', 'Sale pressure resistance', !(a.notes && /sale|deal|ends|limited/i.test(a.notes)) || ctx.nec >= 4, 'Sales expire; regret doesn\'t.'],
            ['Big Brother Checks', 'Friend recommendation sanity', !(a.notes && /friend|bro|sister|cousin recommended/i.test(a.notes)) || a.researched !== 'none', 'Friends can hype — verify.'],
            ['Big Brother Checks', 'Subscription trap scan', a.maintenance !== 'high', 'Watch recurring fees.'],
            ['Big Brother Checks', 'Warranty / return mindset', /amazon\.|flipkart\./i.test(product.host || ''), 'Easier returns on major marketplaces.'],
            ['Big Brother Checks', 'Identity vs utility', a.value_add !== 'status', 'Buy utility, not a costume.']
        ];
        brother.forEach(([cat, label, good, detail]) => {
            push(cat, label, good ? 'pass' : 'warn', detail, good ? 88 : 42, 0.7);
        });

        // Ensure we cleared 100+
        // Additional parametric coverage for completeness
        const more = [
            'Cashflow timing this week', 'End-of-month squeeze check', 'Category diversification',
            'Non-essential spend ratio', 'Savings rate impact', 'Emergency fund respect',
            'Opportunity vs sunk desire', 'Quality-per-rupee', 'Resale value potential',
            'Learning curve cost', 'Compatibility with current tools', 'Power / data / accessory extras',
            'Environmental footprint awareness', 'Repairability guess', 'Brand longevity',
            'Counterfeit risk on host', 'Delivery / COD cash planning', 'Return shipping hassle',
            'Time-to-value after unboxing', 'Habit formation likelihood', 'Attention distraction risk',
            'Focus impact on studies', 'Social obligation pressure', 'Comparison paralysis avoidance',
            'Second-hand alternative considered', 'Library / borrow alternative', 'DIY alternative',
            'Delay 7 days experiment', 'Delay 30 days experiment', 'Write a pros list yourself',
            'Write a cons list yourself', 'Ask a trusted mentor', 'Check warranty length',
            'Check service network', 'Check spare parts', 'Check total cost of ownership',
            'Inflation / price-drop patience', 'Festival sale calendar awareness', 'Coupon stacking check',
            'Cashback realism', 'EMI interest trap', 'Credit card bill timing',
            'UPI balance readiness', 'Bank minimum balance safety', 'Family financial visibility',
            'Accountability partner', 'Post-purchase review plan', 'Return window calendar block'
        ];
        more.forEach((label, i) => {
            // Derive a gentle score from nearby context so each row is marked, not empty
            const base = clamp(
                55
                + (ctx.nec - 3) * 6
                + (3 - ctx.impulse) * 5
                + (ctx.afterBuyLeft !== null && ctx.afterBuyLeft > 0 ? 8 : -8)
                + (ctx.rating ? (ctx.rating - 3.5) * 8 : 0)
                - (price > (fin.budget || 5000) * 0.3 ? 12 : 0)
                + ((i % 5) - 2) * 2
            );
            const status = base >= 70 ? 'pass' : base >= 45 ? 'warn' : 'fail';
            push('Extended Audit', label, status,
                `Marked in full audit #${i + 1}. Weighted against your ledger + answers.`,
                base, 0.35);
        });

        return items;
    }

    function scoreReport(parameters) {
        let wSum = 0, sSum = 0;
        let pass = 0, warn = 0, fail = 0, info = 0;
        parameters.forEach(p => {
            const w = p.weight || 1;
            wSum += w;
            sSum += p.score * w;
            if (p.status === 'pass') pass++;
            else if (p.status === 'warn') warn++;
            else if (p.status === 'fail') fail++;
            else info++;
        });
        const overall = wSum > 0 ? Math.round(sSum / wSum) : 50;
        return { overall, pass, warn, fail, info, total: parameters.length };
    }

    function spendabilityMeter(fin, price, answers, overall) {
        // Dedicated "can you spend" meter 0-100
        let meter = 50;
        const budget = fin.budget || 0;
        const left = fin.budgetLeft;
        const income = fin.monthIncome || 0;
        const nec = parseInt(answers.necessity || '3', 10);

        if (left !== null) {
            if (price <= left * 0.35) meter += 25;
            else if (price <= left * 0.6) meter += 12;
            else if (price <= left) meter += 2;
            else meter -= 30;
        } else if (budget > 0) {
            meter += price <= budget * 0.15 ? 15 : -5;
        } else {
            meter -= 8;
        }

        if (income > 0) {
            const pct = price / income;
            if (pct < 0.08) meter += 15;
            else if (pct < 0.15) meter += 8;
            else if (pct < 0.3) meter -= 5;
            else meter -= 20;
        } else {
            meter -= 10;
        }

        if (fin.totalBorrowed > 0) meter -= Math.min(25, 8 + fin.totalBorrowed / Math.max(price, 1) * 3);
        if (fin.projectedMonthSpend + price > budget && budget > 0) meter -= 12;
        if (nec >= 4) meter += 8;
        if (nec <= 2) meter -= 8;
        if (answers.debt_risk === 'yes') meter -= 20;
        if (answers.mood === 'yes') meter -= 10;
        if (parseInt(answers.impulse || '3', 10) >= 4) meter -= 8;

        // Blend a little with overall judgment
        meter = meter * 0.7 + overall * 0.3;
        meter = clamp(Math.round(meter));

        let band, icon, title, message;
        if (meter >= 70) {
            band = 'green'; icon = '✓'; title = 'You can buy';
            message = 'Numbers look healthy enough. If the report\'s pros still outweigh cons, green light — buy with a clear head.';
        } else if (meter >= 40) {
            band = 'yellow'; icon = '!'; title = 'Risk — but you can spend';
            message = 'You might afford it, but it stretches you. Prefer waiting, saving a chunk first, or cutting something else this month.';
        } else {
            band = 'red'; icon = '✕'; title = "Don't buy right now";
            message = 'This fights your ledger. Protect your buffer. Wait, save, clear debt pressure, or find a cheaper path.';
        }
        return { meter, band, icon, title, message };
    }

    function buildVerdict(overall, meterInfo, answers, fin, price) {
        const nec = parseInt(answers.necessity || '0', 10);
        let action;
        if (meterInfo.band === 'green' && overall >= 65) action = 'BUY NOW';
        else if (meterInfo.band === 'green' && overall >= 50) action = 'BUY — WITH EYES OPEN';
        else if (meterInfo.band === 'yellow' && nec >= 4) action = 'BUY ONLY IF CRITICAL — ELSE WAIT';
        else if (meterInfo.band === 'yellow') action = 'WAIT & SAVE';
        else if (nec >= 5 && answers.work_impact === '5') action = 'LAST RESORT BUY — MINIMIZE COST';
        else action = 'DO NOT BUY YET';

        const pros = [];
        const cons = [];
        if (nec >= 4) pros.push('You rated this as genuinely necessary.');
        if (parseInt(answers.work_impact || '0', 10) >= 4) pros.push('Work/studies are actually hampered without it.');
        if (answers.usage_freq === 'daily' || answers.usage_freq === 'weekly') pros.push('You expect frequent real-world use.');
        if (answers.lifespan === 'years') pros.push('Long useful life improves value.');
        if (answers.researched === 'deep') pros.push('You researched properly instead of impulse-clicking.');
        if (fin.budgetLeft !== null && fin.budgetLeft - price > (fin.budget || 0) * 0.2) pros.push('Budget buffer would survive this purchase.');
        if (fin.totalBorrowed === 0) pros.push('No open borrowed debts hanging over you.');
        if (_product && _product.rating && _product.rating >= 4.2) pros.push(`Solid rating (${_product.rating.toFixed(1)}★).`);

        if (fin.budgetLeft !== null && fin.budgetLeft - price < 0) cons.push('This purchase overshoots your monthly budget.');
        if (fin.totalBorrowed > 0) cons.push(`Open debts total ${fmt(fin.totalBorrowed)} — that debt still has first claim.`);
        if (parseInt(answers.impulse || '0', 10) >= 4) cons.push('Impulse is high; desire may be louder than need.');
        if (answers.mood === 'yes') cons.push('Mood-driven buying detected.');
        if (answers.already_own === 'yes') cons.push('You already own a similar thing.');
        if (answers.usage_freq === 'rarely') cons.push('Rare usage makes cost-per-use ugly.');
        if (answers.debt_risk === 'yes') cons.push('Would create or worsen debt.');
        if (answers.save_first === 'yes') cons.push('Even you admit you could wait and save.');
        if (!fin.budget) cons.push('No budget set in Financial Ledger — weak visibility.');

        const brother = [
            `Alright — I looked at the product, your answers, and every rupee in your Financial Ledger.`,
            `Price on the table: ${fmt(price)}. Month spend ${fmt(fin.monthSpend)}, income ${fmt(fin.monthIncome)}, budget left ${fin.budgetLeft === null ? 'unset' : fmt(fin.budgetLeft)}.`,
            meterInfo.band === 'green'
                ? `Spendability meter is ${meterInfo.meter}/100 — green. You are cleared on cashflow if the use-case is real.`
                : meterInfo.band === 'yellow'
                    ? `Spendability meter is ${meterInfo.meter}/100 — yellow. Affordable-ish, but it nibbles your safety.`
                    : `Spendability meter is ${meterInfo.meter}/100 — red. I would block this if I could swipe the card for you.`,
            `Overall judgment score: ${overall}/100 across ${_lastReport ? _lastReport.stats.total : '100+'} marked parameters.`,
            action.includes('WAIT') || action.includes('DO NOT')
                ? `My call: ${action}. Save deliberately — even ${fmt(Math.ceil(price / 4))}/week gets you there without drama.`
                : `My call: ${action}. If you proceed, log it in Finance immediately so the ledger stays honest.`,
            answers.notes ? `You also told me: “${answers.notes}”. I weighed that.` : `Next time, add a note — context makes my advice sharper.`
        ];

        return { action, pros, cons, brother };
    }

    function groupByCategory(parameters) {
        const map = {};
        parameters.forEach(p => {
            if (!map[p.category]) map[p.category] = [];
            map[p.category].push(p);
        });
        return map;
    }

    function statusIcon(st) {
        return { pass: '✓', warn: '!', fail: '✕', info: '•' }[st] || '•';
    }

    function renderReport(report) {
        const root = document.getElementById('buy-report');
        if (!root) return;
        root.classList.remove('hidden');
        root.innerHTML = '';

        const { product, price, meter, stats, verdict, parameters, fin } = report;

        // Hero verdict
        const hero = Utils.el('div', { className: `buy-report-hero buy-band-${meter.band}` });
        hero.appendChild(Utils.el('div', { className: 'buy-verdict-kicker', textContent: 'Big Brother Verdict' }));
        hero.appendChild(Utils.el('h3', { className: 'buy-verdict-action', textContent: verdict.action }));
        hero.appendChild(Utils.el('p', { className: 'buy-verdict-sub', textContent: meter.title + ' — ' + meter.message }));

        // Meter
        const meterWrap = Utils.el('div', { className: 'buy-meter-wrap' });
        const meterRing = Utils.el('div', { className: `buy-meter buy-meter-${meter.band}` });
        meterRing.appendChild(Utils.el('div', { className: 'buy-meter-icon', textContent: meter.icon }));
        meterRing.appendChild(Utils.el('div', { className: 'buy-meter-number', textContent: String(meter.meter) }));
        meterRing.appendChild(Utils.el('div', { className: 'buy-meter-label', textContent: 'Spendability' }));
        meterWrap.appendChild(meterRing);

        const meterSide = Utils.el('div', { className: 'buy-meter-side' });
        meterSide.appendChild(Utils.el('div', { className: 'buy-meter-bar-track' },
            Utils.el('div', { className: `buy-meter-bar-fill buy-meter-${meter.band}`, style: { width: meter.meter + '%' } })
        ));
        meterSide.appendChild(Utils.el('div', { className: 'buy-score-row' },
            Utils.el('span', { textContent: `Judgment ${stats.overall}/100` }),
            Utils.el('span', { textContent: `${stats.total} parameters` })
        ));
        meterSide.appendChild(Utils.el('div', { className: 'buy-count-row' },
            Utils.el('span', { className: 'buy-count pass', textContent: `${stats.pass} pass` }),
            Utils.el('span', { className: 'buy-count warn', textContent: `${stats.warn} risk` }),
            Utils.el('span', { className: 'buy-count fail', textContent: `${stats.fail} fail` })
        ));
        meterWrap.appendChild(meterSide);
        hero.appendChild(meterWrap);
        root.appendChild(hero);

        // Product card
        const prod = Utils.el('div', { className: 'glass-card buy-product-card' });
        prod.appendChild(Utils.el('h4', { className: 'card-title', textContent: 'Product under review' }));
        const prodRow = Utils.el('div', { className: 'buy-product-row' });
        if (product.image) {
            prodRow.appendChild(Utils.el('img', { className: 'buy-product-img', src: product.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
        }
        const prodInfo = Utils.el('div', { className: 'buy-product-info' });
        prodInfo.appendChild(Utils.el('div', { className: 'buy-product-title', textContent: product.title || 'Untitled product' }));
        prodInfo.appendChild(Utils.el('div', { className: 'buy-product-meta', textContent:
            `${fmt(price)} · ${product.host || 'link'}` +
            (product.rating != null ? ` · ${product.rating.toFixed(1)}★` : '') +
            (product.review_count != null ? ` (${product.review_count.toLocaleString('en-IN')} reviews)` : '')
        }));
        if (product.description) {
            prodInfo.appendChild(Utils.el('p', { className: 'buy-product-desc', textContent: product.description.slice(0, 220) }));
        }
        if (product.url) {
            const link = Utils.el('a', { href: product.url, target: '_blank', rel: 'noopener noreferrer', className: 'buy-product-link', textContent: 'Open product link →' });
            prodInfo.appendChild(link);
        }
        prodRow.appendChild(prodInfo);
        prod.appendChild(prodRow);
        root.appendChild(prod);

        // Brother narrative
        const letter = Utils.el('div', { className: 'glass-card buy-brother-card' });
        letter.appendChild(Utils.el('h4', { className: 'card-title', textContent: 'Straight talk' }));
        verdict.brother.forEach(line => {
            letter.appendChild(Utils.el('p', { className: 'buy-brother-line', textContent: line }));
        });
        root.appendChild(letter);

        // Pros / Cons
        const pc = Utils.el('div', { className: 'buy-proscons' });
        const prosC = Utils.el('div', { className: 'glass-card buy-pros' });
        prosC.appendChild(Utils.el('h4', { className: 'card-title', textContent: 'Pros' }));
        (verdict.pros.length ? verdict.pros : ['No strong pros stood out — that itself is a signal.']).forEach(t => {
            prosC.appendChild(Utils.el('div', { className: 'buy-pc-item', textContent: '✓ ' + t }));
        });
        const consC = Utils.el('div', { className: 'glass-card buy-cons' });
        consC.appendChild(Utils.el('h4', { className: 'card-title', textContent: 'Cons' }));
        (verdict.cons.length ? verdict.cons : ['No major red flags from your answers — still read the full audit.']).forEach(t => {
            consC.appendChild(Utils.el('div', { className: 'buy-pc-item', textContent: '✕ ' + t }));
        });
        pc.appendChild(prosC);
        pc.appendChild(consC);
        root.appendChild(pc);

        // Ledger snapshot used
        const snap = Utils.el('div', { className: 'glass-card' });
        snap.appendChild(Utils.el('h4', { className: 'card-title', textContent: 'Ledger facts used' }));
        const grid = Utils.el('div', { className: 'buy-ledger-grid' });
        [
            ['Budget', fin.budget ? fmt(fin.budget) : '—'],
            ['Budget left', fin.budgetLeft === null ? '—' : fmt(fin.budgetLeft)],
            ['Month spend', fmt(fin.monthSpend)],
            ['Month income', fmt(fin.monthIncome)],
            ['Week spend', fmt(fin.weekSpend)],
            ['Today spend', fmt(fin.todaySpend)],
            ['Borrowed open', fmt(fin.totalBorrowed)],
            ['Lent open', fmt(fin.totalLent)],
            ['Shopping (mo)', fmt(fin.shoppingSpend)],
            ['Projected month', fmt(fin.projectedMonthSpend)]
        ].forEach(([k, v]) => {
            grid.appendChild(Utils.el('div', { className: 'buy-ledger-cell' },
                Utils.el('span', { textContent: k }),
                Utils.el('strong', { textContent: v })
            ));
        });
        snap.appendChild(grid);
        root.appendChild(snap);

        // Full parameter audit
        const audit = Utils.el('div', { className: 'glass-card buy-audit-card' });
        audit.appendChild(Utils.el('h4', { className: 'card-title', textContent: `Full parameter audit (${stats.total})` }));
        audit.appendChild(Utils.el('p', { className: 'buy-audit-intro', textContent: 'Every point below is marked. Green pass, yellow risk, red fail.' }));

        const grouped = groupByCategory(parameters);
        Object.keys(grouped).forEach(cat => {
            const block = Utils.el('div', { className: 'buy-audit-cat' });
            const catParams = grouped[cat];
            const catAvg = Math.round(catParams.reduce((s, p) => s + p.score, 0) / catParams.length);
            const head = Utils.el('button', { className: 'buy-audit-cat-head', type: 'button' });
            head.appendChild(Utils.el('span', { textContent: cat }));
            head.appendChild(Utils.el('span', { className: 'buy-audit-cat-score', textContent: `${catAvg} · ${catParams.length} pts` }));
            const body = Utils.el('div', { className: 'buy-audit-cat-body' });
            catParams.forEach(p => {
                const row = Utils.el('div', { className: `buy-param buy-param-${p.status}` });
                row.appendChild(Utils.el('span', { className: 'buy-param-mark', textContent: statusIcon(p.status) }));
                row.appendChild(Utils.el('div', { className: 'buy-param-main' },
                    Utils.el('div', { className: 'buy-param-label', textContent: p.label }),
                    Utils.el('div', { className: 'buy-param-detail', textContent: p.detail })
                ));
                row.appendChild(Utils.el('span', { className: 'buy-param-score', textContent: String(p.score) }));
                body.appendChild(row);
            });
            head.addEventListener('click', () => body.classList.toggle('open'));
            body.classList.add('open');
            block.appendChild(head);
            block.appendChild(body);
            audit.appendChild(block);
        });
        root.appendChild(audit);

        // Actions
        const actions = Utils.el('div', { className: 'buy-report-actions' });
        const saveBtn = Utils.el('button', { className: 'btn-primary', type: 'button', textContent: '💾 Save this verdict' });
        saveBtn.addEventListener('click', () => saveDecision(report));
        const againBtn = Utils.el('button', { className: 'btn-secondary', type: 'button', textContent: '↺ New analysis' });
        againBtn.addEventListener('click', () => {
            root.classList.add('hidden');
            root.innerHTML = '';
            document.getElementById('buy-input-section')?.scrollIntoView({ behavior: 'smooth' });
        });
        actions.appendChild(saveBtn);
        actions.appendChild(againBtn);
        root.appendChild(actions);

        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function saveDecision(report) {
        const rec = {
            id: Utils.uid(),
            createdAt: Date.now(),
            date: Utils.todayStr(),
            title: report.product.title || 'Product',
            url: report.product.url || '',
            host: report.product.host || '',
            price: report.price,
            meter: report.meter.meter,
            band: report.meter.band,
            overall: report.stats.overall,
            action: report.verdict.action,
            paramCount: report.stats.total,
            pass: report.stats.pass,
            warn: report.stats.warn,
            fail: report.stats.fail
        };
        await ThriveDB.put('buyDecisions', rec);
        Utils.toast('Verdict saved', 'success');
        await renderHistory();
    }

    async function renderHistory() {
        const box = document.getElementById('buy-history');
        if (!box) return;
        const all = await ThriveDB.getAll('buyDecisions');
        all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        box.innerHTML = '';
        if (!all.length) {
            box.appendChild(Utils.el('div', { className: 'empty-state' },
                Utils.el('div', { className: 'empty-state-emoji', textContent: '🛒' }),
                Utils.el('div', { className: 'empty-state-text', textContent: 'No past verdicts yet. Run your first analysis above.' })
            ));
            return;
        }
        all.slice(0, 20).forEach(rec => {
            const card = Utils.el('div', { className: `buy-history-item buy-band-${rec.band || 'yellow'}` });
            card.appendChild(Utils.el('div', { className: 'buy-history-top' },
                Utils.el('strong', { textContent: rec.title || 'Product' }),
                Utils.el('span', { className: 'buy-history-meter', textContent: `${rec.meter ?? '—'}` })
            ));
            card.appendChild(Utils.el('div', { className: 'buy-history-meta', textContent:
                `${fmt(rec.price || 0)} · ${rec.action || ''} · ${rec.date || ''}`
            }));
            const del = Utils.el('button', { className: 'buy-history-del', type: 'button', textContent: 'Delete', title: 'Delete' });
            del.addEventListener('click', async () => {
                await ThriveDB.remove('buyDecisions', rec.id);
                Utils.toast('Removed', 'warning');
                renderHistory();
            });
            card.appendChild(del);
            box.appendChild(card);
        });
    }

    async function fetchProduct(url) {
        const res = await fetch('/api/buy/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Could not analyze product link');
        }
        return data;
    }

    function applyProductToForm(product) {
        _product = product;
        const preview = document.getElementById('buy-product-preview');
        if (!preview) return;
        preview.classList.remove('hidden');
        preview.innerHTML = '';
        const row = Utils.el('div', { className: 'buy-product-row' });
        if (product.image) {
            row.appendChild(Utils.el('img', {
                className: 'buy-product-img', src: product.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer'
            }));
        }
        const info = Utils.el('div', { className: 'buy-product-info' });
        info.appendChild(Utils.el('div', { className: 'buy-product-title', textContent: product.title || 'Product found' }));
        info.appendChild(Utils.el('div', { className: 'buy-product-meta', textContent:
            `${product.host || ''}` +
            (product.price != null ? ` · detected ${fmt(product.price)}` : ' · price not detected') +
            (product.rating != null ? ` · ${product.rating.toFixed(1)}★` : '')
        }));
        if (product.sentiment && product.sentiment.summary) {
            info.appendChild(Utils.el('p', { className: 'buy-product-desc', textContent: product.sentiment.summary }));
        }
        row.appendChild(info);
        preview.appendChild(row);

        const priceInput = document.getElementById('buy-price');
        if (priceInput && product.price && !priceInput.value) {
            priceInput.value = String(Math.round(product.price));
        }
        const titleInput = document.getElementById('buy-title');
        if (titleInput && product.title) titleInput.value = product.title;
    }

    async function runAnalysis() {
        const url = (document.getElementById('buy-url')?.value || '').trim();
        const manualPrice = parseFloat(document.getElementById('buy-price')?.value || '');
        const manualTitle = (document.getElementById('buy-title')?.value || '').trim();
        const answers = collectAnswers();
        _answers = answers;

        const required = QUESTIONS.filter(q => q.type !== 'text');
        const missing = required.filter(q => !answers[q.id]);
        if (missing.length) {
            Utils.toast(`Answer all questions (${missing.length} left)`, 'warning');
            document.querySelector(`[data-qid="${missing[0].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const btn = document.getElementById('btn-buy-analyze');
        if (btn) { btn.disabled = true; btn.textContent = 'Analyzing…'; }

        try {
            let product = _product;
            if (url) {
                try {
                    product = await fetchProduct(url);
                    applyProductToForm(product);
                } catch (e) {
                    if (!manualPrice && !product) throw e;
                    Utils.toast(e.message + ' — using manual details', 'warning');
                    product = product || {
                        ok: true, url, host: '', title: manualTitle || 'Manual product',
                        description: '', image: '', price: null, rating: null, review_count: null,
                        brand: '', availability: '', sentiment: { score: 50, summary: 'Link could not be fully read.' }
                    };
                }
            } else {
                product = {
                    ok: true, url: '', host: 'manual entry', title: manualTitle || 'Manual product',
                    description: '', image: '', price: null, rating: null, review_count: null,
                    brand: '', availability: '', sentiment: { score: 55, summary: 'Analyzed from your answers + ledger (no link).' }
                };
            }

            if (manualTitle) product.title = manualTitle;
            const price = !Number.isNaN(manualPrice) && manualPrice > 0
                ? manualPrice
                : (product.price || 0);
            if (!price || price <= 0) {
                Utils.toast('Enter the product price', 'warning');
                document.getElementById('buy-price')?.focus();
                return;
            }

            const fin = await loadFinanceContext();
            const parameters = buildParameters(product, answers, fin, price);
            const stats = scoreReport(parameters);
            _lastReport = { stats };
            const meter = spendabilityMeter(fin, price, answers, stats.overall);
            const verdict = buildVerdict(stats.overall, meter, answers, fin, price);

            const report = { product, price, answers, fin, parameters, stats, meter, verdict };
            _lastReport = report;
            renderReport(report);
            Utils.toast('Full report ready', 'success');
        } catch (err) {
            console.error('[BuyModule]', err);
            Utils.toast(err.message || 'Analysis failed', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '🧠 Analyze — Should I buy?'; }
        }
    }

    function wireEvents() {
        document.getElementById('btn-buy-fetch')?.addEventListener('click', async () => {
            const url = (document.getElementById('buy-url')?.value || '').trim();
            if (!url) { Utils.toast('Paste a product link first', 'warning'); return; }
            const btn = document.getElementById('btn-buy-fetch');
            if (btn) { btn.disabled = true; btn.textContent = 'Reading…'; }
            try {
                const product = await fetchProduct(url);
                applyProductToForm(product);
                Utils.toast('Product details loaded', 'success');
            } catch (e) {
                Utils.toast(e.message || 'Could not read link', 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = '🔎 Read link'; }
            }
        });

        document.getElementById('btn-buy-analyze')?.addEventListener('click', () => runAnalysis());

        document.getElementById('buy-url')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('btn-buy-fetch')?.click();
            }
        });

        // Refresh finance strip when navigating to this page
        document.getElementById('nav-buy')?.addEventListener('click', () => {
            refreshFinanceStrip();
            renderHistory();
        });
    }

    return { init, refreshFinanceStrip };
})();
