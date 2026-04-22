// ====================================================
//  ClassManager Pro — script.js v2.0
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

// ── HISTORY (Undo/Redo) ──
let history = [];
let historyIndex = -1;

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
    window._saveTimer = setTimeout(() => el.style.opacity = '0', 1500);
}

// ── HELPERS ──
let pressTimer;
window._selectedPoolStudent = null;
let aiMessages = [];
let _dragData = null;

function totalCells() { return state.cols * state.rows; }
function ensureGridSize() { while (state.grid.length < totalCells()) state.grid.push(null); }
function idxToColRow(idx) { return { col: idx % state.cols, row: Math.floor(idx / state.cols) }; }

// ── MODES ──
function setMode(mode) {
    state.editMode = mode;
    ['normal','structure','gapCol','gapRow'].forEach(m => document.getElementById(m+'Btn')?.classList.remove('active'));
    document.getElementById(mode+'Btn')?.classList.add('active');
}

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

// ── DESK CLICK ──
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
        render(false); saveToStorage();
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

function onDragLeaveDesk(e) {
    e.currentTarget.classList.remove('drag-over');
}

function onDropDesk(e, idx) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!_dragData) return;
    if (state.hiddenDesks.has(idx)) return;
    if (state.locked.has(idx)) { showToast('⛔ המושב נעול', 'error'); return; }
    pushHistory();
    if (_dragData.source === 'pool') {
        // If desk occupied, swap that student back to pool (fine - they'll appear in pool)
        state.grid[idx] = _dragData.id;
    } else if (_dragData.source === 'desk') {
        const fromIdx = _dragData.fromIdx;
        if (fromIdx === idx) { _dragData = null; return; }
        // Swap the two desks
        const temp = state.grid[idx];
        state.grid[idx] = state.grid[fromIdx];
        state.grid[fromIdx] = temp;
    }
    _dragData = null;
    render(false); saveToStorage();
}

function onDragOverPool(e) {
    if (_dragData?.source === 'desk') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
}

function onDropPool(e) {
    e.preventDefault();
    if (!_dragData || _dragData.source !== 'desk') return;
    const fromIdx = _dragData.fromIdx;
    if (state.locked.has(fromIdx)) { showToast('⛔ המושב נעול', 'error'); _dragData = null; return; }
    pushHistory();
    state.grid[fromIdx] = null;
    _dragData = null;
    window._selectedPoolStudent = null;
    render(false); saveToStorage();
}

// ── ADD STUDENT MANUALLY ──
function addStudentManually() {
    const input = document.getElementById('newStudentName');
    const name = input.value.trim();
    if (!name) { showToast('יש להזין שם', 'error'); input.focus(); return; }
    const newId = state.students.length ? Math.max(...state.students.map(s => +s.id)) + 1 : 1;
    pushHistory();
    state.students.push({ id: newId, name, preferred: [], forbidden: [] });
    input.value = '';
    input.focus();
    render(false); saveToStorage();
    showToast(`✅ ${name} נוסף`);
}

function handleNewStudentKeydown(e) {
    if (e.key === 'Enter') addStudentManually();
}

// ── SMART SORT ──
function runSmartSort() {
    pushHistory();
    const lockedStudents = new Set();
    for (let i = 0; i < totalCells(); i++) if (state.locked.has(i) && state.grid[i]) lockedStudents.add(state.grid[i]);
    const toPlace = state.students.filter(s => !lockedStudents.has(s.id));
    for (let i = 0; i < totalCells(); i++) if (!state.locked.has(i)) state.grid[i] = null;
    const available = [];
    for (let i = 0; i < totalCells(); i++) if (!state.hiddenDesks.has(i) && !state.locked.has(i)) available.push(i);
    const seatOf = {};
    toPlace.forEach(student => {
        if (!available.length) return;
        let best = { seat: available[0], score: -Infinity };
        for (const seat of available) {
            const { col: sc, row: sr } = idxToColRow(seat);
            let score = 0;
            (student.preferred||[]).forEach(pid => {
                if (seatOf[pid] !== undefined) {
                    const { col: pc, row: pr } = idxToColRow(seatOf[pid]);
                    const d = Math.abs(sc-pc)+Math.abs(sr-pr);
                    if (d<=1) score+=10; else if (d<=2) score+=3;
                }
            });
            (student.forbidden||[]).forEach(fid => {
                if (seatOf[fid] !== undefined) {
                    const { col: fc, row: fr } = idxToColRow(seatOf[fid]);
                    if (Math.abs(sc-fc)+Math.abs(sr-fr)<=1) score-=20;
                }
            });
            score += Math.random()*0.5;
            if (score > best.score) best = { seat, score };
        }
        state.grid[best.seat] = student.id; seatOf[student.id] = best.seat;
        available.splice(available.indexOf(best.seat),1);
    });
    render(false); saveToStorage();
}

