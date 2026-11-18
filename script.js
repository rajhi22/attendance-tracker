const CLASSES_KEY = 'attendanceTracker.classes.v1';
const SETTINGS_KEY = 'attendanceTracker.settings.v1';
const DEFAULT_GOAL = 75;
const HISTORY_LIMIT = 30;

const els = {
    form: document.getElementById('addClassForm'),
    nameInput: document.getElementById('classNameInput'),
    addError: document.getElementById('addError'),
    list: document.getElementById('classesList'),
    emptyState: document.getElementById('emptyState'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptyText: document.getElementById('emptyText'),
    search: document.getElementById('searchInput'),
    sort: document.getElementById('sortSelect'),
    goal: document.getElementById('goalInput'),
    overall: document.getElementById('overallPercentage'),
    overallMeta: document.getElementById('overallMeta'),
    statAttended: document.getElementById('statAttended'),
    statAttendedMeta: document.getElementById('statAttendedMeta'),
    statClasses: document.getElementById('statClasses'),
    statClassesMeta: document.getElementById('statClassesMeta'),
    statAtRisk: document.getElementById('statAtRisk'),
    statAtRiskMeta: document.getElementById('statAtRiskMeta'),
    modal: document.getElementById('confirmModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage'),
    confirmBtn: document.getElementById('confirmBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    toastRegion: document.getElementById('toastRegion'),
    themeToggle: document.getElementById('themeToggle'),
    moreBtn: document.getElementById('moreBtn'),
    moreMenu: document.getElementById('moreMenu'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    importFile: document.getElementById('importFile')
};

const state = {
    classes: loadClasses(),
    goal: loadSettings().goal || DEFAULT_GOAL,
    theme: loadSettings().theme || 'light',
    query: '',
    sort: 'risk'
};

let confirmHandler = null;

function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function loadClasses() {
    try {
        const raw = localStorage.getItem(CLASSES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeClass).filter(Boolean);
    } catch (error) {
        return [];
    }
}

function normalizeClass(item) {
    if (!item || typeof item.name !== 'string') return null;
    const name = item.name.trim();
    if (!name) return null;
    const total = Math.max(0, Math.floor(Number(item.total) || 0));
    const attended = Math.min(total, Math.max(0, Math.floor(Number(item.attended) || 0)));
    return {
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        name,
        attended,
        total,
        history: Array.isArray(item.history) ? item.history.slice(-HISTORY_LIMIT) : [],
        updatedAt: Number(item.updatedAt) || Date.now()
    };
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (error) {
        return {};
    }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ goal: state.goal, theme: state.theme }));
}

function saveClasses() {
    try {
        localStorage.setItem(CLASSES_KEY, JSON.stringify(state.classes));
    } catch (error) {
        showToast('Could not save your data locally.', 'error');
    }
}

