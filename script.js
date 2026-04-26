// ====================================================
//  ClassManager Pro — script.js v3.0
//  עיצוב חדש + מנוע אילוצים מתקדם + מד שביעות רצון
// ====================================================

// ── STATE ──
let state = {
    cols: 8, rows: 6,
    students: [],
    grid: [],
    locked: new Set(),
    hiddenDesks: new Set(),
    columnGaps: new Set(),
    rowGaps: new Set(),
    editMode: 'normal',
    currentEditIdx: null,
    openaiKey: localStorage.getItem('cm_openai_key') || ''
};

let history = [];
let historyIndex = -1;
let aiMessages = [];
let _dragData = null;
window._selectedPoolStudent = null;
let pressTimer;

// ── HISTORY ──
function snapshotState() {
    return {
        cols: state.cols, rows: state.rows,
        students: JSON.parse(JSON.stringify(state.students)),
        grid: [...state.grid],
        locked: [...state.locked],
        hiddenDesks: [...state.hiddenDesks],
        columnGaps: [...state.columnGaps],
        rowGaps: [...state.rowGaps]
    };
}
function pushHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(snapshotState());
    if (history.length > 50) history.shift(); else historyIndex++;
    updateUndoRedoBtns();
}
function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    applySnapshot(history[historyIndex]);
    saveToStorage();
}
function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    applySnapshot(history[historyIndex]);
    saveToStorage();
}
function applySnapshot(snap) {
    state.cols = snap.cols; state.rows = snap.rows;
    state.students = JSON.parse(JSON.stringify(snap.students));
    state.grid = [...snap.grid];
    state.locked = new Set(snap.locked);
    state.hiddenDesks = new Set(snap.hiddenDesks);
    state.columnGaps = new Set(snap.columnGaps);
    state.rowGaps = new Set(snap.rowGaps);
    document.getElementById('colCount').textContent = state.cols;
    document.getElementById('rowCount').textContent = state.rows;
    render(false);
    updateUndoRedoBtns();
}
function updateUndoRedoBtns() {
    const u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn');
    if (u) { u.disabled = historyIndex <= 0; u.style.opacity = historyIndex <= 0 ? '0.35' : '1'; }
    if (r) { r.disabled = historyIndex >= history.length - 1; r.style.opacity = historyIndex >= history.length - 1 ? '0.35' : '1'; }
}

// ── LOCAL STORAGE ──
function saveToStorage() {
    try {
        localStorage.setItem('cm_state', JSON.stringify({
            cols: state.cols, rows: state.rows,
            students: state.students, grid: state.grid,
            locked: [...state.locked], hiddenDesks: [...state.hiddenDesks],
            columnGaps: [...state.columnGaps], rowGaps: [...state.rowGaps]
        }));
        flashSaveIndicator();
    } catch(e) {}
}
function loadFromStorage() {
    try {
        const saved = localStorage.getItem('cm_state');
        if (!saved) return false;
        const d = JSON.parse(saved);
        state.cols = d.cols || 8; state.rows = d.rows || 6;
        state.students = d.students || []; state.grid = d.grid || [];
        state.locked = new Set(d.locked || []);
        state.hiddenDesks = new Set(d.hiddenDesks || []);
        state.columnGaps = new Set(d.columnGaps || []);
        state.rowGaps = new Set(d.rowGaps || []);
        return true;
    } catch(e) { return false; }
}
function flashSaveIndicator() {
    const el = document.getElementById('saveIndicator');
    if (!el) return;
    el.style.opacity = '1';
    clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(() => el.style.opacity = '0', 2000);
}

// ── HELPERS ──
function totalCells() { return state.cols * state.rows; }
function ensureGridSize() { while (state.grid.length < totalCells()) state.grid.push(null); }
function idxToColRow(idx) { return { col: idx % state.cols, row: Math.floor(idx / state.cols) }; }

// ── CONSTRAINT SCORING ENGINE ──
// סוגי אילוצים לכל תלמיד: preferred, forbidden, frontPrefer (קדמה), backPrefer (אחורה), cornerPrefer (פינה), separateFrom (הפרדה מקסימלית)
function scorePlacement(studentId, seatIdx, seatOf) {
    const student = state.students.find(s => s.id == studentId);
    if (!student) return 0;
    const { col, row } = idxToColRow(seatIdx);
    const maxRow = state.rows - 1;
    let score = 0;

    // preferred neighbors (+15 adjacent, +5 nearby)
    (student.preferred || []).forEach(pid => {
        if (seatOf[pid] !== undefined) {
            const { col: pc, row: pr } = idxToColRow(seatOf[pid]);
            const d = Math.abs(col - pc) + Math.abs(row - pr);
            if (d <= 1) score += 15;
            else if (d <= 2) score += 5;
            else if (d <= 3) score += 1;
        }
    });

    // forbidden neighbors (-25 adjacent, -8 nearby)
    (student.forbidden || []).forEach(fid => {
        if (seatOf[fid] !== undefined) {
            const { col: fc, row: fr } = idxToColRow(seatOf[fid]);
            const d = Math.abs(col - fc) + Math.abs(row - fr);
            if (d <= 1) score -= 25;
            else if (d <= 2) score -= 8;
        }
    });

    // separateFrom - מקסימום מרחק (4 פינות)
    (student.separateFrom || []).forEach(sid => {
        if (seatOf[sid] !== undefined) {
            const { col: sc, row: sr } = idxToColRow(seatOf[sid]);
            const d = Math.abs(col - sc) + Math.abs(row - sr);
            score += d * 3; // ככל שרחוק יותר - ציון גבוה יותר
        }
    });

    // frontPrefer - עדיפות לשורות קדמיות (row נמוך = קדמה)
    if (student.frontPrefer) {
        score += (maxRow - row) * 4;
    }

    // backPrefer - עדיפות לשורות אחוריות
    if (student.backPrefer) {
        score += row * 4;
    }

    // tall - גבוה, מועדף שורות אחוריות
    if (student.tall) {
        score += row * 3;
    }

    // cornerPrefer - עדיפות לפינות
    if (student.cornerPrefer) {
        const isCornerCol = col === 0 || col === state.cols - 1;
        const isCornerRow = row === 0 || row === maxRow;
        if (isCornerCol && isCornerRow) score += 20;
        else if (isCornerCol || isCornerRow) score += 8;
    }

    return score;
}

