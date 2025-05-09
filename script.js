// מערך לשמירת ההזמנות
let orders = [];

// הוספה בתחילת הקובץ
let selectedDate = null;
let currentMonth = new Date();

let orderToDelete = null;

// הוספת משתנה גלובלי לשמירת ה-unsubscribe
let unsubscribeListener = null;

// הגדרות Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCnlK35-Bva8u4gdBR4JuuyJpotKK5ODW4",
    authDomain: "pergolas-bakfar-ordemanagement.firebaseapp.com",
    projectId: "pergolas-bakfar-ordemanagement",
    storageBucket: "pergolas-bakfar-ordemanagement.firebasestorage.app",
    messagingSenderId: "610208986707",
    appId: "1:610208986707:web:0b2d5feba375cdefbb38a6",
    measurementId: "G-S9Z84P6RN7"
};

// אתחול Firebase - פעם אחת בלבד
let db;
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
db = firebase.firestore();

// עדכון טעינת הדף
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // בדיקת חיבור למסד הנתונים
        await db.collection('orders').get();
        console.log('Firebase connection successful');
        
        // הפעלת האזנה בזמן אמת
        setupRealtimeListener();
        
        // המשך האתחול הרגיל
        await loadOrders();
        setupSearchListeners();
        
        // הוספת מאזינים לכפתורי הייצוא
        document.getElementById('exportExcelButton').addEventListener('click', exportToExcel);
        document.getElementById('exportJsonButton').addEventListener('click', backupToDrive);
        document.getElementById('printButton').addEventListener('click', exportToPDF);
        
        // מאזינים ללוח שנה
        document.getElementById('prevMonth').addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            renderCalendar();
        });
        
        document.getElementById('nextMonth').addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            renderCalendar();
        });
        
        document.querySelector('.close-modal').addEventListener('click', () => {
            document.getElementById('calendar-modal').style.display = 'none';
        });
        
        // פתיחת המודל בלחיצה על שדה התאריך
        document.getElementById('installationDate').addEventListener('click', (e) => {
            e.preventDefault();
            showCalendarModal(e.target);
        });
    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }
});

// הוספת הזמנה חדשה
document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const newOrder = {
            customerName: document.getElementById('customerName').value,
            installationDate: document.getElementById('installationDate').value,
            warrantyMonths: document.getElementById('warrantyMonths').value,
            serviceType: document.getElementById('serviceType').value,
            address: document.getElementById('address').value,
            phone: document.getElementById('phone').value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('Saving order:', newOrder); // לבדיקה

        // שמירה ב-Firestore
        const docRef = await db.collection('orders').add(newOrder);
        console.log('Document written with ID: ', docRef.id); // לבדיקה

        // טעינה מחדש של ההזמנות
        await loadOrders();
        e.target.reset();
    } catch (error) {
        console.error("Error adding order: ", error);
    }
});

// הוספת מאזינים לפילטרים החדשים
document.getElementById('dateFrom').addEventListener('input', filterOrders);
document.getElementById('dateTo').addEventListener('input', filterOrders);
document.getElementById('warrantyFilter').addEventListener('change', filterOrders);

// הוספת מאזין לכפתור הפילטור
document.getElementById('filterButton').addEventListener('click', filterOrders);

// הוספת מאזין למקש Enter בשדות החיפוש
document.querySelectorAll('.search-box input, .search-box select').forEach(element => {
    element.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // מניעת שליחת טופס
            filterOrders();
        }
    });
});

// הגדרת מאזיני חיפוש
function setupSearchListeners() {
    const searchInput = document.getElementById('searchInput');
    const filterButton = document.getElementById('filterButton');

    // מאזין לשינויים בשדה החיפוש
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim() === '') {
            renderOrders(orders); // הצג את כל ההזמנות כשהשדה ריק
        }
    });

    // מאזין ללחיצה על כפתור החיפוש
    filterButton.addEventListener('click', filterOrders);

    // מאזין ללחיצה על Enter בשדה החיפוש
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterOrders();
        }
    });
}

// פונקציית החיפוש
function filterOrders() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        renderOrders(orders); // הצג את כל ההזמנות כשהחיפוש ריק
        return;
    }
    
    const filteredOrders = orders.filter(order => 
        order.customerName.toLowerCase().includes(searchTerm)
    );
    
    renderOrders(filteredOrders);
}

// הוספת פונקציה למחיקת הזמנה
function deleteOrder(index) {
    orderToDelete = index;
    document.getElementById('delete-modal').style.display = 'block';
}

