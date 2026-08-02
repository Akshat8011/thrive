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
        { id: 'already_own', label: 'Own something similar already — and what happens to it?', type: 'choice', options: [
            { v: 'no', t: 'Nothing similar' }, { v: 'partial', t: 'Partial alternative' },
            { v: 'replace', t: 'Have one — will replace/retire it' }, { v: 'keep_both', t: 'Have one — would keep both' }
        ]},
        { id: 'usage_context', label: 'Where + how often will you mainly use it?', type: 'choice', options: [
            { v: 'work_daily', t: 'Work/study · daily' }, { v: 'home_daily', t: 'Home · daily' },
            { v: 'weekly', t: 'Weekly (any place)' }, { v: 'travel', t: 'Travel / occasional' },
            { v: 'rarely', t: 'Rare / one-off' }, { v: 'social_image', t: 'Mostly social / looks' }
        ]},
        { id: 'lifespan', label: 'Expected useful life?', type: 'choice', options: [
            { v: 'years', t: '3+ years' }, { v: 'year', t: 'About a year' }, { v: 'months', t: 'A few months' }, { v: 'once', t: 'One-time use' }
        ]},
        { id: 'urgency_timing', label: 'Urgency + when are you buying? (deadline × cart timing)', type: 'choice', options: [
            { v: 'need_now_clear', t: 'Need now · clear-headed daytime' }, { v: 'need_now_night', t: 'Need now · late night cart' },
            { v: 'soon_planned', t: 'Within a month · planned' }, { v: 'payday', t: 'Mostly because payday/sale hit' },
            { v: 'can_wait', t: 'Can wait 3+ months' }, { v: 'no_deadline', t: 'No real deadline' }
        ]},
        { id: 'impulse', label: 'How impulsive is this urge?', type: 'scale', min: 1, max: 5, hints: ['Fully planned', 'Mostly planned', 'Mixed', 'Mostly impulse', 'Pure FOMO'] },
        { id: 'research_influence', label: 'Research depth + what pulled you to THIS listing?', type: 'choice', options: [
            { v: 'deep_own', t: 'Deep research · my own shortlist' }, { v: 'some_own', t: 'Some compare · my choice' },
            { v: 'friend', t: 'Friend/family hype' }, { v: 'influencer', t: 'Influencer / ad pull' },
            { v: 'sale_only', t: 'Mostly sale countdown' }, { v: 'none', t: 'No compare · just this link' }
        ]},
        { id: 'value_add', label: 'Primary value this adds?', type: 'choice', options: [
            { v: 'career', t: 'Career / skills' }, { v: 'health', t: 'Health' }, { v: 'time', t: 'Saves time' },
            { v: 'joy', t: 'Joy / comfort' }, { v: 'status', t: 'Status / looks' }, { v: 'replace', t: 'Replaces broken item' }
        ]},
        { id: 'quality_need', label: 'Do you specifically need THIS quality/brand tier?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, cheaper ones fail me' }, { v: 'maybe', t: 'Maybe mid-range is fine' }, { v: 'no', t: 'Any decent one works' }
        ]},
        { id: 'money_source', label: 'Paying from what — and still keep emergency basics?', type: 'choice', options: [
            { v: 'saved_safe', t: 'Saved money · buffer stays' }, { v: 'saved_thin', t: 'Saved money · buffer gets thin' },
            { v: 'salary_planned', t: 'Upcoming salary · already planned' }, { v: 'stretch', t: 'Would stretch / juggle' },
            { v: 'borrow', t: 'Borrow / credit / owe someone' }
        ]},
        { id: 'can_afford', label: 'Stress level if you pay today?', type: 'choice', options: [
            { v: 'easy', t: 'Easily, no stress' }, { v: 'ok', t: 'Yes, but I\'ll feel it' }, { v: 'tight', t: 'It would stretch me' }, { v: 'no', t: 'Not really / would borrow' }
        ]},
        { id: 'opportunity_cost', label: 'If you skip this, what does the money protect?', type: 'choice', options: [
            { v: 'nothing', t: 'Nothing urgent waiting' }, { v: 'goal', t: 'A goal / trip / exam need' },
            { v: 'bills', t: 'Bills / family / essentials' }, { v: 'debt', t: 'Debt payoff' }, { v: 'invest', t: 'Savings / invest habit' }
        ]},
        { id: 'save_first', label: 'Could you wait and save for it?', type: 'choice', options: [
            { v: 'no', t: 'Must buy now' }, { v: 'maybe', t: 'Could wait a bit' }, { v: 'yes', t: 'Yes, I can save' }
        ]},
        { id: 'cool_off', label: 'Cooling-off: wait 24–48h (or already waited)?', type: 'choice', options: [
            { v: 'waited', t: 'Already waited days+' }, { v: 'can', t: 'I can wait 24–48h' }, { v: 'wont', t: 'Won\'t wait' }
        ]},
        { id: 'recent_buys', label: 'Non-essential buys in the last 2 weeks?', type: 'choice', options: [
            { v: '0', t: 'None' }, { v: '1', t: 'One' }, { v: '2', t: 'Two–three' }, { v: 'many', t: 'A streak of them' }
        ]},
        { id: 'debt_risk', label: 'Debt impact?', type: 'choice', options: [
            { v: 'no', t: 'No debt impact' }, { v: 'delay', t: 'Delays payoff' }, { v: 'yes', t: 'Creates / worsens debt' }
        ]},
        { id: 'regretted_similar', label: 'Regretted a similar purchase before?', type: 'choice', options: [
            { v: 'no', t: 'Never' }, { v: 'once', t: 'Once' }, { v: 'often', t: 'Often' }
        ]},
        { id: 'shared_use', label: 'Who benefits?', type: 'choice', options: [
            { v: 'many', t: 'Family / team' }, { v: 'one', t: 'Just me' }, { v: 'gift', t: "It's a gift" }
        ]},
        { id: 'tco_extras', label: 'True cost beyond sticker (subs / accessories / power / cases)?', type: 'choice', options: [
            { v: 'none', t: 'Just the price' }, { v: 'low', t: 'Small extras likely' },
            { v: 'high', t: 'Big extras / subscription' }, { v: 'unknown', t: 'Haven\'t checked' }
        ]},
        { id: 'setup_skill', label: 'Space ready + can you set up & use it fully soon?', type: 'choice', options: [
            { v: 'ready_week', t: 'Space ready · using within a week' }, { v: 'ready_later', t: 'Space ready · later / learning needed' },
            { v: 'arrange', t: 'Need to arrange space first' }, { v: 'doubt', t: 'Might never fully use it' }
        ]},
        { id: 'warranty_exit', label: 'Warranty/service nearby + exit if you hate it?', type: 'choice', options: [
            { v: 'strong', t: 'Warranty + easy return/resale' }, { v: 'warranty', t: 'Warranty only' },
            { v: 'return_only', t: 'Easy return, weak warranty' }, { v: 'stuck', t: 'Hard return · weak support' }, { v: 'unknown', t: 'Don\'t know yet' }
        ]},
        { id: 'mood', label: 'Buying to fix a mood / stress / unbox craving?', type: 'choice', options: [
            { v: 'no', t: 'Clear-headed need' }, { v: 'partly', t: 'Partly emotional' }, { v: 'yes', t: 'Mostly mood / unbox therapy' }
        ]},
        { id: 'future_thanks', label: 'Will future-you thank present-you in 6 months?', type: 'scale', min: 1, max: 5, hints: ['Will regret', 'Doubtful', 'Neutral', 'Probably yes', 'Absolutely'] },
        { id: 'joy_value', label: 'Real joy / relief from owning this?', type: 'scale', min: 1, max: 5, hints: ['Almost none', 'A little', 'Some', 'A lot', 'Huge lift'] },
        { id: 'life_beyond', label: 'Self-denial vs treat balance lately?', type: 'choice', options: [
            { v: 'yes', t: 'Been very strict' }, { v: 'balanced', t: 'Mostly balanced' }, { v: 'no', t: 'Treat myself often' }
        ]},
        { id: 'secondhand', label: 'Checked used / cheaper / borrow / repair-first?', type: 'choice', options: [
            { v: 'yes', t: 'Checked — this wins' }, { v: 'no', t: 'Didn\'t check' }, { v: 'na', t: 'Not possible here' }
        ]},
        { id: 'goals_align', label: 'Aligns with your current goals?', type: 'scale', min: 1, max: 5, hints: ['Conflicts', 'Neutral', 'Somewhat', 'Supports', 'Directly advances'] },
        { id: 'identity', label: 'Real need — or image / vibe purchase?', type: 'choice', options: [
            { v: 'real', t: 'Real need / real me' }, { v: 'mix', t: 'A bit of both' }, { v: 'image', t: 'Mostly image / vibe' }
        ]},
        { id: 'focus_risk', label: 'Could this distract focus / become another half-used gadget?', type: 'choice', options: [
            { v: 'no', t: 'No — clear use case' }, { v: 'maybe', t: 'Maybe a little' }, { v: 'yes', t: 'Yes, distraction risk' }
        ]},
        { id: 'waste_risk', label: 'Chance it becomes unused clutter?', type: 'scale', min: 1, max: 5, hints: ['Almost none', 'Low', 'Maybe', 'Likely', 'Very likely'] },
        { id: 'advisor_constraint', label: 'If a senior advisor gave you ONE rule for this buy, which fits?', type: 'choice', options: [
            { v: 'must_utility', t: 'Only if it clearly earns/saves time or money' },
            { v: 'must_buffer', t: 'Only if emergency buffer stays intact' },
            { v: 'must_wait', t: 'Sleep on it 48h no matter what' },
            { v: 'must_cheaper', t: 'Only after one cheaper option fails' },
            { v: 'joy_ok', t: 'Affordable joy is allowed if I\'ll use it' }
        ]},
        { id: 'notes', label: 'Advisor notes — facts I should weigh (optional)', type: 'text', placeholder: 'Sale end date, project deadline, why this model, EMI plan, who recommended…' }
    ];

    const LIFE_QUESTIONS = [
        { id: 'why_now', label: 'Why this, why today?', type: 'choice', options: [
            { v: 'joy', t: 'Joy / fun' }, { v: 'rest', t: 'Rest / comfort' },
            { v: 'social', t: 'People / relationship' }, { v: 'memory', t: 'Make a memory' },
            { v: 'convenience', t: 'Convenience / tired' }, { v: 'fomo', t: 'FOMO / habit / boredom' }
        ]},
        { id: 'heart_pull', label: 'How strongly does your heart want this?', type: 'scale', min: 1, max: 5, hints: ['Meh', 'Mild want', 'Clear want', 'Really want', 'Deeply need this feeling'] },
        { id: 'body_mood', label: 'Body energy + emotional weather right now?', type: 'choice', options: [
            { v: 'drained_low', t: 'Drained + sad/stressed' }, { v: 'drained_ok', t: 'Drained but calm' },
            { v: 'ok_flat', t: 'Okay but bored/numb' }, { v: 'ok_calm', t: 'Okay + clear' },
            { v: 'high_happy', t: 'Energized + already happy' }, { v: 'high_restless', t: 'Energized / restless urge' }
        ]},
        { id: 'can_afford', label: 'Can you spend this without money anxiety afterward?', type: 'choice', options: [
            { v: 'easy', t: 'Easily' }, { v: 'ok', t: 'Yes, mild pinch' }, { v: 'tight', t: 'It\'ll sting' }, { v: 'no', t: 'Would regret the cost' }
        ]},
        { id: 'money_timing', label: 'Paying from / timing check?', type: 'choice', options: [
            { v: 'planned', t: 'Planned joy budget' }, { v: 'saved', t: 'From savings, still fine' },
            { v: 'payday', t: 'Payday bounce' }, { v: 'stretch', t: 'Stretching this week' }, { v: 'owe', t: 'Would need to borrow/juggle' }
        ]},
        { id: 'recent_treats', label: 'Similar treat recently?', type: 'choice', options: [
            { v: 'long', t: 'Not in a long while' }, { v: 'week', t: 'Within a week' }, { v: 'yesterday', t: 'Yesterday / today already' }, { v: 'streak', t: 'I\'ve been on a streak' }
        ]},
        { id: 'memory_value', label: 'Warm memory potential later?', type: 'scale', min: 1, max: 5, hints: ['Forgettable', 'Maybe', 'Somewhat', 'Yes', 'Core memory vibes'] },
        { id: 'people_plan', label: 'People: connection + company quality?', type: 'choice', options: [
            { v: 'gold', t: 'Shared with good people' }, { v: 'solo_good', t: 'Solo · intentional for me' },
            { v: 'mixed', t: 'Mixed / uncertain company' }, { v: 'drain', t: 'Draining company / pressure' }, { v: 'na', t: 'Not a people thing' }
        ]},
        { id: 'alternative_home', label: 'Cheaper 80% feeling OR solid at-home version?', type: 'choice', options: [
            { v: 'no_alt', t: 'No good substitute' }, { v: 'partial', t: 'Partial substitute' },
            { v: 'home_ok', t: 'Home version can work' }, { v: 'cheap_easy', t: 'Easy cheaper option exists' }
        ]},
        { id: 'health_tomorrow', label: 'Health/sleep impact + how you\'ll feel tomorrow?', type: 'choice', options: [
            { v: 'good_glad', t: 'Fine health · glad tomorrow' }, { v: 'good_fine', t: 'Fine health · fine either way' },
            { v: 'mild_meh', t: 'Mild downside · maybe meh' }, { v: 'bad_regret', t: 'Hurts tomorrow · likely regret' }
        ]},
        { id: 'obligation', label: 'True want or pressure/FOMO?', type: 'choice', options: [
            { v: 'want', t: 'True want' }, { v: 'mix', t: 'Mix' }, { v: 'pressure', t: 'Pressure / guilt / FOMO' }
        ]},
        { id: 'scarcity', label: 'Rare window (travel, show, people visiting)?', type: 'choice', options: [
            { v: 'rare', t: 'Rare / time-sensitive' }, { v: 'sometime', t: 'Can happen again soon' }, { v: 'anytime', t: 'Anytime available' }
        ]},
        { id: 'self_kindness', label: 'Too hard on yourself with money lately?', type: 'choice', options: [
            { v: 'yes', t: 'Yes — over-restricting' }, { v: 'balanced', t: 'Balanced' }, { v: 'loose', t: 'Spending freely lately' }
        ]},
        { id: 'waste_feel', label: 'Gut: does this feel wasteful?', type: 'scale', min: 1, max: 5, hints: ['Not wasteful', 'Slightly', 'Mixed', 'Kinda wasteful', 'Very wasteful'] },
        { id: 'presence', label: 'Will you savor it (phone away) — or half-distract?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, I\'ll savor it' }, { v: 'maybe', t: 'Maybe' }, { v: 'no', t: 'Probably distracted' }
        ]},
        { id: 'values', label: 'Matches the life you want — not just dopamine?', type: 'scale', min: 1, max: 5, hints: ['Conflicts', 'Neutral', 'Somewhat', 'Fits', 'Deeply fits'] },
        { id: 'swap', label: 'Skipping frees money for something you care about more?', type: 'choice', options: [
            { v: 'no', t: 'No bigger priority waiting' }, { v: 'maybe', t: 'Maybe' }, { v: 'yes', t: 'Yes — protect that instead' }
        ]},
        { id: 'habit_loop', label: 'Autopilot habit (order out, scroll-buy, etc.)?', type: 'choice', options: [
            { v: 'no', t: 'Intentional choice' }, { v: 'forming', t: 'Starting to be habit' }, { v: 'yes', t: 'Autopilot habit' }
        ]},
        { id: 'social_signal', label: 'Any Instagram / flex / “should look fun” motive?', type: 'choice', options: [
            { v: 'none', t: 'None — private joy' }, { v: 'little', t: 'A little' }, { v: 'yes', t: 'Yes, posting/flex is part of it' }
        ]},
        { id: 'basic_needs', label: 'Basics covered this week (food, travel, bills) if you do this?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, basics safe' }, { v: 'tight', t: 'Basics get tight' }, { v: 'no', t: 'Would risk basics' }
        ]},
        { id: 'gratitude', label: 'Can you name gratitude today without this?', type: 'choice', options: [
            { v: 'yes', t: 'Yes, I can' }, { v: 'hard', t: 'Hard right now' }, { v: 'no', t: 'Feeling empty' }
        ]},
        { id: 'advisor_rule', label: 'One advisor rule for tonight?', type: 'choice', options: [
            { v: 'shrink', t: 'Pick a cheaper version first' }, { v: 'share', t: 'Only if shared with good people' },
            { v: 'savor', t: 'Yes only if I\'ll be fully present' }, { v: 'sleep', t: 'Decide tomorrow morning' },
            { v: 'mercy', t: 'Small mercy treat is OK' }
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

    function setMode(mode, opts = {}) {
        _mode = mode;
        document.querySelectorAll('.buy-mode-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.buymode === mode);
        });
        document.getElementById('buy-mode-product')?.classList.toggle('hidden', mode !== 'product');
        document.getElementById('buy-mode-life')?.classList.toggle('hidden', mode !== 'life');
        if (!opts.keepReport) {
            const report = document.getElementById('buy-report');
            if (report) { report.classList.add('hidden'); report.innerHTML = ''; }
        }
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

    function normalizeProductAnswers(raw) {
        const a = Object.assign({}, raw);
        // Compound → legacy fields used across scoring
        const uc = a.usage_context;
        a.usage_freq = ({ work_daily: 'daily', home_daily: 'daily', weekly: 'weekly', travel: 'monthly', rarely: 'rarely', social_image: 'rarely' })[uc] || a.usage_freq;
        if (a.already_own === 'replace') { a.already_own_raw = 'replace'; a.already_own = 'yes'; a.value_add = a.value_add || 'replace'; }
        else if (a.already_own === 'keep_both') { a.already_own_raw = 'keep_both'; a.already_own = 'yes'; }
        const ut = a.urgency_timing;
        a.urgency = ({ need_now_clear: 'now', need_now_night: 'now', soon_planned: 'soon', payday: 'soon', can_wait: 'later', no_deadline: 'never' })[ut] || a.urgency;
        const ri = a.research_influence;
        a.researched = ({ deep_own: 'deep', some_own: 'some', friend: 'some', influencer: 'none', sale_only: 'none', none: 'none' })[ri] || a.researched;
        if (a.setup_skill === 'ready_week' || a.setup_skill === 'ready_later') a.space = 'yes';
        else if (a.setup_skill === 'arrange') a.space = 'maybe';
        else if (a.setup_skill === 'doubt') a.space = 'no';
        if (a.tco_extras === 'none') a.maintenance = 'none';
        else if (a.tco_extras === 'low') a.maintenance = 'low';
        else if (a.tco_extras === 'high') a.maintenance = 'high';
        if (a.warranty_exit === 'strong' || a.warranty_exit === 'return_only') a.return_policy = 'yes';
        else if (a.warranty_exit === 'warranty') a.return_policy = 'maybe';
        else if (a.warranty_exit === 'stuck') a.return_policy = 'no';
        return a;
    }

    function normalizeLifeAnswers(raw) {
        const a = Object.assign({}, raw);
        const bm = a.body_mood;
        if (bm) {
            a.body_energy = bm.startsWith('drained') ? 'drained' : bm.startsWith('high') ? 'high' : 'ok';
            a.emotional_state = ({
                drained_low: 'low', drained_ok: 'calm', ok_flat: 'flat', ok_calm: 'calm',
                high_happy: 'happy', high_restless: 'flat'
            })[bm] || 'calm';
        }
        const pp = a.people_plan;
        if (pp === 'gold') { a.connection = 'yes'; a.company_quality = 'yes'; }
        else if (pp === 'solo_good') { a.connection = 'solo'; a.company_quality = 'na'; }
        else if (pp === 'mixed') { a.connection = 'yes'; a.company_quality = 'mixed'; }
        else if (pp === 'drain') { a.connection = 'no'; a.company_quality = 'no'; }
        else if (pp === 'na') { a.connection = 'no'; a.company_quality = 'na'; }
        const ah = a.alternative_home;
        if (ah === 'no_alt') { a.alternative = 'no'; a.home_option = 'no'; }
        else if (ah === 'partial') { a.alternative = 'partial'; a.home_option = 'somewhat'; }
        else if (ah === 'home_ok') { a.alternative = 'partial'; a.home_option = 'yes'; }
        else if (ah === 'cheap_easy') { a.alternative = 'yes'; a.home_option = 'somewhat'; }
        const ht = a.health_tomorrow;
        if (ht === 'good_glad') { a.health = 'good'; a.tomorrow_feel = 'glad'; }
        else if (ht === 'good_fine') { a.health = 'good'; a.tomorrow_feel = 'fine'; }
        else if (ht === 'mild_meh') { a.health = 'mild'; a.tomorrow_feel = 'meh'; }
        else if (ht === 'bad_regret') { a.health = 'bad'; a.tomorrow_feel = 'regret'; }
        return a;
    }

    function buildProductParameters(product, rawAnswers, price) {
        const a = normalizeProductAnswers(rawAnswers);
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
        addParam(P, 'Money Comfort', 'Funding source + emergency buffer',
            a.money_source === 'saved_safe' || a.money_source === 'salary_planned' ? 'pass' :
                a.money_source === 'saved_thin' || a.money_source === 'stretch' ? 'warn' :
                    a.money_source === 'borrow' ? 'fail' : 'info',
            a.money_source === 'borrow' ? 'Funding via borrow/credit is a hard advisor brake.' :
                a.money_source === 'saved_thin' ? 'Buffer gets thin — size down or wait.' :
                    a.money_source ? `Funding: ${a.money_source}.` : 'Not answered.',
            ({ saved_safe: 92, salary_planned: 80, saved_thin: 45, stretch: 30, borrow: 8 }[a.money_source] || 40), 1.9);
        addParam(P, 'Money Comfort', 'Opportunity cost of saying yes',
            a.opportunity_cost === 'nothing' ? 'pass' : a.opportunity_cost === 'goal' || a.opportunity_cost === 'invest' ? 'warn' :
                a.opportunity_cost === 'bills' || a.opportunity_cost === 'debt' ? 'fail' : 'info',
            a.opportunity_cost === 'bills' || a.opportunity_cost === 'debt'
                ? 'This competes with obligations — advisor priority is clear: obligations first.'
                : a.opportunity_cost ? `Money otherwise protects: ${a.opportunity_cost}.` : 'Not answered.',
            ({ nothing: 85, goal: 55, invest: 50, bills: 20, debt: 12 }[a.opportunity_cost] || 40), 1.6);
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
        addParam(P, 'Necessity & Use', 'Existing alternative / one-in-one-out',
            a.already_own === 'no' ? 'pass' : a.already_own === 'partial' ? 'warn' :
                a.already_own_raw === 'replace' ? 'pass' : a.already_own_raw === 'keep_both' ? 'fail' :
                    a.already_own === 'yes' ? 'fail' : 'info',
            a.already_own_raw === 'keep_both' ? 'Keeping both = upgrade tax + clutter.' :
                a.already_own_raw === 'replace' ? 'Replacing/retiring the old one — cleaner decision.' :
                    a.already_own === 'yes' ? 'You already have something similar.' :
                        a.already_own ? `Alternative: ${a.already_own}.` : 'Not answered.',
            a.already_own_raw === 'replace' ? 82 : ({ no: 90, partial: 55, yes: 25 }[a.already_own] || 40), 1.5);
        addParam(P, 'Necessity & Use', 'Usage context + frequency',
            a.usage_context === 'work_daily' || a.usage_context === 'home_daily' ? 'pass' :
                a.usage_context === 'weekly' ? 'pass' :
                    a.usage_context === 'travel' ? 'warn' :
                        a.usage_context === 'social_image' || a.usage_context === 'rarely' ? 'fail' : 'info',
            a.usage_context ? `Use plan: ${a.usage_context}.` : 'Not answered.',
            ({ work_daily: 95, home_daily: 90, weekly: 75, travel: 50, rarely: 22, social_image: 20 }[a.usage_context] || usageMap[a.usage_freq] || 40), 1.5);
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
        addParam(P, 'Discipline & Timing', 'Research + influence source',
            a.research_influence === 'deep_own' ? 'pass' : a.research_influence === 'some_own' ? 'pass' :
                a.research_influence === 'friend' ? 'warn' :
                    a.research_influence === 'influencer' || a.research_influence === 'sale_only' || a.research_influence === 'none' ? 'fail' : 'info',
            a.research_influence === 'sale_only' ? 'Sale pressure is not a strategy.' :
                a.research_influence === 'influencer' ? 'Influencer pull needs your own verification.' :
                    a.research_influence ? `Source: ${a.research_influence}.` : 'Not answered.',
            ({ deep_own: 92, some_own: 75, friend: 48, influencer: 25, sale_only: 20, none: 18 }[a.research_influence] || 40), 1.4);
        addParam(P, 'Discipline & Timing', 'Mood / unbox therapy',
            a.mood === 'no' ? 'pass' : a.mood === 'partly' ? 'warn' : a.mood === 'yes' ? 'fail' : 'info',
            a.mood === 'yes' ? 'Feelings first, cart second — walk before you buy.' : a.mood ? `Mood: ${a.mood}.` : 'Not answered.',
            ({ no: 90, partly: 50, yes: 20 }[a.mood] || 40), 1.5);
        addParam(P, 'Discipline & Timing', 'Past regret pattern',
            a.regretted_similar === 'no' ? 'pass' : a.regretted_similar === 'once' ? 'warn' : a.regretted_similar === 'often' ? 'fail' : 'info',
            a.regretted_similar ? `Regret history: ${a.regretted_similar}.` : 'Not answered.',
            ({ no: 85, once: 55, often: 20 }[a.regretted_similar] || 40), 1.2);
        addParam(P, 'Discipline & Timing', 'Urgency × cart timing',
            a.urgency_timing === 'need_now_clear' && nec >= 4 ? 'pass' :
                a.urgency_timing === 'need_now_night' || a.urgency_timing === 'payday' ? 'fail' :
                    a.urgency_timing === 'can_wait' || a.urgency_timing === 'no_deadline' ? 'pass' :
                        a.urgency_timing === 'soon_planned' ? 'pass' : 'info',
            a.urgency_timing === 'need_now_night' ? 'Late-night carts are where budgets go to die.' :
                a.urgency_timing === 'payday' ? 'Payday bounce is a classic wealth leak.' :
                    a.urgency_timing ? `Timing: ${a.urgency_timing}.` : 'Not answered.',
            ({ need_now_clear: 70, need_now_night: 18, soon_planned: 72, payday: 22, can_wait: 85, no_deadline: 88 }[a.urgency_timing] || 45), 1.3);
        addParam(P, 'Discipline & Timing', 'Cooling-off discipline',
            a.cool_off === 'waited' ? 'pass' : a.cool_off === 'can' ? 'warn' : a.cool_off === 'wont' ? 'fail' : 'info',
            a.cool_off === 'wont' ? 'Refusal to wait is a red flag unless necessity is critical.' :
                a.cool_off ? `Cool-off: ${a.cool_off}.` : 'Not answered.',
            ({ waited: 90, can: 60, wont: 25 }[a.cool_off] || 45), 1.3);
        addParam(P, 'Discipline & Timing', 'Secondhand / cheaper check',
            a.secondhand === 'yes' || a.secondhand === 'na' ? 'pass' : a.secondhand === 'no' ? 'warn' : 'info',
            a.secondhand === 'no' ? 'Worth a 10-minute cheaper-option scan.' : a.secondhand ? `Checked: ${a.secondhand}.` : 'Not answered.',
            ({ yes: 85, na: 70, no: 40 }[a.secondhand] || 45), 0.9);
        addParam(P, 'Discipline & Timing', 'Warranty + exit plan',
            a.warranty_exit === 'strong' ? 'pass' : a.warranty_exit === 'warranty' || a.warranty_exit === 'return_only' ? 'warn' :
                a.warranty_exit === 'stuck' ? 'fail' : 'info',
            a.warranty_exit === 'stuck' ? 'Hard exit raises the quality bar for saying yes.' :
                a.warranty_exit ? `Exit/support: ${a.warranty_exit}.` : 'Not answered.',
            ({ strong: 88, warranty: 62, return_only: 65, stuck: 28, unknown: 40 }[a.warranty_exit] || 45), 1.0);

        // Practical fit
        addParam(P, 'Practical Fit', 'Setup + space + time-to-value',
            a.setup_skill === 'ready_week' ? 'pass' : a.setup_skill === 'ready_later' ? 'warn' :
                a.setup_skill === 'arrange' ? 'warn' : a.setup_skill === 'doubt' ? 'fail' : 'info',
            a.setup_skill === 'doubt' ? 'If you might never fully use it, don\'t fund the fantasy.' :
                a.setup_skill ? `Setup plan: ${a.setup_skill}.` : 'Not answered.',
            ({ ready_week: 90, ready_later: 55, arrange: 40, doubt: 15 }[a.setup_skill] || 40), 1.2);
        addParam(P, 'Practical Fit', 'True cost of ownership extras',
            a.tco_extras === 'none' ? 'pass' : a.tco_extras === 'low' ? 'warn' :
                a.tco_extras === 'high' || a.tco_extras === 'unknown' ? 'fail' : 'info',
            a.tco_extras === 'unknown' ? 'Unknown extras = incomplete analysis — check before buying.' :
                a.tco_extras ? `Extras: ${a.tco_extras}.` : 'Not answered.',
            ({ none: 90, low: 65, high: 28, unknown: 30 }[a.tco_extras] || 40), 1.2);
        addParam(P, 'Practical Fit', 'Focus / half-used gadget risk',
            a.focus_risk === 'no' ? 'pass' : a.focus_risk === 'maybe' ? 'warn' : a.focus_risk === 'yes' ? 'fail' : 'info',
            a.focus_risk ? `Focus risk: ${a.focus_risk}.` : 'Not answered.',
            ({ no: 88, maybe: 50, yes: 22 }[a.focus_risk] || 45), 1.1);
        addParam(P, 'Practical Fit', 'Shared utility',
            a.shared_use === 'many' ? 'pass' : a.shared_use === 'gift' ? 'info' : a.shared_use ? 'warn' : 'info',
            a.shared_use ? `Shared use: ${a.shared_use}.` : 'Not answered.',
            ({ many: 85, gift: 60, one: 55 }[a.shared_use] || 40), 0.8);
        addParam(P, 'Practical Fit', 'Quality tier need',
            a.quality_need === 'yes' ? 'pass' : a.quality_need === 'maybe' ? 'warn' : a.quality_need === 'no' ? 'info' : 'info',
            a.quality_need === 'no' ? 'If any decent one works, hunt a cheaper pick.' : a.quality_need ? `Tier need: ${a.quality_need}.` : 'Not answered.',
            ({ yes: 80, maybe: 60, no: 45 }[a.quality_need] || 45), 0.9);

        // Product signals (listing-accurate rating + mined buyer themes)
        const buyer = product.buyer_insights || {};
        const buyerPros = Array.isArray(buyer.pros) ? buyer.pros : [];
        const buyerCons = Array.isArray(buyer.cons) ? buyer.cons : [];
        const samples = Array.isArray(buyer.sample_reviews) ? buyer.sample_reviews : [];
        const ratingConf = product.rating_confidence || 0;

        addParam(P, 'Product Signals', 'Price available', price > 0 ? 'pass' : 'fail', price > 0 ? `Analysis price ${fmt(price)}.` : 'No price.', price > 0 ? 90 : 5, 1.0);
        addParam(P, 'Product Signals', 'Customer rating (this listing)',
            rating == null ? 'info' : rating >= 4.2 ? 'pass' : rating >= 3.5 ? 'warn' : 'fail',
            rating == null
                ? 'No confident listing rating (related-product stars ignored).'
                : `${rating.toFixed(1)} / 5` + (reviews != null ? ` · ${Number(reviews).toLocaleString('en-IN')} ratings` : '') +
                    (product.rating_source ? ` · via ${product.rating_source}` : '') +
                    (ratingConf ? ` · confidence ${ratingConf}` : ''),
            rating == null ? 50 : clamp((rating / 5) * 100), 1.4);
        addParam(P, 'Product Signals', 'Review volume', reviews == null ? 'info' : reviews >= 200 ? 'pass' : reviews >= 30 ? 'warn' : 'fail',
            reviews == null ? 'Review count unknown.' : `${Number(reviews).toLocaleString('en-IN')} ratings/reviews on this listing.`,
            reviews == null ? 50 : clamp(Math.log10(reviews + 1) * 28), 1.0);
        if (product.star_breakdown) {
            const sb = product.star_breakdown;
            const five = Number(sb['5'] || 0);
            addParam(P, 'Product Signals', '5-star share',
                five >= 55 ? 'pass' : five >= 40 ? 'warn' : 'fail',
                `Star mix ≈ 5★ ${sb['5'] || 0}% · 4★ ${sb['4'] || 0}% · 3★ ${sb['3'] || 0}% · 2★ ${sb['2'] || 0}% · 1★ ${sb['1'] || 0}%.`,
                clamp(five + Number(sb['4'] || 0) * 0.6), 0.9);
        }
        addParam(P, 'Product Signals', 'Buyer theme polarity',
            sentiment >= 70 ? 'pass' : sentiment >= 50 ? 'warn' : 'fail',
            (product.sentiment && product.sentiment.summary) || 'Buyer theme polarity unavailable.',
            sentiment, 1.1);
        addParam(P, 'Product Signals', 'Buyer pros mined',
            buyerPros.length >= 3 ? 'pass' : buyerPros.length ? 'warn' : 'info',
            buyerPros.length
                ? buyerPros.slice(0, 4).map(p => `${p.text} (${Number(p.count || 0).toLocaleString('en-IN')})`).join(' · ')
                : 'No counted buyer pros extracted.',
            buyerPros.length ? clamp(55 + buyerPros.length * 8) : 45, 1.0);
        addParam(P, 'Product Signals', 'Buyer cons mined',
            buyerCons.length === 0 ? 'pass' : buyerCons.length <= 2 ? 'warn' : 'fail',
            buyerCons.length
                ? buyerCons.slice(0, 4).map(c => `${c.text} (${Number(c.count || 0).toLocaleString('en-IN')})`).join(' · ')
                : 'No major counted cons surfaced.',
            buyerCons.length === 0 ? 80 : clamp(70 - buyerCons.length * 10), 1.1);
        addParam(P, 'Product Signals', 'Top reviews read',
            samples.length >= 4 ? 'pass' : samples.length ? 'warn' : 'info',
            samples.length ? `${samples.length} customer reviews parsed from the listing.` : 'No individual reviews parsed.',
            samples.length ? clamp(40 + samples.length * 8) : 40, 0.8);
        addParam(P, 'Product Signals', 'Marketplace familiarity',
            /amazon\.|flipkart\.|myntra\.|croma\.|apple\.|samsung\./i.test(product.host || '') ? 'pass' : 'warn',
            `Host: ${product.host || 'unknown'}.`, /amazon\.|flipkart\.|myntra\.|croma\.|apple\.|samsung\./i.test(product.host || '') ? 80 : 50, 0.7);

        // Advisor synthesis — every point tied to asked answers
        const advisorChecks = [
            ['Advisor Checks', 'Intake completeness', PRODUCT_QUESTIONS.filter(q => q.type !== 'text').every(q => rawAnswers[q.id]), 'All scored questions answered.', 0.7],
            ['Advisor Checks', 'Context note provided', !!(a.notes && a.notes.length > 8), 'Written context improves precision.', 0.5],
            ['Advisor Checks', 'Utility over toy', ['career', 'health', 'time', 'replace'].includes(a.value_add) || a.usage_context === 'work_daily', 'Earns keep via work/health/time/replace.', 1.2],
            ['Advisor Checks', 'Urgency matches necessity', !(a.urgency === 'now' && nec <= 2), 'No fake urgency on a weak need.', 1.1],
            ['Advisor Checks', 'Emotional temperature OK', impulse <= 3 && a.mood !== 'yes' && a.urgency_timing !== 'need_now_night', 'Not a heated cart decision.', 1.2],
            ['Advisor Checks', 'Affordable intentional joy', a.life_beyond === 'yes' && a.can_afford === 'easy' && joy >= 4 && a.money_source !== 'borrow', 'Strict saver + safe joy exception.', 1.0],
            ['Advisor Checks', 'Critical function override', nec >= 5 && work >= 4, 'Blocks real work/life function.', 1.3],
            ['Advisor Checks', 'No duplicate stack', a.already_own_raw !== 'keep_both' && (a.already_own !== 'yes' || a.already_own_raw === 'replace' || a.value_add === 'replace'), 'One-in one-out respected.', 1.2],
            ['Advisor Checks', 'Subscription / extras controlled', a.tco_extras !== 'high' && a.tco_extras !== 'unknown', 'True cost understood.', 1.1],
            ['Advisor Checks', 'Will be used, not displayed', future >= 3 && waste <= 3 && a.focus_risk !== 'yes', 'Use > possession.', 1.1],
            ['Advisor Checks', 'Sale / hype resistance', a.research_influence !== 'sale_only' && a.research_influence !== 'influencer', 'Not bought by countdown/ad.', 1.2],
            ['Advisor Checks', 'Social proof verified', a.research_influence !== 'friend' || a.researched === 'deep' || a.researched === 'some', 'Friend hype cross-checked.', 0.9],
            ['Advisor Checks', 'Earn-then-own', a.save_first === 'yes' || a.money_source === 'saved_safe' || a.can_afford === 'easy', 'No financial hangover path.', 1.2],
            ['Advisor Checks', 'Long-game asset', a.lifespan === 'years' && usageMap[a.usage_freq] >= 70, 'Durable frequent use.', 1.0],
            ['Advisor Checks', 'Your chosen advisor rule held',
                (a.advisor_constraint === 'must_utility' && ['career', 'health', 'time', 'replace'].includes(a.value_add)) ||
                (a.advisor_constraint === 'must_buffer' && (a.money_source === 'saved_safe' || a.money_source === 'salary_planned')) ||
                (a.advisor_constraint === 'must_wait' && (a.cool_off === 'waited' || a.cool_off === 'can')) ||
                (a.advisor_constraint === 'must_cheaper' && (a.secondhand === 'yes' || a.quality_need !== 'yes')) ||
                (a.advisor_constraint === 'joy_ok' && a.can_afford === 'easy' && joy >= 3 && waste <= 3),
                'You set a rule — decision should obey it.', 1.5],
            ['Advisor Checks', 'Night cart avoided', a.urgency_timing !== 'need_now_night', 'No late-night purchase pressure.', 1.0],
            ['Advisor Checks', 'Payday bounce avoided', a.urgency_timing !== 'payday', 'Not spending because money just arrived.', 1.0],
            ['Advisor Checks', 'Exit liquidity OK', a.warranty_exit === 'strong' || a.warranty_exit === 'return_only' || price < 1500, 'Can reverse if wrong.', 0.9],
            ['Advisor Checks', 'Setup within a week', a.setup_skill === 'ready_week', 'Fast time-to-value.', 1.0],
            ['Advisor Checks', 'Not image-primary', a.identity !== 'image' && a.usage_context !== 'social_image', 'Utility > costume.', 1.1]
        ];
        advisorChecks.forEach(([cat, label, good, detail, w]) => {
            addParam(P, cat, label, good ? 'pass' : 'warn', detail, good ? 88 : 38, w || 0.8);
        });

        // Concrete senior-advisor money math (answer-based, no ledger)
        const weeksToSave = price > 0 ? Math.max(1, Math.ceil(price / Math.max(500, price / 8))) : 1;
        addParam(P, 'Advisor Math', 'Save-rate path',
            a.save_first === 'yes' || a.cool_off !== 'wont' ? 'pass' : 'warn',
            `At a calm ~${fmt(Math.ceil(price / 4))}/week, ownership takes ~4 weeks without shock.`,
            a.save_first === 'yes' ? 85 : a.can_afford === 'easy' ? 70 : 45, 1.0);
        addParam(P, 'Advisor Math', 'Stress-adjusted greenlight',
            a.can_afford === 'easy' && a.money_source !== 'borrow' && a.debt_risk === 'no' ? 'pass' :
                a.can_afford === 'ok' && nec >= 4 ? 'warn' : 'fail',
            'Greenlight only when cash comfort + no debt + clear need align.',
            a.can_afford === 'easy' && a.debt_risk === 'no' ? 90 : nec >= 4 ? 55 : 30, 1.4);
        addParam(P, 'Advisor Math', 'Delay cost vs buy cost',
            a.urgency_timing === 'can_wait' || a.urgency_timing === 'no_deadline' || nec >= 4 ? 'pass' : 'warn',
            nec >= 4 ? 'Delay has real function cost — speed can be rational.' : 'Delay is cheap when need is soft.',
            nec >= 4 ? 75 : 70, 0.8);

        return P;
    }

    function buildLifeParameters(rawAnswers, price, meta) {
        const a = normalizeLifeAnswers(rawAnswers);
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
        addParam(P, 'Money & Sanity', 'Funding / timing discipline',
            a.money_timing === 'planned' || a.money_timing === 'saved' ? 'pass' :
                a.money_timing === 'payday' || a.money_timing === 'stretch' ? 'warn' :
                    a.money_timing === 'owe' ? 'fail' : 'info',
            a.money_timing === 'payday' ? 'Payday bounce spending is a classic leak.' :
                a.money_timing ? `Timing: ${a.money_timing}.` : 'Not answered.',
            ({ planned: 90, saved: 85, payday: 35, stretch: 40, owe: 12 }[a.money_timing] || 45), 1.5);
        addParam(P, 'Money & Sanity', 'Basics still covered this week',
            a.basic_needs === 'yes' ? 'pass' : a.basic_needs === 'tight' ? 'warn' : a.basic_needs === 'no' ? 'fail' : 'info',
            a.basic_needs === 'no' ? 'Never fund a treat by risking food/travel/bills.' :
                a.basic_needs ? `Basics: ${a.basic_needs}.` : 'Not answered.',
            ({ yes: 90, tight: 45, no: 10 }[a.basic_needs] || 45), 1.7);
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

        addParam(P, 'Choice Quality', 'Flex / post motive',
            a.social_signal === 'none' ? 'pass' : a.social_signal === 'little' ? 'warn' : a.social_signal === 'yes' ? 'fail' : 'info',
            a.social_signal === 'yes' ? 'If posting is the point, joy is rented from strangers.' :
                a.social_signal ? `Signal motive: ${a.social_signal}.` : 'Not answered.',
            ({ none: 88, little: 55, yes: 25 }[a.social_signal] || 50), 1.0);

        const lifeExtras = [
            ['Advisor Checks', 'Not only saving — also living', heart >= 3 && memory >= 3 && a.can_afford !== 'no' && a.basic_needs !== 'no', 'Joy + meaning + basics safe.'],
            ['Advisor Checks', 'Not only spending — also sense', waste <= 3 && a.habit_loop !== 'yes' && a.money_timing !== 'owe', 'Not mindless or borrowed.'],
            ['Advisor Checks', 'Intake completeness', LIFE_QUESTIONS.filter(q => q.type !== 'text').every(q => rawAnswers[q.id]), 'Full check-in done.'],
            ['Advisor Checks', 'Heart note shared', !!(a.notes && a.notes.length > 6), 'Context sharpens advice.'],
            ['Advisor Checks', 'Small affordable comfort', price <= 300 && a.can_afford !== 'no' && heart >= 3 && a.basic_needs === 'yes', 'Small joy window.'],
            ['Advisor Checks', 'Big ticket needs bigger why', price < 3000 || memory >= 4 || a.scarcity === 'rare' || a.people_plan === 'gold', 'Cost matched by meaning.'],
            ['Advisor Checks', 'Rest without excess', a.why_now !== 'rest' || (price <= 1000 && a.can_afford !== 'no'), 'Gentle rest choice.'],
            ['Advisor Checks', 'Social gold', a.people_plan === 'gold', 'Good people + shared plan.'],
            ['Advisor Checks', 'FOMO brake', a.why_now !== 'fomo' && a.obligation !== 'pressure', 'Free of fake urgency.'],
            ['Advisor Checks', 'Savor plan', a.presence === 'yes', 'You\'ll actually taste the moment.'],
            ['Advisor Checks', 'No hangover spend', a.tomorrow_feel === 'glad' || a.tomorrow_feel === 'fine', 'Tomorrow stays kind.'],
            ['Advisor Checks', 'Mercy after discipline', a.self_kindness === 'yes' && a.recent_treats === 'long' && a.can_afford !== 'no', 'Mercy treat after discipline.'],
            ['Advisor Checks', 'Stop the streak', a.recent_treats !== 'streak' && a.habit_loop !== 'yes', 'Not feeding a binge.'],
            ['Advisor Checks', 'Home dignity', a.home_option !== 'yes' || heart >= 4 || a.people_plan === 'gold', 'Leaving home has a reason.'],
            ['Advisor Checks', 'Body kindness', a.health !== 'bad', 'Body respected.'],
            ['Advisor Checks', 'Payday bounce avoided', a.money_timing !== 'payday', 'Not spending because money just landed.'],
            ['Advisor Checks', 'Your advisor rule held',
                (a.advisor_rule === 'shrink' && (a.alternative_home === 'cheap_easy' || a.alternative_home === 'home_ok' || a.alternative_home === 'partial')) ||
                (a.advisor_rule === 'share' && a.people_plan === 'gold') ||
                (a.advisor_rule === 'savor' && a.presence === 'yes') ||
                (a.advisor_rule === 'sleep') ||
                (a.advisor_rule === 'mercy' && price <= 500 && a.can_afford !== 'no'),
                'Obey the rule you set for yourself.', 1.4]
        ];
        lifeExtras.forEach(([cat, label, good, detail, w]) => {
            addParam(P, cat, label, good ? 'pass' : 'warn', detail, good ? 88 : 38, w || 0.8);
        });

        addParam(P, 'Advisor Math', 'Cost-to-meaning ratio',
            (memory >= 4 || a.people_plan === 'gold' || a.scarcity === 'rare') && a.can_afford !== 'no' ? 'pass' :
                price <= 400 && heart >= 3 ? 'pass' : 'warn',
            'Pay for meaning and presence — not for autopilot.',
            memory >= 4 || a.people_plan === 'gold' ? 85 : price <= 400 ? 70 : 45, 1.2);
        addParam(P, 'Advisor Math', 'Safer substitute test',
            a.alternative_home === 'no_alt' || heart >= 4 || a.scarcity === 'rare' ? 'pass' : 'warn',
            a.alternative_home === 'cheap_easy' || a.alternative_home === 'home_ok'
                ? 'A cheaper/home path exists — use it unless meaning is rare/high.'
                : 'No clean substitute — paid option can be rational.',
            a.alternative_home === 'no_alt' ? 78 : heart >= 4 ? 70 : 42, 1.1);

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

    function lifeBalanceMeter(rawAnswers, price, overall, kind) {
        const answers = kind === 'life' ? normalizeLifeAnswers(rawAnswers) : normalizeProductAnswers(rawAnswers);
        let meter = 50;
        const heart = num(answers.heart_pull || answers.joy_value);
        const future = num(answers.future_thanks || answers.memory_value);
        const waste = num(answers.waste_risk || answers.waste_feel);
        const nec = num(answers.necessity);

        if (answers.can_afford === 'easy') meter += 18;
        else if (answers.can_afford === 'ok') meter += 8;
        else if (answers.can_afford === 'tight') meter -= 12;
        else if (answers.can_afford === 'no') meter -= 28;

        if (answers.debt_risk === 'yes' || answers.money_source === 'borrow' || answers.money_timing === 'owe') meter -= 20;
        if (answers.mood === 'yes' || answers.why_now === 'fomo') meter -= 10;
        if (num(answers.impulse) >= 4) meter -= 8;
        if (answers.habit_loop === 'yes' || answers.recent_treats === 'streak' || answers.recent_buys === 'many') meter -= 12;
        if (answers.urgency_timing === 'need_now_night' || answers.urgency_timing === 'payday' || answers.money_timing === 'payday') meter -= 10;
        if (answers.basic_needs === 'no') meter -= 18;
        if (answers.focus_risk === 'yes') meter -= 8;

        if ((heart >= 4 || future >= 4) && answers.can_afford !== 'no' && answers.can_afford !== 'tight') meter += 10;
        if (answers.life_beyond === 'yes' || answers.self_kindness === 'yes') meter += 6;
        if ((answers.connection === 'yes' && answers.company_quality === 'yes') || answers.people_plan === 'gold') meter += 8;
        if (answers.scarcity === 'rare') meter += 6;
        if (nec >= 4) meter += 8;
        if (waste >= 4) meter -= 10;
        if (answers.tomorrow_feel === 'glad') meter += 8;
        if (answers.tomorrow_feel === 'regret') meter -= 14;
        if (answers.cool_off === 'waited' || answers.money_source === 'saved_safe') meter += 6;

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

    function buildProductVerdict(overall, meter, rawAnswers, price, product) {
        const answers = normalizeProductAnswers(rawAnswers);
        const nec = num(answers.necessity);
        const joy = num(answers.joy_value);
        let action;
        if (meter.band === 'green' && overall >= 65) action = 'BUY NOW';
        else if (meter.band === 'green') action = 'BUY — WITH EYES OPEN';
        else if (meter.band === 'yellow' && nec >= 4 && answers.money_source !== 'borrow') action = 'BUY ONLY IF CRITICAL — ELSE WAIT';
        else if (meter.band === 'yellow' && joy >= 4 && answers.can_afford === 'easy' && answers.life_beyond === 'yes') action = 'CONDITIONAL YES — WAIT ONE NIGHT FIRST';
        else if (meter.band === 'yellow') action = 'WAIT & SAVE';
        else if (nec >= 5 && answers.debt_risk !== 'yes') action = 'LAST RESORT — BUY CHEAPEST THAT WORKS';
        else action = 'DO NOT BUY YET';

        const pros = [];
        const cons = [];
        if (nec >= 4) pros.push('You rated this as genuinely necessary.');
        if (num(answers.work_impact) >= 4) pros.push('Work/study is actually hampered without it.');
        if (answers.usage_freq === 'daily' || answers.usage_freq === 'weekly') pros.push('You expect frequent real use.');
        if (answers.lifespan === 'years') pros.push('Long useful life improves value.');
        if (answers.research_influence === 'deep_own') pros.push('Deep own research — not hype.');
        if (answers.can_afford === 'easy' && answers.money_source === 'saved_safe') pros.push('Funded from savings with buffer intact.');
        if (answers.cool_off === 'waited') pros.push('You already cooled off — desire survived time.');
        if (joy >= 4 && answers.life_beyond === 'yes') pros.push('You\'ve been strict — thoughtful joy has a place.');
        if (product.rating && product.rating >= 4.2) {
            pros.push(`Solid listing rating (${product.rating.toFixed(1)}★` +
                (product.review_count != null ? ` from ${Number(product.review_count).toLocaleString('en-IN')} ratings` : '') + ').');
        }
        const bi = product.buyer_insights || {};
        (bi.pros || []).slice(0, 3).forEach(p => {
            pros.push(`Buyers praise ${p.text.toLowerCase()} (${Number(p.count || 0).toLocaleString('en-IN')} mentions).`);
        });

        if (answers.can_afford === 'no' || answers.can_afford === 'tight') cons.push('Money comfort is low for this price.');
        if (answers.money_source === 'borrow' || answers.debt_risk === 'yes') cons.push('Debt/borrow funding is unacceptable for this.');
        if (num(answers.impulse) >= 4) cons.push('Impulse is high.');
        if (answers.mood === 'yes') cons.push('Mood / unbox therapy detected.');
        if (answers.already_own_raw === 'keep_both') cons.push('You would keep both — upgrade tax.');
        else if (answers.already_own === 'yes') cons.push('You already own something similar.');
        if (answers.usage_freq === 'rarely') cons.push('Rare usage makes cost-per-use ugly.');
        if (answers.save_first === 'yes') cons.push('Even you admit you could wait and save.');
        if (num(answers.waste_risk) >= 4 || answers.setup_skill === 'doubt') cons.push('High chance it stays underused.');
        if (answers.urgency_timing === 'need_now_night' || answers.urgency_timing === 'payday') cons.push('Cart timing is emotionally risky.');
        if (answers.opportunity_cost === 'bills' || answers.opportunity_cost === 'debt') cons.push('This competes with obligations.');
        if (product.rating != null && product.rating < 3.8) cons.push(`Listing rating is soft (${product.rating.toFixed(1)}★).`);
        (bi.cons || []).slice(0, 3).forEach(c => {
            cons.push(`Buyers flag ${c.text.toLowerCase()} (${Number(c.count || 0).toLocaleString('en-IN')} complaints).`);
        });

        const conditions = [];
        if (action.includes('WAIT') || action.includes('DO NOT') || action.includes('CONDITIONAL')) {
            if (answers.cool_off !== 'waited') conditions.push('Sleep on it 48 hours before any payment.');
            if (answers.secondhand !== 'yes' && answers.quality_need !== 'yes') conditions.push('Price-check one cheaper/used option first.');
            if (answers.tco_extras === 'unknown') conditions.push('List all extras (case, cable, sub) before deciding.');
            conditions.push(`If still yes later, save ~${fmt(Math.ceil(price / 4))}/week instead of impulse-buying.`);
        } else {
            conditions.push('Buy only the exact model you researched — no cart upsells.');
            if (answers.already_own_raw === 'replace') conditions.push('Retire/sell the old item within 7 days (one-in one-out).');
            conditions.push('After purchase, use it within 7 days or reverse/return.');
        }

        const costPerUseHint = (() => {
            const freq = answers.usage_freq;
            const years = answers.lifespan === 'years' ? 3 : answers.lifespan === 'year' ? 1 : answers.lifespan === 'months' ? 0.4 : 0.1;
            const uses = freq === 'daily' ? 300 * years : freq === 'weekly' ? 50 * years : freq === 'monthly' ? 12 * years : 3 * years;
            if (!uses || !price) return null;
            return Math.round(price / Math.max(uses, 1));
        })();

        const brother = [
            `Senior financial advisor read — judged from your questionnaire + product signals only (Financial Ledger is separate on purpose).`,
            `Ticket: ${fmt(price)}. Funding: ${answers.money_source || 'unspecified'}. Stress if paid today: ${answers.can_afford || 'unspecified'}. Necessity ${nec}/5 · joy ${joy}/5.`,
            product.rating != null
                ? `Marketplace signal for THIS listing: ${product.rating.toFixed(1)}★` +
                    (product.review_count != null ? ` across ${Number(product.review_count).toLocaleString('en-IN')} ratings` : '') +
                    ((bi.pros || []).length || (bi.cons || []).length
                        ? ` · buyer themes mined: ${(bi.pros || []).length} pros / ${(bi.cons || []).length} cons.`
                        : '.')
                : `Marketplace rating could not be read confidently for this exact listing (related-product stars are ignored on purpose).`,
            costPerUseHint != null
                ? `Rough cost-per-use (from your frequency + lifespan answers): ~${fmt(costPerUseHint)} per use. If that number feels silly for what you get, wait or downsize.`
                : `I could not estimate cost-per-use cleanly — tighten frequency/lifespan answers next time.`,
            meter.band === 'green'
                ? `Life-balance ${meter.meter}/100 (green). Cash comfort and purpose are aligned enough for a clear-headed yes.`
                : meter.band === 'yellow'
                    ? `Life-balance ${meter.meter}/100 (yellow). This is a conditional file — yes only if the conditions below are met.`
                    : `Life-balance ${meter.meter}/100 (red). I would decline this purchase today and protect the buffer.`,
            `Composite judgment: ${overall}/100 across the full marked audit.`,
            `Hard recommendation: ${action}.`,
            answers.opportunity_cost === 'bills' || answers.opportunity_cost === 'debt'
                ? `Priority call: this competes with ${answers.opportunity_cost}. Obligations beat upgrades.`
                : `Opportunity cost: money otherwise protects “${answers.opportunity_cost || 'unspecified'}”.`,
            answers.cool_off === 'wont' || answers.urgency_timing === 'need_now_night' || answers.mood === 'yes'
                ? `Process risk is elevated (night cart / mood / no cool-off). Good advisors force a pause before payment — not after regret.`
                : `Process looks calmer. Still: buy the researched model only, no cart upsells.`,
            `Standard I use: a good buy is useful weekly+, funded without anxiety, survives a 48h cool-off, and future-you still thanks you in 6 months.`,
            answers.notes ? `Your note weighed in: “${answers.notes}”.` : `Tip: add advisor notes (deadline, EMI, why this model) for even sharper next verdicts.`
        ];
        return { action, pros, cons, brother, conditions };
    }

    function buildLifeVerdict(overall, meter, rawAnswers, price, meta) {
        const answers = normalizeLifeAnswers(rawAnswers);
        const heart = num(answers.heart_pull);
        const memory = num(answers.memory_value);
        let action;
        if (meter.band === 'green' && overall >= 65) action = 'YES — DO IT & SAVOR IT';
        else if (meter.band === 'green') action = 'YES — KEEP IT INTENTIONAL';
        else if (meter.band === 'yellow' && (memory >= 4 || answers.scarcity === 'rare' || answers.people_plan === 'gold')) action = 'YES IF MEANING IS HIGH — ELSE SHRINK IT';
        else if (meter.band === 'yellow') action = 'PAUSE — OR CHOOSE A LIGHTER VERSION';
        else if (answers.self_kindness === 'yes' && price <= 300 && answers.can_afford !== 'no' && answers.basic_needs === 'yes') action = 'TINY MERCY TREAT OK — KEEP IT SMALL';
        else action = 'SKIP — CARE FOR YOURSELF ANOTHER WAY';

        const pros = [];
        const cons = [];
        if (heart >= 4) pros.push('Your heart genuinely wants this.');
        if (memory >= 4) pros.push('Strong memory potential.');
        if (answers.people_plan === 'gold') pros.push('Shared with good people — high life ROI.');
        if (answers.scarcity === 'rare') pros.push('Rare window — timing matters.');
        if (answers.can_afford === 'easy' && answers.basic_needs === 'yes') pros.push('Affordable with basics safe.');
        if (answers.self_kindness === 'yes' && answers.recent_treats === 'long') pros.push('You\'ve been disciplined — a mindful yes can be healthy.');
        if (answers.presence === 'yes') pros.push('You plan to actually be present.');
        if (answers.tomorrow_feel === 'glad') pros.push('You expect to feel glad tomorrow.');

        if (answers.can_afford === 'no' || answers.can_afford === 'tight') cons.push('Money anxiety would tag along.');
        if (answers.basic_needs === 'no') cons.push('Basics would be at risk.');
        if (answers.why_now === 'fomo') cons.push('FOMO is driving this.');
        if (answers.habit_loop === 'yes' || answers.recent_treats === 'streak') cons.push('Feeds a spend streak / autopilot habit.');
        if (num(answers.waste_feel) >= 4) cons.push('Your gut already calls it wasteful.');
        if (answers.tomorrow_feel === 'regret') cons.push('You already predict regret.');
        if (answers.obligation === 'pressure') cons.push('Pressure, not desire.');
        if (answers.presence === 'no') cons.push('You probably won\'t even savor it.');
        if (answers.health === 'bad') cons.push('Tomorrow\'s body pays interest.');
        if (answers.social_signal === 'yes') cons.push('Flex/posting motive is in the mix.');
        if (answers.money_timing === 'payday' || answers.money_timing === 'owe') cons.push('Funding timing is weak.');

        const conditions = [];
        if (action.includes('PAUSE') || action.includes('SKIP') || action.includes('SHRINK') || action.includes('TINY')) {
            if (answers.alternative_home === 'home_ok' || answers.alternative_home === 'cheap_easy') conditions.push('Try the cheaper/home version first tonight.');
            if (answers.advisor_rule === 'sleep' || meter.band !== 'green') conditions.push('If still craving it, decide tomorrow morning — not in the urge.');
            if (price > 800) conditions.push('Shrink the plan (cheaper seat/dish/slot) before cancelling joy entirely.');
            conditions.push('Protect basics first; joy second.');
        } else {
            conditions.push('Be fully present — phone away for the core of the experience.');
            if (answers.people_plan === 'gold') conditions.push('Protect the people part — that\'s the real purchase.');
            conditions.push('No stack-on extras (upgrades, impulse add-ons) after you say yes.');
        }

        const brother = [
            `Senior advisor + big-brother hybrid: protect money without killing a life worth living.`,
            `Decision: ${meta.title} · ${fmt(price)} · type: ${meta.typeLabel || meta.type}${meta.alt ? ` · cheaper path noted: ${meta.alt}` : ''}.`,
            `Heart ${heart}/5 · memory ${memory}/5 · money feel: ${answers.can_afford || '—'} · basics: ${answers.basic_needs || '—'}.`,
            meter.band === 'green'
                ? `Life-balance ${meter.meter}/100 (green). This can be living, not leaking — say yes and actually savor it.`
                : meter.band === 'yellow'
                    ? `Life-balance ${meter.meter}/100 (yellow). Conditional: keep only if meaning beats the cheaper substitute.`
                    : `Life-balance ${meter.meter}/100 (red). Care for the need underneath (rest, loneliness, boredom) — not the cart.`,
            `Composite judgment: ${overall}/100 across the full marked audit.`,
            `Hard recommendation: ${action}.`,
            answers.why_now === 'rest' || answers.body_energy === 'drained'
                ? `Tired-brain rule: rest is allowed. A small intentional comfort can be kindness — autopilot delivery/scroll-spend is not the same thing.`
                : answers.people_plan === 'gold'
                    ? `People premium: shared time with good company is often the highest-ROI “purchase” available. Protect presence over extras.`
                    : `Joy is allowed. Waste is optional. Choose the version that leaves you proud tomorrow morning.`,
            answers.habit_loop === 'yes' || answers.recent_treats === 'streak'
                ? `Pattern alert: this sits on a streak/autopilot loop. Break the loop once — even with a tiny home version — so joy stays special.`
                : `Pattern looks intentional enough; still skip stack-on upgrades after you decide.`,
            answers.notes ? `I heard you: “${answers.notes}”.` : `Next time: tell me who you're with and what feeling you want — advice gets sharper.`
        ];
        return { action, pros, cons, brother, conditions };
    }

    function statusIcon(st) {
        return { pass: '✓', warn: '!', fail: '✕', info: '•' }[st] || '•';
    }

    function renderBuyerInsightsCard(product) {
        const bi = product && product.buyer_insights;
        if (!bi) return null;
        const pros = bi.pros || [];
        const cons = bi.cons || [];
        const samples = bi.sample_reviews || [];
        const aspects = bi.aspects || [];
        if (!pros.length && !cons.length && !samples.length && !bi.customers_say) return null;

        const card = Utils.el('div', { className: 'glass-card buy-buyer-card' });
        card.appendChild(Utils.el('h4', { className: 'card-title', textContent: 'What buyers actually say' }));

        const ratingBits = [];
        if (product.rating != null) ratingBits.push(`${Number(product.rating).toFixed(1)}★`);
        if (product.review_count != null) ratingBits.push(`${Number(product.review_count).toLocaleString('en-IN')} ratings`);
        if (product.rating_source) ratingBits.push(`source: ${product.rating_source}`);
        if (ratingBits.length) {
            card.appendChild(Utils.el('div', {
                className: 'buy-buyer-rating',
                textContent: 'This listing · ' + ratingBits.join(' · ')
            }));
        }
        if (bi.customers_say) {
            card.appendChild(Utils.el('p', { className: 'buy-buyer-say', textContent: bi.customers_say }));
        }
        if (bi.summary) {
            card.appendChild(Utils.el('div', { className: 'buy-buyer-meta', textContent: bi.summary }));
        }

        if (pros.length || cons.length) {
            const grid = Utils.el('div', { className: 'buy-buyer-grid' });
            const proBox = Utils.el('div', { className: 'buy-buyer-col' });
            proBox.appendChild(Utils.el('div', { className: 'buy-buyer-col-title', textContent: `Buyer pros (${pros.length})` }));
            (pros.length ? pros : [{ text: 'None counted', count: 0, detail: '' }]).forEach(p => {
                proBox.appendChild(Utils.el('div', { className: 'buy-buyer-chip pass' },
                    Utils.el('strong', { textContent: p.text }),
                    Utils.el('span', { textContent: p.count ? Number(p.count).toLocaleString('en-IN') : '—' }),
                    Utils.el('small', { textContent: p.detail || '' })
                ));
            });
            const conBox = Utils.el('div', { className: 'buy-buyer-col' });
            conBox.appendChild(Utils.el('div', { className: 'buy-buyer-col-title', textContent: `Buyer cons (${cons.length})` }));
            (cons.length ? cons : [{ text: 'None counted', count: 0, detail: '' }]).forEach(c => {
                conBox.appendChild(Utils.el('div', { className: 'buy-buyer-chip fail' },
                    Utils.el('strong', { textContent: c.text }),
                    Utils.el('span', { textContent: c.count ? Number(c.count).toLocaleString('en-IN') : '—' }),
                    Utils.el('small', { textContent: c.detail || '' })
                ));
            });
            grid.appendChild(proBox);
            grid.appendChild(conBox);
            card.appendChild(grid);
        }

        if (aspects.length) {
            const aspectWrap = Utils.el('div', { className: 'buy-aspect-list' });
            aspectWrap.appendChild(Utils.el('div', { className: 'buy-buyer-col-title', textContent: 'Aspect mention counts' }));
            aspects.slice(0, 8).forEach(a => {
                aspectWrap.appendChild(Utils.el('div', { className: 'buy-aspect-row' },
                    Utils.el('span', { textContent: a.name }),
                    Utils.el('span', { textContent: `${Number(a.total || 0).toLocaleString('en-IN')} · ${a.positive_pct || 0}% pos / ${a.negative_pct || 0}% neg` })
                ));
            });
            card.appendChild(aspectWrap);
        }

        if (samples.length) {
            const rev = Utils.el('div', { className: 'buy-sample-reviews' });
            rev.appendChild(Utils.el('div', {
                className: 'buy-buyer-col-title',
                textContent: `Sample customer reviews (${samples.length})`
            }));
            samples.slice(0, 6).forEach(s => {
                rev.appendChild(Utils.el('div', { className: 'buy-sample-review' },
                    Utils.el('div', { className: 'buy-sample-head', textContent: `${'★'.repeat(s.stars || 0)}${'☆'.repeat(Math.max(0, 5 - (s.stars || 0)))} · ${s.title || 'Review'}` }),
                    Utils.el('p', { textContent: s.body || '' })
                ));
            });
            card.appendChild(rev);
        }
        return card;
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
        letter.appendChild(Utils.el('h4', { className: 'card-title', textContent: kind === 'life' ? 'Senior advice (with heart)' : 'Senior financial advice' }));
        verdict.brother.forEach(line => letter.appendChild(Utils.el('p', { className: 'buy-brother-line', textContent: line })));
        root.appendChild(letter);

        if (verdict.conditions && verdict.conditions.length) {
            const cond = Utils.el('div', { className: 'glass-card buy-conditions-card' });
            cond.appendChild(Utils.el('h4', { className: 'card-title', textContent: 'Conditions / next steps' }));
            verdict.conditions.forEach((c, i) => {
                cond.appendChild(Utils.el('div', { className: 'buy-condition-item', textContent: `${i + 1}. ${c}` }));
            });
            root.appendChild(cond);
        }

        const buyerCard = renderBuyerInsightsCard(subject);
        if (buyerCard) root.appendChild(buyerCard);

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
        if (!report.fromHistory) {
            const saveBtn = Utils.el('button', {
                className: 'btn-primary',
                type: 'button',
                textContent: report.savedId ? '✓ Saved — update analysis' : '💾 Save full analysis'
            });
            saveBtn.addEventListener('click', async () => {
                await saveDecision(report);
                saveBtn.textContent = '✓ Saved — update analysis';
            });
            actions.appendChild(saveBtn);
            if (report.savedId) {
                actions.appendChild(Utils.el('div', {
                    className: 'buy-history-banner',
                    textContent: 'Full analysis auto-saved under Past verdicts — reopen anytime'
                }));
            }
        } else {
            actions.appendChild(Utils.el('div', {
                className: 'buy-history-banner',
                textContent: `Saved verdict · ${report.savedDate || ''} · full advice, conditions, pros/cons + every parameter mark`
            }));
        }
        const againBtn = Utils.el('button', { className: 'btn-secondary', type: 'button', textContent: report.fromHistory ? '← Back to list' : '↺ New analysis' });
        againBtn.addEventListener('click', () => {
            root.classList.add('hidden');
            root.innerHTML = '';
            if (report.fromHistory) {
                document.getElementById('buy-history')?.scrollIntoView({ behavior: 'smooth' });
            } else {
                const target = kind === 'life' ? 'life-input-section' : 'buy-input-section';
                document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
            }
        });
        actions.appendChild(againBtn);
        root.appendChild(actions);
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function saveDecision(report, opts = {}) {
        // Persist the complete analysis so it can be reopened later
        const id = report.savedId || Utils.uid();
        const createdAt = report.savedAt || Date.now();
        const date = report.savedDate || Utils.todayStr();
        const snapshot = {
            kind: report.kind,
            subject: report.subject,
            price: report.price,
            answers: report.answers,
            parameters: report.parameters,
            stats: report.stats,
            meter: report.meter,
            verdict: report.verdict
        };
        const rec = {
            id,
            createdAt,
            date,
            kind: report.kind || 'product',
            title: (report.subject && report.subject.title) || 'Decision',
            url: (report.subject && report.subject.url) || '',
            host: (report.subject && report.subject.host) || '',
            price: report.price,
            meter: report.meter.meter,
            band: report.meter.band,
            overall: report.stats.overall,
            action: report.verdict.action,
            paramCount: report.stats.total,
            pass: report.stats.pass,
            warn: report.stats.warn,
            fail: report.stats.fail,
            fullReport: snapshot
        };
        await ThriveDB.put('buyDecisions', rec);
        report.savedId = id;
        report.savedAt = createdAt;
        report.savedDate = date;
        _lastReport = report;
        if (!opts.silent) Utils.toast('Full analysis saved — reopen anytime from Past verdicts', 'success');
        await renderHistory();
        return rec;
    }

    function openSavedVerdict(rec) {
        if (!rec.fullReport) {
            Utils.toast('This older save has scores only. Re-run analysis — new saves keep the full advice + audit.', 'warning');
            return;
        }
        const report = Object.assign({}, rec.fullReport, {
            fromHistory: true,
            savedId: rec.id,
            savedAt: rec.createdAt,
            savedDate: rec.date
        });
        if (report.kind === 'life') setMode('life', { keepReport: true });
        else setMode('product', { keepReport: true });
        _lastReport = report;
        renderReport(report);
        document.getElementById('buy-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                Utils.el('div', { className: 'empty-state-text', textContent: 'No past verdicts yet. Run an analysis and save it to reopen the full report later.' })
            ));
            return;
        }
        all.slice(0, 30).forEach(rec => {
            const card = Utils.el('div', { className: `buy-history-item buy-band-${rec.band || 'yellow'}` });
            card.appendChild(Utils.el('div', { className: 'buy-history-top' },
                Utils.el('strong', { textContent: `${rec.kind === 'life' ? '🌙 ' : '🛒 '}${rec.title || 'Decision'}` }),
                Utils.el('span', { className: 'buy-history-meter', textContent: `${rec.meter ?? '—'}` })
            ));
            card.appendChild(Utils.el('div', { className: 'buy-history-meta', textContent:
                `${fmt(rec.price || 0)} · ${rec.action || ''} · ${rec.date || ''}` +
                (rec.fullReport ? ' · full analysis saved' : ' · scores only')
            }));
            const btns = Utils.el('div', { className: 'buy-history-actions' });
            const view = Utils.el('button', {
                className: 'buy-history-view',
                type: 'button',
                textContent: rec.fullReport ? 'View analysis' : 'No full save'
            });
            view.disabled = !rec.fullReport;
            view.addEventListener('click', (e) => {
                e.stopPropagation();
                openSavedVerdict(rec);
            });
            const del = Utils.el('button', { className: 'buy-history-del', type: 'button', textContent: 'Delete' });
            del.addEventListener('click', async (e) => {
                e.stopPropagation();
                await ThriveDB.remove('buyDecisions', rec.id);
                Utils.toast('Removed', 'warning');
                renderHistory();
            });
            btns.appendChild(view);
            btns.appendChild(del);
            card.appendChild(btns);
            if (rec.fullReport) {
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => openSavedVerdict(rec));
            }
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
            // Never fill rating from a lower-confidence / empty source — wrong stars are worse than none
            const outConf = out.rating_confidence || 0;
            const otherConf = other.rating_confidence || 0;
            if ((out.rating == null && other.rating != null && otherConf >= 60) ||
                (other.rating != null && otherConf > outConf && otherConf >= 60)) {
                out.rating = other.rating;
                out.review_count = other.review_count;
                out.rating_confidence = otherConf;
                out.rating_source = other.rating_source;
                out.star_breakdown = other.star_breakdown || out.star_breakdown;
            }
            if (!out.buyer_insights && other.buyer_insights) out.buyer_insights = other.buyer_insights;
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
            (product.rating != null ? ` · ${product.rating.toFixed(1)}★` : '') +
            (product.review_count != null ? ` · ${Number(product.review_count).toLocaleString('en-IN')} ratings` : '')
        }));
        if (product.sentiment && product.sentiment.summary) {
            info.appendChild(Utils.el('p', { className: 'buy-product-desc', textContent: product.sentiment.summary }));
        }
        const biPrev = product.buyer_insights || {};
        if ((biPrev.pros || []).length || (biPrev.cons || []).length) {
            info.appendChild(Utils.el('p', { className: 'buy-product-desc', textContent:
                `Buyers: ${(biPrev.pros || []).slice(0, 3).map(p => `+${p.text}(${p.count})`).join(', ') || '—'}` +
                ` · ${(biPrev.cons || []).slice(0, 3).map(c => `−${c.text}(${c.count})`).join(', ') || 'no major cons counted'}`
            }));
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
            await saveDecision(report, { silent: true });
            renderReport(report);
            Utils.toast('Full report ready · saved under Past verdicts', 'success');
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
            await saveDecision(report, { silent: true });
            renderReport(report);
            Utils.toast('Full report ready · saved under Past verdicts', 'success');
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