// ── SATISFACTION METER ──
function calcSatisfaction() {
    let total = 0, satisfied = 0, violated = 0, partial = 0;
    const seatOf = {};
    for (let i = 0; i < totalCells(); i++) {
        if (state.grid[i] && !state.hiddenDesks.has(i)) seatOf[state.grid[i]] = i;
    }
    state.students.forEach(student => {
        if (!seatOf[student.id]) return;
        const { col, row } = idxToColRow(seatOf[student.id]);

        // preferred constraints
        (student.preferred || []).forEach(pid => {
            if (!seatOf[pid]) return;
            total++;
            const { col: pc, row: pr } = idxToColRow(seatOf[pid]);
            const d = Math.abs(col - pc) + Math.abs(row - pr);
            if (d <= 1) satisfied++;
            else if (d <= 3) partial++;
            else violated++;
        });

        // forbidden constraints
        (student.forbidden || []).forEach(fid => {
            if (!seatOf[fid]) return;
            total++;
            const { col: fc, row: fr } = idxToColRow(seatOf[fid]);
            const d = Math.abs(col - fc) + Math.abs(row - fr);
            if (d > 2) satisfied++;
            else if (d === 2) partial++;
            else violated++;
        });

        // separateFrom
        (student.separateFrom || []).forEach(sid => {
            if (!seatOf[sid]) return;
            total++;
            const { col: sc, row: sr } = idxToColRow(seatOf[sid]);
            const d = Math.abs(col - sc) + Math.abs(row - sr);
            const maxD = state.cols + state.rows - 2;
            if (d >= maxD * 0.6) satisfied++;
            else if (d >= maxD * 0.3) partial++;
            else violated++;
        });

        // frontPrefer / backPrefer / tall
        if (student.frontPrefer || student.tall) {
            total++;
            if (row <= 1) satisfied++;
            else if (row <= 2) partial++;
            else violated++;
        }
        if (student.backPrefer) {
            total++;
            if (row >= state.rows - 2) satisfied++;
            else if (row >= state.rows - 3) partial++;
            else violated++;
        }
        if (student.tall && !student.frontPrefer) {
            // tall alone means back
            total++;
            if (row >= state.rows - 2) satisfied++;
            else if (row >= state.rows - 3) partial++;
            else violated++;
        }
    });

    if (total === 0) return { pct: 100, satisfied: 0, partial: 0, violated: 0, total: 0 };
    const pct = Math.round(((satisfied + partial * 0.5) / total) * 100);
    return { pct, satisfied, partial, violated, total };
}

function updateSatisfactionBar() {
    const { pct, satisfied, partial, violated, total } = calcSatisfaction();
    const bar = document.getElementById('satisfactionBar');
    const label = document.getElementById('satisfactionLabel');
    const detail = document.getElementById('satisfactionDetail');
    if (!bar) return;

    bar.style.width = pct + '%';
    bar.style.background = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
    if (label) label.textContent = total === 0 ? 'אין אילוצים' : `${pct}% שביעות רצון`;
    if (detail && total > 0) {
        detail.textContent = `✅${satisfied} ⚡${partial} ❌${violated}`;
    }
}

// ── SMART SORT (מתקדם) ──
function runSmartSort() {
    pushHistory();
    const lockedStudents = new Set();
    for (let i = 0; i < totalCells(); i++) {
        if (state.locked.has(i) && state.grid[i]) lockedStudents.add(state.grid[i]);
    }

    const toPlace = state.students.filter(s => !lockedStudents.has(s.id));

    // נקה רק משבצות לא נעולות ולא מוסתרות
    for (let i = 0; i < totalCells(); i++) {
        if (!state.locked.has(i) && !state.hiddenDesks.has(i)) state.grid[i] = null;
    }

    // משבצות זמינות: רק משבצות שאינן מוסתרות ואינן נעולות
    const available = [];
    for (let i = 0; i < totalCells(); i++) {
        if (!state.hiddenDesks.has(i) && !state.locked.has(i)) available.push(i);
    }

    // מיון תלמידים: קודם אלה עם יותר אילוצים (חשוב לשבץ אותם ראשונים)
    toPlace.sort((a, b) => {
        const scoreA = (a.preferred?.length || 0) + (a.forbidden?.length || 0) + (a.separateFrom?.length || 0) + (a.frontPrefer ? 2 : 0) + (a.backPrefer ? 2 : 0) + (a.tall ? 1 : 0) + (a.cornerPrefer ? 1 : 0);
        const scoreB = (b.preferred?.length || 0) + (b.forbidden?.length || 0) + (b.separateFrom?.length || 0) + (b.frontPrefer ? 2 : 0) + (b.backPrefer ? 2 : 0) + (b.tall ? 1 : 0) + (b.cornerPrefer ? 1 : 0);
        return scoreB - scoreA;
    });

    const seatOf = {};
    // נרשום מיקומי תלמידים נעולים
    for (let i = 0; i < totalCells(); i++) {
        if (state.locked.has(i) && state.grid[i]) seatOf[state.grid[i]] = i;
    }

    toPlace.forEach(student => {
        if (!available.length) return;
        let best = { seat: available[0], score: -Infinity };
        for (const seat of available) {
            const score = scorePlacement(student.id, seat, seatOf) + Math.random() * 0.3;
            if (score > best.score) best = { seat, score };
        }
        state.grid[best.seat] = student.id;
        seatOf[student.id] = best.seat;
        available.splice(available.indexOf(best.seat), 1);
    });

    render(false);
    saveToStorage();
    updateSatisfactionBar();
    showToast('🪄 סידור חכם הושלם!');
}

