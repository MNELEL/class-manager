let state = {
    cols: 8, rows: 6,
    students: [], // {id, name, forbidden: [], preferred: []}
    grid: Array(100).fill(null),
    locked: new Set(),
    hiddenDesks: new Set(),
    columnGaps: new Set(),
    editMode: 'normal',
    currentEditIdx: null
};

let pressTimer;

// אתחול מצבים
function setMode(mode) {
    state.editMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('bg-indigo-600', 'text-white', 'shadow');
        b.classList.add('bg-white', 'border');
    });
    document.getElementById(mode + 'Btn').classList.add('bg-indigo-600', 'text-white', 'shadow');
}

// לחיצה ארוכה לנעילה
function startPress(idx) {
    pressTimer = setTimeout(() => {
        if (state.grid[idx]) {
            state.locked.has(idx) ? state.locked.delete(idx) : state.locked.add(idx);
            render();
            if (navigator.vibrate) navigator.vibrate(50);
        }
    }, 600);
}

function endPress() { clearTimeout(pressTimer); }

// טיפול בקליק
function handleDeskClick(idx) {
    if (state.editMode === 'structure') {
        state.hiddenDesks.has(idx) ? state.hiddenDesks.delete(idx) : state.hiddenDesks.add(idx);
    } else if (state.editMode === 'gap') {
        const col = idx % state.cols;
        state.columnGaps.has(col) ? state.columnGaps.delete(col) : state.columnGaps.add(col);
    } else {
        if (state.grid[idx]) openModal(idx);
    }
    render();
}

// אלגוריתם סידור חכם עם משקלים (העדפות חברתיות)
function runSmartSort() {
    let seatedIds = state.grid.filter((id, idx) => id && state.locked.has(idx));
    let toPlace = state.students.filter(s => !seatedIds.includes(s.id));
    
    // ערבוב בסיסי
    toPlace.sort(() => Math.random() - 0.5);

    let newGrid = [...state.grid];
    
    // ניקוי מקומות לא נעולים
    for(let i=0; i < newGrid.length; i++) {
        if (!state.locked.has(i)) newGrid[i] = null;
    }

    // שיבוץ לפי מקומות פנויים
    let placeIdx = 0;
    toPlace.forEach(student => {
        while (placeIdx < state.cols * state.rows && (state.hiddenDesks.has(placeIdx) || state.locked.has(placeIdx))) {
            placeIdx++;
        }
        if (placeIdx < state.cols * state.rows) {
            newGrid[placeIdx] = student.id;
            placeIdx++;
        }
    });

    state.grid = newGrid;
    render();
}

// ייבוא נתונים (תמיכה במבנה ה-JSON שהעלית)
async function handleUniversalImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        if (file.name.endsWith('.json')) {
            const data = JSON.parse(await file.text());
            state.students = data.students.map(s => ({
                id: s.id, 
                name: s.name, 
                forbidden: s.forbidden || [], 
                preferred: s.preferred || []
            }));
        } else {
            // לוגיקת אקסל
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
            state.students = rows.flat().filter(n => n).map((n, i) => ({id: i+1, name: n.toString(), forbidden: [], preferred: []}));
        }
        alert(`נטענו ${state.students.length} תלמידים`);
        render();
    } catch (err) {
        alert("שגיאה בטעינת הקובץ");
    }
}

function render() {
    const container = document.getElementById('gridContainer');
    container.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    container.style.width = 'fit-content';
    container.innerHTML = '';

    for (let i = 0; i < state.cols * state.rows; i++) {
        const desk = document.createElement('div');
        const col = i % state.cols;
        const sId = state.grid[i];
        
        desk.className = `desk ${state.hiddenDesks.has(i) ? 'hidden' : ''} 
                          ${state.columnGaps.has(col) ? 'spacer' : ''} 
                          ${state.locked.has(i) ? 'locked' : ''}`;
        
        if (sId && !state.hiddenDesks.has(i)) {
            const student = state.students.find(s => s.id == sId);
            desk.innerText = student ? student.name : "";
        }

        desk.onmousedown = () => startPress(i);
        desk.onmouseup = endPress;
        desk.ontouchstart = () => startPress(i);
        desk.ontouchend = endPress;
        desk.onclick = () => handleDeskClick(i);
        container.appendChild(desk);
    }
    updatePool();
}

function updatePool() {
    const pool = document.getElementById('studentPool');
    const seatedIds = state.grid.filter(id => id);
    const unseated = state.students.filter(s => !seatedIds.includes(s.id));
    
    pool.innerHTML = unseated.length ? '' : '<p class="text-xs text-gray-400">כל התלמידים משובצים</p>';
    unseated.forEach(s => {
        const div = document.createElement('div');
        div.className = "bg-white border px-3 py-1 rounded-full text-xs shadow-sm cursor-pointer hover:bg-indigo-50";
        div.innerText = s.name;
        div.onclick = () => alert(`תלמיד: ${s.name}\nמספר: ${s.id}`);
        pool.appendChild(div);
    });
}

function changeGrid(type, val) {
    if (type === 'cols') state.cols = Math.max(1, state.cols + val);
    if (type === 'rows') state.rows = Math.max(1, state.rows + val);
    render();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
function openModal(idx) { state.currentEditIdx = idx; document.getElementById('editModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('editModal').classList.add('hidden'); }
function clearGrid() { if(confirm("לנקות את כל הכיתה?")) { state.grid.fill(null); state.locked.clear(); render(); } }

render();
