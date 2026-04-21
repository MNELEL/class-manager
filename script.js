const students = [
    {id: 1, name: "נתי אורדמן", pref: [5, 2, 22], hate: [15, 16, 27]},
    // ... שאר הנתונים מה-JSON שלך
];

let grid = Array(40).fill(null);

function checkSocialDynamics(seatIdx, studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return null;

    // מציאת השכן (בזוגות)
    const neighborIdx = seatIdx % 2 === 0 ? seatIdx + 1 : seatIdx - 1;
    const neighborId = grid[neighborIdx];

    if (!neighborId) return 'neutral';
    if (student.hate.includes(neighborId)) return 'conflict';
    if (student.pref.includes(neighborId)) return 'perfect';
    return 'neutral';
}

// פונקציות גרירה ושחרור יבואו כאן...