// ── IMPORT / EXPORT ──
async function handleStudentsImport(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value = '';
    try {
        let students;
        const text = await file.text();
        if (file.name.endsWith('.json')) {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                if (typeof data[0] === 'string') {
                    students = data.map((n, i) => ({ id: i + 1, name: n, forbidden: [], preferred: [] }));
                } else {
                    students = data.map(s => ({ id: s.id ?? Math.random(), name: s.name, forbidden: s.forbidden || [], preferred: s.preferred || [] }));
                }
            } else if (data.students) {
                students = data.students.map(s => ({ id: s.id, name: s.name, forbidden: s.forbidden || [], preferred: s.preferred || [] }));
            } else throw new Error('מבנה JSON לא מזוהה');
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const buf = await file.arrayBuffer(); const wb = XLSX.read(buf);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            students = rows.flat().filter(n => n && String(n).trim()).map((n, i) => ({ id: i + 1, name: String(n).trim(), forbidden: [], preferred: [] }));
        } else {
            students = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map((n, i) => ({ id: i + 1, name: n, forbidden: [], preferred: [] }));
        }
        if (!students?.length) { showToast('❌ לא נמצאו תלמידים', 'error'); return; }
        pushHistory();
        state.students = students;
        state.grid = Array(totalCells()).fill(null);
        showToast(`✅ נטענו ${state.students.length} תלמידים`);
        render(false); saveToStorage();
    } catch(err) { showToast('❌ שגיאה: ' + err.message, 'error'); }
}

async function handleConstraintsImport(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value = '';
    try {
        const data = JSON.parse(await file.text()); let updated = 0;
        data.forEach(entry => {
            const s = state.students.find(s => s.id == entry.id || s.name === entry.name);
            if (s) {
                if (entry.preferred) s.preferred = entry.preferred;
                if (entry.forbidden) s.forbidden = entry.forbidden;
                if (entry.separateFrom) s.separateFrom = entry.separateFrom;
                if (entry.frontPrefer !== undefined) s.frontPrefer = entry.frontPrefer;
                if (entry.backPrefer !== undefined) s.backPrefer = entry.backPrefer;
                if (entry.tall !== undefined) s.tall = entry.tall;
                if (entry.cornerPrefer !== undefined) s.cornerPrefer = entry.cornerPrefer;
                updated++;
            }
        });
        showToast(`✅ עודכנו אילוצים ל-${updated} תלמידים`);
        render(false); saveToStorage(); updateSatisfactionBar();
    } catch(err) { showToast('❌ שגיאה בטעינת האילוצים', 'error'); }
}