// הצגת ההזמנות
function renderOrders(filteredOrders = orders) {
    const tableBody = document.getElementById('ordersTableBody');
    const cardsContainer = document.getElementById('ordersCards');
    
    tableBody.innerHTML = '';
    cardsContainer.innerHTML = '';

    // סידור ההזמנות בסדר הפוך - החדשות למעלה
    const sortedOrders = [...filteredOrders].reverse();

    sortedOrders.forEach((order, index) => {
        // טבלה
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.customerName || ''}</td>
            <td>${formatDate(order.installationDate) || ''}</td>
            <td>${(order.warrantyMonths || '') + ' חודשים'}</td>
            <td>${order.serviceType || ''}</td>
            <td>${order.address || ''}</td>
            <td>${order.phone || ''}</td>
            <td>
                <button class="delete-btn" onclick="deleteOrder(${orders.indexOf(order)})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);

        // כרטיסיות
        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="header-title">
                    <span class="label">שם לקוח:</span>
                    <span class="value">${order.customerName || ''}</span>
                </div>
                <button class="delete-btn" onclick="deleteOrder(${orders.indexOf(order)})" title="מחק הזמנה">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="info-row">
                <strong>תאריך התקנה:</strong>
                <span>${formatDate(order.installationDate) || ''}</span>
            </div>
            <div class="info-row">
                <strong>תקופת אחריות:</strong>
                <span>${(order.warrantyMonths || '') + ' חודשים'}</span>
            </div>
            <div class="info-row">
                <strong>סוג שירות:</strong>
                <span>${order.serviceType || ''}</span>
            </div>
            <div class="info-row">
                <strong>כתובת:</strong>
                <span>${order.address || ''}</span>
            </div>
            <div class="info-row">
                <strong>טלפון:</strong>
                <span class="phone-number">${order.phone || ''}</span>
            </div>
        `;
        cardsContainer.appendChild(card);
    });
}

// פונקציה לפורמט התאריך
function formatDate(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}.${month}.${year}`;
}

// הוספת סגנונות לסטטוס אחריות
const style = document.createElement('style');
style.textContent = `
    .warranty-active {
        color: #4CAF50;
        font-weight: bold;
        margin-right: 8px;
    }
    .warranty-expired {
        color: #f44336;
        font-weight: bold;
        margin-right: 8px;
    }
`;
document.head.appendChild(style);

// פונקציה להצגת המודל
function showCalendarModal(inputElement) {
    const modal = document.getElementById('calendar-modal');
    modal.style.display = 'block';
    selectedDate = inputElement;
    renderCalendar();
}

// פונקציה ליצירת לוח השנה
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    document.getElementById('currentMonth').textContent = 
        new Intl.DateTimeFormat('he-IL', { year: 'numeric', month: 'long' }).format(currentMonth);
    
    const daysContainer = document.getElementById('calendar-days');
    daysContainer.innerHTML = '';
    
    // חישוב היום הראשון בשבוע
    let firstDayIndex = firstDay.getDay();
    
    // התאמה ללוח שנה עברי
    if (firstDayIndex === 0) {
        firstDayIndex = 6;
    } else {
        firstDayIndex--;
    }
    
    // ימים ריקים בתחילת החודש
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'day empty';
        daysContainer.appendChild(emptyDay);
    }
    
    // ימי החודש
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'day';
        dayElement.textContent = day;
        
        // יצירת תאריך חדש עם התחשבות באזור הזמן המקומי
        const currentDate = new Date(year, month, day, 12); // הוספנו שעה 12 כדי להימנע מבעיות אזור זמן
        
        if (isToday(currentDate)) {
            dayElement.classList.add('today');
        }
        
        const selectedDateValue = selectedDate ? selectedDate.value : '';
        const currentDateString = formatDateForInput(currentDate);
        
        if (selectedDateValue === currentDateString) {
            dayElement.classList.add('selected');
        }
        
        dayElement.addEventListener('click', () => {
            selectedDate.value = currentDateString;
            document.getElementById('calendar-modal').style.display = 'none';
        });
        
        daysContainer.appendChild(dayElement);
    }
}

