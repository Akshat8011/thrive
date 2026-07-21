/* ============================================================
   THRIVE v2 — Creative Space (journal, brainstorm, vision)
   ============================================================ */

const CreativeModule = (() => {
    let _filter = 'all';

    const BRAINSTORM_PROMPTS = [
        "What would you create if you had unlimited resources?",
        "Describe your perfect day 5 years from now.",
        "What problem in the world would you solve and how?",
        "If you could learn any skill overnight, what would it be and why?",
        "Write a letter to your future self.",
        "What's one thing you've always wanted to try but haven't?",
        "If you could have dinner with anyone (alive or dead), who and why?",
        "What does success truly mean to you?",
        "Describe a technology that doesn't exist yet but should.",
        "What book/movie/song changed your life and why?",
        "What would you do differently if nobody was watching?",
        "Imagine you're teaching a class — what subject and what's lesson 1?",
        "What are 3 things you're grateful for right now?",
        "If your life were a movie, what would the title be?",
        "What legacy do you want to leave behind?",
        "Redesign your daily routine from scratch.",
        "What's an unconventional career that fascinates you?",
        "Describe the perfect workspace for your creativity.",
        "What habit would transform your life if you stuck with it?",
        "Write about a challenge you overcame and what you learned."
    ];

    const COMBO_WORDS = [
        'AI', 'Music', 'Education', 'Space', 'Food', 'Art', 'Health', 'Gaming',
        'Nature', 'Fashion', 'Architecture', 'Psychology', 'Travel', 'History',
        'Photography', 'Robotics', 'Literature', 'Sports', 'Meditation', 'Cinema',
        'Mathematics', 'Dance', 'Cooking', 'Language', 'Sustainability', 'Philosophy',
        'Neuroscience', 'Virtual Reality', 'Music Production', 'Street Art'
    ];

    let _freewriteTimer = null;

    async function init() {
        await renderIdeas();
        await renderJournal();
        await renderAffirmations();
        setRandomPrompt();
        randomCombine();
        wireEvents();
    }

    // ===== Ideas Tab =====
    async function renderIdeas() {
        const all = await ThriveDB.getAll('ideas');
        const filtered = _filter === 'all' ? all : all.filter(i => i.type === _filter);
        const grid = document.getElementById('ideas-grid');
        grid.innerHTML = '';
        if (filtered.length === 0) {
            grid.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">💡</div><p class="empty-state-text">Capture your first idea!</p></div>';
            return;
        }
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        filtered.forEach(idea => {
            const card = Utils.el('div', { className: 'idea-card' },
                Utils.el('span', { className: `idea-type-badge ${idea.type}`, textContent: idea.type }),
                Utils.el('h4', { className: 'idea-title', textContent: idea.title }),
                Utils.el('p', { className: 'idea-body', textContent: idea.body || idea.url || '' }),
                Utils.el('div', { className: 'idea-meta' },
                    Utils.el('span', { textContent: Utils.formatDate(idea.date) }),
                    Utils.el('div', { className: 'idea-actions' },
                        Utils.el('button', { textContent: '✏️', onClick: () => showEditIdeaModal(idea) }),
                        Utils.el('button', { className: 'delete-btn', textContent: '🗑️', onClick: async () => {
                            await ThriveDB.remove('ideas', idea.id); Utils.toast('Deleted', 'warning'); renderIdeas();
                        }})
                    )
                )
            );
            grid.appendChild(card);
        });
    }

    function showNewIdeaModal() {
        Utils.showModal('New Idea', `<form id="idea-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
            <input type="text" id="idea-title" placeholder="Title" required maxlength="120">
            <textarea id="idea-body" placeholder="Write your idea..." rows="5" style="resize:vertical;min-height:80px;"></textarea>
            <button type="submit" class="btn-primary">Save 💡</button></form>`);
        document.getElementById('idea-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await ThriveDB.put('ideas', { id: Utils.uid(), type: 'idea', title: document.getElementById('idea-title').value.trim(), body: document.getElementById('idea-body').value.trim(), date: Utils.todayStr(), createdAt: Date.now() });
            Utils.closeModal(); Utils.toast('Idea saved! 💡', 'success'); renderIdeas();
        });
    }

    function showSaveLinkModal() {
        Utils.showModal('Save Link', `<form id="link-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
            <input type="text" id="link-title" placeholder="Title" required maxlength="120">
            <input type="url" id="link-url" placeholder="https://..." required>
            <textarea id="link-notes" placeholder="Notes (optional)" rows="3" style="resize:vertical;"></textarea>
            <button type="submit" class="btn-primary">Save 🔗</button></form>`);
        document.getElementById('link-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await ThriveDB.put('ideas', { id: Utils.uid(), type: 'link', title: document.getElementById('link-title').value.trim(), body: document.getElementById('link-notes').value.trim(), url: document.getElementById('link-url').value.trim(), date: Utils.todayStr(), createdAt: Date.now() });
            Utils.closeModal(); Utils.toast('Link saved! 🔗', 'success'); renderIdeas();
        });
    }

    function showEditIdeaModal(idea) {
        Utils.showModal('Edit', `<form id="edit-idea-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
            <input type="text" id="edit-title" value="${idea.title}" required maxlength="120">
            <textarea id="edit-body" rows="5" style="resize:vertical;min-height:80px;">${idea.body || ''}</textarea>
            ${idea.url ? `<input type="url" id="edit-url" value="${idea.url}">` : ''}
            <button type="submit" class="btn-primary">Update ✓</button></form>`);
        document.getElementById('edit-idea-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            idea.title = document.getElementById('edit-title').value.trim();
            idea.body = document.getElementById('edit-body').value.trim();
            const urlEl = document.getElementById('edit-url'); if (urlEl) idea.url = urlEl.value.trim();
            await ThriveDB.put('ideas', idea);
            Utils.closeModal(); Utils.toast('Updated! ✏️', 'success'); renderIdeas();
        });
    }

    // ===== Journal =====
    async function renderJournal() {
        const all = await ThriveDB.getAll('journals');
        all.sort((a, b) => b.createdAt - a.createdAt);
        const container = document.getElementById('journal-list');
        container.innerHTML = '';
        if (all.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:16px;"><p class="empty-state-text">Your journal is empty. Start writing!</p></div>';
            return;
        }
        all.forEach(j => {
            const card = Utils.el('div', { className: 'journal-card' },
                Utils.el('div', { className: 'journal-date', textContent: Utils.formatDate(j.date) + ' • ' + (j.timeStr || '') }),
                j.mood ? Utils.el('div', { className: 'journal-mood', textContent: j.mood }) : document.createTextNode(''),
                Utils.el('p', { className: 'journal-text', textContent: j.text }),
                Utils.el('div', { className: 'journal-actions' },
                    Utils.el('button', { className: 'btn-small btn-secondary', textContent: '✏️ Edit', onClick: () => showEditJournalModal(j) }),
                    Utils.el('button', { className: 'btn-small btn-danger', textContent: '🗑️', onClick: async () => {
                        await ThriveDB.remove('journals', j.id); Utils.toast('Entry deleted', 'warning'); renderJournal();
                    }})
                )
            );
            container.appendChild(card);
        });
    }

    function showNewJournalModal() {
        Utils.showModal('📓 Journal Entry', `<form id="journal-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:8px;">
                <button type="button" class="mood-btn" data-mood="😊">😊</button>
                <button type="button" class="mood-btn" data-mood="😐">😐</button>
                <button type="button" class="mood-btn" data-mood="😔">😔</button>
                <button type="button" class="mood-btn" data-mood="😡">😡</button>
                <button type="button" class="mood-btn" data-mood="🤩">🤩</button>
                <button type="button" class="mood-btn" data-mood="😴">😴</button>
            </div>
            <input type="hidden" id="j-mood" value="">
            <textarea id="j-text" placeholder="How are you feeling? What's on your mind?" rows="6" style="resize:vertical;min-height:120px;" required></textarea>
            <button type="submit" class="btn-primary">Save Entry ✍️</button></form>`);

        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.style.cssText = 'font-size:1.5rem;padding:8px;border-radius:8px;border:2px solid var(--border);transition:all 0.15s;';
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mood-btn').forEach(b => b.style.borderColor = 'var(--border)');
                btn.style.borderColor = 'var(--primary)';
                document.getElementById('j-mood').value = btn.dataset.mood;
            });
        });

        document.getElementById('journal-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await ThriveDB.put('journals', { id: Utils.uid(), text: document.getElementById('j-text').value.trim(), mood: document.getElementById('j-mood').value, date: Utils.todayStr(), timeStr: Utils.nowTime(), createdAt: Date.now() });
            Utils.closeModal(); Utils.toast('Journal saved! 📓', 'success'); renderJournal();
        });
    }

    function showEditJournalModal(j) {
        Utils.showModal('Edit Journal', `<form id="edit-journal-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
            <textarea id="ej-text" rows="6" style="resize:vertical;min-height:120px;">${j.text}</textarea>
            <button type="submit" class="btn-primary">Save ✓</button></form>`);
        document.getElementById('edit-journal-form').addEventListener('submit', async (e) => {
            e.preventDefault(); j.text = document.getElementById('ej-text').value.trim();
            await ThriveDB.put('journals', j); Utils.closeModal(); Utils.toast('Updated!', 'success'); renderJournal();
        });
    }

    // ===== Brainstorm =====
    function setRandomPrompt() {
        const idx = Math.floor(Math.random() * BRAINSTORM_PROMPTS.length);
        document.getElementById('brainstorm-prompt').textContent = BRAINSTORM_PROMPTS[idx];
    }

    function randomCombine() {
        const i1 = Math.floor(Math.random() * COMBO_WORDS.length);
        let i2 = Math.floor(Math.random() * COMBO_WORDS.length);
        while (i2 === i1) i2 = Math.floor(Math.random() * COMBO_WORDS.length);
        document.getElementById('combo-1').textContent = COMBO_WORDS[i1];
        document.getElementById('combo-2').textContent = COMBO_WORDS[i2];
    }

    function startFreewrite() {
        const mins = parseInt(document.getElementById('freewrite-duration').value);
        let remaining = mins * 60;
        document.getElementById('freewrite-area').classList.remove('hidden');
        document.getElementById('freewrite-text').value = '';
        document.getElementById('freewrite-text').focus();
        document.getElementById('btn-save-freewrite').classList.add('hidden');

        _freewriteTimer = setInterval(() => {
            remaining--;
            const m = Math.floor(remaining / 60), s = remaining % 60;
            document.getElementById('freewrite-timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
            if (remaining <= 0) {
                clearInterval(_freewriteTimer);
                document.getElementById('freewrite-timer').textContent = "Time's up! ✨";
                document.getElementById('btn-save-freewrite').classList.remove('hidden');
                Utils.toast('Free writing complete! 🎉', 'success');
            }
        }, 1000);
    }

    async function saveFreewrite() {
        const text = document.getElementById('freewrite-text').value.trim();
        if (!text) return;
        await ThriveDB.put('ideas', { id: Utils.uid(), type: 'idea', title: '✍️ Free Writing — ' + Utils.formatDate(Utils.todayStr()), body: text, date: Utils.todayStr(), createdAt: Date.now() });
        Utils.toast('Free writing saved! ✍️', 'success');
        document.getElementById('freewrite-area').classList.add('hidden');
        renderIdeas();
    }

    // ===== Affirmations =====
    async function renderAffirmations() {
        const all = await ThriveDB.getAll('ideas');
        const affs = all.filter(i => i.type === 'affirmation').sort((a, b) => b.createdAt - a.createdAt);
        const container = document.getElementById('affirmation-list');
        container.innerHTML = '';
        affs.forEach(a => {
            container.appendChild(Utils.el('div', { className: 'affirmation-card', textContent: a.body }));
        });
    }

    // ===== Wire Events =====
    function wireEvents() {
        document.getElementById('btn-new-idea').addEventListener('click', showNewIdeaModal);
        document.getElementById('btn-save-link').addEventListener('click', showSaveLinkModal);
        document.getElementById('btn-new-journal').addEventListener('click', showNewJournalModal);
        document.getElementById('btn-next-prompt').addEventListener('click', setRandomPrompt);
        document.getElementById('btn-combine').addEventListener('click', randomCombine);
        document.getElementById('btn-start-freewrite').addEventListener('click', startFreewrite);
        document.getElementById('btn-save-freewrite').addEventListener('click', saveFreewrite);

        document.getElementById('btn-save-affirmation').addEventListener('click', async () => {
            const text = document.getElementById('affirmation-text').value.trim();
            if (!text) return;
            await ThriveDB.put('ideas', { id: Utils.uid(), type: 'affirmation', title: 'Affirmation', body: text, date: Utils.todayStr(), createdAt: Date.now() });
            document.getElementById('affirmation-text').value = '';
            Utils.toast('Affirmation saved! ✨', 'success'); renderAffirmations();
        });

        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active'); _filter = chip.dataset.filter; renderIdeas();
            });
        });

        // Creative main tabs
        document.querySelectorAll('.creative-main-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.creative-main-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.creative-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`ctab-${tab.dataset.ctab}`).classList.add('active');
            });
        });
    }

    return { init };
})();