function exportJSON() {
    const data = {
        cols: state.cols, rows: state.rows, students: state.students, grid: state.grid,
        locked: [...state.locked], hiddenDesks: [...state.hiddenDesks],
        columnGaps: [...state.columnGaps], rowGaps: [...state.rowGaps]
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'classroom.json'; a.click();
}

// ── MODES ──
function setMode(mode) {
    state.editMode = mode;
    ['normal', 'structure', 'gapCol', 'gapRow'].forEach(m => document.getElementById(m + 'Btn')?.classList.remove('active'));
    document.getElementById(mode + 'Btn')?.classList.add('active');
}

// ── DESK INTERACTIONS ──
function startPress(idx) {
    pressTimer = setTimeout(() => {
        if (state.grid[idx]) {
            pushHistory();
            state.locked.has(idx) ? state.locked.delete(idx) : state.locked.add(idx);
            render(false); saveToStorage();
            if (navigator.vibrate) navigator.vibrate(50);
        }
    }, 600);
}
function endPress() { clearTimeout(pressTimer); }

function handleDeskClick(idx) {
    if (state.hiddenDesks.has(idx) && state.editMode !== 'structure') return;
    if (state.editMode === 'structure') {
        pushHistory();
        state.hiddenDesks.has(idx) ? state.hiddenDesks.delete(idx) : state.hiddenDesks.add(idx);
        if (state.hiddenDesks.has(idx) && state.grid[idx]) state.grid[idx] = null;
        render(false); saveToStorage(); return;
    }
    if (state.editMode === 'gapCol') {
        const col = idx % state.cols;
        state.columnGaps.has(col) ? state.columnGaps.delete(col) : state.columnGaps.add(col);
        render(false); return;
    }
    if (state.editMode === 'gapRow') {
        const row = Math.floor(idx / state.cols);
        state.rowGaps.has(row) ? state.rowGaps.delete(row) : state.rowGaps.add(row);
        render(false); return;
    }
    if (state.grid[idx]) { openModal(idx); }
    else if (window._selectedPoolStudent != null) {
        pushHistory();
        state.grid[idx] = window._selectedPoolStudent;
        window._selectedPoolStudent = null;
        render(false); saveToStorage(); updateSatisfactionBar();
    }
}

// ── DRAG & DROP ──
function onDragStartDesk(e, idx) {
    if (!state.grid[idx] || state.locked.has(idx)) { e.preventDefault(); return; }
    _dragData = { source: 'desk', id: state.grid[idx], fromIdx: idx };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    setTimeout(() => { if (e.target) e.target.style.opacity = '0.35'; }, 0);
}
function onDragEndDesk(e) {
    if (e.target) e.target.style.opacity = '';
    _dragData = null;
    document.querySelectorAll('.desk').forEach(d => d.classList.remove('drag-over'));
}
function onDragStartPool(e, studentId) {
    _dragData = { source: 'pool', id: studentId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(studentId));
}
function onDragOverDesk(e, idx) {
    if (state.hiddenDesks.has(idx) || state.locked.has(idx) || !_dragData) return;
    if (_dragData.source === 'desk' && _dragData.fromIdx === idx) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}
function onDragLeaveDesk(e) { e.currentTarget.classList.remove('drag-over'); }
function onDropDesk(e, idx) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!_dragData) return;
    if (state.hiddenDesks.has(idx)) return;
    if (state.locked.has(idx)) { showToast('⛔ המושב נעול', 'error'); return; }
    pushHistory();
    if (_dragData.source === 'pool') {
        state.grid[idx] = _dragData.id;
    } else if (_dragData.source === 'desk') {
        const fromIdx = _dragData.fromIdx;
        if (fromIdx === idx) { _dragData = null; return; }
        const temp = state.grid[idx];
        state.grid[idx] = state.grid[fromIdx];
        state.grid[fromIdx] = temp;
    }
    _dragData = null;
    render(false); saveToStorage(); updateSatisfactionBar();
}
function onDragOverPool(e) { if (_dragData?.source === 'desk') { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }
function onDropPool(e) {
    e.preventDefault();
    if (!_dragData || _dragData.source !== 'desk') return;
    const fromIdx = _dragData.fromIdx;
    if (state.locked.has(fromIdx)) { showToast('⛔ המושב נעול', 'error'); _dragData = null; return; }
    pushHistory();
    state.grid[fromIdx] = null;
    _dragData = null;
    window._selectedPoolStudent = null;
    render(false); saveToStorage(); updateSatisfactionBar();
}

// ── ADD STUDENT ──
function addStudentManually() {
    const input = document.getElementById('newStudentName');
    const name = input.value.trim();
    if (!name) { showToast('יש להזין שם', 'error'); input.focus(); return; }
    const newId = state.students.length ? Math.max(...state.students.map(s => +s.id)) + 1 : 1;
    pushHistory();
    state.students.push({ id: newId, name, preferred: [], forbidden: [], separateFrom: [] });
    input.value = ''; input.focus();
    render(false); saveToStorage();
    showToast(`✅ ${name} נוסף`);
}
function handleNewStudentKeydown(e) { if (e.key === 'Enter') addStudentManually(); }

// ── GRID SIZE ──
function changeGrid(type, val) {
    if (type === 'cols') {
        const newCols = Math.max(1, Math.min(16, state.cols + val)); if (newCols === state.cols) return;
        const oldGrid = [...state.grid], newGrid = [];
        for (let r = 0; r < state.rows; r++) for (let c = 0; c < newCols; c++) newGrid.push(c < state.cols ? (oldGrid[r * state.cols + c] ?? null) : null);
        state.cols = newCols; state.grid = newGrid;
        state.locked = new Set([...state.locked].filter(i => i < totalCells()));
        state.hiddenDesks = new Set([...state.hiddenDesks].filter(i => i < totalCells()));
        state.columnGaps = new Set([...state.columnGaps].filter(c => c < newCols));
    }
    if (type === 'rows') {
        const newRows = Math.max(1, Math.min(20, state.rows + val)); if (newRows === state.rows) return;
        state.rows = newRows; ensureGridSize();
        state.locked = new Set([...state.locked].filter(i => i < totalCells()));
        state.hiddenDesks = new Set([...state.hiddenDesks].filter(i => i < totalCells()));
        state.rowGaps = new Set([...state.rowGaps].filter(r => r < newRows));
    }
    document.getElementById('colCount').textContent = state.cols;
    document.getElementById('rowCount').textContent = state.rows;
    render(false); saveToStorage();
}

// ── RENDER ──
function render(doHistory = true) {
    ensureGridSize();
    document.getElementById('colCount').textContent = state.cols;
    document.getElementById('rowCount').textContent = state.rows;
    const wrapper = document.getElementById('gridWrapper'); wrapper.innerHTML = '';
    const outer = document.createElement('div'); outer.style.display = 'inline-block';
    outer.appendChild(buildColControlRow());
    for (let r = 0; r < state.rows; r++) {
        if (r > 0) outer.appendChild(buildRowGapStrip(r));
        outer.appendChild(buildDeskRow(r));
    }
    outer.appendChild(buildRowAddRemoveBar());
    wrapper.appendChild(outer);
    updatePool();
    updateUndoRedoBtns();
    updateSatisfactionBar();
}

function buildDeskRow(r) {
    const rowDiv = document.createElement('div');
    rowDiv.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
    const rw = document.createElement('div'); rw.style.cssText = 'display:flex;align-items:center;gap:8px;';
    for (let c = 0; c < state.cols; c++) {
        if (c > 0 && state.columnGaps.has(c)) {
            const g = document.createElement('div');
            g.style.cssText = 'width:28px;height:72px;background:#e0e7ff;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#6366f1;font-size:1rem;';
            g.textContent = '↔'; g.onclick = () => { state.columnGaps.delete(c); render(false); }; rw.appendChild(g);
        } else if (c > 0 && state.editMode === 'gapCol') {
            const g = document.createElement('div');
            g.style.cssText = 'width:8px;height:72px;cursor:pointer;border-radius:4px;transition:background 0.15s;';
            g.onmouseenter = () => g.style.background = '#c7d2fe'; g.onmouseleave = () => g.style.background = 'transparent';
            g.onclick = () => { state.columnGaps.add(c); render(false); }; rw.appendChild(g);
        }
        rw.appendChild(buildDesk(r * state.cols + c));
    }
    rowDiv.appendChild(rw); return rowDiv;
}

function buildDesk(idx) {
    const sId = state.grid[idx];
    const isHidden = state.hiddenDesks.has(idx);
    const isLocked = state.locked.has(idx);
    const student = sId ? state.students.find(s => s.id == sId) : null;
    const desk = document.createElement('div'); desk.className = 'desk';

    if (isHidden) {
        desk.classList.add('hidden-desk');
    } else if (isLocked) {
        desk.classList.add('locked');
    }

    if (student && !isHidden) {
        if (checkConflict(idx, sId)) desk.classList.add('conflict');
        else if (checkPreferred(idx, sId)) desk.classList.add('preferred');

        // תגיות תכונות
        const badges = [];
        if (student.tall) badges.push('<span class="desk-badge tall-badge">גבוה</span>');
        if (student.frontPrefer) badges.push('<span class="desk-badge front-badge">קדמה</span>');
        if (student.backPrefer) badges.push('<span class="desk-badge back-badge">אחורה</span>');
        if (student.cornerPrefer) badges.push('<span class="desk-badge corner-badge">פינה</span>');

        desk.innerHTML = `<span class="desk-name">${student.name}</span>${badges.join('')}`;

        if (!isLocked) {
            desk.draggable = true;
            desk.addEventListener('dragstart', e => onDragStartDesk(e, idx));
            desk.addEventListener('dragend', onDragEndDesk);
        }
    }

    if (!isHidden && !isLocked) {
        desk.addEventListener('dragover', e => onDragOverDesk(e, idx));
        desk.addEventListener('dragleave', onDragLeaveDesk);
        desk.addEventListener('drop', e => onDropDesk(e, idx));
    }

    if (window._selectedPoolStudent != null && !sId && !isHidden) {
        desk.classList.add('drop-target');
    }

    desk.addEventListener('mousedown', () => startPress(idx));
    desk.addEventListener('mouseup', endPress);
    desk.addEventListener('touchstart', e => { e.preventDefault(); startPress(idx); }, { passive: false });
    desk.addEventListener('touchend', endPress);
    desk.addEventListener('click', () => handleDeskClick(idx));
    return desk;
}

function getNeighborIds(idx) {
    const { col, row } = idxToColRow(idx); const n = [];
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dc, dr]) => {
        const nc = col + dc, nr = row + dr;
        if (nc >= 0 && nc < state.cols && nr >= 0 && nr < state.rows) {
            const nid = state.grid[nr * state.cols + nc]; if (nid) n.push(nid);
        }
    }); return n;
}
function checkConflict(idx, sId) { const s = state.students.find(s => s.id == sId); return s && getNeighborIds(idx).some(nid => (s.forbidden || []).includes(nid)); }
function checkPreferred(idx, sId) { const s = state.students.find(s => s.id == sId); return s && getNeighborIds(idx).some(nid => (s.preferred || []).includes(nid)); }

