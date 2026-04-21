let cols = 10;
let rows = 4;
let gridState = Array(40).fill(null);
let selectedId = null;

// נתוני התלמידים (נלקח מהקבצים שלך)
const students = [
    {id: 1, name: "נתי אורדמן", pref: [5, 2, 22], hate: [15, 16, 27]},
    {id: 2, name: "אוריאל אנסבכר", pref: [9, 13, 22], hate: [6, 26, 15]},
    {id: 3, name: "חיים בן פורת", pref: [2, 13, 25], hate: [11, 21, 18]},
    {id: 4, name: "דניאל גוטרמן", pref: [9, 25, 1], hate: [29, 11, 21]},
    {id: 5, name: "חיים גולדמן", pref: [1, 20, 13], hate: [2, 23, 3]},
    {id: 6, name: "ניסים דיין", pref: [12, 5, 22], hate: [26, 15, 29]},
    {id: 7, name: "מוישי הריסון", pref: [25, 6, 20], hate: [15, 23, 21]},
    {id: 8, name: "אבריימי זיאת", pref: [9, 19, 13], hate: [26, 29, 22]},
    {id: 9, name: "ציקי יורקוביץ", pref: [5, 1, 2], hate: [26, 11, 11]},
    {id: 10, name: "מיכאל יעקובי", pref: [20, 4, 13], hate: [15, 23, 21]},
    {id: 11, name: "אלחנן כהן", pref: [18, 10, 15], hate: [5, 22, 2]},
    {id: 12, name: "כתריאל לוי", pref: [22, 5, 2], hate: [20, 26, 28]},
    {id: 13, name: "מלאכי לינצר", pref: [31, 5, 25], hate: [10, 1, 11]},
    {id: 14, name: "אליהו מויאל", pref: [15, 11, 10], hate: [20, 26, 21]},
    {id: 15, name: "מאיר מיימון", pref: [11, 16, 14], hate: [1, 2, 6]},
    {id: 16, name: "נדב מלול", pref: [15, 11, 18], hate: [1, 2, 25]},
    {id: 17, name: "איתמר משולם", pref: [18, 22, 21], hate: [1, 10, 23]},
    {id: 18, name: "אביתר עמר", pref: [11, 17, 21], hate: [4, 10, 13]},
    {id: 19, name: "מנחם פודור", pref: [28, 8, 2], hate: [11, 22, 30]},
    {id: 20, name: "אוריה תם", pref: [5, 10, 13], hate: [1, 21, 23]},
    {id: 21, name: "יהונתן פז", pref: [22, 18, 25], hate: [9, 7, 17]},
    {id: 22, name: "ישי קוכלני", pref: [17, 1, 12], hate: [16, 11, 25]},
    {id: 23, name: "יוסף קמחי", pref: [8, 1, 22], hate: [26, 11, 29]},
    {id: 24, name: "בן ציון קצב", pref: [5, 25, 10], hate: [23, 18, 11]},
    {id: 25, name: "נדב רובין", pref: [22, 1, 2], hate: [6, 15, 16]},
    {id: 26, name: "יהונתן רוזן", pref: [25, 18, 1], hate: [6, 2, 9]},
    {id: 27, name: "אברהם ריין", pref: [1, 22, 5], hate: [15, 16, 21]},
    {id: 28, name: "אריאל שטאובר", pref: [19, 22, 1], hate: [11, 12, 15]},
    {id: 29, name: "איתי שלזינגר", pref: [10, 13, 22], hate: [4, 6, 8]},
    {id: 30, name: "דניאל ששון", pref: [13, 2, 25], hate: [19, 21, 11]},
    {id: 31, name: "אוריה תם", pref: [13, 4, 28], hate: [17, 23, 8]},
    {id: 32, name: "אליהו מויאל", pref: [], hate: []}
];

function updateGrid(type, change) {
    if (type === 'cols') cols = Math.max(2, cols + change);
    if (type === 'rows') rows = Math.max(1, rows + change);
    
    document.getElementById('colCount').innerText = cols;
    document.getElementById('rowCount').innerText = rows;
    
    // התאמת המערך לכמות הכיסאות החדשה
    const totalSeats = cols * rows;
    if (gridState.length < totalSeats) {
        gridState = [...gridState, ...Array(totalSeats - gridState.length).fill(null)];
    }
    render();
}

function render() {
    const pool = document.getElementById('studentPool');
    const grid = document.getElementById('classroomGrid');
    
    // עדכון מאגר תלמידים
    pool.innerHTML = '';
    const unplaced = students.filter(s => !gridState.includes(s.id));
    document.getElementById('studentCount').innerText = unplaced.length;

    unplaced.forEach(s => {
        const div = document.createElement('div');
        div.className = `student-pill ${selectedId === s.id ? 'active' : ''}`;
        div.innerText = s.name;
        div.onclick = () => { selectedId = s.id; render(); };
        pool.appendChild(div);
    });

    // עדכון גריד הכיתה
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.innerHTML = '';

    gridState.slice(0, cols * rows).forEach((sId, idx) => {
        const desk = document.createElement('div');
        const s = students.find(x => x.id === sId);
        desk.className = `desk ${s ? 'occupied' : ''}`;
        
        // יצירת "מעברים" - למשל כל 2 שולחנות יהיה רווח קטן
        if ((idx + 1) % 2 === 0 && (idx + 1) % cols !== 0) {
            desk.style.marginLeft = "15px";
        }

        if (s) {
            desk.innerText = s.name;
            // בדיקת דינמיקה (שכן משמאל או מימין)
            const partnerIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
            const partnerId = gridState[partnerIdx];
            if (partnerId) {
                if (s.hate.includes(partnerId)) desk.classList.add('conflict');
                if (s.pref.includes(partnerId)) desk.classList.add('match');
            }
        } else {
            desk.innerText = idx + 1;
        }

        desk.onclick = () => {
            if (selectedId) {
                gridState[idx] = selectedId;
                selectedId = null;
            } else {
                gridState[idx] = null;
            }
            render();
        };
        grid.appendChild(desk);
    });
}

function runAutoSeating() {
    let unplaced = [...students];
    let newGrid = Array(cols * rows).fill(null);
    let current = 0;
    while (unplaced.length > 0 && current < newGrid.length) {
        let s1 = unplaced.shift();
        newGrid[current] = s1.id;
        // ניסיון לשבץ שותף מועדף
        if (current % 2 === 0) {
            let prefIdx = unplaced.findIndex(x => s1.pref.includes(x.id));
            if (prefIdx !== -1) {
                newGrid[current+1] = unplaced[prefIdx].id;
                unplaced.splice(prefIdx, 1);
                current += 2;
                continue;
            }
        }
        current++;
    }
    gridState = newGrid;
    render();
}

render();
