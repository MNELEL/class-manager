let state = {
    cols: 6, rows: 6,
    students: [],
    grid: Array(100).fill(null),
    hiddenDesks: new Set(),
    columnGaps: new Set(),
    editMode: 'normal'
};

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }

function setMode(mode) {
    state.editMode = state.editMode === mode ? 'normal' : mode;
    document.querySelectorAll('.btn-sm').forEach(b => b.classList.remove('active'));
    if (state.editMode !== 'normal') document.getElementById(mode + 'Btn').classList.add('active');
}

async function handleUniversalImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        if (file.name.endsWith('.json')) {
            const text = await file.text();
            const data = JSON.parse(text);
            // מותאם בדיוק למבנה ששלחת: { "teacher": "...", "students": [...] }
            state.students = data.students || data;
        } else {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});
            state.students = rows.flat().filter(n => n).map((n, i) => ({id: i+1, name: n.toString()}));
        }
        alert("נטענו " + state.students.length + " תלמידים");
        render();
    } catch (err) {
        alert("שגיאה בטעינת הקובץ");
    }
}

function handleDeskClick(idx) {
    if (state.editMode === 'structure') {
        state.hiddenDesks.has(idx) ? state.hiddenDesks.delete(idx) : state.hiddenDesks.add(idx);
    } else if (state.editMode === 'gap') {
        const col = idx % state.cols;
        state.columnGaps.has(col) ? state.columnGaps.delete(col) : state.columnGaps.add(col);
    }
    render();
}

function render() {
    const container = document.getElementById('gridContainer');
    container.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    container.innerHTML = '';

    for (let i = 0; i < state.cols * state.rows; i++) {
        const desk = document.createElement('div');
        const col = i % state.cols;
        desk.className = `desk ${state.hiddenDesks.has(i) ? 'hidden' : ''} ${state.columnGaps.has(col) ? 'spacer' : ''}`;
        
        const sId = state.grid[i];
        if (sId && !state.hiddenDesks.has(i)) {
            const s = state.students.find(x => x.id == sId);
            desk.innerText = s ? s.name : "";
        }
        
        desk.onclick = () => handleDeskClick(i);
        container.appendChild(desk);
    }
}

function changeGrid(type, val) {
    if (type === 'cols') state.cols = Math.max(1, state.cols + val);
    render();
}

function runSmartSort() {
    let unplaced = [...state.students];
    state.grid.fill(null);
    for (let i = 0; i < state.cols * state.rows; i++) {
        if (!state.hiddenDesks.has(i) && unplaced.length > 0) {
            state.grid[i] = unplaced.shift().id;
        }
    }
    render();
}

render();