function percentageOf(item) {
    if (!item.total) return 0;
    return Math.round((item.attended / item.total) * 100);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function statusOf(item) {
    if (!item.total) return 'idle';
    return percentageOf(item) >= state.goal ? 'good' : 'bad';
}

function missesAllowed(item) {
    if (!item.attended) return 0;
    const allowedTotal = Math.floor((item.attended * 100) / state.goal);
    return Math.max(0, allowedTotal - item.total);
}

function attendNeeded(item) {
    if (item.total === 0) return 0;
    const needed = (state.goal * item.total - item.attended * 100) / (100 - state.goal);
    return needed > 0 ? Math.ceil(needed) : 0;
}

function formatStatus(item) {
    const status = statusOf(item);
    if (status === 'idle') {
        return { badge: 'No sessions yet', badgeClass: 'badge--idle', hint: 'Mark the first session to get started.' };
    }
    if (status === 'good') {
        const allowed = missesAllowed(item);
        const hint = allowed > 0
            ? `You can miss ${allowed} more session${allowed === 1 ? '' : 's'} and stay at ${state.goal}%.`
            : `One more absence would drop you below ${state.goal}%.`;
        return { badge: 'On track', badgeClass: 'badge--good', hint };
    }
    const needed = attendNeeded(item);
    const hint = needed > 0
        ? `Attend the next ${needed} session${needed === 1 ? '' : 's'} to reach ${state.goal}%.`
        : `You are below the ${state.goal}% target.`;
    return { badge: 'Below target', badgeClass: 'badge--bad', hint };
}

function render() {
    renderSummary();
    renderList();
}

function renderSummary() {
    const totalAttended = state.classes.reduce((sum, item) => sum + item.attended, 0);
    const totalSessions = state.classes.reduce((sum, item) => sum + item.total, 0);
    const overall = totalSessions ? Math.round((totalAttended / totalSessions) * 100) : null;
    const atRisk = state.classes.filter((item) => statusOf(item) === 'bad').length;
    const tracked = state.classes.filter((item) => item.total > 0).length;

    els.overall.textContent = overall === null ? '—' : `${overall}%`;
    els.overallMeta.textContent = overall === null
        ? 'No sessions recorded yet'
        : overall >= state.goal
            ? `Target is ${state.goal}% — you are above it`
            : `Target is ${state.goal}% — ${state.goal - overall}% below`;

    els.statAttended.textContent = String(totalAttended);
    els.statAttendedMeta.textContent = `of ${totalSessions} session${totalSessions === 1 ? '' : 's'}`;
    els.statClasses.textContent = String(state.classes.length);
    els.statClassesMeta.textContent = tracked ? `${tracked} with recorded sessions` : 'Add a class to begin';
    els.statAtRisk.textContent = String(atRisk);
    els.statAtRiskMeta.textContent = atRisk ? 'Needs your attention' : 'Everything is on track';
}

function visibleClasses() {
    const query = state.query.trim().toLowerCase();
    const items = query ? state.classes.filter((item) => item.name.toLowerCase().includes(query)) : state.classes.slice();

    const riskRank = (item) => {
        const status = statusOf(item);
        if (status === 'bad') return 0;
        if (status === 'good') return 1;
        return 2;
    };

    const sorters = {
        risk: (a, b) => riskRank(a) - riskRank(b) || percentageOf(a) - percentageOf(b) || a.name.localeCompare(b.name),
        name: (a, b) => a.name.localeCompare(b.name),
        percentage: (a, b) => percentageOf(b) - percentageOf(a) || a.name.localeCompare(b.name),
        recent: (a, b) => b.updatedAt - a.updatedAt
    };

    return items.sort(sorters[state.sort] || sorters.risk);
}

function renderList() {
    const items = visibleClasses();
    els.list.innerHTML = '';

    if (!items.length) {
        els.emptyState.hidden = false;
        if (!state.classes.length) {
            els.emptyTitle.textContent = 'No classes yet';
            els.emptyText.textContent = 'Add your first class above to start tracking attendance.';
        } else {
            els.emptyTitle.textContent = 'No matches';
            els.emptyText.textContent = `Nothing matches “${state.query.trim()}”. Try a different search.`;
        }
        return;
    }

    els.emptyState.hidden = true;
    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.appendChild(buildClassCard(item)));
    els.list.appendChild(fragment);
}

function buildClassCard(item) {
    const status = statusOf(item);
    const percent = percentageOf(item);
    const info = formatStatus(item);
    const card = document.createElement('article');
    card.className = `class-card class-card--${status === 'good' ? 'on-track' : status === 'bad' ? 'at-risk' : 'empty'}`;
    card.dataset.id = item.id;

    const lastEntry = item.history.length ? item.history[item.history.length - 1] : null;
    const lastLabel = lastEntry === 'present' ? 'last marked present' : lastEntry === 'absent' ? 'last marked absent' : 'no sessions recorded';

    card.innerHTML = `
        <div>
            <div class="class-card__head">
                <h3 class="class-card__name">${escapeHtml(item.name)}</h3>
                <span class="badge ${info.badgeClass}">${info.badge}</span>
            </div>
            <p class="class-card__meta">
                <strong>${item.attended}</strong> attended of <strong>${item.total}</strong> session${item.total === 1 ? '' : 's'} · ${lastLabel}
            </p>
            <p class="class-card__hint${status === 'bad' ? ' is-warn' : ''}">${escapeHtml(info.hint)}</p>
        </div>
        <div class="class-card__aside">
            <span class="class-card__percent ${status === 'good' ? 'is-good' : status === 'bad' ? 'is-bad' : 'is-idle'}">${percent}%</span>
        </div>
        <div class="progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(item.name)} attendance">
            <div class="progress__fill ${status === 'good' ? '' : status === 'bad' ? 'is-bad' : 'is-idle'}" style="width:${percent}%"></div>
        </div>
        <div class="class-card__actions">
            <button class="btn btn--success btn--sm" type="button" data-action="present">Present</button>
            <button class="btn btn--warn btn--sm" type="button" data-action="absent">Absent</button>
            <button class="btn btn--ghost btn--sm" type="button" data-action="undo" ${item.history.length ? '' : 'disabled'}>Undo</button>
            <span class="spacer"></span>
            <button class="btn btn--ghost btn--sm" type="button" data-action="reset">Reset</button>
            <button class="btn btn--ghost btn--sm" type="button" data-action="delete">Delete</button>
        </div>
    `;

    return card;
}

