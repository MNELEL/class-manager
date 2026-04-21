let state = {
    cols: 6, rows: 6,
    students: [],
    grid: Array(100).fill(null),
    hiddenDesks: new Set(), // שולחנות מחוקים
    editMode: 'normal' // normal או structure
};

// פתיחה/סגירה של תפריט בטלפון
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

// מצב עריכת מבנה (מחיקת שולחנות)
function toggleStructureMode() {
    state.editMode = state.editMode === 'normal' ? 'structure' : 'normal';
    document.body.classList.toggle('structure-mode');
    document.getElementById('structureBtn').classList.toggle('active');
}

// ייבוא אוניברסלי (Excel / JSON)
async function handleUniversalImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});
        state.students = rows.flat().filter(n => n).map((n, i) => ({id: i, name: n.toString()}));
    } else {
        const text = await file.text();
        state.students = JSON.parse(text).students || JSON.parse(text);
    }
    render();
}

function handleDeskClick(idx) {
    if (state.editMode === 'structure') {
        if (state.hiddenDesks.has(idx)) state.hiddenDesks.delete(idx);
        else state.hiddenDesks.add(idx);
        render();
    } else {
        // כאן תבוא לוגיקת העריכה הידנית או הנעילה שדיברנו עליה
    }
}

function render() {
    const container = document.getElementById('gridContainer');
    container.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    container.innerHTML = '';

    for (let i = 0; i < state.cols * state.rows; i++) {
        const desk = document.createElement('div');
        desk.className = `desk ${state.hiddenDesks.has(i) ? 'hidden' : ''}`;
        
        const sId = state.grid[i];
        if (sId && !state.hiddenDesks.has(i)) {
            const s = state.students.find(x => x.id == sId);
            desk.innerText = s ? s.name : "";
        } else if (!state.hiddenDesks.has(i)) {
            desk.innerText = "";
        }

        desk.onclick = () => handleDeskClick(i);
        container.appendChild(desk);
    }
}

function changeGrid(type, val) {
    if (type === 'cols') state.cols = Math.max(1, state.cols + val);
    render();
}// הוסף למשתנה ה-state בראש הקובץ
state.columnGaps = new Set(); // שומר את מספרי הטורים שרוצים רווח אחריהם
state.editMode = 'normal';

function toggleGapMode() {
    state.editMode = state.editMode === 'gap' ? 'normal' : 'gap';
    alert(state.editMode === 'gap' ? "לחץ על שולחן כדי להוסיף רווח משמאלו" : "חזרת למצב רגיל");
}

// עדכון פונקציית handleDeskClick
function handleDeskClick(idx) {
    if (state.editMode === 'structure') {
        state.hiddenDesks.has(idx) ? state.hiddenDesks.delete(idx) : state.hiddenDesks.add(idx);
    } 
    else if (state.editMode === 'gap') {
        const colIndex = idx % state.cols;
        state.columnGaps.has(colIndex) ? state.columnGaps.delete(colIndex) : state.columnGaps.add(colIndex);
    }
    render();
}

// עדכון פונקציית ה-render (החלק שיוצר את ה-Desk)
function render() {
    const container = document.getElementById('gridContainer');
    container.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    container.innerHTML = '';

    for (let i = 0; i < state.cols * state.rows; i++) {
        const desk = document.createElement('div');
        const colIndex = i % state.cols;
        
        // הוספת המעבר אם הטור הזה נבחר
        let className = `desk ${state.hiddenDesks.has(i) ? 'hidden' : ''}`;
        if (state.columnGaps.has(colIndex)) {
            className += ' column-spacer';
        }
        desk.className = className;

        desk.onclick = () => handleDeskClick(i);
        container.appendChild(desk);
    }
}


render();