// ── IMPORT ──
async function handleStudentsImport(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value='';
    try {
        let students;
        if (file.name.endsWith('.json')) {
            const data = JSON.parse(await file.text());
            students = Array.isArray(data) && typeof data[0]==='string'
                ? data.map((n,i)=>({id:i+1,name:n,forbidden:[],preferred:[]}))
                : data.map(s=>({id:s.id??Math.random(),name:s.name,forbidden:s.forbidden||[],preferred:s.preferred||[]}));
        } else {
            const buf = await file.arrayBuffer(); const wb = XLSX.read(buf);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
            students = rows.flat().filter(n=>n&&typeof n==='string'&&n.trim()).map((n,i)=>({id:i+1,name:n.trim(),forbidden:[],preferred:[]}));
        }
        pushHistory();
        state.students = students;
        state.grid = Array(totalCells()).fill(null);
        showToast(`✅ נטענו ${state.students.length} תלמידים`); render(false); saveToStorage();
    } catch(err) { showToast('❌ שגיאה בטעינת הקובץ','error'); }
}

async function handleConstraintsImport(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value='';
    try {
        const data = JSON.parse(await file.text()); let updated=0;
        data.forEach(entry => {
            const s = state.students.find(s=>s.id==entry.id||s.name===entry.name);
            if (s) { if(entry.preferred) s.preferred=entry.preferred; if(entry.forbidden) s.forbidden=entry.forbidden; updated++; }
        });
        showToast(`✅ עודכנו אילוצים ל-${updated} תלמידים`); render(false); saveToStorage();
    } catch(err) { showToast('❌ שגיאה בטעינת האילוצים','error'); }
}

function exportJSON() {
    const data = { cols:state.cols, rows:state.rows, students:state.students, grid:state.grid,
        locked:[...state.locked], hiddenDesks:[...state.hiddenDesks], columnGaps:[...state.columnGaps], rowGaps:[...state.rowGaps] };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    a.download='classroom.json'; a.click();
}

// ── GRID SIZE ──
function changeGrid(type, val) {
    if (type==='cols') {
        const newCols = Math.max(1,Math.min(16,state.cols+val)); if(newCols===state.cols) return;
        const oldGrid=[...state.grid], newGrid=[];
        for(let r=0;r<state.rows;r++) for(let c=0;c<newCols;c++) newGrid.push(c<state.cols?(oldGrid[r*state.cols+c]??null):null);
        state.cols=newCols; state.grid=newGrid;
        state.locked=new Set([...state.locked].filter(i=>i<totalCells()));
        state.hiddenDesks=new Set([...state.hiddenDesks].filter(i=>i<totalCells()));
        state.columnGaps=new Set([...state.columnGaps].filter(c=>c<newCols));
    }
    if (type==='rows') {
        const newRows=Math.max(1,Math.min(20,state.rows+val)); if(newRows===state.rows) return;
        state.rows=newRows; ensureGridSize();
        state.locked=new Set([...state.locked].filter(i=>i<totalCells()));
        state.hiddenDesks=new Set([...state.hiddenDesks].filter(i=>i<totalCells()));
        state.rowGaps=new Set([...state.rowGaps].filter(r=>r<newRows));
    }
    document.getElementById('colCount').textContent=state.cols;
    document.getElementById('rowCount').textContent=state.rows;
    render(false); saveToStorage();
}

