const addClassForm = document.getElementById('addClassForm');
const classNameInput = document.getElementById('classNameInput');
const classesList = document.getElementById('classesList');
const overallPercentageEl = document.getElementById('overallPercentage');
const confirmModal = document.getElementById('confirmModal');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');

const minimumAttendance = 75;

// Load classes from localStorage
function loadData() {
    const data = localStorage.getItem('attendanceData');
    return data ? JSON.parse(data) : [];
}

// Save classes to localStorage
function saveData(classes) {
    localStorage.setItem('attendanceData', JSON.stringify(classes));
}

// Calculate attendance percentage
function calculatePercentage(attended, total) {
    if (total === 0) return 0;
    return Math.floor((attended / total) * 100);
}

// Render overall summary
function renderOverallSummary(classes) {
    const totalAttended = classes.reduce((sum, cls) => sum + cls.attended, 0);
    const totalClasses = classes.reduce((sum, cls) => sum + cls.total, 0);
    const percentage = calculatePercentage(totalAttended, totalClasses);
    overallPercentageEl.textContent = `${percentage}%`;
    overallPercentageEl.style.color = percentage >= minimumAttendance ? '#10b981' : '#ef4444';
}

// Render all classes
function renderClasses() {
    const classes = loadData();
    classesList.innerHTML = '';
    classes.forEach(cls => renderClass(cls));
    renderOverallSummary(classes);
}

// Save and rerender
function saveAndRender(classes) {
    saveData(classes);
    renderClasses();
}

// Render a single class
function renderClass(cls) {
    const percentage = calculatePercentage(cls.attended, cls.total);
    const statusColor = percentage >= minimumAttendance ? 'text-green-600' : 'text-red-600';

    const classItem = document.createElement('div');
    classItem.className = 'class-item card p-4 mb-4 flex flex-col md:flex-row items-center justify-between gap-4';
    classItem.innerHTML = `
        <div class="flex-grow">
            <h2 class="text-xl font-semibold text-gray-800">${cls.name}</h2>
            <p class="text-gray-600">Total Classes: <span>${cls.total}</span> | Attended: <span>${cls.attended}</span></p>
        </div>
        <div class="flex items-center gap-4">
            <div class="percent-box text-center">
                <p class="text-sm text-gray-500">Percentage</p>
                <p class="text-xl font-bold ${statusColor}">${percentage}%</p>
            </div>
            <div class="flex gap-2 flex-wrap justify-center md:justify-end">
                <button class="btn-blue px-3 py-1 text-sm rounded-md">Attended</button>
                <button class="btn-green px-3 py-1 text-sm rounded-md">Missed</button>
                <button class="btn-gray px-3 py-1 text-sm rounded-md">Reset</button>
                <button class="btn-red px-3 py-1 text-sm rounded-md">Delete</button>
            </div>
        </div>
    `;

    const [attendedBtn, missedBtn, resetBtn, deleteBtn] = classItem.querySelectorAll('button');

    attendedBtn.addEventListener('click', () => {
        const classes = loadData();
        const c = classes.find(cl => cl.name === cls.name);
        c.attended += 1;
        c.total += 1;
        saveAndRender(classes);
    });

    missedBtn.addEventListener('click', () => {
        const classes = loadData();
        const c = classes.find(cl => cl.name === cls.name);
        c.total += 1;
        saveAndRender(classes);
    });

    resetBtn.addEventListener('click', () => {
        showModal('Reset Class', 'Are you sure you want to reset this class?', () => {
            const classes = loadData();
            const c = classes.find(cl => cl.name === cls.name);
            c.attended = 0;
            c.total = 0;
            saveAndRender(classes);
        });
    });

    deleteBtn.addEventListener('click', () => {
        showModal('Delete Class', `Are you sure you want to delete ${cls.name}?`, () => {
            const classes = loadData().filter(cl => cl.name !== cls.name);
            saveAndRender(classes);
        });
    });

    classesList.appendChild(classItem);
}

// Show confirmation modal
function showModal(title, message, onConfirm) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    confirmModal.classList.remove('hidden');

    const handleConfirm = () => {
        onConfirm();
        closeModal();
    };

    const handleCancel = () => {
        closeModal();
    };

    confirmBtn.addEventListener('click', handleConfirm, { once: true });
    cancelBtn.addEventListener('click', handleCancel, { once: true });
}

function closeModal() {
    confirmModal.classList.add('hidden');
}

// Handle form submission
addClassForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = classNameInput.value.trim();
    if (!name) return;

    const classes = loadData();
    if (classes.find(cls => cls.name === name)) {
        alert('Class already exists!');
        return;
    }

    classes.push({ name, attended: 0, total: 0 });
    saveAndRender(classes);
    classNameInput.value = '';
});

// Initial render
renderClasses();
