/* ============================================================
   THRIVE v3 — Focus Garden (Gamified Pomodoro Engine)
   Grow plants, harvest fruits, stay focused! 🌱
   ============================================================ */

const PomodoroModule = (() => {
    const RING_CIRCUM = 848.23;
    const FOCUS_RING_CIRCUM = 942.48;

    const FRUITS = [
        { id:'apple',      name:'Apple',      emoji:'🍎', stageTime:15, stages:5,  difficulty:'Easy',      color:'#EF4444', diffColor:'#10B981' },
        { id:'cherry',     name:'Cherry',     emoji:'🍒', stageTime:15, stages:6,  difficulty:'Easy',      color:'#DC2626', diffColor:'#10B981' },
        { id:'orange',     name:'Orange',     emoji:'🍊', stageTime:20, stages:6,  difficulty:'Medium',    color:'#F97316', diffColor:'#F59E0B' },
        { id:'strawberry', name:'Strawberry', emoji:'🍓', stageTime:20, stages:7,  difficulty:'Medium',    color:'#F43F5E', diffColor:'#F59E0B' },
        { id:'watermelon', name:'Watermelon', emoji:'🍉', stageTime:25, stages:8,  difficulty:'Hard',      color:'#10B981', diffColor:'#EF4444' },
        { id:'peach',      name:'Peach',      emoji:'🍑', stageTime:30, stages:7,  difficulty:'Hard',      color:'#FB923C', diffColor:'#EF4444' },
        { id:'mango',      name:'Mango',      emoji:'🥭', stageTime:40, stages:9,  difficulty:'Legendary', color:'#EAB308', diffColor:'#8B5CF6' }
    ];

    const STAGE_NAMES = ['Seed','Sprout','Seedling','Small Plant','Bush','Tree','Flowering','Fruiting','Ripe!'];
    const STAGE_ICONS = ['🌰','🌱','🪴','🌿','🌳','🌲','🌸','🍈','✨'];

    const QUOTES = [
        { text:"The only way to do great work is to love what you do.", author:"Steve Jobs" },
        { text:"Life is what happens when you're busy making other plans.", author:"John Lennon" },
        { text:"The future belongs to those who believe in the beauty of their dreams.", author:"Eleanor Roosevelt" },
        { text:"It is during our darkest moments that we must focus to see the light.", author:"Aristotle" },
        { text:"The way to get started is to quit talking and begin doing.", author:"Walt Disney" },
        { text:"Everything you want is on the other side of fear.", author:"George Addair" },
        { text:"Believe you can and you're halfway there.", author:"Theodore Roosevelt" },
        { text:"The best time to plant a tree was 20 years ago. The second best time is now.", author:"Chinese Proverb" },
        { text:"Don't watch the clock; do what it does. Keep going.", author:"Sam Levenson" },
        { text:"The only impossible journey is the one you never begin.", author:"Tony Robbins" },
        { text:"In the middle of every difficulty lies opportunity.", author:"Albert Einstein" },
        { text:"What lies behind us and what lies before us are tiny matters compared to what lies within us.", author:"Ralph Waldo Emerson" },
        { text:"You are never too old to set another goal or to dream a new dream.", author:"C.S. Lewis" },
        { text:"The only limits are the ones you place on yourself.", author:"Unknown" },
        { text:"Success is not final, failure is not fatal.", author:"Winston Churchill" },
        { text:"Your time is limited, don't waste it living someone else's life.", author:"Steve Jobs" },
        { text:"The future depends on what you do today.", author:"Mahatma Gandhi" },
        { text:"Don't let yesterday take up too much of today.", author:"Will Rogers" },
        { text:"You miss 100% of the shots you don't take.", author:"Wayne Gretzky" },
        { text:"Hard work beats talent when talent doesn't work hard.", author:"Tim Notke" },
        { text:"Small daily improvements over time lead to stunning results.", author:"Robin Sharma" },
        { text:"Focus on being productive instead of busy.", author:"Tim Ferriss" },
        { text:"A river cuts through rock not because of its power but because of its persistence.", author:"Jim Watkins" },
        { text:"The secret of getting ahead is getting started.", author:"Mark Twain" },
        { text:"It always seems impossible until it's done.", author:"Nelson Mandela" },
        { text:"Do what you can, with what you have, where you are.", author:"Theodore Roosevelt" },
        { text:"The only person you are destined to become is the person you decide to be.", author:"Ralph Waldo Emerson" },
        { text:"What we plant in the soil of contemplation, we shall reap in the harvest of action.", author:"Meister Eckhart" },
        { text:"Every expert was once a beginner.", author:"Helen Hayes" },
        { text:"Discipline is the bridge between goals and accomplishment.", author:"Jim Rohn" },
        { text:"The mind is everything. What you think you become.", author:"Buddha" },
        { text:"Start where you are. Use what you have. Do what you can.", author:"Arthur Ashe" },
        { text:"Energy and persistence conquer all things.", author:"Benjamin Franklin" },
        { text:"Be not afraid of growing slowly, be afraid only of standing still.", author:"Chinese Proverb" },
        { text:"Genius is 1% inspiration and 99% perspiration.", author:"Thomas Edison" },
        { text:"Learning is not attained by chance, it must be sought for with ardor.", author:"Abigail Adams" },
        { text:"The expert in anything was once a beginner.", author:"Helen Hayes" },
        { text:"Study hard what interests you the most in the most undisciplined manner.", author:"Richard Feynman" },
        { text:"Education is not the filling of a pail, but the lighting of a fire.", author:"W.B. Yeats" },
        { text:"The roots of education are bitter, but the fruit is sweet.", author:"Aristotle" }
    ];

    // === STATE ===
    let _timer = null, _totalSec = 25*60, _remaining = 25*60;
    let _isRunning = false, _isPaused = false, _focusMode = false;
    let _config = { focusMin:25, breakMin:5, longBreakMin:15, sessionsBeforeLong:4 };
    let _currentSession = 1, _totalSessions = 4, _isBreak = false;
    let _currentSubject = null, _currentSubjectName = null;
    let _selectedFruit = null, _gardenProgress = null;
    let _quoteTimer = null, _qIdx = 0;
    
    // Break resume state
    let _savedFocusRemaining = 0, _savedFocusTotal = 0;
    let _sessionFocusSecElapsed = 0;

    // Wake Lock
    let _wakeLock = null;

    // === INIT ===
    async function init() {
        await loadConfig();
        await loadGarden();
        await renderStats();
        await renderCollection();
        displayDailyQuote();
        syncQuickGrid();
        updateDisplay();
        wireEvents();
        if (typeof FocusMusic !== 'undefined') FocusMusic.init();
    }

    async function loadConfig() {
        const cfg = await ThriveDB.get('pomodoroConfig','default');
        if (cfg) _config = cfg;
        _totalSec = _config.focusMin * 60;
        _remaining = _totalSec;
    }

    async function loadGarden() {
        try {
            const p = await ThriveDB.get('focusGarden','today_progress');
            if (p && p.date === Utils.todayStr()) { _gardenProgress = p; _selectedFruit = FRUITS.find(f=>f.id===p.fruitId); }
            else { _gardenProgress = null; _selectedFruit = null; }
        } catch(e) { _gardenProgress = null; }
    }

    async function saveGarden() { if (_gardenProgress) await ThriveDB.put('focusGarden', _gardenProgress); }

    async function loadCollection() {
        try { const c = await ThriveDB.get('focusGarden','collection'); return c ? c.fruits : {}; }
        catch(e) { return {}; }
    }

    async function addToCollection(fid) {
        const c = await loadCollection();
        c[fid] = (c[fid]||0) + 1;
        await ThriveDB.put('focusGarden', { id:'collection', fruits:c });
    }

    function syncQuickGrid() {
        document.querySelectorAll('.pomo-quick-btn').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.time) === _config.focusMin);
        });
    }

    // === QUOTES ===
    function getDayOfYear() { const n=new Date(), s=new Date(n.getFullYear(),0,0); return Math.floor((n-s)/(864e5)); }

    function displayDailyQuote() {
        try {
            _qIdx = getDayOfYear() % QUOTES.length;
            const q = QUOTES[_qIdx];
            const t = document.getElementById('daily-motivation-text');
            const a = document.getElementById('daily-motivation-author');
            if (t) t.textContent = q.text;
            if (a) a.textContent = '— ' + q.author;
            setFocusQuote(q);
        } catch(e) { console.warn('[Pomo] Quote err:', e); }
    }

    function setFocusQuote(q) {
        const el = document.getElementById('focus-quote-text');
        if (el) el.textContent = `"${q.text}" — ${q.author}`;
    }

    function rotateQuote() {
        _qIdx = (_qIdx + 1) % QUOTES.length;
        const el = document.getElementById('focus-quote-text');
        if (el) {
            el.style.transition = 'opacity 0.5s';
            el.style.opacity = '0';
            setTimeout(() => { setFocusQuote(QUOTES[_qIdx]); el.style.opacity = '1'; }, 600);
        }
    }

    function startQuoteRotation() { stopQuoteRotation(); _quoteTimer = setInterval(rotateQuote, 300000); }
    function stopQuoteRotation() { if (_quoteTimer) { clearInterval(_quoteTimer); _quoteTimer = null; } }

    // === WAKE LOCK ===
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                _wakeLock = await navigator.wakeLock.request('screen');
                _wakeLock.addEventListener('release', () => { console.log('[Thrive] Wake Lock released'); });
                console.log('[Thrive] Wake Lock active');
            } catch (err) { console.warn('[Thrive] Wake Lock failed:', err); }
        }
    }

    function releaseWakeLock() {
        if (_wakeLock !== null) {
            _wakeLock.release().then(() => { _wakeLock = null; });
        }
    }

    // === DISPLAY ===
    function updateDisplay() {
        const m = Math.floor(_remaining/60), s = _remaining%60;
        const ts = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        document.getElementById('pomo-time').textContent = ts;
        const pct = ((_totalSec - _remaining) / _totalSec) * 100;
        document.getElementById('pomo-progress').setAttribute('stroke-dashoffset', RING_CIRCUM - (pct/100)*RING_CIRCUM);
        
        let labelStr = _isBreak ? 'Break Time ☕' : (_selectedFruit ? `Growing ${_selectedFruit.emoji}` : 'Focus Session');
        document.getElementById('pomo-label').textContent = labelStr;
        document.getElementById('pomo-session-counter').textContent = `Session ${_currentSession} / ${_totalSessions}`;

        const sl = document.getElementById('pomo-subject-label');
        if (sl) { if (_currentSubjectName && !_isBreak) { sl.textContent = `📚 ${_currentSubjectName}`; sl.style.display='block'; } else sl.style.display='none'; }

        if (_focusMode) {
            document.getElementById('focus-time').textContent = ts;
            document.getElementById('focus-progress').setAttribute('stroke-dashoffset', FOCUS_RING_CIRCUM - (pct/100)*FOCUS_RING_CIRCUM);
            const fl = document.getElementById('focus-label');
            if (fl) fl.textContent = labelStr;
            
            const pi = document.getElementById('focus-paused-info');
            const pt = document.getElementById('focus-paused-time');
            if (_isBreak && pi && pt) {
                pi.classList.remove('hidden');
                const pm = Math.floor(_savedFocusRemaining/60), ps = _savedFocusRemaining%60;
                pt.textContent = `${String(pm).padStart(2,'0')}:${String(ps).padStart(2,'0')}`;
            } else if (pi) {
                pi.classList.add('hidden');
            }
        }
        document.title = _isRunning ? `${ts} — Thrive` : 'Thrive — Life OS';
    }

    // === PLANT SVG ===
    function generatePlantSVG(stage, fruit) {
        if (!fruit) return '';
        const total = fruit.stages;
        const pct = Math.min(stage / Math.max(total-1, 1), 1);
        const fc = fruit.color;

        const potTop = 215, soilY = 210;
        let svg = `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<defs>
            <linearGradient id="gPot" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#C4956A"/><stop offset="50%" stop-color="#D4A574"/><stop offset="100%" stop-color="#B8845A"/></linearGradient>
            <linearGradient id="gLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#66BB6A"/><stop offset="100%" stop-color="#43A047"/></linearGradient>
            <linearGradient id="gSoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5D4037"/><stop offset="100%" stop-color="#4E342E"/></linearGradient>
            <filter id="pShadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.12"/></filter>
        </defs>`;
        // Pot
        svg += `<path d="M60,${potTop} L68,260 Q100,268 132,260 L140,${potTop} Z" fill="url(#gPot)"/>`;
        svg += `<rect x="55" y="${potTop-8}" width="90" height="12" rx="4" fill="#D4A574" stroke="#B8845A" stroke-width="0.5"/>`;
        svg += `<ellipse cx="100" cy="${soilY}" rx="36" ry="8" fill="url(#gSoil)"/>`;

        if (stage === 0) {
            svg += `<ellipse cx="100" cy="${soilY-2}" rx="7" ry="5" fill="#8D6E63" stroke="#6D4C41" stroke-width="0.8"/>`;
            svg += `<path d="M100,${soilY-7} Q103,${soilY-12} 100,${soilY-15}" stroke="#A5D6A7" stroke-width="1.2" fill="none" opacity="0.6"/>`;
        } else {
            const stemH = Math.min(30 + pct*120, 150);
            const stemTop = soilY - stemH;
            const sw = 4 + pct*4;
            svg += `<rect x="${100-sw/2}" y="${stemTop}" width="${sw}" height="${stemH}" rx="${sw/2}" fill="#4CAF50" filter="url(#pShadow)"/>`;

            const nPairs = Math.min(Math.ceil(pct*6), 6);
            for (let i=0; i<nPairs; i++) {
                const ly = stemTop + stemH * ((i+1)/(nPairs+1)) * 0.75;
                const ls = (10 + pct*14) * (1 - (i/(nPairs+1))*0.3);
                const side = i%2===0 ? -1 : 1;
                const bl = ls*1.3;
                svg += `<line x1="100" y1="${ly}" x2="${100+side*bl}" y2="${ly-6}" stroke="#388E3C" stroke-width="${1.5+pct}" stroke-linecap="round"/>`;
                svg += `<ellipse cx="${100+side*(bl+ls*0.35)}" cy="${ly-8}" rx="${ls}" ry="${ls*0.42}" fill="url(#gLeaf)" transform="rotate(${side*22+i*4},${100+side*(bl+ls*0.35)},${ly-8})" opacity="0.9">
                    <animateTransform attributeName="transform" type="rotate" values="${side*20+i*4};${side*24+i*4};${side*20+i*4}" dur="${2.5+i*0.3}s" repeatCount="indefinite" additive="sum"/>
                </ellipse>`;
            }

            if (pct >= 0.45) {
                const cs = (pct-0.45)/0.55;
                const cr = 18 + cs*38;
                svg += `<circle cx="100" cy="${stemTop-cr*0.25}" r="${cr}" fill="#43A047" opacity="${0.35+cs*0.35}"/>`;
                svg += `<circle cx="82" cy="${stemTop-cr*0.5}" r="${cr*0.7}" fill="#66BB6A" opacity="${0.3+cs*0.25}"/>`;
                svg += `<circle cx="118" cy="${stemTop-cr*0.35}" r="${cr*0.6}" fill="#4CAF50" opacity="${0.3+cs*0.3}"/>`;
                svg += `<circle cx="95" cy="${stemTop-cr*0.7}" r="${cr*0.45}" fill="#81C784" opacity="${0.25+cs*0.2}"/>`;
            }

            if (pct >= 0.65 && pct < 0.85) {
                const fps = [[82,stemTop-18],[118,stemTop-24],[96,stemTop-40],[108,stemTop-34],[90,stemTop-46]];
                const nf = Math.min(Math.ceil((pct-0.65)*25), 5);
                for (let i=0; i<nf; i++) {
                    const [fx,fy]=fps[i];
                    for (let p=0; p<5; p++) {
                        const a=(p*72)*Math.PI/180;
                        svg += `<circle cx="${fx+Math.cos(a)*5}" cy="${fy+Math.sin(a)*5}" r="2.8" fill="white" opacity="0.85"/>`;
                    }
                    svg += `<circle cx="${fx}" cy="${fy}" r="2.5" fill="${fc}"/>`;
                }
            }

            if (pct >= 0.8) {
                const fps = [[78,stemTop-10],[122,stemTop-18],[90,stemTop-36],[112,stemTop-28]];
                const nf = pct>=1 ? 4 : Math.min(Math.ceil((pct-0.8)*15), 3);
                const fr = pct>=1 ? 10 : 6;
                for (let i=0; i<nf; i++) {
                    const [fx,fy]=fps[i];
                    svg += `<circle cx="${fx+1}" cy="${fy+1}" r="${fr}" fill="rgba(0,0,0,0.08)"/>`;
                    svg += `<circle cx="${fx}" cy="${fy}" r="${fr}" fill="${fc}"><animate attributeName="r" values="${fr};${fr+0.5};${fr}" dur="3s" repeatCount="indefinite"/></circle>`;
                    svg += `<circle cx="${fx-2}" cy="${fy-2}" r="${fr*0.3}" fill="white" opacity="0.45"/>`;
                }
            }

            if (pct >= 1) {
                const sps = [[70,stemTop-44],[130,stemTop-32],[100,stemTop-58],[82,stemTop-52],[118,stemTop-48]];
                svg += `<g>`;
                for (let i=0; i<sps.length; i++) {
                    const [sx,sy]=sps[i];
                    svg += `<g transform="translate(${sx},${sy})">
                        <line x1="-4" y1="0" x2="4" y2="0" stroke="#FFD700" stroke-width="1.8"><animate attributeName="opacity" values="0.2;1;0.2" dur="${1+i*0.25}s" repeatCount="indefinite"/></line>
                        <line x1="0" y1="-4" x2="0" y2="4" stroke="#FFD700" stroke-width="1.8"><animate attributeName="opacity" values="0.2;1;0.2" dur="${1+i*0.25}s" repeatCount="indefinite"/></line>
                    </g>`;
                }
                svg += `</g>`;
            }
        }

        svg += `</svg>`;
        return svg;
    }

    function updatePlantDisplay() {
        const c = document.getElementById('garden-plant');
        if (!c || !_selectedFruit || !_gardenProgress) return;
        c.innerHTML = generatePlantSVG(_gardenProgress.currentStage, _selectedFruit);
        const vs = Math.round((_gardenProgress.currentStage / Math.max(_selectedFruit.stages-1,1)) * 8);
        const sl = document.getElementById('garden-stage-label');
        if (sl) sl.textContent = `${STAGE_ICONS[Math.min(vs,8)]} ${STAGE_NAMES[Math.min(vs,8)]}`;
        const bar = document.getElementById('garden-progress-bar');
        if (bar) bar.style.width = `${(_gardenProgress.currentStage / Math.max(_selectedFruit.stages-1,1)) * 100}%`;
        const sc = document.getElementById('garden-stage-count');
        if (sc) sc.textContent = `Stage ${_gardenProgress.currentStage} / ${_selectedFruit.stages-1}`;
        const fi = document.getElementById('garden-fruit-icon');
        const fn = document.getElementById('garden-fruit-name');
        if (fi) fi.textContent = _selectedFruit.emoji;
        if (fn) fn.textContent = _selectedFruit.name;
    }

    // === SEED SELECTION ===
    function showSeedModal() {
        let html = '<div class="seed-modal"><p class="seed-subtitle">Choose your seed — harder fruits need more focus time!</p><div class="seed-grid">';
        FRUITS.forEach(f => {
            const tt = f.stageTime * f.stages;
            const th = Math.floor(tt/60), tm = tt%60;
            const ts = th > 0 ? `${th}h${tm>0?' '+tm+'m':''}` : `${tm}m`;
            const hasProgress = _gardenProgress && _gardenProgress.fruitId === f.id && _gardenProgress.date === Utils.todayStr() && _gardenProgress.currentStage > 0;
            html += `<button class="seed-card" data-fruit="${f.id}">
                <span class="seed-emoji">${f.emoji}</span>
                <span class="seed-name">${f.name}</span>
                <span class="seed-time">${f.stageTime}m / stage</span>
                <span class="seed-total">Total: ${ts}</span>
                <span class="seed-diff" style="background:${f.diffColor}">${f.difficulty}</span>
                ${hasProgress ? '<span class="seed-resume">▶ Resume</span>' : ''}
            </button>`;
        });
        html += '</div><div class="seed-actions"><button id="seed-plant-btn" class="btn-pomo-main" disabled>🌱 Plant & Focus</button> <button id="seed-skip-btn" class="btn-secondary" style="margin-left: 8px;">⏱️ Just Timer</button></div></div>';

        Utils.showModal('🌱 Pick Your Seed', html, '');

        let selId = null;
        document.querySelectorAll('.seed-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.seed-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selId = card.dataset.fruit;
                document.getElementById('seed-plant-btn').disabled = false;
            });
        });
        document.getElementById('seed-plant-btn').addEventListener('click', () => {
            if (!selId) return;
            Utils.closeModal();
            beginGardenSession(FRUITS.find(f => f.id === selId));
        });
        document.getElementById('seed-skip-btn').addEventListener('click', () => {
            Utils.closeModal();
            beginStandardSession();
        });
    }

    function beginStandardSession() {
        _selectedFruit = null;
        _gardenProgress = null;
        _totalSessions = _config.sessionsBeforeLong || 4;
        _currentSession = 1;
        _totalSec = _config.focusMin * 60;
        _remaining = _totalSec;
        _sessionFocusSecElapsed = 0;
        
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.style.display = 'none';
        
        updateDisplay();
        start();
    }

    function beginGardenSession(fruit) {
        _selectedFruit = fruit;
        _config.focusMin = fruit.stageTime;
        _totalSessions = fruit.stages;

        if (_gardenProgress && _gardenProgress.fruitId === fruit.id && _gardenProgress.date === Utils.todayStr()) {
            _currentSession = _gardenProgress.currentStage + 1;
        } else {
            _currentSession = 1;
            _gardenProgress = { id:'today_progress', fruitId:fruit.id, currentStage:0, date:Utils.todayStr() };
            saveGarden();
        }
        _totalSec = fruit.stageTime * 60;
        _remaining = _totalSec;
        _sessionFocusSecElapsed = 0;
        
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.style.display = '';
        
        updateDisplay();
        start();
    }

    // === CONTROLS ===
    function start() {
        if (_isRunning && !_isPaused) return;
        _isRunning = true; _isPaused = false;
        requestWakeLock();
        document.getElementById('pomo-start').classList.add('hidden');
        document.getElementById('pomo-pause').classList.remove('hidden');
        document.getElementById('pomo-stop-save').classList.remove('hidden');
        if (!_isBreak && !_focusMode) enterFocus();
        setFocusControls('running');
        startQuoteRotation();
        _timer = setInterval(() => { 
            _remaining--; 
            if (!_isBreak) _sessionFocusSecElapsed++;
            updateDisplay(); 
            if (_remaining <= 0) complete(); 
        }, 1000);
    }

    function pause() {
        _isPaused = true; clearInterval(_timer);
        releaseWakeLock();
        document.getElementById('pomo-start').classList.remove('hidden');
        document.getElementById('pomo-start').innerHTML = '▶ Resume';
        document.getElementById('pomo-pause').classList.add('hidden');
        document.getElementById('pomo-stop-save').classList.remove('hidden');
        setFocusControls('paused');
        stopQuoteRotation();
    }

    function reset() {
        clearInterval(_timer); _isRunning=false; _isPaused=false; _isBreak=false; _currentSession=1;
        releaseWakeLock();
        _currentSubject=null; _currentSubjectName=null;
        _selectedFruit=null; _gardenProgress=null;
        _totalSec = _config.focusMin*60; _remaining = _totalSec;
        _sessionFocusSecElapsed = 0;
        document.getElementById('pomo-start').classList.remove('hidden');
        document.getElementById('pomo-start').innerHTML = '▶ Start';
        document.getElementById('pomo-pause').classList.add('hidden');
        document.getElementById('pomo-stop-save').classList.add('hidden');
        exitFocus(); stopQuoteRotation(); updateDisplay();
        document.title = 'Thrive — Life OS';
    }

    function setFocusControls(state) {
        const r=document.getElementById('focus-resume');
        const p=document.getElementById('focus-pause');
        const b=document.getElementById('focus-break');
        const eb=document.getElementById('focus-end-break');
        if (!r) return;
        r.classList.toggle('hidden', state!=='paused');
        p.classList.toggle('hidden', state!=='running');
        b.classList.toggle('hidden', state==='break');
        if (eb) eb.classList.toggle('hidden', state!=='break');
    }

    // === LOGGING ===
    async function logSession(mins) {
        await ThriveDB.put('pomodoro', { id:Utils.uid(), date:Utils.todayStr(), duration:mins, completedAt:Date.now() });
        const timeStr = `${Math.floor(mins)}m ${Math.round((mins%1)*60)}s`;
        await ThriveDB.put('activities', { id:Utils.uid(), type:'study', name:`${timeStr} Focus (Session ${_currentSession})`, duration:mins, date:Utils.todayStr(), timeStr:Utils.nowTime(), timestamp:Date.now() });
        if (_currentSubject) {
            await ThriveDB.put('studySessions', { id:'ss_'+Date.now(), subject:_currentSubject, date:Utils.todayStr(), duration:mins, startTime:Date.now()-(mins*60000), endTime:Date.now() });
            if (typeof StudyModule !== 'undefined' && StudyModule.refresh) StudyModule.refresh();
        }
    }

    async function stopAndSave() {
        clearInterval(_timer);
        const mins = _sessionFocusSecElapsed / 60;
        if (mins > 1/60) { // Log if more than 1 second elapsed
            await logSession(mins);
            const m = Math.floor(mins), s = Math.round((mins%1)*60);
            Utils.toast(`✅ Saved ${m}m ${s}s Focus Session`, 'success');
            renderStats(); renderCollection();
            if (typeof DashboardModule !== 'undefined') DashboardModule.refresh();
        }
        reset();
    }

    async function complete() {
        clearInterval(_timer); _isRunning = false; releaseWakeLock();
        if (!_isBreak) {
            await logSession(_config.focusMin);
            Utils.toast(`🎉 Session ${_currentSession} complete!`, 'success');
            Utils.sendNotification('🎉 Session Complete!', `Focus session ${_currentSession} done!`, 'pomo');
            if (navigator.vibrate) navigator.vibrate([200,100,200]);

            // Advance plant
            if (_gardenProgress && _selectedFruit) {
                _gardenProgress.currentStage = Math.min(_gardenProgress.currentStage+1, _selectedFruit.stages-1);
                await saveGarden();

                // Growth notification
                const vs = Math.round((_gardenProgress.currentStage / Math.max(_selectedFruit.stages-1,1)) * 8);
                const stageName = STAGE_NAMES[Math.min(vs,8)];
                const stageIcon = STAGE_ICONS[Math.min(vs,8)];
                Utils.sendNotification(`${stageIcon} Your plant grew!`, `${_selectedFruit.emoji} ${_selectedFruit.name} → ${stageName} (Stage ${_gardenProgress.currentStage}/${_selectedFruit.stages-1})`, 'garden');

                // Expand sidebar briefly to show growth
                const sidebar = document.getElementById('focus-sidebar');
                if (sidebar) sidebar.classList.remove('collapsed');

                const pc = document.getElementById('garden-plant');
                if (pc) {
                    pc.classList.add('watering');
                    setTimeout(() => {
                        pc.classList.remove('watering');
                        updatePlantDisplay();
                        pc.classList.add('growing');
                        setTimeout(() => {
                            pc.classList.remove('growing');
                            // Auto-collapse sidebar after showing growth
                            setTimeout(() => { if (sidebar) sidebar.classList.add('collapsed'); }, 2000);
                        }, 900);
                    }, 2200);
                } else { updatePlantDisplay(); }

                // Harvest?
                if (_gardenProgress.currentStage >= _selectedFruit.stages - 1) {
                    await addToCollection(_selectedFruit.id);
                    Utils.sendNotification(`🎉 Harvest!`, `You grew a ${_selectedFruit.emoji} ${_selectedFruit.name}! Check your garden collection.`, 'harvest');
                    setTimeout(() => {
                        Utils.toast(`🎉 You harvested a ${_selectedFruit.emoji} ${_selectedFruit.name}!`, 'success');
                        const pc2 = document.getElementById('garden-plant');
                        if (pc2) pc2.classList.add('harvesting');
                        setTimeout(() => { exitFocus(); reset(); renderStats(); renderCollection(); }, 3500);
                    }, 2500);
                    return;
                }
            }

            // Auto-start next session
            renderStats();
            if (typeof DashboardModule !== 'undefined') DashboardModule.refresh();
            Utils.toast(`🌱 Next session starting in 3s...`, 'info');
            _currentSession++;
            _totalSec = _selectedFruit ? _selectedFruit.stageTime*60 : _config.focusMin*60;
            _remaining = _totalSec;
            updateDisplay();
            setTimeout(() => { _isRunning = false; start(); }, 3000);
        } else {
            // Break over -> Restore Focus Session
            endBreak();
        }
    }

    // === BREAK SYSTEM ===
    function showBreakPicker() {
        if (_isBreak) return;
        pause(); // ensure timer is paused before selecting
        const pk = document.getElementById('focus-break-picker');
        if (pk) { pk.classList.remove('hidden'); setFocusControls('break'); }
    }

    function startBreak(mins) {
        const pk = document.getElementById('focus-break-picker');
        if (pk) pk.classList.add('hidden');
        
        // Save current focus state
        _savedFocusRemaining = _remaining;
        _savedFocusTotal = _totalSec;
        
        _isBreak = true; 
        _totalSec = mins*60; 
        _remaining = _totalSec;
        _isRunning = true; _isPaused = false;
        
        requestWakeLock();
        updateDisplay();
        setFocusControls('break');
        clearInterval(_timer);
        _timer = setInterval(() => { _remaining--; updateDisplay(); if (_remaining <= 0) complete(); }, 1000);
    }

    function endBreak() {
        if (!_isBreak) return;
        clearInterval(_timer);
        _isBreak = false;
        _totalSec = _savedFocusTotal;
        _remaining = _savedFocusRemaining;
        updateDisplay();
        setFocusControls('paused'); // Stay paused so user can manually resume when ready
        Utils.toast('Break ended. Ready to resume!', 'info');
    }

    // === FOCUS OVERLAY ===
    function enterFocus() {
        _focusMode = true;
        document.getElementById('focus-overlay').classList.remove('hidden');
        document.getElementById('bottom-nav').style.display = 'none';
        updatePlantDisplay();
        // Start collapsed — user can expand via toggle
        const sidebar = document.getElementById('focus-sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }

    function exitFocus() {
        _focusMode = false;
        document.getElementById('focus-overlay').classList.add('hidden');
        document.getElementById('bottom-nav').style.display = '';
        stopQuoteRotation();
        const pk = document.getElementById('focus-break-picker');
        if (pk) pk.classList.add('hidden');
        if (typeof FocusMusic !== 'undefined') FocusMusic.onTimerEnd();
    }

    // === STATS ===
    async function renderStats() {
        const sessions = await ThriveDB.getAll('pomodoro','by_date',Utils.todayStr());
        const totalMins = sessions.reduce((s,p) => s+(p.duration||0), 0);
        document.getElementById('pomo-sessions').textContent = sessions.length;
        
        const h = Math.floor(totalMins / 60);
        const m = Math.floor(totalMins % 60);
        const s = Math.round((totalMins % 1) * 60);
        let timeStr = '';
        if (h > 0) timeStr += `${h}h `;
        timeStr += `${m}m `;
        if (h === 0 && s > 0) timeStr += `${s}s`;
        document.getElementById('pomo-hours').textContent = timeStr.trim();
        
        let streak = 0;
        for (let i=0; i<365; i++) {
            const d = new Date(); d.setDate(d.getDate()-i);
            const ss = await ThriveDB.getAll('pomodoro','by_date',d.toISOString().split('T')[0]);
            if (i===0 && ss.length===0) continue;
            if (ss.length > 0) streak++; else if (i>0) break;
        }
        document.getElementById('pomo-streak').textContent = streak;
    }

    async function renderCollection() {
        const grid = document.getElementById('fruit-collection-grid');
        if (!grid) return;
        const coll = await loadCollection();
        grid.innerHTML = FRUITS.map(f => {
            const cnt = coll[f.id] || 0;
            return `<div class="fruit-item ${cnt>0?'collected':''}">
                <span class="fruit-emoji">${f.emoji}</span>
                <span class="fruit-count">×${cnt}</span>
            </div>`;
        }).join('');
    }

    function startForSubject(subjectId, subjectName) {
        if (_isRunning || _isPaused) reset();
        _currentSubject = subjectId;
        _currentSubjectName = subjectName;
        showSeedModal();
    }

    // === EVENTS ===
    function wireEvents() {
        document.getElementById('pomo-start').addEventListener('click', () => {
            if (_isPaused) { start(); return; }
            showSeedModal();
        });
        document.getElementById('pomo-pause').addEventListener('click', pause);
        document.getElementById('pomo-stop-save').addEventListener('click', stopAndSave);
        document.getElementById('pomo-reset').addEventListener('click', reset);

        const fr = document.getElementById('focus-resume');
        const fp = document.getElementById('focus-pause');
        const fb = document.getElementById('focus-break');
        const feb = document.getElementById('focus-end-break');
        const fe = document.getElementById('focus-exit');
        if (fr) fr.addEventListener('click', () => { start(); });
        if (fp) fp.addEventListener('click', pause);
        if (fb) fb.addEventListener('click', showBreakPicker);
        if (feb) feb.addEventListener('click', endBreak);
        if (fe) fe.addEventListener('click', stopAndSave);

        const bp = document.getElementById('focus-break-picker');
        if (bp) bp.addEventListener('click', e => { const b=e.target.closest('[data-break]'); if(b) startBreak(parseInt(b.dataset.break)); });

        const st = document.getElementById('sidebar-toggle');
        if (st) st.addEventListener('click', () => document.getElementById('focus-sidebar').classList.toggle('collapsed'));

        document.getElementById('pomo-quick-grid').addEventListener('click', async (e) => {
            const btn = e.target.closest('.pomo-quick-btn');
            if (!btn || _isRunning) return;
            document.querySelectorAll('.pomo-quick-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            const mins = parseInt(btn.dataset.time);
            _config.focusMin = mins;
            await ThriveDB.put('pomodoroConfig', { id:'default', ..._config });
            _totalSec = mins*60; _remaining = _totalSec; updateDisplay();
        });

        document.addEventListener('visibilitychange', async () => {
            if (_isRunning && document.visibilityState === 'visible') {
                await requestWakeLock();
            }
        });
    }

    return { init, startForSubject, refresh: renderStats };
})();
