/* ============================================================
   VITA ENGINE v3 — Voice Intelligence & Thrive Assistant
   SpeechRecognition + SpeechSynthesis + Context Bridge
   ============================================================ */

const VitaEngine = (() => {
    // ===== State =====
    let _recognition = null;
    let _isListening = false;
    let _isSpeaking = false;
    let _isPaused = false;
    let _currentAudio = null;
    let _orbEl = null;
    let _panelEl = null;
    let _ttsQueue = [];      // Sentence chunks for reliable TTS
    let _ttsCurrentIdx = 0;
    let _ttsCancelled = false;
    let _voicesReady = false;
    let _cachedVoices = [];

    const API_URL = '/api/vita/ask';

    // Quick command suggestions for new users
    const QUICK_COMMANDS = [
        { icon: '💰', label: "Today's spending", query: "How much did I spend today?" },
        { icon: '📊', label: 'Budget status', query: "What's my budget status this month?" },
        { icon: '🎓', label: 'Study tracker', query: "Show me my GATE study tracker" },
        { icon: '⏱️', label: 'Start studying', query: "Start a study session" },
        { icon: '📅', label: 'Upcoming events', query: "What events are coming up?" },
        { icon: '🎯', label: 'Goal progress', query: "How are my goals going?" },
        { icon: '✅', label: "Today's tasks", query: "What are my tasks for today?" },
        { icon: '💡', label: 'My ideas', query: "What are my recent ideas?" },
        { icon: '📓', label: 'Journal recap', query: "Summarize my recent journal entries" },
        { icon: '🔔', label: 'Reminders', query: "What reminders do I have?" },
        { icon: '🏆', label: 'Milestones', query: "What are my upcoming milestones?" },
        { icon: '💳', label: 'Debts status', query: "Who owes me money and who do I owe?" }
    ];


    // ===== Initialization =====
    function init() {
        _createUI();
        _initSpeechRecognition();
        _initVoices();
        _wireEvents();
        console.log('[Vita] Engine v3 initialized ✨');
    }


    // ===== Pre-load voices (critical for mobile) =====
    function _initVoices() {
        if (!('speechSynthesis' in window)) return;

        // Chrome (especially mobile) loads voices asynchronously
        const loadVoices = () => {
            _cachedVoices = window.speechSynthesis.getVoices();
            if (_cachedVoices.length > 0) _voicesReady = true;
        };

        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        // Fallback: poll for voices on mobile
        if (!_voicesReady) {
            let attempts = 0;
            const poll = setInterval(() => {
                loadVoices();
                attempts++;
                if (_voicesReady || attempts > 20) clearInterval(poll);
            }, 250);
        }
    }


    // ===== Pick the best available voice =====
    function _getBestVoice() {
        if (_cachedVoices.length === 0) _cachedVoices = window.speechSynthesis.getVoices();

        // Priority: Natural/Online > Google > en-US/en-IN > anything
        return _cachedVoices.find(v => v.name.includes('Natural') || v.name.includes('Online')) ||
               _cachedVoices.find(v => v.name.includes('Google US English') || v.name.includes('Google UK English')) ||
               _cachedVoices.find(v => v.lang === 'en-US') ||
               _cachedVoices.find(v => v.lang === 'en-IN') ||
               _cachedVoices.find(v => v.lang.startsWith('en')) ||
               _cachedVoices[0] || null;
    }


    // ===== Create the Orb & Response Panel =====
    function _createUI() {
        // --- The Orb ---
        _orbEl = document.createElement('button');
        _orbEl.id = 'vita-orb';
        _orbEl.setAttribute('aria-label', 'Vita Voice Assistant');
        _orbEl.setAttribute('title', 'Tap to speak with Vita');
        _orbEl.innerHTML = `
            <svg viewBox="0 0 24 24" class="vita-mic-icon">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <div class="vita-waveform" style="display:none;">
                <span></span><span></span><span></span><span></span><span></span>
            </div>
        `;

        // --- Response Panel ---
        _panelEl = document.createElement('div');
        _panelEl.id = 'vita-panel';
        _panelEl.innerHTML = `
            <div class="vita-panel-header">
                <span class="vita-panel-title">✦ Vita</span>
                <div class="vita-panel-actions">
                    <button class="vita-tts-toggle" id="vita-tts-toggle" aria-label="Pause/Resume voice" title="Pause/Resume voice" style="display:none;">
                        <svg class="vita-tts-icon-pause" viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        <svg class="vita-tts-icon-play" viewBox="0 0 24 24" width="16" height="16" style="display:none;"><polygon points="5,3 19,12 5,21"/></svg>
                    </button>
                    <button class="vita-tts-stop" id="vita-tts-stop" aria-label="Stop voice" title="Stop voice" style="display:none;">
                        <svg viewBox="0 0 24 24" width="16" height="16"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    </button>
                    <button class="vita-panel-close" id="vita-panel-close" aria-label="Close">✕</button>
                </div>
            </div>
            <div class="vita-transcript" id="vita-transcript"></div>
            <div class="vita-response" id="vita-response"></div>
            <div class="vita-quick-cmds" id="vita-quick-cmds">
                <div class="vita-quick-cmds-label">Quick Commands</div>
                <div class="vita-quick-cmds-grid" id="vita-quick-cmds-grid"></div>
            </div>
            <div class="vita-input-container">
                <form id="vita-text-form" onsubmit="return false;">
                    <input type="text" id="vita-text-input" placeholder="Type to Vita..." autocomplete="off">
                    <button type="submit" id="vita-text-submit" class="icon-btn">➤</button>
                </form>
            </div>
        `;

        document.body.appendChild(_panelEl);
        document.body.appendChild(_orbEl);

        // Populate quick commands
        const grid = document.getElementById('vita-quick-cmds-grid');
        QUICK_COMMANDS.forEach(cmd => {
            const btn = document.createElement('button');
            btn.className = 'vita-cmd-chip';
            btn.innerHTML = `<span class="vita-cmd-icon">${cmd.icon}</span><span class="vita-cmd-text">${cmd.label}</span>`;
            btn.addEventListener('click', () => {
                document.getElementById('vita-quick-cmds').style.display = 'none';
                _handleQuery(cmd.query);
            });
            grid.appendChild(btn);
        });
    }


    // ===== Speech Recognition Setup =====
    function _initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[Vita] SpeechRecognition API not supported in this browser.');
            return;
        }

        _recognition = new SpeechRecognition();
        _recognition.lang = 'en-IN';
        _recognition.interimResults = true;
        _recognition.continuous = false;
        _recognition.maxAlternatives = 1;

        _recognition.onstart = () => {
            _isListening = true;
            _setOrbState('listening');
            _showWaveform(true);
            _setTranscript('Listening...');
            _showPanel();
        };

        _recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            _setTranscript(finalTranscript || interimTranscript || 'Listening...');

            if (finalTranscript) {
                _handleQuery(finalTranscript.trim());
            }
        };

        _recognition.onerror = (event) => {
            console.error('[Vita] Recognition error:', event.error);
            _isListening = false;
            _showWaveform(false);

            if (event.error === 'no-speech') {
                _setOrbState('idle');
                _setResponse('I didn\'t catch that. Tap the orb and try again.');
            } else if (event.error === 'not-allowed') {
                _setOrbState('error');
                _setResponse('Microphone access denied. Please enable it in your browser settings.');
            } else {
                _setOrbState('error');
                _setResponse(`Recognition error: ${event.error}. Try again.`);
            }

            setTimeout(() => _setOrbState('idle'), 2000);
        };

        _recognition.onend = () => {
            _isListening = false;
            _showWaveform(false);
        };
    }


    // ===== Event Wiring =====
    function _wireEvents() {
        _orbEl.addEventListener('click', () => {
            if (_isListening) {
                _stopListening();
            } else {
                _startListening();
            }
        });

        document.getElementById('vita-panel-close').addEventListener('click', () => {
            _hidePanel();
            _killAllAudio(); // Stop ALL audio when panel is closed
        });

        // Pause/Resume TTS
        document.getElementById('vita-tts-toggle').addEventListener('click', () => {
            if (_isSpeaking && !_isPaused) {
                _pauseTTS();
            } else if (_isPaused) {
                _resumeTTS();
            }
        });

        // Stop TTS
        document.getElementById('vita-tts-stop').addEventListener('click', () => {
            _killAllAudio();
        });

        const textForm = document.getElementById('vita-text-form');
        const textInput = document.getElementById('vita-text-input');
        
        textForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = textInput.value.trim();
            if (query) {
                textInput.value = '';
                if (_isListening && _recognition) {
                    _recognition.stop();
                }
                _killAllAudio(); // Kill any playing audio before new query
                _handleQuery(query);
            }
        });

        // Double-click orb to open panel for typing
        _orbEl.addEventListener('dblclick', () => {
            _showPanel();
            document.getElementById('vita-quick-cmds').style.display = 'block';
            textInput.focus();
        });
    }


    // ===== Start / Stop Listening =====
    function _startListening() {
        if (!_recognition) {
            Utils.toast('Voice not supported. You can still type to Vita.', 'warning');
            _showPanel();
            document.getElementById('vita-text-input').focus();
            return;
        }

        _killAllAudio(); // Kill any previous audio
        _setResponse(''); // Clear previous response

        try {
            _recognition.start();
        } catch (e) {
            _recognition.stop();
            setTimeout(() => {
                try { _recognition.start(); } catch (err) {
                    console.error('[Vita] Could not start recognition:', err);
                }
            }, 200);
        }
    }

    function _stopListening() {
        if (_recognition && _isListening) {
            _recognition.stop();
        }
    }


    // ===== TTS: Sentence-Chunked Speech Synthesis =====

    function _speakText(rawText) {
        if (!('speechSynthesis' in window)) {
            _setOrbState('idle');
            return;
        }

        // Kill any previous speech first
        _cancelTTS();

        // Strip HTML tags
        const plainText = rawText.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
        if (!plainText) { _setOrbState('idle'); return; }

        // Split into sentences for reliable mobile playback
        // (Chrome mobile kills utterances > ~300 chars)
        _ttsQueue = plainText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [plainText];
        _ttsCurrentIdx = 0;
        _ttsCancelled = false;
        _isSpeaking = true;
        _isPaused = false;

        _showTTSControls(true);
        _setOrbState('speaking');

        _speakNextChunk();
    }

    function _speakNextChunk() {
        if (_ttsCancelled || _ttsCurrentIdx >= _ttsQueue.length) {
            _isSpeaking = false;
            _isPaused = false;
            _showTTSControls(false);
            _setOrbState('idle');
            return;
        }

        const chunk = _ttsQueue[_ttsCurrentIdx].trim();
        if (!chunk) {
            _ttsCurrentIdx++;
            _speakNextChunk();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(chunk);
        const voice = _getBestVoice();
        if (voice) utterance.voice = voice;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
            if (!_ttsCancelled) {
                _ttsCurrentIdx++;
                _speakNextChunk();
            }
        };

        utterance.onerror = (e) => {
            if (e.error !== 'canceled' && e.error !== 'interrupted') {
                console.warn('[Vita] TTS chunk error:', e.error);
            }
            if (!_ttsCancelled) {
                _ttsCurrentIdx++;
                _speakNextChunk();
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    function _cancelTTS() {
        _ttsCancelled = true;
        _ttsQueue = [];
        _ttsCurrentIdx = 0;
        _isSpeaking = false;
        _isPaused = false;
        window.speechSynthesis.cancel();
        _showTTSControls(false);
    }

    function _pauseTTS() {
        if ('speechSynthesis' in window && _isSpeaking) {
            window.speechSynthesis.pause();
            _isPaused = true;
            _setOrbState('idle');
            // Toggle icons
            const pauseIcon = document.querySelector('.vita-tts-icon-pause');
            const playIcon = document.querySelector('.vita-tts-icon-play');
            if (pauseIcon) pauseIcon.style.display = 'none';
            if (playIcon) playIcon.style.display = 'block';
        }
    }

    function _resumeTTS() {
        if ('speechSynthesis' in window && _isPaused) {
            window.speechSynthesis.resume();
            _isPaused = false;
            _setOrbState('speaking');
            const pauseIcon = document.querySelector('.vita-tts-icon-pause');
            const playIcon = document.querySelector('.vita-tts-icon-play');
            if (pauseIcon) pauseIcon.style.display = 'block';
            if (playIcon) playIcon.style.display = 'none';
        }
    }

    function _showTTSControls(show) {
        const toggle = document.getElementById('vita-tts-toggle');
        const stop = document.getElementById('vita-tts-stop');
        if (toggle) toggle.style.display = show ? 'flex' : 'none';
        if (stop) stop.style.display = show ? 'flex' : 'none';
        // Reset icons
        if (show) {
            const pauseIcon = document.querySelector('.vita-tts-icon-pause');
            const playIcon = document.querySelector('.vita-tts-icon-play');
            if (pauseIcon) pauseIcon.style.display = 'block';
            if (playIcon) playIcon.style.display = 'none';
        }
    }


    // ===== Kill ALL audio (Audio element + SpeechSynthesis) =====
    function _killAllAudio() {
        // Cancel browser TTS
        _cancelTTS();

        // Cancel HTML Audio
        if (_currentAudio) {
            _currentAudio.pause();
            _currentAudio.currentTime = 0;
            _currentAudio = null;
        }

        _setOrbState('idle');
    }


    // ===== Core Pipeline: Query → Context → Backend → TTS =====
    async function _handleQuery(query) {
        // KILL any ongoing speech immediately when new query arrives
        _killAllAudio();

        _setOrbState('thinking');
        _setTranscript(query);
        _setResponse('<div class="vita-thinking-dots"><span></span><span></span><span></span></div>');
        _showPanel();

        try {
            // Build local context from IndexedDB
            const localContext = await _buildLocalContext();

            // Send to backend
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    local_context: localContext
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Display text response
            _setResponse(data.response || 'I have nothing to say.');

            // Speak the response
            if (data.audio_url) {
                _playAudio(data.audio_url);
            } else if ('speechSynthesis' in window && data.response) {
                _speakText(data.response);
            } else {
                _setOrbState('idle');
            }

        } catch (err) {
            console.error('[Vita] Pipeline error:', err);
            _setOrbState('error');
            _setResponse(`Oops — ${err.message}. Check your backend connection and API keys.`);
            setTimeout(() => _setOrbState('idle'), 3000);
        }
    }


    // ===== PHASE 2: The Context Bridge (FULL APP DATA) =====
    async function _buildLocalContext() {
        const today = Utils.todayStr();
        const weekStartDate = Utils.weekStart();
        const weekEndDate = Utils.weekEnd();
        const monthStr = Utils.monthStr();

        const ctx = {
            date: today,
            day_of_week: new Date().toLocaleDateString('en-IN', { weekday: 'long' }),
            time: Utils.nowTime(),
            finances: {},
            milestones: [],
            goals: [],
            goals_progress: {},
            reminders: [],
            todos: [],
            checklist: [],
            purchases: [],
            pomodoro: {},
            ideas: [],
            journals: [],
            income: [],
            calendar: { upcoming_events: [] }
        };

        // ===== FINANCES =====
        try {
            const todayExpenses = await ThriveDB.getAll('expenses', 'by_date', today);
            const todaySpend = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);

            let weekSpend = 0;
            const start = new Date(weekStartDate);
            const end = new Date(weekEndDate);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const ds = d.toISOString().split('T')[0];
                const dayE = await ThriveDB.getAll('expenses', 'by_date', ds);
                weekSpend += dayE.reduce((s, e) => s + (e.amount || 0), 0);
            }

            const monthExpenses = await ThriveDB.getAll('expenses', 'by_month', monthStr);
            const monthSpend = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);

            const budgets = await ThriveDB.getAll('budgets', 'by_month', monthStr);
            const budget = budgets.length > 0 ? budgets[0].amount || 0 : 0;

            const lentDebts = (await ThriveDB.getAll('debts', 'by_type', 'lent')).filter(d => !d.settled);
            const borrowedDebts = (await ThriveDB.getAll('debts', 'by_type', 'borrowed')).filter(d => !d.settled);
            const settledDebts = (await ThriveDB.getAll('debts')).filter(d => d.settled);

            ctx.finances = {
                today_spend: todaySpend,
                today_expenses: todayExpenses.map(e => ({ description: e.description, amount: e.amount, category: e.category, time: e.timeStr })),
                week_spend: weekSpend,
                month_spend: monthSpend,
                monthly_budget: budget,
                budget_remaining: budget > 0 ? budget - monthSpend : 0,
                total_lent: lentDebts.reduce((s, d) => s + (d.amount || 0), 0),
                lent_details: lentDebts.map(d => ({ person: d.personName, amount: d.amount, reason: d.reason || '' })),
                total_borrowed: borrowedDebts.reduce((s, d) => s + (d.amount || 0), 0),
                borrowed_details: borrowedDebts.map(d => ({ person: d.personName, amount: d.amount, reason: d.reason || '' })),
                settled_count: settledDebts.length
            };
        } catch (e) { console.warn('[Vita] Finance context error:', e); }

        // ===== MILESTONES =====
        try {
            const allMilestones = await ThriveDB.getAll('milestones');
            ctx.milestones = allMilestones.map(m => ({
                name: m.name || m.title || 'Untitled',
                targetDate: m.targetDate,
                daysUntil: m.targetDate ? Utils.daysUntil(m.targetDate) : null,
                completed: m.completed || false
            })).sort((a, b) => (a.daysUntil || 9999) - (b.daysUntil || 9999));
        } catch (e) { console.warn('[Vita] Milestones error:', e); }

        // ===== GOALS =====
        try {
            const allGoals = await ThriveDB.getAll('goals');
            ctx.goals = allGoals.map(g => ({
                name: g.name || g.title || 'Untitled',
                tier: g.tier,
                target: g.target,
                current: g.current || 0,
                unit: g.unit || '',
                completed: g.completed || false,
                percent: g.target > 0 ? Math.round((g.current || 0) / g.target * 100) : 0
            }));
        } catch (e) { console.warn('[Vita] Goals error:', e); }

        // ===== DAILY LOG =====
        try {
            const dailyLog = await ThriveDB.get('dailyLog', today);
            if (dailyLog) {
                ctx.goals_progress = { completed: dailyLog.completed || 0, total: dailyLog.total || 0, percent: dailyLog.percent || 0 };
            }
        } catch (e) { console.warn('[Vita] DailyLog error:', e); }

        // ===== REMINDERS =====
        try {
            const allReminders = await ThriveDB.getAll('reminders');
            ctx.reminders = allReminders.map(r => ({
                title: r.title,
                date: r.date,
                time: r.time || '',
                done: r.done || false,
                daysUntil: r.date ? Utils.daysUntil(r.date) : null
            })).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        } catch (e) { console.warn('[Vita] Reminders error:', e); }

        // ===== TODOS =====
        try {
            const todayTodos = await ThriveDB.getAll('todos', 'by_date', today);
            ctx.todos = todayTodos.map(t => ({ text: t.text, done: t.done || false }));
        } catch (e) { console.warn('[Vita] Todos error:', e); }

        // ===== CHECKLIST =====
        try {
            const checklistItems = await ThriveDB.getAll('checklist');
            ctx.checklist = checklistItems.map(c => ({ text: c.text || c.name || '', checked: c.checked || false, listType: c.listType }));
        } catch (e) { console.warn('[Vita] Checklist error:', e); }

        // ===== PURCHASES =====
        try {
            const todayPurchases = await ThriveDB.getAll('purchases', 'by_date', today);
            ctx.purchases = todayPurchases.map(p => ({ text: p.text || p.name || '', done: p.done || false }));
        } catch (e) { console.warn('[Vita] Purchases error:', e); }

        // ===== STUDY TRACKER =====
        try {
            const todaySessions = await ThriveDB.getAll('studySessions', 'by_date', today);
            const totalStudyMins = todaySessions.reduce((s, p) => s + (p.duration || 0), 0);
            
            const studyHabits = await ThriveDB.getAll('studyHabits', 'by_date', today);
            const habitsData = studyHabits.map(h => ({ habitId: h.habitId, current: h.current }));

            ctx.study_tracker = { 
                today_sessions: todaySessions.length, 
                today_study_minutes: totalStudyMins, 
                today_study_hours: (totalStudyMins / 60).toFixed(1),
                habits: habitsData,
                gate_exam_date: '2027-02-01'
            };
        } catch (e) { console.warn('[Vita] Study Tracker error:', e); }

        // ===== IDEAS =====
        try {
            const allIdeas = await ThriveDB.getAll('ideas');
            ctx.ideas = allIdeas.slice(-10).map(i => ({ title: i.title || i.text || '', type: i.type, createdAt: i.createdAt }));
        } catch (e) { console.warn('[Vita] Ideas error:', e); }

        // ===== JOURNALS =====
        try {
            const allJournals = await ThriveDB.getAll('journals');
            ctx.journals = allJournals.slice(-5).map(j => ({ date: j.date, mood: j.mood || '', preview: (j.text || j.content || '').substring(0, 80) }));
        } catch (e) { console.warn('[Vita] Journals error:', e); }

        // ===== INCOME =====
        try {
            const monthIncome = await ThriveDB.getAll('income', 'by_month', monthStr);
            ctx.income = monthIncome.map(i => ({ source: i.source, amount: i.amount, date: i.date }));
        } catch (e) { console.warn('[Vita] Income error:', e); }

        // ===== CALENDAR EVENTS =====
        try {
            const futureHolidays = Utils.PUBLIC_HOLIDAYS_2026
                .filter(h => h.date >= today)
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 5)
                .map(h => ({ name: h.name, date: h.date, daysUntil: Utils.daysUntil(h.date), type: h.type }));
            const allReminders = await ThriveDB.getAll('reminders');
            const futureReminders = allReminders
                .filter(r => r.date >= today && !r.done)
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 5)
                .map(r => ({ name: r.title, date: r.date, daysUntil: Utils.daysUntil(r.date), type: 'Reminder' }));
            ctx.calendar.upcoming_events = [...futureHolidays, ...futureReminders]
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 5);
        } catch (e) { console.warn('[Vita] Calendar error:', e); }



        return ctx;
    }


    // ===== Audio Playback (for backend-generated audio) =====
    function _playAudio(audioUrl) {
        _killAllAudio();
        _setOrbState('speaking');

        _currentAudio = new Audio(audioUrl);
        _currentAudio.volume = 1.0;

        _currentAudio.onplay = () => {
            _setOrbState('speaking');
        };

        _currentAudio.onended = () => {
            _setOrbState('idle');
            _currentAudio = null;
        };

        _currentAudio.onerror = (e) => {
            console.error('[Vita] Audio playback error:', e);
            _setOrbState('idle');
            _currentAudio = null;
        };

        _currentAudio.play().catch(err => {
            console.warn('[Vita] Audio autoplay blocked:', err);
            _setOrbState('idle');
        });
    }


    // ===== UI Helpers =====
    function _setOrbState(state) {
        _orbEl.classList.remove('listening', 'thinking', 'speaking', 'error');
        if (state !== 'idle') {
            _orbEl.classList.add(state);
        }
    }

    function _showWaveform(show) {
        const mic = _orbEl.querySelector('.vita-mic-icon');
        const wave = _orbEl.querySelector('.vita-waveform');
        if (mic) mic.style.display = show ? 'none' : 'block';
        if (wave) wave.style.display = show ? 'flex' : 'none';
    }

    function _setTranscript(text) {
        const el = document.getElementById('vita-transcript');
        if (el) el.textContent = text;
    }

    function _setResponse(html) {
        const el = document.getElementById('vita-response');
        if (el) el.innerHTML = html;
    }

    function _showPanel() {
        _panelEl.classList.add('active');
    }

    function _hidePanel() {
        _panelEl.classList.remove('active');
    }


    // ===== Public API =====
    return { init };
})();