// ── RENDER ──
function render(doHistory = true) {
    ensureGridSize();
    document.getElementById('colCount').textContent=state.cols;
    document.getElementById('rowCount').textContent=state.rows;
    const wrapper=document.getElementById('gridWrapper'); wrapper.innerHTML='';
    const outer=document.createElement('div'); outer.style.display='inline-block';
    outer.appendChild(buildColControlRow());
    for(let r=0;r<state.rows;r++) { if(r>0) outer.appendChild(buildRowGapStrip(r)); outer.appendChild(buildDeskRow(r)); }
    outer.appendChild(buildRowAddRemoveBar());
    wrapper.appendChild(outer); updatePool(); updateUndoRedoBtns();
}

function buildDeskRow(r) {
    const rowDiv=document.createElement('div'); rowDiv.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;';
    const rw=document.createElement('div'); rw.style.cssText='display:flex;align-items:center;gap:8px;';
    for(let c=0;c<state.cols;c++) {
        if(c>0&&state.columnGaps.has(c)) {
            const g=document.createElement('div');
            g.style.cssText='width:28px;height:72px;background:#e0e7ff;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#6366f1;font-size:1rem;';
            g.textContent='↔'; g.onclick=()=>{state.columnGaps.delete(c);render(false);}; rw.appendChild(g);
        } else if(c>0&&state.editMode==='gapCol') {
            const g=document.createElement('div'); g.style.cssText='width:8px;height:72px;cursor:pointer;border-radius:4px;transition:background 0.15s;';
            g.onmouseenter=()=>g.style.background='#c7d2fe'; g.onmouseleave=()=>g.style.background='transparent';
            g.onclick=()=>{state.columnGaps.add(c);render(false);}; rw.appendChild(g);
        }
        rw.appendChild(buildDesk(r*state.cols+c));
    }
    rowDiv.appendChild(rw); return rowDiv;
}

function buildDesk(idx) {
    const sId=state.grid[idx], isHidden=state.hiddenDesks.has(idx), isLocked=state.locked.has(idx);
    const student=sId?state.students.find(s=>s.id==sId):null;
    const desk=document.createElement('div'); desk.className='desk';
    if(isHidden) desk.classList.add('hidden-desk');
    if(isLocked) desk.classList.add('locked');

    if(student&&!isHidden) {
        if(checkConflict(idx,sId)) desk.classList.add('conflict');
        else if(checkPreferred(idx,sId)) desk.classList.add('preferred');
        desk.textContent=student.name;
        // Drag source
        if(!isLocked) {
            desk.draggable=true;
            desk.addEventListener('dragstart', e=>onDragStartDesk(e,idx));
            desk.addEventListener('dragend', onDragEndDesk);
        }
    }

    // Drop target
    if(!isHidden&&!isLocked) {
        desk.addEventListener('dragover', e=>onDragOverDesk(e,idx));
        desk.addEventListener('dragleave', onDragLeaveDesk);
        desk.addEventListener('drop', e=>onDropDesk(e,idx));
    }

    if(window._selectedPoolStudent!=null&&!sId&&!isHidden) {
        desk.style.border='2px dashed #4f46e5'; desk.style.cursor='cell';
    }
    desk.addEventListener('mousedown',()=>startPress(idx)); desk.addEventListener('mouseup',endPress);
    desk.addEventListener('touchstart',e=>{e.preventDefault();startPress(idx);},{passive:false}); desk.addEventListener('touchend',endPress);
    desk.addEventListener('click',()=>handleDeskClick(idx)); return desk;
}

function getNeighborIds(idx) {
    const {col,row}=idxToColRow(idx); const n=[];
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dc,dr])=>{
        const nc=col+dc,nr=row+dr;
        if(nc>=0&&nc<state.cols&&nr>=0&&nr<state.rows){const nid=state.grid[nr*state.cols+nc];if(nid)n.push(nid);}
    }); return n;
}
function checkConflict(idx,sId){const s=state.students.find(s=>s.id==sId);return s&&getNeighborIds(idx).some(nid=>(s.forbidden||[]).includes(nid));}
function checkPreferred(idx,sId){const s=state.students.find(s=>s.id==sId);return s&&getNeighborIds(idx).some(nid=>(s.preferred||[]).includes(nid));}

