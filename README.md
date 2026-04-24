# 🎓 Class Manager- מערכת הושבה חכמה

**ניהול פדגוגי מתקדם לסידור מקומות ישיבה בכיתה **

מערכת זו נבנתה כדי לסייע למלמד/מורה לארגן את הכיתה בצורה אופטימלית, תוך התחשבות במורכבויות החברתיות, הצרכים הפדגוגיים והמבנה הפיזי של הכיתה

## 🚀 תכונות עיקריות

* **ממשק אינטראקטיבי (Drag & Drop):** גרירה נוחה של תלמידים מרשימת ה"מאגר" ישירות לשולחן המבוקש.
* **אלגוריתם סידור חכם:** כפתור "סידור חכם" המנסה לשבץ תלמידים ליד החברים המועדפים עליהם באופן אוטומטי.
* **זיהוי קונפליקטים חברתיים:** המערכת מסמנת ב**אדום** שיבוץ שעלול ליצור הפרעה (על בסיס נתוני העדפות) וב**ירוק** שיבוצים מוצלחים במיוחד.
* **מבנה כיתה ריאלי:** תצוגה של טורים (4 שולחנות בצדדים ו-2 במרכז) המותאמת למבנה הכיתה הפיזי.
* **ניהול תלמידים חסרים:** רשימה מעודכנת של תלמידים שטרם שובצו כדי לוודא שאף אחד לא נשכח.
- **מבנה גמיש:** אפשרות להגדיר את כמות הטורים והשורות בזמן אמת.
- **התאמה אישית:** מתאים לכל כיתה 
- **ניתוח חברתי:** זיהוי אוטומטי של העדפות ישיבה (ירוק לשיבוץ טוב, אדום לקונפליקט).
- **ממשק נקי:** עיצוב פשוט וממוקד עבודה.

## 🛠 טכנולוגיות

* **Frontend:** HTML5, CSS3 (Flexbox & Grid), JavaScript (Vanilla).
* **Styling:** Tailwind CSS לעיצוב מודרני ומהיר.
* **Deployment:** GitHub Pages.

## 📋 איך להשתמש?

1.  **פתיחת האפליקציה:** כנסו לקישור של ה-GitHub Pages של הפרויקט.
2.  **בחירת תלמיד:** לחצו על שם תלמיד מרשימת ה"תלמידים להושבה" בצד ימין.
3.  **הושבה:** לחצו על כיסא פנוי בכיתה. התלמיד ישובץ שם מיד.
4.  **שינוי מיקום:** לחצו על תלמיד שכבר יושב כדי להחזיר אותו למאגר, או גררו אותו למקום חדש.
5.  **סידור אוטומטי:** השתמשו בכפתור "סידור חכם" כדי לקבל הצעה ראשונית המבוססת על העדפות התלמידים.
6.  *מבנה גמיש:** אפשרות להגדיר את כמות הטורים והשורות בזמן אמת.
7.  *התאמה אישית:** מתאים לכל כיתה
8.  *ניתוח חברתי:** זיהוי אוטומטי של העדפות ישיבה (ירוק לשיבוץ טוב, אדום לקונפליקט).
9.  **ממשק נקי:** עיצוב פשוט וממוקד עבודה.

## ✍️ פיתוח
הפרויקט פותח ככלי עזר למלמד במטרה להפוך את תהליך סידור הכיתה למהיר, נעים ומבוסס נתונים.

class-manager/
├── index.html         ✅
├── script.js          ✅ (1200+ שורות)
├── style.css          ✅
├── sw.js              ✅ (Service Worker)
├── manifest.json      ✅
├── README.md          ✅
├── assets/icons/
│   ├── ClassManager.svg   ✅
│   ├── icon-192.png       ⏳ (צריך המרה)
│   ├── icon-152.png       ⏳
│   └── icon-512.png       ⏳
└── .github/workflows/ (אופציונלי)
## ClassManager H1 - Smart Classroom Seating Arrangement System

This repository is a **classroom management tool** designed to help teachers organize student seating in an optimal way. It's written in Hebrew (עברית) and built as a helper for managing a 5th-grade classroom (Class H1).

### Key Features:

- **Interactive Drag & Drop Interface**: Teachers can easily drag students from a pool/list directly to desired seats
- **Smart Sorting Algorithm**: A "smart arrangement" button automatically suggests optimal student placements based on preferences
- **Social Conflict Detection**: The system highlights in red problematic seating arrangements (based on student preferences) and in green positive placements
- **Realistic Classroom Layout**: Visualizes the actual classroom structure with 4 tables on the sides and 2 in the center
- **Missing Student Tracking**: Maintains an updated list of students not yet seated to ensure no one is forgotten

### Technology Stack:

The project uses vanilla **JavaScript (40.2%)**, **HTML (32.3%)**, and **CSS (27.5%)** with Tailwind CSS for styling, and is deployed via GitHub Pages.

### Purpose:

This is a pedagogical tool built to make the classroom seating arrangement process fast, user-friendly, and data-driven for the teacher.