function buildRowGapStrip(rowIndex) {
    const strip = document.createElement('div'); const hasGap = state.rowGaps.has(rowIndex);
    strip.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;cursor:pointer;border-radius:6px;transition:all 0.15s;margin-bottom:4px;';
    if (hasGap) {
        strip.style.height = '28px'; strip.style.background = '#e0e7ff'; strip.style.color = '#6366f1';
        strip.style.fontSize = '0.7rem'; strip.style.fontWeight = '700'; strip.textContent = '↕ רווח שורה — לחץ להסרה';
        strip.onclick = () => { state.rowGaps.delete(rowIndex); render(false); };
    } else if (state.editMode === 'gapRow') {
        strip.style.height = '8px';
        strip.onmouseenter = () => strip.style.background = '#c7d2fe'; strip.onmouseleave = () => strip.style.background = 'transparent';
        strip.onclick = () => { state.rowGaps.add(rowIndex); render(false); };
    } else { strip.style.height = '4px'; }
    return strip;
}

function buildColControlRow() {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;justify-content:center;';
    const mk = (txt, fn, tip) => { const b = document.createElement('button'); b.className = 'grid-ctrl-btn'; b.textContent = txt; b.title = tip; b.onclick = fn; return b; };
    row.appendChild(mk('−', () => changeGrid('cols', -1), 'הסר טור'));
    for (let c = 0; c < state.cols; c++) {
        if (c > 0 && state.columnGaps.has(c)) { const sp = document.createElement('div'); sp.style.width = '28px'; row.appendChild(sp); }
        else if (c > 0 && state.editMode === 'gapCol') { const sp = document.createElement('div'); sp.style.width = '8px'; row.appendChild(sp); }
        const sp = document.createElement('div'); sp.style.cssText = 'width:85px;text-align:center;font-size:0.65rem;color:#94a3b8;font-weight:700;'; sp.textContent = c + 1; row.appendChild(sp);
    }
    row.appendChild(mk('+', () => changeGrid('cols', 1), 'הוסף טור')); return row;
}