function buildRowGapStrip(rowIndex) {
    const strip=document.createElement('div'); const hasGap=state.rowGaps.has(rowIndex);
    strip.style.cssText='display:flex;align-items:center;justify-content:center;width:100%;cursor:pointer;border-radius:6px;transition:all 0.15s;margin-bottom:4px;';
    if(hasGap){
        strip.style.height='28px'; strip.style.background='#e0e7ff'; strip.style.color='#6366f1';
        strip.style.fontSize='0.7rem'; strip.style.fontWeight='700'; strip.textContent='↕ רווח שורה — לחץ להסרה';
        strip.onclick=()=>{state.rowGaps.delete(rowIndex);render(false);};
    } else if(state.editMode==='gapRow'){
        strip.style.height='8px';
        strip.onmouseenter=()=>strip.style.background='#c7d2fe'; strip.onmouseleave=()=>strip.style.background='transparent';
        strip.onclick=()=>{state.rowGaps.add(rowIndex);render(false);};
    } else { strip.style.height='4px'; }
    return strip;
}

function buildColControlRow() {
    const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;justify-content:center;';
    const mk=(txt,fn,tip)=>{const b=document.createElement('button');b.className='grid-ctrl-btn';b.textContent=txt;b.title=tip;b.onclick=fn;return b;};
    row.appendChild(mk('−',()=>changeGrid('cols',-1),'הסר טור'));
    for(let c=0;c<state.cols;c++){
        if(c>0&&state.columnGaps.has(c)){const sp=document.createElement('div');sp.style.width='28px';row.appendChild(sp);}
        else if(c>0&&state.editMode==='gapCol'){const sp=document.createElement('div');sp.style.width='8px';row.appendChild(sp);}
        const sp=document.createElement('div'); sp.style.cssText='width:85px;text-align:center;font-size:0.65rem;color:#94a3b8;font-weight:700;'; sp.textContent=c+1; row.appendChild(sp);
    }
    row.appendChild(mk('+',()=>changeGrid('cols',1),'הוסף טור')); return row;
}

function buildRowAddRemoveBar() {
    const bar=document.createElement('div'); bar.style.cssText='display:flex;justify-content:center;gap:10px;margin-top:10px;';
    const mk=(txt,fn,tip)=>{const b=document.createElement('button');b.className='grid-ctrl-btn';b.style.width='32px';b.style.height='32px';b.textContent=txt;b.title=tip;b.onclick=fn;return b;};
    const label=document.createElement('span'); label.style.cssText='font-size:0.7rem;color:#94a3b8;font-weight:700;align-self:center;'; label.textContent='שורות';
    bar.append(mk('−',()=>changeGrid('rows',-1),'הסר שורה'),label,mk('+',()=>changeGrid('rows',1),'הוסף שורה')); return bar;
}

// ── POOL ──
function updatePool() {
    const pool=document.getElementById('studentPool');
    const seatedIds=new Set(state.grid.filter(id=>id));
    const unseated=state.students.filter(s=>!seatedIds.has(s.id));
    document.getElementById('poolCount').textContent=unseated.length;

    pool.innerHTML='';

    // Pool itself is a drop target (to return desk student to pool)
    pool.ondragover = onDragOverPool;
    pool.ondrop = onDropPool;

    if(!unseated.length){
        pool.innerHTML='<p class="text-xs text-gray-400 w-full text-center py-2">✅ כל התלמידים משובצים</p>';
        return;
    }
    unseated.forEach(s=>{
        const div=document.createElement('div'); const isSel=window._selectedPoolStudent===s.id;
        div.className='px-3 py-1 rounded-full text-xs font-bold cursor-grab border transition select-none';
        div.style.background=isSel?'#4f46e5':'white'; div.style.color=isSel?'white':'#334155'; div.style.borderColor=isSel?'#4f46e5':'#e2e8f0';
        div.textContent=s.name;
        div.draggable=true;
        div.addEventListener('dragstart', e=>onDragStartPool(e,s.id));
        div.onclick=()=>{window._selectedPoolStudent=isSel?null:s.id;render(false);};
        pool.appendChild(div);
    });
}

