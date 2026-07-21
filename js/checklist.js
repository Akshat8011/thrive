/* ============================================================
   THRIVE — Anti-Forgetfulness Module (Module 6)
   Before Leaving checklist, Daily To-Do, Daily Purchases.
   ============================================================ */

const ChecklistModule = (() => {

    async function init() {
        await renderLeavingChecklist();
        await renderTodoList();
        await renderPurchaseList();
        wireEvents();
    }

    // ===== Before Leaving Checklist =====
    async function renderLeavingChecklist() {
        const items = await ThriveDB.getAll('checklist', 'by_listType', 'leaving');
        items.sort((a, b) => (a.order || 0) - (b.order || 0));
        const container = document.getElementById('leaving-checklist');
        container.innerHTML = '';

        items.forEach(item => {
            const row = Utils.el('div', { className: 'checklist-item' },
                Utils.el('div', {
                    className: `check-circle ${item.checked ? 'checked' : ''}`,
                    textContent: item.checked ? '✓' : '',
                    onClick: async () => {
                        item.checked = !item.checked;
                        await ThriveDB.put('checklist', item);
                        renderLeavingChecklist();
                        if (item.checked && navigator.vibrate) navigator.vibrate(15);
                    }
                }),
                Utils.el('span', {
                    className: `checklist-text ${item.checked ? 'done' : ''}`,
                    textContent: item.text
                }),
                Utils.el('button', {
                    className: 'checklist-remove',
                    textContent: '✕',
                    onClick: async () => {
                        await ThriveDB.remove('checklist', item.id);
                        Utils.toast('Item removed', 'warning');
                        renderLeavingChecklist();
                    }
                })
            );
            container.appendChild(row);
        });
    }

    function showAddChecklistItemModal() {
        Utils.showModal('Add Checklist Item', `
            <form id="checklist-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
                <input type="text" id="cl-text" placeholder="e.g. 🧴 Sunscreen" required maxlength="60">
                <button type="submit" class="btn-primary">Add ✓</button>
            </form>
        `);

        document.getElementById('checklist-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = document.getElementById('cl-text').value.trim();
            if (!text) return;

            const existing = await ThriveDB.getAll('checklist', 'by_listType', 'leaving');
            await ThriveDB.put('checklist', {
                id: Utils.uid(),
                listType: 'leaving',
                text,
                checked: false,
                order: existing.length
            });

            Utils.closeModal();
            Utils.toast('Item added!', 'success');
            renderLeavingChecklist();
        });
    }

    // ===== Daily To-Do =====
    async function renderTodoList() {
        const today = Utils.todayStr();
        const todos = await ThriveDB.getAll('todos', 'by_date', today);
        const container = document.getElementById('todo-list');
        container.innerHTML = '';

        if (todos.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:16px 0;">
                    <p class="empty-state-text" style="font-size:0.82rem;color:var(--text-muted);">No to-dos for today. Tap ＋ to add.</p>
                </div>`;
            return;
        }

        todos.forEach(todo => {
            const item = Utils.el('div', { className: 'todo-item' },
                Utils.el('div', {
                    className: `check-circle ${todo.done ? 'checked' : ''}`,
                    textContent: todo.done ? '✓' : '',
                    onClick: async () => {
                        todo.done = !todo.done;
                        await ThriveDB.put('todos', todo);
                        renderTodoList();
                        if (todo.done) {
                            if (navigator.vibrate) navigator.vibrate(15);
                            // Refresh dashboard progress
                            if (typeof DashboardModule !== 'undefined') DashboardModule.refresh();
                        }
                    }
                }),
                Utils.el('span', {
                    className: `todo-text ${todo.done ? 'done' : ''}`,
                    textContent: todo.text
                }),
                Utils.el('button', {
                    className: 'todo-delete',
                    textContent: '✕',
                    onClick: async () => {
                        await ThriveDB.remove('todos', todo.id);
                        Utils.toast('To-do removed', 'warning');
                        renderTodoList();
                        if (typeof DashboardModule !== 'undefined') DashboardModule.refresh();
                    }
                })
            );
            container.appendChild(item);
        });
    }

    function showAddTodoModal() {
        Utils.showModal('Add To-Do', `
            <form id="todo-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
                <input type="text" id="todo-text-input" placeholder="What needs to be done?" required maxlength="100">
                <button type="submit" class="btn-primary">Add ✓</button>
            </form>
        `);

        document.getElementById('todo-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = document.getElementById('todo-text-input').value.trim();
            if (!text) return;

            await ThriveDB.put('todos', {
                id: Utils.uid(),
                text,
                done: false,
                date: Utils.todayStr(),
                createdAt: Date.now()
            });

            Utils.closeModal();
            Utils.toast('To-do added! 📋', 'success');
            renderTodoList();
            if (typeof DashboardModule !== 'undefined') DashboardModule.refresh();
        });
    }

    // ===== Daily Purchases =====
    async function renderPurchaseList() {
        const today = Utils.todayStr();
        const purchases = await ThriveDB.getAll('purchases', 'by_date', today);
        const container = document.getElementById('purchase-list');
        container.innerHTML = '';

        if (purchases.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:16px 0;">
                    <p class="empty-state-text" style="font-size:0.82rem;color:var(--text-muted);">No purchases planned. Tap ＋ to add.</p>
                </div>`;
            return;
        }

        purchases.forEach(p => {
            const item = Utils.el('div', { className: 'purchase-item' },
                Utils.el('div', {
                    className: `check-circle ${p.done ? 'checked' : ''}`,
                    textContent: p.done ? '✓' : '',
                    onClick: async () => {
                        p.done = !p.done;
                        await ThriveDB.put('purchases', p);
                        renderPurchaseList();
                        if (p.done && navigator.vibrate) navigator.vibrate(15);
                    }
                }),
                Utils.el('span', {
                    className: `purchase-text ${p.done ? 'done' : ''}`,
                    textContent: p.text
                }),
                Utils.el('button', {
                    className: 'purchase-delete',
                    textContent: '✕',
                    onClick: async () => {
                        await ThriveDB.remove('purchases', p.id);
                        Utils.toast('Purchase removed', 'warning');
                        renderPurchaseList();
                    }
                })
            );
            container.appendChild(item);
        });
    }

    function showAddPurchaseModal() {
        Utils.showModal('Add Purchase', `
            <form id="purchase-form" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;">
                <input type="text" id="purchase-text-input" placeholder="What to buy?" required maxlength="80">
                <button type="submit" class="btn-primary">Add 🛒</button>
            </form>
        `);

        document.getElementById('purchase-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = document.getElementById('purchase-text-input').value.trim();
            if (!text) return;

            await ThriveDB.put('purchases', {
                id: Utils.uid(),
                text,
                done: false,
                date: Utils.todayStr(),
                createdAt: Date.now()
            });

            Utils.closeModal();
            Utils.toast('Purchase added! 🛒', 'success');
            renderPurchaseList();
        });
    }

    // ===== Reset daily items (checklist unchecks) =====
    async function resetDaily() {
        // Uncheck all leaving checklist items at midnight
        const items = await ThriveDB.getAll('checklist', 'by_listType', 'leaving');
        for (const item of items) {
            item.checked = false;
            await ThriveDB.put('checklist', item);
        }
        renderLeavingChecklist();
        renderTodoList();
        renderPurchaseList();
    }

    // ===== Wire Events =====
    function wireEvents() {
        document.getElementById('btn-add-checklist-item').addEventListener('click', showAddChecklistItemModal);
        document.getElementById('btn-add-todo').addEventListener('click', showAddTodoModal);
        document.getElementById('btn-add-purchase').addEventListener('click', showAddPurchaseModal);
    }

    return { init, resetDaily };
})();