// פונקציה חדשה לפורמט תאריך עבור שדה input
function formatDateForInput(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

// עדכון פונקציית isToday
function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function selectDate(date) {
    if (selectedDate) {
        selectedDate.value = date.toISOString().split('T')[0];
        document.getElementById('calendar-modal').style.display = 'none';
    }
}

function displayOrders(orders) {
    const ordersTableBody = document.getElementById('ordersTableBody');
    const ordersCards = document.getElementById('ordersCards');
    
    // נקה את התצוגות הקיימות
    ordersTableBody.innerHTML = '';
    ordersCards.innerHTML = '';
    
    // אם אין הזמנות, נצא מהפונקציה
    if (!orders || orders.length === 0) {
        return;
    }
    
    orders.forEach(order => {
        // הוספה לטבלה
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.customerName}</td>
            <td>${order.installationDate}</td>
            <td>${order.warrantyMonths} חודשים</td>
            <td>${order.address}</td>
            <td>${order.phone}</td>
            <td>
                <button class="delete-btn" onclick="deleteOrder('${order.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        ordersTableBody.appendChild(row);

        // הוספה לקארדים
        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="header-title">
                    <span class="label">שם לקוח:</span>
                    <span class="value">${order.customerName}</span>
                </div>
                <button class="delete-btn" onclick="deleteOrder('${order.id}')" title="מחק הזמנה">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="card-content">
                <div class="info-line">
                    <span class="label">תאריך:</span>
                    <span class="value">${order.installationDate}</span>
                </div>
                <div class="info-line">
                    <span class="label">אחריות:</span>
                    <span class="value">${order.warrantyMonths} חודשים</span>
                    <span class="status-tag active">בתוקף</span>
                </div>
                <div class="info-line">
                    <span class="label">כתובת:</span>
                    <span class="value">${order.address}</span>
                </div>
                <div class="info-line">
                    <span class="label">טלפון:</span>
                    <span class="value phone">${order.phone}</span>
                </div>
            </div>
        `;
        ordersCards.appendChild(card);
    });
}

// הוסף פונקציה לטעינת ההזמנות מ-Firestore
async function loadOrders() {
    try {
        const snapshot = await db.collection('orders').get();
        orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderOrders();
    } catch (error) {
        console.error("Error loading orders: ", error);
    }
}

// פונקציה לסגירת המודל
function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
    orderToDelete = null;
}

// פונקציה לאישור המחיקה
async function confirmDelete() {
    if (orderToDelete !== null) {
        try {
            // מחיקה מ-Firestore
            await db.collection('orders').doc(orders[orderToDelete].id).delete();
            // טעינה מחדש של ההזמנות
            await loadOrders();
            closeDeleteModal();
        } catch (error) {
            console.error("Error deleting order: ", error);
        }
    }
}

// סגירת המודל בלחיצה מחוץ לתוכן
window.onclick = function(event) {
    const modal = document.getElementById('delete-modal');
    if (event.target == modal) {
        closeDeleteModal();
    }
}

// פונקציות ייצוא וגיבוי
document.getElementById('exportExcelButton').addEventListener('click', exportToExcel);
document.getElementById('exportJsonButton').addEventListener('click', backupToDrive);
document.getElementById('printButton').addEventListener('click', exportToPDF);

// פונקציה משופרת לייצוא לאקסל
function exportToExcel() {
    try {
        // יצירת תוכן ה-CSV
        let csvContent = 'שם לקוח,תאריך התקנה,תקופת אחריות,סוג שירות,כתובת,טלפון\n';
        
        // הוספת כל ההזמנות
        orders.forEach(order => {
            csvContent += [
                order.customerName || '',
                formatDate(order.installationDate) || '',
                (order.warrantyMonths || '') + ' חודשים',
                order.serviceType || '',
                order.address || '',
                order.phone || ''
            ].map(field => `"${field}"`).join(',') + '\n';
        });

        // יצירת קובץ והורדה
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `הזמנות_${new Date().toLocaleDateString('he-IL')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error exporting to Excel:', error);
    }
}

// פונקציה לגיבוי אוטומטי
async function backupToDrive() {
    try {
        const snapshot = await db.collection('orders').get();
        const backupData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        const backupJson = JSON.stringify(backupData, null, 2);
        const timestamp = new Date().toISOString().split('T')[0];
        
        // שמירה כקובץ JSON
        const blob = new Blob([backupJson], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `orders_backup_${timestamp}.json`;
        link.click();
    } catch (error) {
        console.error('Error creating backup:', error);
    }
}

// פונקציית ההדפסה
function exportToPDF() {
    // הוספת תאריך הדפסה לקונטיינר
    const container = document.querySelector('.orders-container');
    container.setAttribute('data-print-date', new Date().toLocaleString('he-IL'));
    
    window.print();
}

// פונקציה להאזנה לשינויים בזמן אמת
function setupRealtimeListener() {
    // ביטול האזנה קודמת אם קיימת
    if (unsubscribeListener) {
        unsubscribeListener();
    }

    // הגדרת האזנה חדשה
    unsubscribeListener = db.collection('orders')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            // טיפול בשינויים
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    // הזמנה חדשה נוספה
                    const newOrder = {
                        id: change.doc.id,
                        ...change.doc.data()
                    };
                    orders.unshift(newOrder);
                } else if (change.type === 'modified') {
                    // הזמנה עודכנה
                    const index = orders.findIndex(order => order.id === change.doc.id);
                    if (index !== -1) {
                        orders[index] = {
                            id: change.doc.id,
                            ...change.doc.data()
                        };
                    }
                } else if (change.type === 'removed') {
                    // הזמנה נמחקה
                    const index = orders.findIndex(order => order.id === change.doc.id);
                    if (index !== -1) {
                        orders.splice(index, 1);
                    }
                }
            });
            
            // עדכון התצוגה
            renderOrders();
        }, (error) => {
            console.error("Error listening to changes: ", error);
        });
}

// ניקוי האזנה בעת עזיבת הדף
window.addEventListener('beforeunload', () => {
    if (unsubscribeListener) {
        unsubscribeListener();
    }
}); 