// ── MODAL (with constraints editing) ──
function openModal(idx) {
    state.currentEditIdx=idx;
    const sId=state.grid[idx];
    const student=state.students.find(s=>s.id==sId);
    if(!student) return;
    document.getElementById('editNameInput').value=student.name;
    document.getElementById('modalTitle').textContent='עריכת תלמיד';
    document.getElementById('modalSub').textContent=`מושב ${idx+1}`;
    buildConstraintsEditor(student);
    document.getElementById('editModal').style.display='flex';
}

function buildConstraintsEditor(student) {
    const container=document.getElementById('constraintsEditor');
    if(!container) return;
    container.innerHTML='';
    const others=state.students.filter(s=>s.id!==student.id);
    if(!others.length){ container.innerHTML='<p class="text-xs text-gray-400 py-1">אין תלמידים נוספים</p>'; return; }

    ['preferred','forbidden'].forEach(type=>{
        const isPreferred=type==='preferred';
        const label=isPreferred?'💚 מועדפים':'🔴 אסורים';
        const activeColor=isPreferred?'#10b981':'#ef4444';
        const activeBg=isPreferred?'#f0fdf4':'#fef2f2';

        const section=document.createElement('div'); section.style.marginBottom='10px';
        const title=document.createElement('p');
        title.style.cssText='font-size:0.72rem;font-weight:700;color:#475569;margin-bottom:5px;';
        title.textContent=label;
        section.appendChild(title);

        const wrap=document.createElement('div'); wrap.style.cssText='display:flex;flex-wrap:wrap;gap:4px;';
        others.forEach(other=>{
            const isActive=(student[type]||[]).includes(other.id);
            const btn=document.createElement('button');
            btn.textContent=other.name;
            btn.style.cssText=`padding:3px 9px;border-radius:20px;font-size:0.7rem;font-weight:700;cursor:pointer;border:1.5px solid;transition:all 0.15s;font-family:Assistant,sans-serif;background:${isActive?activeColor:'white'};color:${isActive?'white':'#64748b'};border-color:${isActive?activeColor:'#e2e8f0'};`;
            btn.onclick=()=>{
                const arr=student[type]=(student[type]||[]);
                const i=arr.indexOf(other.id);
                if(i>=0) arr.splice(i,1); else arr.push(other.id);
                // Remove from opposite type
                const opp=isPreferred?'forbidden':'preferred';
                const oi=(student[opp]||[]).indexOf(other.id);
                if(oi>=0) student[opp].splice(oi,1);
                buildConstraintsEditor(student);
                saveToStorage();
                render(false);
            };
            wrap.appendChild(btn);
        });
        section.appendChild(wrap); container.appendChild(section);
    });
}

function closeModal(){
    document.getElementById('editModal').style.display='none';
    state.currentEditIdx=null;
}

function saveQuickEdit(){
    const idx=state.currentEditIdx; if(idx===null) return;
    const s=state.students.find(s=>s.id==state.grid[idx]);
    if(s){
        const newName=document.getElementById('editNameInput').value.trim();
        if(newName&&newName!==s.name){ pushHistory(); s.name=newName; }
    }
    closeModal(); render(false); saveToStorage();
}

function moveToPool(){
    const idx=state.currentEditIdx; if(idx===null) return;
    if(!state.locked.has(idx)){ pushHistory(); state.grid[idx]=null; saveToStorage(); }
    closeModal(); render(false);
}

function removeStudent(){
    const idx=state.currentEditIdx; if(idx===null) return;
    const sId=state.grid[idx]; if(!sId) return;
    if(!confirm('למחוק תלמיד לגמרי מהרשימה?')) return;
    pushHistory();
    state.grid[idx]=null;
    state.students=state.students.filter(s=>s.id!==sId);
    state.students.forEach(s=>{
        s.preferred=(s.preferred||[]).filter(id=>id!==sId);
        s.forbidden=(s.forbidden||[]).filter(id=>id!==sId);
    });
    closeModal(); render(false); saveToStorage();
    showToast('🗑️ תלמיד נמחק');
}