function buildRowAddRemoveBar() {
    const bar = document.createElement('div'); bar.style.cssText = 'display:flex;justify-content:center;gap:10px;margin-top:10px;';
    const mk = (txt, fn, tip) => { const b = document.createElement('button'); b.className = 'grid-ctrl-btn'; b.style.width = '32px'; b.style.height = '32px'; b.textContent = txt; b.title = tip; b.onclick = fn; return b; };
    const label = document.createElement('span'); label.style.cssText = 'font-size:0.7rem;color:#94a3b8;font-weight:700;align-self:center;'; label.textContent = 'שורות';
    bar.append(mk('−', () => changeGrid('rows', -1), 'הסר שורה'), label, mk('+', () => changeGrid('rows', 1), 'הוסף שורה')); return bar;
}

// ── POOL ──
function updatePool() {
    const pool = document.getElementById('studentPool');
    const seatedIds = new Set(state.grid.filter(id => id));
    const unseated = state.students.filter(s => !seatedIds.has(s.id));
    const countEl = document.getElementById('poolCount');
    if (countEl) countEl.textContent = unseated.length;
    pool.innerHTML = '';
    pool.ondragover = onDragOverPool;
    pool.ondrop = onDropPool;
    if (!unseated.length) {
        pool.innerHTML = '<p style="font-size:0.75rem;color:#94a3b8;width:100%;text-align:center;padding:8px 0;">✅ כל התלמידים משובצים</p>';
        return;
    }
    unseated.forEach(s => {
        const isSel = window._selectedPoolStudent === s.id;
        const div = document.createElement('div');
        div.className = 'pool-chip' + (isSel ? ' selected' : '');
        div.textContent = s.name;
        div.draggable = true;
        div.addEventListener('dragstart', e => onDragStartPool(e, s.id));
        div.onclick = () => { window._selectedPoolStudent = isSel ? null : s.id; render(false); };
        pool.appendChild(div);
    });
}

// ── MODAL ──
function openModal(idx) {
    state.currentEditIdx = idx;
    const sId = state.grid[idx];
    const student = state.students.find(s => s.id == sId);
    if (!student) return;
    document.getElementById('editNameInput').value = student.name;
    document.getElementById('modalTitle').textContent = student.name;
    document.getElementById('modalSub').textContent = `שורה ${Math.floor(idx / state.cols) + 1}, טור ${(idx % state.cols) + 1}`;
    buildConstraintsEditor(student);
    buildPositionPrefs(student);
    document.getElementById('editModal').style.display = 'flex';
}

function buildConstraintsEditor(student) {
    const container = document.getElementById('constraintsEditor');
    if (!container) return;
    container.innerHTML = '';
    const others = state.students.filter(s => s.id !== student.id);
    if (!others.length) { container.innerHTML = '<p style="font-size:0.75rem;color:#94a3b8;padding:4px 0">אין תלמידים נוספים</p>'; return; }

    [
        { type: 'preferred', label: '💚 ישיבה ליד', color: '#10b981', bg: '#f0fdf4' },
        { type: 'forbidden', label: '🔴 לא ליד', color: '#ef4444', bg: '#fef2f2' },
        { type: 'separateFrom', label: '↔️ הפרדה מקסימלית', color: '#f59e0b', bg: '#fffbeb' }
    ].forEach(({ type, label, color, bg }) => {
        const section = document.createElement('div'); section.style.marginBottom = '12px';
        const title = document.createElement('p');
        title.style.cssText = 'font-size:0.72rem;font-weight:800;color:#475569;margin-bottom:6px;';
        title.textContent = label; section.appendChild(title);
        const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
        others.forEach(other => {
            const isActive = (student[type] || []).includes(other.id);
            const btn = document.createElement('button');
            btn.textContent = other.name;
            btn.style.cssText = `padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:700;cursor:pointer;border:1.5px solid;transition:all 0.15s;font-family:Assistant,sans-serif;background:${isActive ? color : 'white'};color:${isActive ? 'white' : '#64748b'};border-color:${isActive ? color : '#e2e8f0'};`;
            btn.onclick = () => {
                if (!student[type]) student[type] = [];
                const arr = student[type];
                const i = arr.indexOf(other.id);
                if (i >= 0) arr.splice(i, 1); else arr.push(other.id);
                // Remove from opposite types
                ['preferred', 'forbidden', 'separateFrom'].forEach(ot => {
                    if (ot !== type && student[ot]) {
                        const oi = student[ot].indexOf(other.id);
                        if (oi >= 0) student[ot].splice(oi, 1);
                    }
                });
                buildConstraintsEditor(student);
                saveToStorage(); render(false); updateSatisfactionBar();
            };
            wrap.appendChild(btn);
        });
        section.appendChild(wrap); container.appendChild(section);
    });
}