function findClass(id) {
    return state.classes.find((item) => item.id === id);
}

function markSession(id, entry) {
    const item = findClass(id);
    if (!item) return null;
    if (entry === 'present') {
        item.attended += 1;
        item.total += 1;
    } else {
        item.total += 1;
    }
    item.history.push(entry);
    if (item.history.length > HISTORY_LIMIT) item.history.shift();
    item.updatedAt = Date.now();
    saveClasses();
    render();
    return item;
}

function undoSession(id) {
    const item = findClass(id);
    if (!item || !item.history.length) return false;
    const last = item.history.pop();
    if (last === 'present') {
        item.attended = Math.max(0, item.attended - 1);
        item.total = Math.max(0, item.total - 1);
    } else {
        item.total = Math.max(0, item.total - 1);
    }
    item.updatedAt = Date.now();
    saveClasses();
    render();
    return true;
}

function resetClass(id) {
    const item = findClass(id);
    if (!item) return;
    item.attended = 0;
    item.total = 0;
    item.history = [];
    item.updatedAt = Date.now();
    saveClasses();
    render();
    showToast(`${item.name} was reset.`, 'success');
}

function deleteClass(id) {
    const index = state.classes.findIndex((item) => item.id === id);
    if (index === -1) return;
    const removed = state.classes.splice(index, 1)[0];
    saveClasses();
    render();
    showToast(`${removed.name} deleted.`, 'success', {
        label: 'Undo',
        action: () => {
            state.classes.splice(index, 0, removed);
            saveClasses();
            render();
        }
    });
}

function showModal(title, message, onConfirm, confirmLabel) {
    els.modalTitle.textContent = title;
    els.modalMessage.textContent = message;
    els.confirmBtn.textContent = confirmLabel || 'Confirm';
    confirmHandler = onConfirm || null;
    els.modal.hidden = false;
    els.confirmBtn.focus();
}

function closeModal() {
    els.modal.hidden = true;
}