function clearGrid(){
    if(confirm('לנקות את כל הכיתה?')){
        pushHistory();
        state.grid=Array(totalCells()).fill(null);
        state.locked.clear();
        window._selectedPoolStudent=null;
        render(false); saveToStorage();
    }
}

function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('active'); }

// ── AI PANEL ──
function openAIPanel() {
    document.getElementById('aiPanel').style.display='flex';
    if(!state.openaiKey){
        document.getElementById('aiKeySetup').style.display='block';
        document.getElementById('aiChat').style.display='none';
    } else {
        document.getElementById('aiKeySetup').style.display='none';
        document.getElementById('aiChat').style.display='flex';
    }
}
function closeAIPanel(){ document.getElementById('aiPanel').style.display='none'; }

function saveAPIKey() {
    const key=document.getElementById('apiKeyInput').value.trim();
    if(!key.startsWith('sk-')){ showToast('❌ מפתח לא תקין','error'); return; }
    state.openaiKey=key; localStorage.setItem('cm_openai_key',key);
    document.getElementById('aiKeySetup').style.display='none';
    document.getElementById('aiChat').style.display='flex';
    showToast('✅ מפתח נשמר');
}
function clearAPIKey(){
    state.openaiKey=''; localStorage.removeItem('cm_openai_key');
    document.getElementById('apiKeyInput').value='';
    document.getElementById('aiKeySetup').style.display='block';
    document.getElementById('aiChat').style.display='none';
}

function buildClassroomContext() {
    const seatedIds=new Set(state.grid.filter(id=>id)), seatingDesc=[];
    for(let i=0;i<totalCells();i++){
        if(state.grid[i]&&!state.hiddenDesks.has(i)){
            const{col,row}=idxToColRow(i); const s=state.students.find(s=>s.id==state.grid[i]);
            if(s) seatingDesc.push(`${s.name}(ש${row+1}ט${col+1})`);
        }
    }
    const unseated=state.students.filter(s=>!seatedIds.has(s.id)).map(s=>s.name);
    const constraints=state.students.filter(s=>s.preferred?.length||s.forbidden?.length).map(s=>{
        const pref=(s.preferred||[]).map(pid=>state.students.find(st=>st.id==pid)?.name).filter(Boolean);
        const forb=(s.forbidden||[]).map(pid=>state.students.find(st=>st.id==pid)?.name).filter(Boolean);
        return `${s.name}: מועדפים[${pref.join(',')}] אסורים[${forb.join(',')}]`;
    });
    return `כיתה: ${state.rows}×${state.cols}. תלמידים: ${state.students.length}. ממוקמים: ${seatingDesc.join(' ')||'אין'}. ממתינים: ${unseated.join(',')||'אין'}. אילוצים: ${constraints.join(' ')||'אין'}.`;
}