function buildPositionPrefs(student) {
    const container = document.getElementById('positionPrefs');
    if (!container) return;
    container.innerHTML = '';

    const prefs = [
        { key: 'frontPrefer', label: '⬆️ קדמה', desc: 'שורות קדמיות' },
        { key: 'backPrefer', label: '⬇️ אחורה', desc: 'שורות אחוריות' },
        { key: 'tall', label: '📏 גבוה', desc: 'מועדף אחורה' },
        { key: 'cornerPrefer', label: '📐 פינה', desc: 'מושב פינתי' }
    ];

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';

    prefs.forEach(({ key, label, desc }) => {
        const isActive = !!student[key];
        const btn = document.createElement('button');
        btn.style.cssText = `padding:8px;border-radius:10px;border:2px solid;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:Assistant,sans-serif;text-align:center;transition:all 0.15s;background:${isActive ? '#4f46e5' : 'white'};color:${isActive ? 'white' : '#64748b'};border-color:${isActive ? '#4f46e5' : '#e2e8f0'};`;
        btn.innerHTML = `<div>${label}</div><div style="font-weight:400;font-size:0.65rem;opacity:0.8">${desc}</div>`;
        btn.onclick = () => {
            // frontPrefer ו-backPrefer ו-tall - מוציאים אחד את השני
            if (key === 'frontPrefer' && !student[key]) { student.backPrefer = false; student.tall = false; }
            if (key === 'backPrefer' && !student[key]) { student.frontPrefer = false; }
            if (key === 'tall' && !student[key]) { student.frontPrefer = false; }
            student[key] = !student[key];
            buildPositionPrefs(student);
            saveToStorage(); render(false); updateSatisfactionBar();
        };
        grid.appendChild(btn);
    });

    container.appendChild(grid);
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    state.currentEditIdx = null;
}

function saveQuickEdit() {
    const idx = state.currentEditIdx; if (idx === null) return;
    const s = state.students.find(s => s.id == state.grid[idx]);
    if (s) {
        const newName = document.getElementById('editNameInput').value.trim();
        if (newName && newName !== s.name) { pushHistory(); s.name = newName; }
    }
    closeModal(); render(false); saveToStorage();
}

function moveToPool() {
    const idx = state.currentEditIdx; if (idx === null) return;
    if (!state.locked.has(idx)) { pushHistory(); state.grid[idx] = null; saveToStorage(); }
    closeModal(); render(false); updateSatisfactionBar();
}

function removeStudent() {
    const idx = state.currentEditIdx; if (idx === null) return;
    const sId = state.grid[idx]; if (!sId) return;
    if (!confirm('למחוק תלמיד לגמרי מהרשימה?')) return;
    pushHistory();
    state.grid[idx] = null;
    state.students = state.students.filter(s => s.id !== sId);
    state.students.forEach(s => {
        s.preferred = (s.preferred || []).filter(id => id !== sId);
        s.forbidden = (s.forbidden || []).filter(id => id !== sId);
        s.separateFrom = (s.separateFrom || []).filter(id => id !== sId);
    });
    closeModal(); render(false); saveToStorage(); updateSatisfactionBar();
    showToast('🗑️ תלמיד נמחק');
}

function clearGrid() {
    if (confirm('לנקות את כל הכיתה?')) {
        pushHistory();
        state.grid = Array(totalCells()).fill(null);
        state.locked.clear();
        window._selectedPoolStudent = null;
        render(false); saveToStorage(); updateSatisfactionBar();
    }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }

// ── AI PANEL ──
function openAIPanel() {
    document.getElementById('aiPanel').style.display = 'flex';
    if (!state.openaiKey) {
        document.getElementById('aiKeySetup').style.display = 'block';
        document.getElementById('aiChat').style.display = 'none';
    } else {
        document.getElementById('aiKeySetup').style.display = 'none';
        document.getElementById('aiChat').style.display = 'flex';
    }
}
function closeAIPanel() { document.getElementById('aiPanel').style.display = 'none'; }

function saveAPIKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key.startsWith('sk-')) { showToast('❌ מפתח לא תקין', 'error'); return; }
    state.openaiKey = key; localStorage.setItem('cm_openai_key', key);
    document.getElementById('aiKeySetup').style.display = 'none';
    document.getElementById('aiChat').style.display = 'flex';
    showToast('✅ מפתח נשמר');
}
function clearAPIKey() {
    state.openaiKey = ''; localStorage.removeItem('cm_openai_key');
    document.getElementById('apiKeyInput').value = '';
    document.getElementById('aiKeySetup').style.display = 'block';
    document.getElementById('aiChat').style.display = 'none';
}

function buildClassroomContext() {
    const seatedIds = new Set(state.grid.filter(id => id)), seatingDesc = [];
    const visibleGrid = [];
    for (let i = 0; i < totalCells(); i++) {
        if (!state.hiddenDesks.has(i)) {
            if (state.grid[i]) {
                const { col, row } = idxToColRow(i);
                const s = state.students.find(s => s.id == state.grid[i]);
                if (s) seatingDesc.push(`${s.name}(ש${row + 1}ט${col + 1})`);
            }
            visibleGrid.push(i);
        }
    }
    const unseated = state.students.filter(s => !seatedIds.has(s.id)).map(s => s.name);
    const constraints = state.students.filter(s => s.preferred?.length || s.forbidden?.length || s.separateFrom?.length || s.frontPrefer || s.backPrefer || s.tall || s.cornerPrefer).map(s => {
        const parts = [];
        if (s.preferred?.length) parts.push(`ליד:[${(s.preferred).map(pid => state.students.find(st => st.id == pid)?.name).filter(Boolean).join(',')}]`);
        if (s.forbidden?.length) parts.push(`לא-ליד:[${(s.forbidden).map(pid => state.students.find(st => st.id == pid)?.name).filter(Boolean).join(',')}]`);
        if (s.separateFrom?.length) parts.push(`הפרדה:[${(s.separateFrom).map(pid => state.students.find(st => st.id == pid)?.name).filter(Boolean).join(',')}]`);
        if (s.frontPrefer) parts.push('קדמה');
        if (s.backPrefer) parts.push('אחורה');
        if (s.tall) parts.push('גבוה');
        if (s.cornerPrefer) parts.push('פינה');
        return `${s.name}: ${parts.join(' ')}`;
    });
    const { pct } = calcSatisfaction();
    return `כיתה: ${state.rows}×${state.cols} (${visibleGrid.length} משבצות פעילות). תלמידים: ${state.students.length}. ממוקמים: ${seatingDesc.join(' ') || 'אין'}. ממתינים: ${unseated.join(',') || 'אין'}. אילוצים: ${constraints.join(' ') || 'אין'}. שביעות רצון: ${pct}%.`;
}

