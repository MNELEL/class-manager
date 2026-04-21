let state = {
    cols: 10, rows: 4,
    students: [], 
    grid: Array(100).fill(null),
    locked: new Set(),
    preferences: []
};

let currentEditIdx = null;
let pressTimer;

function changeGrid(type, val) {
    if (type === 'cols') state.cols = Math.max(1, state.cols + val);
    else state.rows = Math.max(1, state.rows + val);
    document.getElementById('displayCols').innerText = state.cols;
    document.getElementById('displayRows').innerText = state.rows;
    render();
}

function handleTouch(idx) {
    pressTimer = setTimeout(() => {
        if (state.grid[idx]) {
            if (state.locked.has(idx)) state.locked.delete(idx);
            else state.locked.add(idx);
            render();
        }
    }, 700);
}

function handleClick(idx) {
    clearTimeout(pressTimer);
    currentEditIdx = idx;
    const sId = state.grid[idx];
    const s = state.students.find(x => x.id === sId);
    document.getElementById('editNameInput').value = s ? s.name : "";
    document.getElementById('editModal').style.display = "flex";
}

function saveQuickEdit() {
    const name = document.getElementById('editNameInput').value;
    if (!name) return;
    
    let sId = state.grid[currentEditIdx];
    if (!sId) {
        sId = Date.now();
        state.students.push({ id: sId, name: name, preferred: [], not_preferred: [] });
        state.grid[currentEditIdx] = sId;
    } else {
        const s = state.students.find(x => x.id === sId);
        if (s) s.name = name;
    }
    closeModal();
    render();
}

function closeModal() { document.getElementById('editModal').style.display = "none"; }

function calculateScore(idx, sId) {
    const s = state.students.find(x => x.id === sId);
    if (!s) return 0;
    const partnerIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const pId = state.grid[partnerIdx];
    if (!pId) return 0;
    
    if (s.preferred?.includes(pId)) return 100;
    if (s.not_preferred?.includes(pId)) return -1000;
    return 0;
}

function render() {
    const container = document.getElementById('gridContainer');
    container.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    container.innerHTML = '';

    for (let i = 0; i < state.cols * state.rows; i++) {
        const desk = document.createElement('div');
        const sId = state.grid[i];
        desk.className = `desk ${sId ? 'occupied' : ''} ${state.locked.has(i) ? 'locked' : ''}`;
        
        if (sId) {
            const s = state.students.find(x => x.id === sId);
            desk.innerText = s ? s.name : "";
            const score = calculateScore(i, sId);
            if (score > 0) desk.classList.add('match');
            if (score < -500) desk.classList.add('conflict');
        } else {
            desk.innerText = i + 1;
        }

        desk.onmousedown = () => handleTouch(i);
        desk.onclick = () => handleClick(i);
        container.appendChild(desk);
    }
}

async function importData(e) {
    const file = e.target.files[0];
    const data = JSON.parse(await file.text());
    state.students = data.students || data;
    render();
}

function runSmartSort() {
    let unplaced = state.students.filter(s => !Array.from(state.locked).map(idx => state.grid[idx]).includes(s.id));
    for (let i = 0; i < state.cols * state.rows; i++) {
        if (state.locked.has(i)) continue;
        if (unplaced.length > 0) {
            state.grid[i] = unplaced.shift().id;
        } else {
            state.grid[i] = null;
        }
    }
    render();
}

render();
