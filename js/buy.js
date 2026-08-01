/* ============================================================
   THRIVE — Should I? (BuyModule)
   Product buys + daily life decisions.
   No Financial Ledger dependency — answers-driven only.
   Balance: save wisely, still enjoy life.
   ============================================================ */

const BuyModule = (() => {
    let _product = null;
    let _lastReport = null;
    let _mode = 'product'; // product | life

    const PRODUCT_QUESTIONS = [
        { id: 'necessity', label: 'How necessary is this for you right now?', type: 'scale', min: 1, max: 5, hints: ['Pure want', 'Nice to have', 'Useful', 'Important', 'Critical need'] },
        { id: 'work_impact', label: 'Is work / study / daily function hurt without it?', type: 'scale', min: 1, max: 5, hints: ['Not at all', 'Slightly', 'Somewhat', 'Quite a bit', 'Severely'] },
        { id: 'already_own', label: 'Do you already own something that does a similar job?', type: 'choice', options: [
            { v: 'no', t: 'No alternative' }, { v: 'partial', t: 'Partial alternative' }, { v: 'yes', t: 'Yes, already have one' }
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
        { id: 'value_add', label: 'What primary value does it add?', type: 'choice', options: [
            { v: 'career', t: 'Career / skills' }, { v: 'health', t: 'Health' }, { v: 'time', t: 'Saves time' },
            { v: 'joy', t: 'Joy / comfort' }, { v: 'status', t: 'Status / looks' }, { v: 'replace', t: 'Replaces broken item' }
        ]},
        { id: 'quality_need', label: 'Do you specifically need THIS quality/brand tier?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, cheaper ones fail me' }, { v: 'maybe', t: 'Maybe mid-range is fine' }, { v: 'no', t: 'Any decent one works' }
        ]},
        { id: 'can_afford', label: 'Can you pay for this without stress or borrowing?', type: 'choice', options: [
            { v: 'easy', t: 'Easily, no stress' }, { v: 'ok', t: 'Yes, but I\'ll feel it' }, { v: 'tight', t: 'It would stretch me' }, { v: 'no', t: 'Not really / would borrow' }
        ]},
        { id: 'save_first', label: 'Could you wait and save for it?', type: 'choice', options: [
            { v: 'no', t: 'Must buy now' }, { v: 'maybe', t: 'Could wait a bit' }, { v: 'yes', t: 'Yes, I can save' }
        ]},
        { id: 'recent_buys', label: 'How many non-essential buys in the last 2 weeks?', type: 'choice', options: [
            { v: '0', t: 'None' }, { v: '1', t: 'One' }, { v: '2', t: 'Two–three' }, { v: 'many', t: 'A streak of them' }
        ]},
        { id: 'debt_risk', label: 'Would this create debt or delay paying someone back?', type: 'choice', options: [
            { v: 'no', t: 'No debt impact' }, { v: 'delay', t: 'Delays payoff' }, { v: 'yes', t: 'Creates / worsens debt' }
        ]},
        { id: 'regretted_similar', label: 'Have you regretted a similar purchase before?', type: 'choice', options: [
            { v: 'no', t: 'Never' }, { v: 'once', t: 'Once' }, { v: 'often', t: 'Often' }
        ]},
        { id: 'shared_use', label: 'Will others also benefit?', type: 'choice', options: [
            { v: 'many', t: 'Family / team' }, { v: 'one', t: 'Just me' }, { v: 'gift', t: "It's a gift" }
        ]},
        { id: 'maintenance', label: 'Ongoing cost (subs, parts, power, fees)?', type: 'choice', options: [
            { v: 'none', t: 'None' }, { v: 'low', t: 'Low' }, { v: 'high', t: 'High / recurring' }
        ]},
        { id: 'space', label: 'Do you have space / setup ready?', type: 'choice', options: [
            { v: 'yes', t: 'Ready' }, { v: 'maybe', t: 'Need to arrange' }, { v: 'no', t: 'No space yet' }
        ]},
        { id: 'mood', label: 'Are you buying this to fix a mood / stress?', type: 'choice', options: [
            { v: 'no', t: 'Clear-headed' }, { v: 'partly', t: 'Partly emotional' }, { v: 'yes', t: 'Retail therapy' }
        ]},
        { id: 'future_thanks', label: 'Will future-you thank present-you in 6 months?', type: 'scale', min: 1, max: 5, hints: ['Will regret', 'Doubtful', 'Neutral', 'Probably yes', 'Absolutely'] },
        { id: 'joy_value', label: 'How much real joy / relief would owning this bring?', type: 'scale', min: 1, max: 5, hints: ['Almost none', 'A little', 'Some', 'A lot', 'Huge lift'] },
        { id: 'life_beyond', label: 'Are you denying yourself too hard lately?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, I\'ve been very strict' }, { v: 'balanced', t: 'Mostly balanced' }, { v: 'no', t: 'No, I treat myself often' }
        ]},
        { id: 'secondhand', label: 'Did you check used / cheaper / borrow options?', type: 'choice', options: [
            { v: 'yes', t: 'Checked — this is best' }, { v: 'no', t: 'Didn\'t check' }, { v: 'na', t: 'Not possible for this' }
        ]},
        { id: 'return_policy', label: 'Easy returns if it disappoints?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, easy returns' }, { v: 'maybe', t: 'Possible but annoying' }, { v: 'no', t: 'Hard / no returns' }
        ]},
        { id: 'goals_align', label: 'Does this align with your current goals?', type: 'scale', min: 1, max: 5, hints: ['Conflicts', 'Neutral', 'Somewhat', 'Supports', 'Directly advances'] },
        { id: 'identity', label: 'Are you buying who you are — or who you wish you looked like?', type: 'choice', options: [
            { v: 'real', t: 'Real need / real me' }, { v: 'mix', t: 'A bit of both' }, { v: 'image', t: 'Mostly image / vibe' }
        ]},
        { id: 'waste_risk', label: 'Chance it becomes unused clutter?', type: 'scale', min: 1, max: 5, hints: ['Almost none', 'Low', 'Maybe', 'Likely', 'Very likely'] },
        { id: 'notes', label: 'Anything else I should know? (optional)', type: 'text', placeholder: 'Sale ends tonight, needed for a project, friend recommended, why this model…' }
    ];

    const LIFE_QUESTIONS = [
        { id: 'why_now', label: 'Why this, why today?', type: 'choice', options: [
            { v: 'joy', t: 'I want joy / fun' }, { v: 'rest', t: 'I need rest / comfort' },
            { v: 'social', t: 'People / relationship' }, { v: 'memory', t: 'Make a memory' },
            { v: 'convenience', t: 'Convenience / tired' }, { v: 'fomo', t: 'FOMO / habit / boredom' }
        ]},
        { id: 'heart_pull', label: 'How strongly does your heart want this?', type: 'scale', min: 1, max: 5, hints: ['Meh', 'Mild want', 'Clear want', 'Really want', 'Deeply need this feeling'] },
        { id: 'body_energy', label: 'How is your body/energy right now?', type: 'choice', options: [
            { v: 'drained', t: 'Drained — need care' }, { v: 'ok', t: 'Okay' }, { v: 'high', t: 'Energized / restless' }
        ]},
        { id: 'emotional_state', label: 'Emotional weather check', type: 'choice', options: [
            { v: 'low', t: 'Sad / lonely / stressed' }, { v: 'flat', t: 'Bored / numb' },
            { v: 'calm', t: 'Calm & clear' }, { v: 'happy', t: 'Already happy' }
        ]},
        { id: 'can_afford', label: 'Can you spend this without money anxiety afterward?', type: 'choice', options: [
            { v: 'easy', t: 'Easily' }, { v: 'ok', t: 'Yes, mild pinch' }, { v: 'tight', t: 'It\'ll sting' }, { v: 'no', t: 'Would regret the cost' }
        ]},
        { id: 'recent_treats', label: 'Have you had a similar treat recently?', type: 'choice', options: [
            { v: 'long', t: 'Not in a long while' }, { v: 'week', t: 'Within a week' }, { v: 'yesterday', t: 'Yesterday / today already' }, { v: 'streak', t: 'I\'ve been on a streak' }
        ]},
        { id: 'memory_value', label: 'Will this become a warm memory later?', type: 'scale', min: 1, max: 5, hints: ['Forgettable', 'Maybe', 'Somewhat', 'Yes', 'Core memory vibes'] },
        { id: 'connection', label: 'Does this deepen connection with someone you care about?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, shared moment' }, { v: 'solo', t: 'Solo — for me' }, { v: 'no', t: 'Not really social' }
        ]},
        { id: 'alternative', label: 'Is there a cheaper way to get ~80% of the feeling?', type: 'choice', options: [
            { v: 'no', t: 'No good substitute' }, { v: 'partial', t: 'Partial substitute exists' }, { v: 'yes', t: 'Yes, easy cheaper option' }
        ]},
        { id: 'health', label: 'Health / sleep / tomorrow-you impact?', type: 'choice', options: [
            { v: 'good', t: 'Neutral or good' }, { v: 'mild', t: 'Mild downside' }, { v: 'bad', t: 'Will hurt tomorrow' }
        ]},
        { id: 'obligation', label: 'Are you doing this from pressure or true want?', type: 'choice', options: [
            { v: 'want', t: 'True want' }, { v: 'mix', t: 'Mix' }, { v: 'pressure', t: 'Pressure / guilt / FOMO' }
        ]},
        { id: 'scarcity', label: 'Is this a rare window (travel, show, people visiting)?', type: 'choice', options: [
            { v: 'rare', t: 'Rare / time-sensitive' }, { v: 'sometime', t: 'Can happen again soon' }, { v: 'anytime', t: 'Anytime available' }
        ]},
        { id: 'self_kindness', label: 'Have you been too hard on yourself with money lately?', type: 'choice', options: [
            { v: 'yes', t: 'Yes — over-restricting' }, { v: 'balanced', t: 'Balanced' }, { v: 'loose', t: 'I\'ve been spending freely' }
        ]},
        { id: 'waste_feel', label: 'Does spending this feel wasteful in your gut?', type: 'scale', min: 1, max: 5, hints: ['Not wasteful', 'Slightly', 'Mixed', 'Kinda wasteful', 'Very wasteful'] },
        { id: 'presence', label: 'Will you actually be present for it (not phone-scrolling through it)?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, I\'ll savor it' }, { v: 'maybe', t: 'Maybe' }, { v: 'no', t: 'Probably distracted' }
        ]},
        { id: 'values', label: 'Does this match the life you want — not just a dopamine hit?', type: 'scale', min: 1, max: 5, hints: ['Conflicts', 'Neutral', 'Somewhat', 'Fits', 'Deeply fits'] },
        { id: 'tomorrow_feel', label: 'How will you feel about this tomorrow morning?', type: 'choice', options: [
            { v: 'glad', t: 'Glad I did it' }, { v: 'fine', t: 'Fine either way' }, { v: 'meh', t: 'Probably meh' }, { v: 'regret', t: 'Likely regret' }
        ]},
        { id: 'swap', label: 'Would skipping this free money for something you care about more?', type: 'choice', options: [
            { v: 'no', t: 'No bigger priority waiting' }, { v: 'maybe', t: 'Maybe' }, { v: 'yes', t: 'Yes — I should protect that instead' }
        ]},
        { id: 'home_option', label: 'Could a simple at-home version still feel good tonight?', type: 'choice', options: [
            { v: 'no', t: 'Home won\'t cut it' }, { v: 'somewhat', t: 'Somewhat' }, { v: 'yes', t: 'Yes, home can work' }
        ]},
        { id: 'company_quality', label: 'If with people — is the company worth it?', type: 'choice', options: [
            { v: 'yes', t: 'Yes / going solo for me' }, { v: 'mixed', t: 'Mixed company' }, { v: 'no', t: 'Draining company' }, { v: 'na', t: 'N/A' }
        ]},
        { id: 'habit_loop', label: 'Is this becoming an autopilot habit (order out, scroll-buy, etc.)?', type: 'choice', options: [
            { v: 'no', t: 'Intentional choice' }, { v: 'forming', t: 'Starting to be habit' }, { v: 'yes', t: 'Autopilot habit' }
        ]},
        { id: 'gratitude', label: 'Can you name what you\'re grateful for today without this?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, I can' }, { v: 'hard', t: 'Hard right now' }, { v: 'no', t: 'Feeling empty' }
        ]},
        { id: 'notes', label: 'Anything else on your heart? (optional)', type: 'text', placeholder: 'Who you\'re with, why it matters, what you\'re tired of, what you hope to feel…' }
    ];

    function fmt(n) {
        if (n === null || n === undefined || Number.isNaN(n)) return '₹—';
        return '₹' + Math.round(n).toLocaleString('en-IN');
    }

    function clamp(n, a = 0, b = 100) {
        return Math.round(Math.max(a, Math.min(b, Number(n) || 0)));
    }

    function num(v, fallback = 0) {
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? fallback : n;
    }

    async function init() {
        renderQuestions('buy-questions', PRODUCT_QUESTIONS);
        renderQuestions('life-questions', LIFE_QUESTIONS);
        await renderHistory();
        wireEvents();
        setMode('product');
    }

    function setMode(mode) {
        _mode = mode;
        document.querySelectorAll('.buy-mode-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.buymode === mode);
        });
        document.getElementById('buy-mode-product')?.classList.toggle('hidden', mode !== 'product');
        document.getElementById('buy-mode-life')?.classList.toggle('hidden', mode !== 'life');
        const report = document.getElementById('buy-report');
        if (report) { report.classList.add('hidden'); report.innerHTML = ''; }
    }

    function renderQuestions(containerId, questions) {
        const box = document.getElementById(containerId);
        if (!box) return;
        box.innerHTML = '';
        questions.forEach((q, idx) => {
            const card = Utils.el('div', { className: 'buy-q-card', dataset: { qid: q.id, qset: containerId } });
            card.appendChild(Utils.el('div', { className: 'buy-q-num', textContent: String(idx + 1).padStart(2, '0') }));
            card.appendChild(Utils.el('label', { className: 'buy-q-label', textContent: q.label }));

            if (q.type === 'scale') {
                const row = Utils.el('div', { className: 'buy-scale-row' });
                for (let i = q.min; i <= q.max; i++) {
                    const id = `${containerId}-${q.id}-${i}`;
                    const wrap = Utils.el('label', { className: 'buy-scale-opt', for: id });
                    wrap.appendChild(Utils.el('input', { type: 'radio', name: `${containerId}-${q.id}`, id, value: String(i) }));
                    wrap.appendChild(Utils.el('span', { textContent: String(i) }));
                    if (q.hints && q.hints[i - q.min]) wrap.title = q.hints[i - q.min];
                    row.appendChild(wrap);
                }
                card.appendChild(row);
                if (q.hints) {
                    card.appendChild(Utils.el('div', { className: 'buy-scale-hints', textContent: `${q.hints[0]} → ${q.hints[q.hints.length - 1]}` }));
                }
            } else if (q.type === 'choice') {
                const row = Utils.el('div', { className: 'buy-choice-row' });
                q.options.forEach((opt, oi) => {
                    const id = `${containerId}-${q.id}-${oi}`;
                    const wrap = Utils.el('label', { className: 'buy-choice-opt', for: id });
                    wrap.appendChild(Utils.el('input', { type: 'radio', name: `${containerId}-${q.id}`, id, value: opt.v }));
                    wrap.appendChild(Utils.el('span', { textContent: opt.t }));
                    row.appendChild(wrap);
                });
                card.appendChild(row);
            } else if (q.type === 'text') {
                card.appendChild(Utils.el('textarea', {
                    id: `${containerId}-${q.id}`,
                    className: 'buy-q-text',
                    placeholder: q.placeholder || '',
                    rows: '2',
                    maxlength: '400'
                }));
            }
            box.appendChild(card);
        });
    }

    function collectAnswers(containerId, questions) {
        const answers = {};
        questions.forEach(q => {
            if (q.type === 'text') {
                const el = document.getElementById(`${containerId}-${q.id}`);
                answers[q.id] = el ? el.value.trim() : '';
            } else {
                const checked = document.querySelector(`input[name="${containerId}-${q.id}"]:checked`);
                answers[q.id] = checked ? checked.value : null;
            }
        });
        return answers;
    }

    function addParam(list, category, label, status, detail, score, weight = 1) {
        list.push({ category, label, status, detail, score: clamp(score), weight });
    }

    function buildProductParameters(product, a, price) {
        const P = [];
        const nec = num(a.necessity);
        const work = num(a.work_impact);
        const impulse = num(a.impulse);
        const goalsAlign = num(a.goals_align);
        const future = num(a.future_thanks);
        const joy = num(a.joy_value);
        const waste = num(a.waste_risk);
        const rating = product.rating;
        const reviews = product.review_count;
        const sentiment = (product.sentiment && product.sentiment.score) || 50;
        const usageMap = { daily: 95, weekly: 75, monthly: 45, rarely: 20 };
        const lifeMap = { years: 90, year: 70, months: 40, once: 15 };
        const affordMap = { easy: 92, ok: 68, tight: 35, no: 12 };

        // Money comfort (self-reported — NOT ledger)
        addParam(P, 'Money Comfort', 'Self-reported affordability',
            a.can_afford === 'easy' || a.can_afford === 'ok' ? 'pass' : a.can_afford === 'tight' ? 'warn' : a.can_afford ? 'fail' : 'info',
            a.can_afford ? `You said: ${a.can_afford}.` : 'Not answered.',
            affordMap[a.can_afford] || 40, 1.8);
        addParam(P, 'Money Comfort', 'Price band awareness',
            price <= 500 ? 'pass' : price <= 2000 ? 'pass' : price <= 10000 ? 'warn' : 'info',
            `${fmt(price)} — ${price <= 500 ? 'small ticket' : price <= 2000 ? 'moderate' : price <= 10000 ? 'serious buy' : 'major decision'}.`,
            price <= 500 ? 85 : price <= 2000 ? 75 : price <= 10000 ? 55 : 40, 1.0);
        addParam(P, 'Money Comfort', 'Recent non-essential streak',
            a.recent_buys === '0' || a.recent_buys === '1' ? 'pass' : a.recent_buys === '2' ? 'warn' : a.recent_buys ? 'fail' : 'info',
            a.recent_buys === 'many' ? 'You\'ve been on a buying streak — pause may help.' : a.recent_buys ? `Recent buys: ${a.recent_buys}.` : 'Not answered.',
            ({ '0': 90, '1': 75, '2': 45, many: 20 }[a.recent_buys] || 45), 1.2);
        addParam(P, 'Money Comfort', 'Debt / borrowing risk',
            a.debt_risk === 'no' ? 'pass' : a.debt_risk === 'delay' ? 'warn' : a.debt_risk === 'yes' ? 'fail' : 'info',
            a.debt_risk === 'yes' ? 'Debt for a want is a hard brake from me.' : a.debt_risk ? `Debt impact: ${a.debt_risk}.` : 'Not answered.',
            ({ no: 90, delay: 45, yes: 10 }[a.debt_risk] || 40), 1.8);
        addParam(P, 'Money Comfort', 'Wait-and-save option',
            a.save_first === 'yes' ? 'pass' : a.save_first === 'maybe' ? 'warn' : a.save_first ? 'info' : 'info',
            a.save_first === 'yes' ? 'You can save — often the wisest flex.' : a.save_first ? `Save path: ${a.save_first}.` : 'Not answered.',
            ({ yes: 85, maybe: 60, no: 40 }[a.save_first] || 45), 1.1);

        // Necessity & use
        addParam(P, 'Necessity & Use', 'Self-rated necessity', nec >= 4 ? 'pass' : nec === 3 ? 'warn' : nec ? 'fail' : 'info',
            nec ? `Necessity ${nec}/5.` : 'Not answered.', nec ? nec * 20 : 40, 1.8);
        addParam(P, 'Necessity & Use', 'Work / study impact', work >= 4 ? 'pass' : work === 3 ? 'warn' : work ? 'fail' : 'info',
            work ? `Impact ${work}/5.` : 'Not answered.', work ? work * 20 : 40, 1.5);
        addParam(P, 'Necessity & Use', 'Existing alternative',
            a.already_own === 'no' ? 'pass' : a.already_own === 'partial' ? 'warn' : a.already_own === 'yes' ? 'fail' : 'info',
            a.already_own === 'yes' ? 'You already have something similar.' : a.already_own ? `Alternative: ${a.already_own}.` : 'Not answered.',
            ({ no: 90, partial: 55, yes: 25 }[a.already_own] || 40), 1.5);
        addParam(P, 'Necessity & Use', 'Usage frequency', usageMap[a.usage_freq] >= 70 ? 'pass' : usageMap[a.usage_freq] >= 40 ? 'warn' : a.usage_freq ? 'fail' : 'info',
            a.usage_freq ? `Usage: ${a.usage_freq}.` : 'Not answered.', usageMap[a.usage_freq] || 40, 1.5);
        (() => {
            const uses = { daily: 300, weekly: 50, monthly: 12, rarely: 2 }[a.usage_freq] || 10;
            const cpu = price / uses;
            addParam(P, 'Necessity & Use', 'Cost per use (heuristic)',
                cpu > 500 ? 'fail' : cpu > 150 ? 'warn' : 'pass',
                `≈ ${fmt(cpu)} per use.`, clamp(100 - cpu / 8), 1.2);
        })();
        addParam(P, 'Necessity & Use', 'Expected lifespan', lifeMap[a.lifespan] >= 70 ? 'pass' : lifeMap[a.lifespan] >= 40 ? 'warn' : a.lifespan ? 'fail' : 'info',
            a.lifespan ? `Lifespan: ${a.lifespan}.` : 'Not answered.', lifeMap[a.lifespan] || 40, 1.1);
        addParam(P, 'Necessity & Use', 'Clutter / waste risk', waste <= 2 ? 'pass' : waste === 3 ? 'warn' : waste ? 'fail' : 'info',
            waste ? `Waste risk ${waste}/5.` : 'Not answered.', waste ? clamp(110 - waste * 18) : 45, 1.3);

        // Heart & life (balance — not only austerity)
        addParam(P, 'Heart & Life', 'Joy / relief value', joy >= 4 ? 'pass' : joy === 3 ? 'warn' : joy ? 'info' : 'info',
            joy >= 4 ? 'Real joy matters — life isn\'t only spreadsheets.' : joy ? `Joy ${joy}/5.` : 'Not answered.',
            joy ? 40 + joy * 12 : 45, 1.3);
        addParam(P, 'Heart & Life', 'Future-you gratitude', future >= 4 ? 'pass' : future === 3 ? 'warn' : future ? 'fail' : 'info',
            future ? `Future-you score ${future}/5.` : 'Not answered.', future ? future * 20 : 40, 1.5);
        addParam(P, 'Heart & Life', 'Self-denial balance',
            a.life_beyond === 'yes' && joy >= 3 && a.can_afford !== 'no' ? 'pass' :
                a.life_beyond === 'no' && nec <= 2 ? 'warn' : a.life_beyond ? 'info' : 'info',
            a.life_beyond === 'yes' ? 'You\'ve been strict — a thoughtful treat can be healthy if affordable.' :
                a.life_beyond === 'no' ? 'You already treat yourself often — raise the bar for this one.' :
                    a.life_beyond ? 'Mostly balanced lately.' : 'Not answered.',
            a.life_beyond === 'yes' ? 78 : a.life_beyond === 'balanced' ? 70 : a.life_beyond === 'no' ? 45 : 50, 1.2);
        addParam(P, 'Heart & Life', 'Goal alignment', goalsAlign >= 4 ? 'pass' : goalsAlign === 3 ? 'warn' : goalsAlign ? 'fail' : 'info',
            goalsAlign ? `Goals ${goalsAlign}/5.` : 'Not answered.', goalsAlign ? goalsAlign * 20 : 40, 1.4);
        addParam(P, 'Heart & Life', 'Identity vs utility',
            a.identity === 'real' ? 'pass' : a.identity === 'mix' ? 'warn' : a.identity === 'image' ? 'fail' : 'info',
            a.identity === 'image' ? 'Image buys fade; utility sticks.' : a.identity ? `Identity check: ${a.identity}.` : 'Not answered.',
            ({ real: 88, mix: 55, image: 25 }[a.identity] || 40), 1.2);
        addParam(P, 'Heart & Life', 'Primary life value',
            ['career', 'health', 'time', 'replace'].includes(a.value_add) ? 'pass' : a.value_add === 'joy' ? 'warn' : a.value_add === 'status' ? 'fail' : 'info',
            a.value_add ? `Value: ${a.value_add}.` : 'Not answered.',
            ({ career: 92, health: 90, time: 85, replace: 88, joy: 62, status: 25 }[a.value_add] || 40), 1.3);

        // Discipline & timing
        addParam(P, 'Discipline & Timing', 'Impulse level', impulse <= 2 ? 'pass' : impulse === 3 ? 'warn' : impulse ? 'fail' : 'info',
            impulse ? `Impulse ${impulse}/5.` : 'Not answered.', impulse ? clamp(110 - impulse * 18) : 40, 1.6);
        addParam(P, 'Discipline & Timing', 'Research depth',
            a.researched === 'deep' ? 'pass' : a.researched === 'some' ? 'warn' : a.researched === 'none' ? 'fail' : 'info',
            a.researched === 'none' ? 'One link isn\'t research.' : a.researched ? `Research: ${a.researched}.` : 'Not answered.',
            ({ deep: 90, some: 65, none: 25 }[a.researched] || 40), 1.3);
        addParam(P, 'Discipline & Timing', 'Mood / retail-therapy',
            a.mood === 'no' ? 'pass' : a.mood === 'partly' ? 'warn' : a.mood === 'yes' ? 'fail' : 'info',
            a.mood === 'yes' ? 'Feelings first, cart second — walk before you buy.' : a.mood ? `Mood: ${a.mood}.` : 'Not answered.',
            ({ no: 90, partly: 50, yes: 20 }[a.mood] || 40), 1.5);
        addParam(P, 'Discipline & Timing', 'Past regret pattern',
            a.regretted_similar === 'no' ? 'pass' : a.regretted_similar === 'once' ? 'warn' : a.regretted_similar === 'often' ? 'fail' : 'info',
            a.regretted_similar ? `Regret history: ${a.regretted_similar}.` : 'Not answered.',
            ({ no: 85, once: 55, often: 20 }[a.regretted_similar] || 40), 1.2);
        addParam(P, 'Discipline & Timing', 'Urgency honesty',
            a.urgency === 'now' && nec < 4 ? 'warn' : a.urgency === 'never' || a.urgency === 'later' ? 'pass' : a.urgency ? 'info' : 'info',
            a.urgency ? `Urgency: ${a.urgency}.` : 'Not answered.',
            ({ now: 40, soon: 55, later: 80, never: 85 }[a.urgency] || 45), 1.0);
        addParam(P, 'Discipline & Timing', 'Secondhand / cheaper check',
            a.secondhand === 'yes' || a.secondhand === 'na' ? 'pass' : a.secondhand === 'no' ? 'warn' : 'info',
            a.secondhand === 'no' ? 'Worth a 10-minute cheaper-option scan.' : a.secondhand ? `Checked: ${a.secondhand}.` : 'Not answered.',
            ({ yes: 85, na: 70, no: 40 }[a.secondhand] || 45), 0.9);
        addParam(P, 'Discipline & Timing', 'Return safety net',
            a.return_policy === 'yes' ? 'pass' : a.return_policy === 'maybe' ? 'warn' : a.return_policy === 'no' ? 'warn' : 'info',
            a.return_policy ? `Returns: ${a.return_policy}.` : 'Not answered.',
            ({ yes: 80, maybe: 55, no: 35 }[a.return_policy] || 45), 0.7);

        // Practical fit
        addParam(P, 'Practical Fit', 'Space / setup ready',
            a.space === 'yes' ? 'pass' : a.space === 'maybe' ? 'warn' : a.space === 'no' ? 'fail' : 'info',
            a.space === 'no' ? 'Nowhere to put it = closet graveyard risk.' : a.space ? `Space: ${a.space}.` : 'Not answered.',
            ({ yes: 85, maybe: 50, no: 25 }[a.space] || 40), 0.9);
        addParam(P, 'Practical Fit', 'Maintenance burden',
            a.maintenance === 'none' ? 'pass' : a.maintenance === 'low' ? 'warn' : a.maintenance === 'high' ? 'fail' : 'info',
            a.maintenance ? `Maintenance: ${a.maintenance}.` : 'Not answered.',
            ({ none: 90, low: 65, high: 30 }[a.maintenance] || 40), 1.0);
        addParam(P, 'Practical Fit', 'Shared utility',
            a.shared_use === 'many' ? 'pass' : a.shared_use === 'gift' ? 'info' : a.shared_use ? 'warn' : 'info',
            a.shared_use ? `Shared use: ${a.shared_use}.` : 'Not answered.',
            ({ many: 85, gift: 60, one: 55 }[a.shared_use] || 40), 0.8);
        addParam(P, 'Practical Fit', 'Quality tier need',
            a.quality_need === 'yes' ? 'pass' : a.quality_need === 'maybe' ? 'warn' : a.quality_need === 'no' ? 'info' : 'info',
            a.quality_need === 'no' ? 'If any decent one works, hunt a cheaper pick.' : a.quality_need ? `Tier need: ${a.quality_need}.` : 'Not answered.',
            ({ yes: 80, maybe: 60, no: 45 }[a.quality_need] || 45), 0.9);

        // Product signals
        addParam(P, 'Product Signals', 'Price available', price > 0 ? 'pass' : 'fail', price > 0 ? `Analysis price ${fmt(price)}.` : 'No price.', price > 0 ? 90 : 5, 1.0);
        addParam(P, 'Product Signals', 'Customer rating', rating == null ? 'info' : rating >= 4.2 ? 'pass' : rating >= 3.5 ? 'warn' : 'fail',
            rating == null ? 'No rating found.' : `${rating.toFixed(1)} / 5.`, rating == null ? 50 : clamp((rating / 5) * 100), 1.2);
        addParam(P, 'Product Signals', 'Review volume', reviews == null ? 'info' : reviews >= 200 ? 'pass' : reviews >= 30 ? 'warn' : 'fail',
            reviews == null ? 'Review count unknown.' : `${reviews.toLocaleString('en-IN')} reviews.`,
            reviews == null ? 50 : clamp(Math.log10(reviews + 1) * 28), 1.0);
        addParam(P, 'Product Signals', 'Page sentiment', sentiment >= 65 ? 'pass' : sentiment >= 45 ? 'warn' : 'fail',
            (product.sentiment && product.sentiment.summary) || 'Sentiment unavailable.', sentiment, 0.9);
        addParam(P, 'Product Signals', 'Marketplace familiarity',
            /amazon\.|flipkart\.|myntra\.|croma\.|apple\.|samsung\./i.test(product.host || '') ? 'pass' : 'warn',
            `Host: ${product.host || 'unknown'}.`, /amazon\.|flipkart\.|myntra\.|croma\.|apple\.|samsung\./i.test(product.host || '') ? 80 : 50, 0.7);

        // Expanded audit rows for depth
        const extras = [
            ['Extended Audit', 'Answers completeness', PRODUCT_QUESTIONS.filter(q => q.type !== 'text').every(q => a[q.id]), 'All core questions answered.'],
            ['Extended Audit', 'Notes provided', !!(a.notes && a.notes.length > 8), 'Extra context sharpens advice.'],
            ['Extended Audit', 'Tool not toy', ['career', 'health', 'time', 'replace'].includes(a.value_add), 'Utility framing.'],
            ['Extended Audit', 'Not FOMO urgency', !(a.urgency === 'now' && nec <= 2), 'Urgency matches need.'],
            ['Extended Audit', 'Cooling-off friendly', impulse <= 3 && a.mood !== 'yes', 'Emotional temperature OK.'],
            ['Extended Audit', 'Affordable joy exception', a.life_beyond === 'yes' && a.can_afford === 'easy' && joy >= 4, 'Strict saver + affordable joy.'],
            ['Extended Audit', 'High necessity override', nec >= 5 && work >= 4, 'Critical functional need.'],
            ['Extended Audit', 'Upgrade tax avoided', a.already_own !== 'yes' || a.value_add === 'replace', 'Not stacking duplicates.'],
            ['Extended Audit', 'Subscription trap check', a.maintenance !== 'high', 'Recurring costs controlled.'],
            ['Extended Audit', 'Presence over possession', future >= 3 && waste <= 3, 'Likely to be used, not displayed.'],
            ['Extended Audit', 'Sale pressure resistance', !(a.notes && /sale|deal|ends|limited/i.test(a.notes)) || nec >= 4, 'Sales expire; regret doesn\'t.'],
            ['Extended Audit', 'Friend-hype verified', !(a.notes && /friend|bro|recommended/i.test(a.notes)) || a.researched !== 'none', 'Verify hype.'],
            ['Extended Audit', 'One-in one-out', a.already_own !== 'yes' || a.value_add === 'replace', 'Replace rather than pile.'],
            ['Extended Audit', 'Earn-then-own spirit', a.save_first === 'yes' || a.can_afford === 'easy', 'Own without hangover.'],
            ['Extended Audit', 'Long-game asset', a.lifespan === 'years' && usageMap[a.usage_freq] >= 70, 'Durable daily driver.']
        ];
        extras.forEach(([cat, label, good, detail]) => {
            addParam(P, cat, label, good ? 'pass' : 'warn', detail, good ? 85 : 42, 0.6);
        });

        // Pad with practical checklist marks (answer-derived, not ledger)
        const more = [
            'Repairability mindset', 'Accessory cost awareness', 'Learning curve patience',
            'Compatibility with what you own', 'Warranty length care', 'Service network nearby',
            'Counterfeit caution', 'Delivery cash planning', 'Unboxing-to-value speed',
            'Habit formation likelihood', 'Attention distraction risk', 'Focus impact on studies/work',
            'Resale value later', 'Environmental footprint thought', 'Gift vs personal utility',
            'Comparison paralysis avoided', 'Written pros list mentally', 'Written cons list mentally',
            '24h cool-off willingness', '7-day delay experiment', 'Ask a trusted person',
            'Total cost of ownership', 'Power / data extras', 'Packaging clutter',
            'Storage plan exists', 'Time to set it up', 'Skill to use it fully',
            'Replaces rented/borrowed tool', 'Stops a recurring workaround', 'Quiet luxury vs loud flex',
            'Night-time cart caution', 'Payday bounce caution', 'Festival FOMO caution',
            'Influencer pull resistance', 'Unbox therapy urge check', 'Collection completion urge',
            'Minimalism compatibility', 'Travel usefulness', 'Home usefulness',
            'Emergency usefulness', 'Seasonal usefulness', 'Daily carry usefulness',
            'Battery / consumable realism', 'Software lock-in risk', 'Privacy tradeoff awareness',
            'Support chat fatigue risk', 'Setup frustration tolerance', 'Post-purchase review plan'
        ];
        more.forEach((label, i) => {
            const base = clamp(
                55
                + (nec - 3) * 5
                + (3 - impulse) * 4
                + (future - 3) * 4
                + (joy - 3) * 2
                + (a.can_afford === 'easy' ? 8 : a.can_afford === 'no' ? -12 : 0)
                + (rating ? (rating - 3.5) * 6 : 0)
                + ((i % 5) - 2) * 2
            );
            addParam(P, 'Deep Checklist', label, base >= 70 ? 'pass' : base >= 45 ? 'warn' : 'fail',
                `Marked from your answers + product signals (#${i + 1}).`, base, 0.35);
        });

        return P;
    }

    function buildLifeParameters(a, price, meta) {
        const P = [];
        const heart = num(a.heart_pull);
        const memory = num(a.memory_value);
        const waste = num(a.waste_feel);
        const values = num(a.values);
        const affordMap = { easy: 92, ok: 70, tight: 38, no: 12 };

        addParam(P, 'Money & Sanity', 'Afford without anxiety',
            a.can_afford === 'easy' || a.can_afford === 'ok' ? 'pass' : a.can_afford === 'tight' ? 'warn' : a.can_afford ? 'fail' : 'info',
            a.can_afford ? `Money feel: ${a.can_afford}.` : 'Not answered.',
            affordMap[a.can_afford] || 40, 1.8);
        addParam(P, 'Money & Sanity', 'Cost scale for this moment',
            price <= 200 ? 'pass' : price <= 800 ? 'pass' : price <= 3000 ? 'warn' : 'info',
            `${fmt(price)} for a ${meta.type} moment.`,
            price <= 200 ? 88 : price <= 800 ? 75 : price <= 3000 ? 55 : 40, 1.0);
        addParam(P, 'Money & Sanity', 'Recent treat pattern',
            a.recent_treats === 'long' ? 'pass' : a.recent_treats === 'week' ? 'warn' : a.recent_treats ? 'fail' : 'info',
            a.recent_treats === 'streak' ? 'Streak mode — joy can become numbness.' : a.recent_treats ? `Recent: ${a.recent_treats}.` : 'Not answered.',
            ({ long: 90, week: 55, yesterday: 30, streak: 15 }[a.recent_treats] || 45), 1.4);
        addParam(P, 'Money & Sanity', 'Gut waste feeling', waste <= 2 ? 'pass' : waste === 3 ? 'warn' : waste ? 'fail' : 'info',
            waste ? `Waste feel ${waste}/5.` : 'Not answered.', waste ? clamp(110 - waste * 18) : 45, 1.5);
        addParam(P, 'Money & Sanity', 'Protecting a bigger priority',
            a.swap === 'no' ? 'pass' : a.swap === 'maybe' ? 'warn' : a.swap === 'yes' ? 'fail' : 'info',
            a.swap === 'yes' ? 'If something matters more, guard that money.' : a.swap ? `Swap check: ${a.swap}.` : 'Not answered.',
            ({ no: 85, maybe: 55, yes: 25 }[a.swap] || 45), 1.2);

        addParam(P, 'Heart & Meaning', 'Heart pull', heart >= 4 ? 'pass' : heart === 3 ? 'warn' : heart ? 'info' : 'info',
            heart >= 4 ? 'Strong heart signals count — humans aren\'t machines.' : heart ? `Heart ${heart}/5.` : 'Not answered.',
            heart ? 35 + heart * 13 : 45, 1.5);
        addParam(P, 'Heart & Meaning', 'Memory potential', memory >= 4 ? 'pass' : memory === 3 ? 'warn' : memory ? 'info' : 'info',
            memory >= 4 ? 'Memories often outlive the receipt.' : memory ? `Memory ${memory}/5.` : 'Not answered.',
            memory ? 35 + memory * 13 : 45, 1.5);
        addParam(P, 'Heart & Meaning', 'Why now',
            ['joy', 'rest', 'social', 'memory'].includes(a.why_now) ? 'pass' : a.why_now === 'convenience' ? 'warn' : a.why_now === 'fomo' ? 'fail' : 'info',
            a.why_now ? `Motive: ${a.why_now}.` : 'Not answered.',
            ({ joy: 80, rest: 85, social: 82, memory: 88, convenience: 50, fomo: 20 }[a.why_now] || 40), 1.4);
        addParam(P, 'Heart & Meaning', 'Connection',
            a.connection === 'yes' ? 'pass' : a.connection === 'solo' ? 'info' : a.connection === 'no' ? 'warn' : 'info',
            a.connection === 'yes' ? 'Shared moments are often worth more than things.' : a.connection ? `Connection: ${a.connection}.` : 'Not answered.',
            ({ yes: 88, solo: 65, no: 45 }[a.connection] || 50), 1.2);
        addParam(P, 'Heart & Meaning', 'Values fit', values >= 4 ? 'pass' : values === 3 ? 'warn' : values ? 'fail' : 'info',
            values ? `Values ${values}/5.` : 'Not answered.', values ? values * 20 : 40, 1.4);
        addParam(P, 'Heart & Meaning', 'Self-kindness balance',
            a.self_kindness === 'yes' && a.can_afford !== 'no' && waste <= 3 ? 'pass' :
                a.self_kindness === 'loose' && a.recent_treats !== 'long' ? 'warn' : a.self_kindness ? 'info' : 'info',
            a.self_kindness === 'yes' ? 'You\'ve been strict — a small intentional joy can be medicine.' :
                a.self_kindness === 'loose' ? 'You\'ve been free with spends — choose more deliberately tonight.' :
                    a.self_kindness ? 'Balanced self-kindness.' : 'Not answered.',
            a.self_kindness === 'yes' ? 80 : a.self_kindness === 'balanced' ? 72 : a.self_kindness === 'loose' ? 42 : 50, 1.3);
        addParam(P, 'Heart & Meaning', 'Gratitude baseline',
            a.gratitude === 'yes' ? 'pass' : a.gratitude === 'hard' ? 'warn' : a.gratitude === 'no' ? 'warn' : 'info',
            a.gratitude === 'no' ? 'If you feel empty, spending alone rarely fills it — but gentle comfort can help.' :
                a.gratitude ? `Gratitude: ${a.gratitude}.` : 'Not answered.',
            ({ yes: 80, hard: 55, no: 45 }[a.gratitude] || 50), 0.9);

        addParam(P, 'Body & Tomorrow', 'Energy / care need',
            a.body_energy === 'drained' && ['rest', 'selfcare', 'treat', 'food'].includes(meta.type) ? 'pass' :
                a.body_energy === 'drained' ? 'warn' : a.body_energy ? 'pass' : 'info',
            a.body_energy === 'drained' ? 'Drained bodies deserve care — pick the kindest option, not the loudest.' :
                a.body_energy ? `Energy: ${a.body_energy}.` : 'Not answered.',
            a.body_energy === 'drained' ? 75 : a.body_energy === 'ok' ? 70 : a.body_energy === 'high' ? 65 : 50, 1.1);
        addParam(P, 'Body & Tomorrow', 'Emotional weather',
            a.emotional_state === 'calm' || a.emotional_state === 'happy' ? 'pass' :
                a.emotional_state === 'low' && price > 1500 ? 'warn' : a.emotional_state ? 'info' : 'info',
            a.emotional_state === 'low' ? 'When low, prefer small comforts over big escapes.' :
                a.emotional_state ? `Mood: ${a.emotional_state}.` : 'Not answered.',
            ({ calm: 85, happy: 80, flat: 55, low: 50 }[a.emotional_state] || 50), 1.2);
        addParam(P, 'Body & Tomorrow', 'Health / tomorrow impact',
            a.health === 'good' ? 'pass' : a.health === 'mild' ? 'warn' : a.health === 'bad' ? 'fail' : 'info',
            a.health === 'bad' ? 'Tomorrow-you is also you.' : a.health ? `Health: ${a.health}.` : 'Not answered.',
            ({ good: 88, mild: 55, bad: 20 }[a.health] || 45), 1.3);
        addParam(P, 'Body & Tomorrow', 'Tomorrow morning feeling',
            a.tomorrow_feel === 'glad' ? 'pass' : a.tomorrow_feel === 'fine' ? 'info' : a.tomorrow_feel === 'meh' ? 'warn' : a.tomorrow_feel === 'regret' ? 'fail' : 'info',
            a.tomorrow_feel ? `Tomorrow feel: ${a.tomorrow_feel}.` : 'Not answered.',
            ({ glad: 90, fine: 65, meh: 40, regret: 15 }[a.tomorrow_feel] || 45), 1.6);

        addParam(P, 'Choice Quality', 'True want vs pressure',
            a.obligation === 'want' ? 'pass' : a.obligation === 'mix' ? 'warn' : a.obligation === 'pressure' ? 'fail' : 'info',
            a.obligation === 'pressure' ? 'Pressure purchases rarely feel like freedom.' : a.obligation ? `Drive: ${a.obligation}.` : 'Not answered.',
            ({ want: 88, mix: 55, pressure: 20 }[a.obligation] || 45), 1.4);
        addParam(P, 'Choice Quality', 'Rarity / window',
            a.scarcity === 'rare' ? 'pass' : a.scarcity === 'sometime' ? 'info' : a.scarcity === 'anytime' ? 'warn' : 'info',
            a.scarcity === 'rare' ? 'Rare windows can justify a yes.' : a.scarcity === 'anytime' ? 'This can wait — no scarcity tax.' : a.scarcity ? `Window: ${a.scarcity}.` : 'Not answered.',
            ({ rare: 85, sometime: 60, anytime: 40 }[a.scarcity] || 50), 1.2);
        addParam(P, 'Choice Quality', 'Cheaper 80% alternative',
            a.alternative === 'no' ? 'pass' : a.alternative === 'partial' ? 'warn' : a.alternative === 'yes' ? 'warn' : 'info',
            a.alternative === 'yes' ? 'If a cheaper path gets most of the feeling, consider it — unless memory/people tip the scale.' :
                a.alternative ? `Alternative: ${a.alternative}.` : 'Not answered.',
            ({ no: 80, partial: 55, yes: 40 }[a.alternative] || 50), 1.1);
        addParam(P, 'Choice Quality', 'Home option tonight',
            a.home_option === 'no' ? 'pass' : a.home_option === 'somewhat' ? 'warn' : a.home_option === 'yes' ? 'info' : 'info',
            a.home_option === 'yes' ? 'Home can be lovely too — not always a downgrade.' : a.home_option ? `Home option: ${a.home_option}.` : 'Not answered.',
            ({ no: 75, somewhat: 55, yes: 50 }[a.home_option] || 50), 0.9);
        addParam(P, 'Choice Quality', 'Presence / savoring',
            a.presence === 'yes' ? 'pass' : a.presence === 'maybe' ? 'warn' : a.presence === 'no' ? 'fail' : 'info',
            a.presence === 'no' ? 'If you won\'t be present, you\'re paying for a prop.' : a.presence ? `Presence: ${a.presence}.` : 'Not answered.',
            ({ yes: 90, maybe: 55, no: 25 }[a.presence] || 45), 1.3);
        addParam(P, 'Choice Quality', 'Company quality',
            a.company_quality === 'yes' || a.company_quality === 'na' ? 'pass' : a.company_quality === 'mixed' ? 'warn' : a.company_quality === 'no' ? 'fail' : 'info',
            a.company_quality === 'no' ? 'Bad company makes expensive nights feel cheaper in the worst way.' : a.company_quality ? `Company: ${a.company_quality}.` : 'Not answered.',
            ({ yes: 85, na: 70, mixed: 50, no: 20 }[a.company_quality] || 50), 1.0);
        addParam(P, 'Choice Quality', 'Habit loop check',
            a.habit_loop === 'no' ? 'pass' : a.habit_loop === 'forming' ? 'warn' : a.habit_loop === 'yes' ? 'fail' : 'info',
            a.habit_loop === 'yes' ? 'Autopilot spending steals both money and meaning.' : a.habit_loop ? `Habit: ${a.habit_loop}.` : 'Not answered.',
            ({ no: 88, forming: 50, yes: 22 }[a.habit_loop] || 45), 1.4);

        // Type-specific nudges
        const typeTips = {
            food: 'Food orders are fine — just not every drained evening by default.',
            treat: 'Tiny treats can be soul vitamins when intentional.',
            movie: 'Stories + shared laughter are classic life wealth.',
            travel: 'Travel is expensive and often worth it when present and rare.',
            vs: 'This-vs-that: pick the one with more memory and less leftover regret.',
            social: 'People time is usually the best ROI in life.',
            selfcare: 'Rest is productive. Numb scrolling is not the same as rest.',
            experience: 'Experiences beat most objects for lasting warmth.',
            other: 'Name the feeling you want — then see if this is the cleanest path.'
        };
        addParam(P, 'Moment Type', meta.typeLabel || meta.type,
            'info', typeTips[meta.type] || typeTips.other, 70, 0.5);
        if (meta.alt) {
            addParam(P, 'Moment Type', 'Named cheaper alternative', 'info',
                `You mentioned: ${meta.alt}. Weigh feeling kept vs money kept.`, 60, 0.7);
        }

        const lifeExtras = [
            ['Life Audit', 'Not only saving, also living', heart >= 3 && memory >= 3 && a.can_afford !== 'no', 'Joy + meaning present.'],
            ['Life Audit', 'Not only spending, also sense', waste <= 3 && a.habit_loop !== 'yes', 'Not mindless.'],
            ['Life Audit', 'Answers completeness', LIFE_QUESTIONS.filter(q => q.type !== 'text').every(q => a[q.id]), 'Full check-in done.'],
            ['Life Audit', 'Heart note shared', !!(a.notes && a.notes.length > 6), 'You opened up a bit.'],
            ['Life Audit', 'Small affordable comfort', price > 0 && price <= 300 && a.can_afford !== 'no' && heart >= 3, 'Small joy window.'],
            ['Life Audit', 'Big ticket needs bigger why', price < 3000 || memory >= 4 || a.scarcity === 'rare' || a.connection === 'yes', 'Cost matched by meaning.'],
            ['Life Audit', 'Rest without excess', a.why_now === 'rest' && price <= 1000, 'Gentle rest choice.'],
            ['Life Audit', 'Social gold', a.connection === 'yes' && a.company_quality === 'yes', 'Good people + shared plan.'],
            ['Life Audit', 'FOMO brake', a.why_now !== 'fomo' && a.obligation !== 'pressure', 'Free of fake urgency.'],
            ['Life Audit', 'Savor plan', a.presence === 'yes', 'You\'ll actually taste the moment.'],
            ['Life Audit', 'No hangover spend', a.tomorrow_feel === 'glad' || a.tomorrow_feel === 'fine', 'Tomorrow stays kind.'],
            ['Life Audit', 'Break-the-strictness mercy', a.self_kindness === 'yes' && a.recent_treats === 'long', 'Mercy treat after discipline.'],
            ['Life Audit', 'Stop-the-streak wisdom', a.recent_treats !== 'streak' && a.habit_loop !== 'yes', 'Not feeding a binge.'],
            ['Life Audit', 'Home dignity', a.home_option !== 'yes' || heart >= 4 || a.connection === 'yes', 'Leaving home has a reason.'],
            ['Life Audit', 'Body kindness', a.health !== 'bad', 'Body respected.']
        ];
        lifeExtras.forEach(([cat, label, good, detail]) => {
            addParam(P, cat, label, good ? 'pass' : 'warn', detail, good ? 86 : 40, 0.65);
        });

        const more = [
            'Phone-away for 20 minutes', 'Photo memories vs presence', 'Outfit stress unnecessary?',
            'Travel logistics energy', 'Queue / crowd tolerance', 'Weather / comfort fit',
            'Food guilt vs nourishment', 'Sugar crash honesty', 'Late-night order trap',
            'Weekend scarcity myth', 'Payday bounce myth', 'Group bill awkwardness',
            'Split-cost fairness', 'Gift economy reciprocity', 'Celebration legitimacy',
            'Grief comfort spending', 'Loneliness spending', 'Boredom spending',
            'Achievement reward sizing', 'Study-break proportionality', 'Workout reward loop',
            'Family expectation pressure', 'Partner expectation pressure', 'Friend flex pressure',
            'Instagram aftertaste', 'Story-post motive check', 'Silent joy validity',
            'Nature cheaper analog', 'Walk + tea analog', 'Cook-with-music analog',
            'Library / free event analog', 'Temple of rest at home', 'Call a friend instead',
            'Journal the urge 5 minutes', 'Drink water first', 'Sleep debt check',
            'Caffeine / hunger confusion', 'Decision fatigue evening', 'Morning clarity test',
            'Budget envelope mental', 'Weekly joy allowance idea', 'Monthly experience fund idea',
            'One yes one no rule', 'Savor slower cheaper', 'Tip kindness included',
            'Leave no mess for future-you', 'Transit safety', 'Return-home energy'
        ];
        more.forEach((label, i) => {
            const base = clamp(
                58
                + (heart - 3) * 4
                + (memory - 3) * 4
                + (3 - waste) * 5
                + (a.can_afford === 'easy' ? 8 : a.can_afford === 'no' ? -14 : 0)
                + (a.tomorrow_feel === 'glad' ? 8 : a.tomorrow_feel === 'regret' ? -12 : 0)
                + ((i % 5) - 2) * 2
            );
            addParam(P, 'Wide Lens', label, base >= 70 ? 'pass' : base >= 45 ? 'warn' : 'fail',
                `Everyday wisdom mark #${i + 1}.`, base, 0.35);
        });

        return P;
    }

    function scoreReport(parameters) {
        let wSum = 0, sSum = 0, pass = 0, warn = 0, fail = 0, info = 0;
        parameters.forEach(p => {
            const w = p.weight || 1;
            wSum += w; sSum += p.score * w;
            if (p.status === 'pass') pass++;
            else if (p.status === 'warn') warn++;
            else if (p.status === 'fail') fail++;
            else info++;
        });
        return { overall: wSum > 0 ? Math.round(sSum / wSum) : 50, pass, warn, fail, info, total: parameters.length };
    }

    function lifeBalanceMeter(answers, price, overall, kind) {
        let meter = 50;
        const heart = num(answers.heart_pull || answers.joy_value);
        const future = num(answers.future_thanks || answers.memory_value);
        const waste = num(answers.waste_risk || answers.waste_feel);
        const nec = num(answers.necessity);

        if (answers.can_afford === 'easy') meter += 18;
        else if (answers.can_afford === 'ok') meter += 8;
        else if (answers.can_afford === 'tight') meter -= 12;
        else if (answers.can_afford === 'no') meter -= 28;

        if (answers.debt_risk === 'yes') meter -= 20;
        if (answers.mood === 'yes' || answers.why_now === 'fomo') meter -= 10;
        if (num(answers.impulse) >= 4) meter -= 8;
        if (answers.habit_loop === 'yes' || answers.recent_treats === 'streak' || answers.recent_buys === 'many') meter -= 12;

        // Life beyond saving — boost intentional joy when affordable
        if ((heart >= 4 || future >= 4) && answers.can_afford !== 'no' && answers.can_afford !== 'tight') meter += 10;
        if (answers.life_beyond === 'yes' || answers.self_kindness === 'yes') meter += 6;
        if (answers.connection === 'yes' && answers.company_quality === 'yes') meter += 8;
        if (answers.scarcity === 'rare') meter += 6;
        if (nec >= 4) meter += 8;
        if (waste >= 4) meter -= 10;
        if (answers.tomorrow_feel === 'glad') meter += 8;
        if (answers.tomorrow_feel === 'regret') meter -= 14;

        if (price > 5000 && answers.can_afford !== 'easy') meter -= 8;
        if (price <= 300 && kind === 'life' && answers.can_afford !== 'no') meter += 5;

        meter = clamp(meter * 0.65 + overall * 0.35);

        let band, icon, title, message;
        if (meter >= 70) {
            band = 'green'; icon = '✓'; title = kind === 'life' ? 'Yes — go live it' : 'You can buy';
            message = kind === 'life'
                ? 'This looks like intentional living, not waste. If your heart and tomorrow-you agree, say yes and savor it.'
                : 'Numbers and answers look healthy enough. If the use-case is real, green light — buy with a clear head.';
        } else if (meter >= 40) {
            band = 'yellow'; icon = '!'; title = kind === 'life' ? 'Maybe — choose consciously' : 'Risk — but you can spend';
            message = kind === 'life'
                ? 'Possible, but not automatic. Shrink it, postpone it, or keep it only if meaning is high.'
                : 'You might manage it, but it stretches you. Prefer waiting, saving a chunk, or a cheaper tier.';
        } else {
            band = 'red'; icon = '✕'; title = kind === 'life' ? 'Not this — care differently' : "Don't buy right now";
            message = kind === 'life'
                ? 'This leans wasteful or heavy. Care for yourself in a gentler, cheaper way tonight.'
                : 'This fights your comfort zone. Wait, save, or find another path.';
        }
        return { meter, band, icon, title, message };
    }

    function buildProductVerdict(overall, meter, answers, price, product) {
        const nec = num(answers.necessity);
        const joy = num(answers.joy_value);
        let action;
        if (meter.band === 'green' && overall >= 65) action = 'BUY NOW';
        else if (meter.band === 'green') action = 'BUY — WITH EYES OPEN';
        else if (meter.band === 'yellow' && nec >= 4) action = 'BUY ONLY IF CRITICAL — ELSE WAIT';
        else if (meter.band === 'yellow' && joy >= 4 && answers.can_afford === 'easy' && answers.life_beyond === 'yes') action = 'SMALL YES — OR WAIT ONE NIGHT';
        else if (meter.band === 'yellow') action = 'WAIT & SAVE';
        else if (nec >= 5) action = 'LAST RESORT — MINIMIZE COST';
        else action = 'DO NOT BUY YET';

        const pros = [];
        const cons = [];
        if (nec >= 4) pros.push('You rated this as genuinely necessary.');
        if (num(answers.work_impact) >= 4) pros.push('Work/study is actually hampered without it.');
        if (answers.usage_freq === 'daily' || answers.usage_freq === 'weekly') pros.push('You expect frequent real use.');
        if (answers.lifespan === 'years') pros.push('Long useful life improves value.');
        if (answers.researched === 'deep') pros.push('You researched properly.');
        if (answers.can_afford === 'easy') pros.push('You can afford it without stress.');
        if (joy >= 4 && answers.life_beyond === 'yes') pros.push('You\'ve been strict — thoughtful joy has a place.');
        if (product.rating && product.rating >= 4.2) pros.push(`Solid rating (${product.rating.toFixed(1)}★).`);

        if (answers.can_afford === 'no' || answers.can_afford === 'tight') cons.push('Money comfort is low for this price.');
        if (num(answers.impulse) >= 4) cons.push('Impulse is high.');
        if (answers.mood === 'yes') cons.push('Mood-driven buying detected.');
        if (answers.already_own === 'yes') cons.push('You already own something similar.');
        if (answers.usage_freq === 'rarely') cons.push('Rare usage makes cost-per-use ugly.');
        if (answers.debt_risk === 'yes') cons.push('Would create or worsen debt.');
        if (answers.save_first === 'yes') cons.push('Even you admit you could wait and save.');
        if (num(answers.waste_risk) >= 4) cons.push('High chance of unused clutter.');

        const brother = [
            `Alright — I looked at the product and your honest answers. (Financial Ledger stays out of this — we keep that separate.)`,
            `Price on the table: ${fmt(price)}.`,
            meter.band === 'green'
                ? `Life-balance meter ${meter.meter}/100 — green. Cash comfort and purpose are aligned enough.`
                : meter.band === 'yellow'
                    ? `Life-balance meter ${meter.meter}/100 — yellow. Affordable-ish, but not a free pass.`
                    : `Life-balance meter ${meter.meter}/100 — red. I'd stop your hand on the buy button.`,
            `Judgment score: ${overall}/100 across the full marked audit.`,
            action.includes('WAIT') || action.includes('DO NOT')
                ? `My call: ${action}. Saving ${fmt(Math.ceil(price / 4))}/week is a calm path if you still want it.`
                : `My call: ${action}. If you proceed, stay present with why you bought it — not just the unboxing hit.`,
            `Remember: saving money matters, and so does a life that feels alive. The win is avoiding waste — not avoiding joy.`,
            answers.notes ? `You also told me: “${answers.notes}”. I weighed that.` : `Next time, add a note — context makes me sharper.`
        ];
        return { action, pros, cons, brother };
    }

    function buildLifeVerdict(overall, meter, answers, price, meta) {
        const heart = num(answers.heart_pull);
        const memory = num(answers.memory_value);
        let action;
        if (meter.band === 'green' && overall >= 65) action = 'YES — DO IT & SAVOR IT';
        else if (meter.band === 'green') action = 'YES — KEEP IT INTENTIONAL';
        else if (meter.band === 'yellow' && (memory >= 4 || answers.scarcity === 'rare' || answers.connection === 'yes')) action = 'YES IF MEANING IS HIGH — ELSE SHRINK IT';
        else if (meter.band === 'yellow') action = 'PAUSE — OR CHOOSE A LIGHTER VERSION';
        else if (answers.self_kindness === 'yes' && price <= 300 && answers.can_afford !== 'no') action = 'TINY MERCY TREAT OK — KEEP IT SMALL';
        else action = 'SKIP — CARE FOR YOURSELF ANOTHER WAY';

        const pros = [];
        const cons = [];
        if (heart >= 4) pros.push('Your heart genuinely wants this.');
        if (memory >= 4) pros.push('Strong memory potential.');
        if (answers.connection === 'yes') pros.push('It deepens a real human connection.');
        if (answers.scarcity === 'rare') pros.push('Rare window — timing matters.');
        if (answers.can_afford === 'easy') pros.push('No money anxiety attached.');
        if (answers.self_kindness === 'yes' && answers.recent_treats === 'long') pros.push('You\'ve been disciplined — a mindful yes can be healthy.');
        if (answers.presence === 'yes') pros.push('You plan to actually be present.');
        if (answers.tomorrow_feel === 'glad') pros.push('You expect to feel glad tomorrow.');

        if (answers.can_afford === 'no' || answers.can_afford === 'tight') cons.push('Money anxiety would tag along.');
        if (answers.why_now === 'fomo') cons.push('FOMO is driving this.');
        if (answers.habit_loop === 'yes' || answers.recent_treats === 'streak') cons.push('This feeds a spend streak / autopilot habit.');
        if (num(answers.waste_feel) >= 4) cons.push('Your gut already calls it wasteful.');
        if (answers.tomorrow_feel === 'regret') cons.push('You already predict regret.');
        if (answers.obligation === 'pressure') cons.push('Pressure, not desire.');
        if (answers.presence === 'no') cons.push('You probably won\'t even savor it.');
        if (answers.health === 'bad') cons.push('Tomorrow\'s body pays interest.');

        const brother = [
            `Hey — this isn't only about being cheap. It's about spending like someone who wants both a future and a present.`,
            `You're asking about: ${meta.title} (${fmt(price)}${meta.alt ? ` · alt: ${meta.alt}` : ''}).`,
            meter.band === 'green'
                ? `Life-balance meter ${meter.meter}/100 — green. This can be living, not leaking.`
                : meter.band === 'yellow'
                    ? `Life-balance meter ${meter.meter}/100 — yellow. Maybe — but make it conscious.`
                    : `Life-balance meter ${meter.meter}/100 — red. Care for the need underneath, not only the cart.`,
            `Judgment score: ${overall}/100 with every parameter marked.`,
            `My call: ${action}.`,
            answers.why_now === 'rest' || answers.body_energy === 'drained'
                ? `If you're tired: rest is allowed. Ordering out / a small treat can be kindness — just don't let autopilot own you.`
                : `Joy is allowed. Waste is optional. Choose the one that leaves you proud tomorrow.`,
            answers.notes ? `I heard you: “${answers.notes}”.` : `If you tell me more next time, I'll advise even closer to your heart.`
        ];
        return { action, pros, cons, brother };
    }

    function statusIcon(st) {
        return { pass: '✓', warn: '!', fail: '✕', info: '•' }[st] || '•';
    }

    function groupByCategory(parameters) {
        const map = {};
        parameters.forEach(p => {
            if (!map[p.category]) map[p.category] = [];
            map[p.category].push(p);
        });
        return map;
    }

    function renderReport(report) {
        const root = document.getElementById('buy-report');
        if (!root) return;
        root.classList.remove('hidden');
        root.innerHTML = '';

        const { kind, subject, price, meter, stats, verdict, parameters } = report;

        const hero = Utils.el('div', { className: `buy-report-hero buy-band-${meter.band}` });
        hero.appendChild(Utils.el('div', { className: 'buy-verdict-kicker', textContent: kind === 'life' ? 'Heart + Head Verdict' : 'Big Brother Verdict' }));
        hero.appendChild(Utils.el('h3', { className: 'buy-verdict-action', textContent: verdict.action }));
        hero.appendChild(Utils.el('p', { className: 'buy-verdict-sub', textContent: meter.title + ' — ' + meter.message }));

        const meterWrap = Utils.el('div', { className: 'buy-meter-wrap' });
        const meterRing = Utils.el('div', { className: `buy-meter buy-meter-${meter.band}` });
        meterRing.appendChild(Utils.el('div', { className: 'buy-meter-icon', textContent: meter.icon }));
        meterRing.appendChild(Utils.el('div', { className: 'buy-meter-number', textContent: String(meter.meter) }));
        meterRing.appendChild(Utils.el('div', { className: 'buy-meter-label', textContent: 'Life balance' }));
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

        // Subject card
        const prod = Utils.el('div', { className: 'glass-card buy-product-card' });
        prod.appendChild(Utils.el('h4', { className: 'card-title', textContent: kind === 'life' ? 'Moment under review' : 'Product under review' }));
        const prodRow = Utils.el('div', { className: 'buy-product-row' });
        if (subject.image) {
            prodRow.appendChild(Utils.el('img', { className: 'buy-product-img', src: subject.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
        }
        const prodInfo = Utils.el('div', { className: 'buy-product-info' });
        prodInfo.appendChild(Utils.el('div', { className: 'buy-product-title', textContent: subject.title || 'Untitled' }));
        prodInfo.appendChild(Utils.el('div', { className: 'buy-product-meta', textContent:
            `${fmt(price)}` +
            (subject.host ? ` · ${subject.host}` : '') +
            (subject.typeLabel ? ` · ${subject.typeLabel}` : '') +
            (subject.rating != null ? ` · ${Number(subject.rating).toFixed(1)}★` : '') +
            (subject.alt ? ` · alt: ${subject.alt}` : '')
        }));
        if (subject.description) {
            prodInfo.appendChild(Utils.el('p', { className: 'buy-product-desc', textContent: String(subject.description).slice(0, 220) }));
        }
        if (subject.url) {
            prodInfo.appendChild(Utils.el('a', { href: subject.url, target: '_blank', rel: 'noopener noreferrer', className: 'buy-product-link', textContent: 'Open link →' }));
        }
        prodRow.appendChild(prodInfo);
        prod.appendChild(prodRow);
        root.appendChild(prod);

        const letter = Utils.el('div', { className: 'glass-card buy-brother-card' });
        letter.appendChild(Utils.el('h4', { className: 'card-title', textContent: kind === 'life' ? 'Straight talk (with heart)' : 'Straight talk' }));
        verdict.brother.forEach(line => letter.appendChild(Utils.el('p', { className: 'buy-brother-line', textContent: line })));
        root.appendChild(letter);

        const pc = Utils.el('div', { className: 'buy-proscons' });
        const prosC = Utils.el('div', { className: 'glass-card buy-pros' });
        prosC.appendChild(Utils.el('h4', { className: 'card-title', textContent: 'Pros' }));
        (verdict.pros.length ? verdict.pros : ['No strong pros stood out — that itself is a signal.']).forEach(t => {
            prosC.appendChild(Utils.el('div', { className: 'buy-pc-item', textContent: '✓ ' + t }));
        });
        const consC = Utils.el('div', { className: 'glass-card buy-cons' });
        consC.appendChild(Utils.el('h4', { className: 'card-title', textContent: 'Cons' }));
        (verdict.cons.length ? verdict.cons : ['No major red flags — still read the full audit.']).forEach(t => {
            consC.appendChild(Utils.el('div', { className: 'buy-pc-item', textContent: '✕ ' + t }));
        });
        pc.appendChild(prosC); pc.appendChild(consC);
        root.appendChild(pc);

        const audit = Utils.el('div', { className: 'glass-card buy-audit-card' });
        audit.appendChild(Utils.el('h4', { className: 'card-title', textContent: `Full parameter audit (${stats.total})` }));
        audit.appendChild(Utils.el('p', { className: 'buy-audit-intro', textContent: 'Every point is marked. Green pass, yellow risk, red fail. Built from your answers' + (kind === 'product' ? ' + product signals' : ' + life context') + ' — not the Financial Ledger.' }));

        const grouped = groupByCategory(parameters);
        Object.keys(grouped).forEach(cat => {
            const block = Utils.el('div', { className: 'buy-audit-cat' });
            const catParams = grouped[cat];
            const catAvg = Math.round(catParams.reduce((s, p) => s + p.score, 0) / catParams.length);
            const head = Utils.el('button', { className: 'buy-audit-cat-head', type: 'button' });
            head.appendChild(Utils.el('span', { textContent: cat }));
            head.appendChild(Utils.el('span', { className: 'buy-audit-cat-score', textContent: `${catAvg} · ${catParams.length} pts` }));
            const body = Utils.el('div', { className: 'buy-audit-cat-body open' });
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
            block.appendChild(head);
            block.appendChild(body);
            audit.appendChild(block);
        });
        root.appendChild(audit);

        const actions = Utils.el('div', { className: 'buy-report-actions' });
        const saveBtn = Utils.el('button', { className: 'btn-primary', type: 'button', textContent: '💾 Save this verdict' });
        saveBtn.addEventListener('click', () => saveDecision(report));
        const againBtn = Utils.el('button', { className: 'btn-secondary', type: 'button', textContent: '↺ New analysis' });
        againBtn.addEventListener('click', () => {
            root.classList.add('hidden');
            root.innerHTML = '';
            const target = kind === 'life' ? 'life-input-section' : 'buy-input-section';
            document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
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
            kind: report.kind || 'product',
            title: report.subject.title || 'Decision',
            url: report.subject.url || '',
            host: report.subject.host || '',
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
                Utils.el('strong', { textContent: `${rec.kind === 'life' ? '🌙 ' : '🛒 '}${rec.title || 'Decision'}` }),
                Utils.el('span', { className: 'buy-history-meter', textContent: `${rec.meter ?? '—'}` })
            ));
            card.appendChild(Utils.el('div', { className: 'buy-history-meta', textContent:
                `${fmt(rec.price || 0)} · ${rec.action || ''} · ${rec.date || ''}`
            }));
            const del = Utils.el('button', { className: 'buy-history-del', type: 'button', textContent: 'Delete' });
            del.addEventListener('click', async () => {
                await ThriveDB.remove('buyDecisions', rec.id);
                Utils.toast('Removed', 'warning');
                renderHistory();
            });
            card.appendChild(del);
            box.appendChild(card);
        });
    }

    function titleFromUrl(url) {
        try {
            const u = new URL(url.startsWith('http') ? url : 'https://' + url);
            const path = decodeURIComponent(u.pathname || '');
            let m = path.match(/\/([^/]{5,})\/dp\/[A-Z0-9]{8,}/i);
            if (m) return m[1].replace(/-/g, ' ').trim();
            m = path.match(/\/([^/]{5,})\/p\/[a-z0-9]+/i);
            if (m) return m[1].replace(/-/g, ' ').trim();
            const parts = path.split('/').filter(Boolean);
            const last = parts[parts.length - 1] || '';
            if (last.length > 4 && !/^[A-Z0-9]{8,}$/i.test(last)) {
                return last.replace(/[-_]/g, ' ').trim();
            }
            return u.hostname.replace(/^www\./, '');
        } catch (_) {
            return 'Product';
        }
    }

    function isJunkTitle(title) {
        if (!title) return true;
        const t = title.trim().toLowerCase();
        return !t || t.length < 3
            || ['amazon.in', 'amazon.com', 'page not found', 'flipkart', 'error', 'site maintenance'].includes(t)
            || t.includes('service unavailable') || t.includes('access denied') || t.startsWith('buy products online');
    }

    async function fetchMicrolinkClient(url) {
        const endpoint = 'https://api.microlink.io?url=' + encodeURIComponent(url);
        const res = await fetch(endpoint);
        const data = await res.json().catch(() => ({}));
        if (data.status !== 'success' || !data.data) return null;
        const d = data.data;
        const image = (d.image && (d.image.url || d.image)) || '';
        return {
            ok: true,
            url: d.url || url,
            host: (() => { try { return new URL(d.url || url).hostname.replace(/^www\./, ''); } catch (_) { return ''; } })(),
            title: d.title || '',
            description: d.description || '',
            image: typeof image === 'string' ? image : '',
            price: null,
            currency: 'INR',
            rating: null,
            review_count: null,
            brand: d.publisher || '',
            availability: '',
            sentiment: { score: 55, summary: 'Loaded via browser metadata fallback.' },
            sources: ['microlink-client'],
            partial: true,
            note: 'Loaded via browser fallback. Confirm price before analyzing.'
        };
    }

    function mergeProductData(primary, fallback, url) {
        const base = primary && primary.ok ? primary : (fallback && fallback.ok ? fallback : null);
        const other = base === primary ? fallback : primary;
        const out = Object.assign({
            ok: true, url, host: '', title: '', description: '', image: '',
            price: null, currency: 'INR', rating: null, review_count: null, brand: '',
            availability: '', sentiment: { score: 55, summary: 'Best-effort product read.' },
            sources: [], partial: true, note: ''
        }, base || {});

        if (other && other.ok) {
            if (isJunkTitle(out.title) && !isJunkTitle(other.title)) out.title = other.title;
            if (!out.description && other.description) out.description = other.description;
            if (!out.image && other.image) out.image = other.image;
            if (out.price == null && other.price != null) out.price = other.price;
            if (out.rating == null && other.rating != null) out.rating = other.rating;
            if (out.review_count == null && other.review_count != null) out.review_count = other.review_count;
            if (!out.brand && other.brand) out.brand = other.brand;
            out.sources = Array.from(new Set([...(out.sources || []), ...(other.sources || [])]));
        }
        if (isJunkTitle(out.title)) out.title = titleFromUrl(url);
        if (!out.host) {
            try { out.host = new URL(out.url || url).hostname.replace(/^www\./, ''); } catch (_) {}
        }
        out.ok = true;
        return out;
    }

    async function fetchProduct(url) {
        let cleaned = (url || '').trim().split(/\s+/)[0].replace(/^<|>$/g, '');
        if (!/^https?:\/\//i.test(cleaned)) cleaned = 'https://' + cleaned;

        let serverErr = null;
        const serverP = fetch('/api/buy/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: cleaned })
        }).then(async res => {
            const data = await res.json().catch(() => ({}));
            if (data && data.ok) return data;
            throw new Error((data && data.error) || `Server returned ${res.status}`);
        }).catch(err => { serverErr = err; return null; });

        const clientP = fetchMicrolinkClient(cleaned).catch(() => null);
        const [serverData, clientData] = await Promise.all([serverP, clientP]);
        const merged = mergeProductData(serverData, clientData, cleaned);
        if (!serverData && !clientData) {
            return mergeProductData({
                ok: true, url: cleaned, title: titleFromUrl(cleaned),
                description: 'Could not read the store page (blocked). Enter price manually.',
                sources: ['url-heuristic'], partial: true,
                note: (serverErr && serverErr.message) ? serverErr.message : 'Store blocked automated reads.',
                sentiment: { score: 50, summary: 'No page content available.' }
            }, null, cleaned);
        }
        return merged;
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
        if (product.note) {
            info.appendChild(Utils.el('p', { className: 'buy-product-desc', textContent: product.note }));
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

    async function runProductAnalysis() {
        const url = (document.getElementById('buy-url')?.value || '').trim();
        const manualPrice = parseFloat(document.getElementById('buy-price')?.value || '');
        const manualTitle = (document.getElementById('buy-title')?.value || '').trim();
        const answers = collectAnswers('buy-questions', PRODUCT_QUESTIONS);

        const missing = PRODUCT_QUESTIONS.filter(q => q.type !== 'text' && !answers[q.id]);
        if (missing.length) {
            Utils.toast(`Answer all questions (${missing.length} left)`, 'warning');
            document.querySelector(`#buy-questions [data-qid="${missing[0].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                    brand: '', availability: '', sentiment: { score: 55, summary: 'Analyzed from your answers (no link).' }
                };
            }

            if (manualTitle) product.title = manualTitle;
            const price = !Number.isNaN(manualPrice) && manualPrice > 0 ? manualPrice : (product.price || 0);
            if (!price || price <= 0) {
                Utils.toast('Enter the product price', 'warning');
                document.getElementById('buy-price')?.focus();
                return;
            }

            const parameters = buildProductParameters(product, answers, price);
            const stats = scoreReport(parameters);
            const meter = lifeBalanceMeter(answers, price, stats.overall, 'product');
            const verdict = buildProductVerdict(stats.overall, meter, answers, price, product);
            const report = {
                kind: 'product',
                subject: product,
                price, answers, parameters, stats, meter, verdict
            };
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

    async function runLifeAnalysis() {
        const typeEl = document.getElementById('life-type');
        const type = typeEl ? typeEl.value : 'other';
        const typeLabel = typeEl && typeEl.selectedOptions[0] ? typeEl.selectedOptions[0].textContent : type;
        const title = (document.getElementById('life-title')?.value || '').trim();
        const price = parseFloat(document.getElementById('life-price')?.value || '');
        const alt = (document.getElementById('life-alt')?.value || '').trim();
        const answers = collectAnswers('life-questions', LIFE_QUESTIONS);

        if (!title) {
            Utils.toast('Describe the decision first', 'warning');
            document.getElementById('life-title')?.focus();
            return;
        }
        if (Number.isNaN(price) || price < 0) {
            Utils.toast('Enter the cost (0 is ok for free plans)', 'warning');
            document.getElementById('life-price')?.focus();
            return;
        }

        const missing = LIFE_QUESTIONS.filter(q => q.type !== 'text' && !answers[q.id]);
        if (missing.length) {
            Utils.toast(`Answer all questions (${missing.length} left)`, 'warning');
            document.querySelector(`#life-questions [data-qid="${missing[0].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const btn = document.getElementById('btn-life-analyze');
        if (btn) { btn.disabled = true; btn.textContent = 'Listening…'; }

        try {
            const meta = { type, typeLabel, title, alt };
            const parameters = buildLifeParameters(answers, price, meta);
            const stats = scoreReport(parameters);
            const meter = lifeBalanceMeter(answers, price, stats.overall, 'life');
            const verdict = buildLifeVerdict(stats.overall, meter, answers, price, meta);
            const report = {
                kind: 'life',
                subject: { title, typeLabel, alt, description: `Daily life decision · ${typeLabel}` },
                price, answers, parameters, stats, meter, verdict
            };
            _lastReport = report;
            renderReport(report);
            Utils.toast('Full report ready', 'success');
        } catch (err) {
            console.error('[BuyModule]', err);
            Utils.toast(err.message || 'Analysis failed', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '💛 Analyze — Should I do this?'; }
        }
    }

    function wireEvents() {
        document.querySelectorAll('.buy-mode-tab').forEach(tab => {
            tab.addEventListener('click', () => setMode(tab.dataset.buymode));
        });

        document.getElementById('btn-buy-fetch')?.addEventListener('click', async () => {
            const url = (document.getElementById('buy-url')?.value || '').trim();
            if (!url) { Utils.toast('Paste a product link first', 'warning'); return; }
            const btn = document.getElementById('btn-buy-fetch');
            if (btn) { btn.disabled = true; btn.textContent = 'Reading…'; }
            try {
                const product = await fetchProduct(url);
                applyProductToForm(product);
                Utils.toast(product.price != null ? 'Product details loaded' : 'Link read — enter/confirm the price', product.price != null ? 'success' : 'warning');
            } catch (e) {
                const fallback = mergeProductData({
                    ok: true, url, title: titleFromUrl(url),
                    description: 'Enter price manually to continue.',
                    partial: true, sources: ['url-heuristic'],
                    sentiment: { score: 50, summary: 'Manual entry mode.' }
                }, null, url);
                applyProductToForm(fallback);
                Utils.toast('Could not fully read store — title filled, enter price', 'warning');
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = '🔎 Read link'; }
            }
        });

        document.getElementById('btn-buy-analyze')?.addEventListener('click', () => runProductAnalysis());
        document.getElementById('btn-life-analyze')?.addEventListener('click', () => runLifeAnalysis());

        document.getElementById('buy-url')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('btn-buy-fetch')?.click();
            }
        });

        document.getElementById('nav-buy')?.addEventListener('click', () => {
            renderHistory();
        });
    }

    return { init };
})();