async function sendAIMessage() {
    const input = document.getElementById('aiInput');
    const userMsg = input.value.trim(); if (!userMsg) return;
    if (!state.openaiKey) { showToast('❌ אין מפתח API', 'error'); return; }
    input.value = ''; addAIBubble(userMsg, 'user');

    const visibleCount = [...Array(totalCells()).keys()].filter(i => !state.hiddenDesks.has(i)).length;

    const systemPrompt = `אתה עוזר פדגוגי חכם למורה. מידע על הכיתה: ${buildClassroomContext()}
חשוב: כיתה זו מכילה ${visibleCount} מושבות פעילות בלבד (מוסתרים אינם נחשבים).
יכולות: לייעץ על סידור, לנתח קונפליקטים, להציע שכנים, לשפר אילוצים.
אם מבקשים לסדר את הכיתה — החזר JSON: {"action":"arrange","grid":[id1,id2,...null]} באורך ${totalCells()} בדיוק, כאשר null במושבות מוסתרות (אינדקסים: ${[...state.hiddenDesks].join(',') || 'אין'}) ובמושבות ריקות.
חשוב מאוד: אל תשבץ תלמידים במושבות המוסתרות! האינדקסים המוסתרים חייבים להישאר null.
ענה בעברית, קצר וברור.`;

    if (aiMessages.length > 20) aiMessages = aiMessages.slice(-20);
    aiMessages.push({ role: 'user', content: userMsg });
    const loadingId = addAIBubble('...', 'assistant', true);
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.openaiKey}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, ...aiMessages], max_tokens: 1200, temperature: 0.6 })
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || 'שגיאת API'); }
        const data = await res.json(); const reply = data.choices[0].message.content;
        aiMessages.push({ role: 'assistant', content: reply });
        document.getElementById(loadingId)?.remove();
        const jsonMatch = reply.match(/\{"action":"arrange","grid":\[[^\]]*\]\}/);
        if (jsonMatch) {
            try {
                const arr = JSON.parse(jsonMatch[0]);
                // ודא שמושבות מוסתרות ריקות
                arr.grid.forEach((val, i) => { if (state.hiddenDesks.has(i)) arr.grid[i] = null; });
                const text = reply.replace(jsonMatch[0], '').trim();
                addAIBubble(text || 'הנה הסידור המוצע:', 'assistant');
                addAIArrangeButton(arr.grid);
            } catch(e) { addAIBubble(reply, 'assistant'); }
        } else { addAIBubble(reply, 'assistant'); }
    } catch(err) { document.getElementById(loadingId)?.remove(); addAIBubble(`❌ שגיאה: ${err.message}`, 'assistant'); }
}

function addAIBubble(text, role, loading = false) {
    const id = 'b' + Date.now() + Math.random().toString(36).slice(2);
    const chatDiv = document.getElementById('aiMessages');
    const bubble = document.createElement('div'); bubble.id = id;
    const isUser = role === 'user';
    bubble.className = 'ai-bubble ' + (isUser ? 'ai-bubble-user' : 'ai-bubble-bot');
    bubble.textContent = loading ? '💭 חושב...' : text;
    chatDiv.appendChild(bubble); chatDiv.scrollTop = chatDiv.scrollHeight; return id;
}

function addAIArrangeButton(grid) {
    const chatDiv = document.getElementById('aiMessages');
    const btn = document.createElement('button');
    btn.className = 'ai-apply-btn';
    btn.textContent = '✅ החל סידור זה';
    btn.onclick = () => {
        if (confirm('להחיל את סידור ה-AI?')) {
            pushHistory();
            // ודא מושבות מוסתרות ריקות
            state.grid = grid.map((id, i) => state.hiddenDesks.has(i) ? null : (id || null));
            ensureGridSize(); render(false); saveToStorage(); updateSatisfactionBar();
            showToast('✅ סידור הוחל!');
            btn.disabled = true; btn.textContent = '✅ הוחל'; btn.style.background = '#94a3b8';
        }
    };
    chatDiv.appendChild(btn); chatDiv.scrollTop = chatDiv.scrollHeight;
}

function handleAIKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); } }

// ── TOAST ──
function showToast(msg, type = 'success') {
    let t = document.getElementById('_toast');
    if (!t) {
        t = document.createElement('div'); t.id = '_toast';
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 24px;border-radius:16px;font-weight:700;font-size:0.85rem;box-shadow:0 8px 32px rgba(0,0,0,0.15);transition:opacity 0.3s,transform 0.3s;font-family:Assistant,sans-serif;pointer-events:none;';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = type === 'error' ? '#fef2f2' : '#f0fdf4';
    t.style.color = type === 'error' ? '#b91c1c' : '#166534';
    t.style.border = `1px solid ${type === 'error' ? '#fecaca' : '#bbf7d0'}`;
    t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(8px)'; }, 2800);
}

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    if (e.key === 'Escape') {
        closeModal();
        if (document.getElementById('aiPanel').style.display === 'flex') closeAIPanel();
    }
});

// ── BOOT ──
if (!loadFromStorage()) {
    state.grid = Array(totalCells()).fill(null);
}
pushHistory();
render(false);