function showToast(message, type, action) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type || 'info'}`;

    const text = document.createElement('span');
    text.className = 'toast__text';
    text.textContent = message;
    toast.appendChild(text);

    if (action) {
        const button = document.createElement('button');
        button.className = 'toast__undo';
        button.type = 'button';
        button.textContent = action.label;
        button.addEventListener('click', () => {
            action.action();
            dismiss();
        });
        toast.appendChild(button);
    }

    const timer = setTimeout(dismiss, action ? 6000 : 3200);

    function dismiss() {
        clearTimeout(timer);
        toast.classList.add('is-leaving');
        toast.addEventListener('animationend', () => toast.remove());
    }

    els.toastRegion.appendChild(toast);
}

function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    els.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    saveSettings();
}

function showAddError(message) {
    els.addError.textContent = message;
    els.addError.hidden = false;
    els.nameInput.setAttribute('aria-invalid', 'true');
    els.nameInput.focus();
}

function clearAddError() {
    els.addError.hidden = true;
    els.nameInput.removeAttribute('aria-invalid');
}

els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = els.nameInput.value.trim();
    clearAddError();

    if (!name) {
        showAddError('Enter a class name.');
        return;
    }

    const duplicate = state.classes.some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
        showAddError(`“${name}” is already being tracked.`);
        return;
    }

    state.classes.push({
        id: uid(),
        name,
        attended: 0,
        total: 0,
        history: [],
        updatedAt: Date.now()
    });
    saveClasses();
    render();
    els.nameInput.value = '';
    els.nameInput.focus();
    showToast(`${name} added.`, 'success');
});

els.nameInput.addEventListener('input', clearAddError);

els.list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('.class-card');
    if (!card) return;
    const id = card.dataset.id;
    const action = button.dataset.action;

    if (action === 'present' || action === 'absent') {
        markSession(id, action);
    } else if (action === 'undo') {
        undoSession(id);
    } else if (action === 'reset') {
        const item = findClass(id);
        if (!item) return;
        showModal('Reset class?', `This clears all recorded sessions for ${item.name}.`, () => resetClass(id), 'Reset');
    } else if (action === 'delete') {
        const item = findClass(id);
        if (!item) return;
        showModal('Delete class?', `${item.name} and its history will be removed.`, () => deleteClass(id), 'Delete');
    }
});

els.search.addEventListener('input', (event) => {
    state.query = event.target.value;
    renderList();
});

els.sort.addEventListener('change', (event) => {
    state.sort = event.target.value;
    renderList();
});

els.goal.addEventListener('input', (event) => {
    const value = parseInt(event.target.value, 10);
    if (Number.isNaN(value) || value < 1 || value > 100) return;
    state.goal = value;
    saveSettings();
    render();
});

els.themeToggle.addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
});

els.moreBtn.addEventListener('click', () => {
    const open = els.moreMenu.hidden;
    els.moreMenu.hidden = !open;
    els.moreBtn.setAttribute('aria-expanded', String(open));
});

document.addEventListener('click', (event) => {
    if (!els.moreMenu.hidden && !event.target.closest('.dropdown')) {
        els.moreMenu.hidden = true;
        els.moreBtn.setAttribute('aria-expanded', 'false');
    }
});

els.confirmBtn.addEventListener('click', () => {
    const handler = confirmHandler;
    confirmHandler = null;
    closeModal();
    if (handler) handler();
});

els.cancelBtn.addEventListener('click', () => {
    confirmHandler = null;
    closeModal();
});

els.modal.addEventListener('click', (event) => {
    if (event.target === els.modal) {
        confirmHandler = null;
        closeModal();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (!els.modal.hidden) {
            confirmHandler = null;
            closeModal();
            return;
        }
        if (!els.moreMenu.hidden) {
            els.moreMenu.hidden = true;
            els.moreBtn.setAttribute('aria-expanded', 'false');
        }
        return;
    }

    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (event.key === '/' && !typing) {
        event.preventDefault();
        els.search.focus();
        els.search.select();
    }
});

els.exportBtn.addEventListener('click', () => {
    closeMenu();
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        goal: state.goal,
        classes: state.classes
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Data exported.', 'success');
});

els.importBtn.addEventListener('click', () => {
    closeMenu();
    els.importFile.click();
});

els.importFile.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result));
            const incoming = Array.isArray(parsed) ? parsed : parsed.classes;
            if (!Array.isArray(incoming)) throw new Error('bad shape');
            const normalized = incoming.map(normalizeClass).filter(Boolean);
            if (!normalized.length) {
                showToast('That file did not contain any classes.', 'error');
                return;
            }
            showModal(
                'Import data?',
                `This replaces your current data with ${normalized.length} class${normalized.length === 1 ? '' : 'es'}.`,
                () => {
                    state.classes = normalized;
                    saveClasses();
                    render();
                    showToast(`Imported ${normalized.length} class${normalized.length === 1 ? '' : 'es'}.`, 'success');
                },
                'Import'
            );
        } catch (error) {
            showToast('Could not read that file. Choose a valid JSON export.', 'error');
        }
    };
    reader.readAsText(file);
});

els.clearAllBtn.addEventListener('click', () => {
    closeMenu();
    if (!state.classes.length) {
        showToast('There is nothing to clear.', 'info');
        return;
    }
    showModal(
        'Clear all data?',
        `This permanently removes all ${state.classes.length} tracked class${state.classes.length === 1 ? '' : 'es'}.`,
        () => {
            const snapshot = state.classes;
            state.classes = [];
            saveClasses();
            render();
            showToast('All data cleared.', 'success', {
                label: 'Undo',
                action: () => {
                    state.classes = snapshot;
                    saveClasses();
                    render();
                }
            });
        },
        'Clear all'
    );
});

function closeMenu() {
    els.moreMenu.hidden = true;
    els.moreBtn.setAttribute('aria-expanded', 'false');
}

function start() {
    els.goal.value = String(state.goal);
    document.documentElement.setAttribute('data-theme', state.theme);
    els.themeToggle.setAttribute('aria-label', state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    render();
}

start();