async function sendAIMessage() {
    const input=document.getElementById('aiInput'); const userMsg=input.value.trim(); if(!userMsg) return;
    if(!state.openaiKey){ showToast('❌ אין מפתח API','error'); return; }
    input.value=''; addAIBubble(userMsg,'user');
    const systemPrompt=`אתה עוזר פדגוגי למלמד. מידע על הכיתה: ${buildClassroomContext()}
יכולות: לייעץ על סידור, לנתח קונפליקטים, להציע שכנים. אם מבקשים "סדר" — החזר JSON: {"action":"arrange","grid":[id1,id2,...null]} באורך ${totalCells()}. ענה עברית, קצר וברור.`;
    // Limit context window to last 20 messages
    if(aiMessages.length>20) aiMessages=aiMessages.slice(-20);
    aiMessages.push({role:'user',content:userMsg});
    const loadingId=addAIBubble('...','assistant',true);
    try {
        const res=await fetch('https://api.openai.com/v1/chat/completions',{
            method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${state.openaiKey}`},
            body:JSON.stringify({model:'gpt-4o-mini',messages:[{role:'system',content:systemPrompt},...aiMessages],max_tokens:1000,temperature:0.7})
        });
        if(!res.ok){const err=await res.json();throw new Error(err.error?.message||'שגיאת API');}
        const data=await res.json(); const reply=data.choices[0].message.content;
        aiMessages.push({role:'assistant',content:reply});
        document.getElementById(loadingId)?.remove();
        const jsonMatch=reply.match(/\{"action":"arrange","grid":\[[^\]]*\]\}/);
        if(jsonMatch){
            try{
                const arr=JSON.parse(jsonMatch[0]);
                const text=reply.replace(jsonMatch[0],'').trim();
                addAIBubble(text||'הנה הסידור:','assistant');
                addAIArrangeButton(arr.grid);
            } catch(e){addAIBubble(reply,'assistant');}
        } else { addAIBubble(reply,'assistant'); }
    } catch(err) { document.getElementById(loadingId)?.remove(); addAIBubble(`❌ שגיאה: ${err.message}`,'assistant'); }
}

function addAIBubble(text,role,loading=false) {
    const id='b'+Date.now()+Math.random().toString(36).slice(2);
    const chatDiv=document.getElementById('aiMessages');
    const bubble=document.createElement('div'); bubble.id=id;
    const isUser=role==='user';
    bubble.style.cssText=`max-width:85%;padding:10px 14px;border-radius:16px;font-size:0.82rem;line-height:1.5;margin-bottom:8px;word-break:break-word;white-space:pre-wrap;${isUser?'align-self:flex-start;background:#4f46e5;color:white;border-radius:16px 16px 4px 16px;':'align-self:flex-end;background:#f1f5f9;color:#1e293b;border-radius:16px 16px 16px 4px;'}`;
    bubble.textContent=loading?'💭 חושב...':text;
    chatDiv.appendChild(bubble); chatDiv.scrollTop=chatDiv.scrollHeight; return id;
}

function addAIArrangeButton(grid) {
    const chatDiv=document.getElementById('aiMessages');
    const wrapper=document.createElement('div'); wrapper.style.cssText='align-self:flex-end;margin-bottom:8px;';
    const btn=document.createElement('button');
    btn.style.cssText='background:#10b981;color:white;border:none;padding:8px 16px;border-radius:10px;font-weight:700;font-size:0.8rem;cursor:pointer;font-family:Assistant,sans-serif;';
    btn.textContent='✅ החל סידור זה';
    btn.onclick=()=>{
        if(confirm('להחיל את סידור ה-AI?')){
            pushHistory();
            state.grid=grid.map(id=>id||null); ensureGridSize(); render(false); saveToStorage(); showToast('✅ סידור הוחל!');
            btn.disabled=true; btn.textContent='✅ הוחל'; btn.style.background='#94a3b8';
        }
    };
    wrapper.appendChild(btn); chatDiv.appendChild(wrapper); chatDiv.scrollTop=chatDiv.scrollHeight;
}

function handleAIKeydown(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendAIMessage(); } }

// ── TOAST ──
function showToast(msg,type='success') {
    let t=document.getElementById('_toast');
    if(!t){
        t=document.createElement('div'); t.id='_toast';
        t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 22px;border-radius:14px;font-weight:700;font-size:0.85rem;box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.3s,transform 0.3s;font-family:Assistant,sans-serif;pointer-events:none;';
        document.body.appendChild(t);
    }
    t.textContent=msg;
    t.style.background=type==='error'?'#fef2f2':'#f0fdf4';
    t.style.color=type==='error'?'#b91c1c':'#166534';
    t.style.border=`1px solid ${type==='error'?'#fecaca':'#bbf7d0'}`;
    t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)';
    clearTimeout(window._toastTimer);
    window._toastTimer=setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(8px)'; },2800);
}

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', e => {
    if ((e.ctrlKey||e.metaKey) && e.key==='z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey||e.metaKey) && (e.key==='y' || (e.key==='z'&&e.shiftKey))) { e.preventDefault(); redo(); }
    if (e.key==='Escape') {
        closeModal();
        if(document.getElementById('aiPanel').style.display==='flex') closeAIPanel();
    }
});

// ── BOOT ──
if(!loadFromStorage()) {
    state.grid=Array(totalCells()).fill(null);
}
pushHistory();
render(false);
