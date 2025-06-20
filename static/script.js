const API_BASE_URL = window.location.origin;

let aiGeneratedSchedule = [];
let uploadedFile = null;

function formatUserNameWithLastNameHighlight(fullName) {
    if (!fullName || typeof fullName !== 'string') return "Guest";
    const nameParts = fullName.trim().split(' ');
    if (nameParts.length > 1) {
        const firstName = nameParts.slice(0, -1).join(' ');
        const lastName = nameParts[nameParts.length - 1];
        return `${firstName}<span class="user-name-lastname">${lastName}</span>`;
    }
    return fullName;
}

function updateDashboardStats(data) {
    const totalTasks = data ? data.totalTasks : 0;
    const completedTasks = data ? data.completedTasks : 0;
    const notCompletedTasks = totalTasks - completedTasks;

    document.getElementById('total-tasks').textContent = totalTasks;
    document.getElementById('completed-tasks').textContent = completedTasks;
    document.getElementById('not-completed-tasks').textContent = notCompletedTasks;
    document.getElementById('progress-total').style.width = totalTasks > 0 ? '100%' : '0%';
    document.getElementById('progress-completed').style.width = totalTasks > 0 ? (completedTasks / totalTasks) * 100 + '%' : '0%';
    document.getElementById('progress-not-completed').style.width = totalTasks > 0 ? (notCompletedTasks / totalTasks) * 100 + '%' : '0%';
    
    document.getElementById('profile-total-tasks').textContent = totalTasks;
    document.getElementById('profile-completed-tasks').textContent = completedTasks;
    document.getElementById('profile-not-completed-tasks').textContent = notCompletedTasks;
    document.getElementById('profile-progress-total').style.width = totalTasks > 0 ? '100%' : '0%';
    document.getElementById('profile-progress-completed').style.width = totalTasks > 0 ? (completedTasks / totalTasks) * 100 + '%' : '0%';
    document.getElementById('profile-progress-not-completed').style.width = totalTasks > 0 ? (notCompletedTasks / totalTasks) * 100 + '%' : '0%';
}

function updateUserInfo() {
    const welcomeHeading = document.querySelector('.welcome-heading');
    const date = new Date();
    const hour = date.getHours();

    let greeting = "Welcome";
    let subMessage = "Let's get things done.";

    if (hour >= 5 && hour < 12) {
        greeting = "Good Morning";
        subMessage = "Have a great and productive day!";
    } else if (hour >= 12 && hour < 16) {
        greeting = "Good Afternoon";
        subMessage = "Time for a tea break, perhaps?";
    } else if (hour >= 16 && hour < 19) {
        greeting = "Good Evening";
        subMessage = "Time to wrap up the day's tasks.";
    } else {
        greeting = "Good Night";
        subMessage = "Time to rest and recharge for tomorrow.";
    }
    
    const userInfoStr = localStorage.getItem('snapTaskUserInfo');
    const profileUserName = document.getElementById('profile-user-name');
    const profilePicture = document.getElementById('profile-picture');
    const defaultPic = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    let userName = "Guest";

    if (!userInfoStr) {
        profilePicture.src = defaultPic;
        profileUserName.textContent = 'Hey, Guest';
    } else {
        const userInfo = JSON.parse(userInfoStr);
        userName = formatUserNameWithLastNameHighlight(userInfo.name || 'User');
        profilePicture.src = userInfo.picture_url || defaultPic;
        profileUserName.innerHTML = `Hey, ${userName}`;
    }

    if (welcomeHeading) {
        welcomeHeading.innerHTML = `${greeting}, ${userName}<br><span class="welcome-subheading-dynamic">${subMessage}</span>`;
    }
}

async function fetchDashboardData() {
    const appToken = localStorage.getItem('snapTaskAppToken');
    if (!appToken) {
        updateDashboardStats({ totalTasks: 0, completedTasks: 0 });
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/dashboard/summary`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${appToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            updateDashboardStats(data);
        } else {
            updateDashboardStats({ totalTasks: 0, completedTasks: 0 });
        }
    } catch (error) {
        console.error("Dashboard data fetch failed:", error);
        updateDashboardStats({ totalTasks: 0, completedTasks: 0 });
    }
}

const navHome = document.getElementById('nav-home');
const navTasks = document.getElementById('nav-tasks');
const navProfile = document.getElementById('nav-profile');
const homeContent = document.getElementById('home-content');
const tasksSection = document.getElementById('tasks-section');
const profileSection = document.getElementById('profile-section');

function showSection(sectionToShow, navLinkToActivate) {
    const allSections = [homeContent, tasksSection, profileSection];
    const allLinks = [navHome, navTasks, navProfile];

    gsap.to(allSections, {
        autoAlpha: 0, duration: 0.2,
        onComplete: () => {
            allSections.forEach(s => s.style.display = 'none');
            allLinks.forEach(l => l.classList.remove('active'));

            sectionToShow.style.display = 'flex';
            navLinkToActivate.classList.add('active');
            gsap.to(sectionToShow, { autoAlpha: 1, duration: 0.3, delay: 0.1 });
        }
    });
}

navHome.addEventListener('click', (e) => { e.preventDefault(); if (!navHome.classList.contains('active')) showSection(homeContent, navHome); });
navTasks.addEventListener('click', (e) => { e.preventDefault(); if (!navTasks.classList.contains('active')) { fetchAndDisplayTasks(); showSection(tasksSection, navTasks); } });
navProfile.addEventListener('click', (e) => { e.preventDefault(); if (!navProfile.classList.contains('active')) showSection(profileSection, navProfile); });

async function fetchAndDisplayTasks() {
    const appToken = localStorage.getItem('snapTaskAppToken');
    if (!appToken) { return; }
    const taskListContainer = document.getElementById('task-list-items');
    taskListContainer.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading tasks...</div>`;
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/`, {
            headers: { 'Authorization': `Bearer ${appToken}` }
        });
        if (!response.ok) {
            throw new Error(`Could not fetch tasks. Server responded: ${await response.text()}`);
        }
        const tasks = await response.json();
        taskListContainer.innerHTML = '';
        if (tasks.length === 0) {
            taskListContainer.innerHTML = '<p class="empty-message">No tasks found. Add some from the modal!</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'task-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th data-sort="status">Status <i class="fas fa-sort"></i></th>
                    <th data-sort="description">Description <i class="fas fa-sort"></i></th>
                    <th data-sort="priority">Priority <i class="fas fa-sort"></i></th>
                    <th data-sort="start_time">Start Time <i class="fas fa-sort"></i></th>
                    <th data-sort="end_time">End Time <i class="fas fa-sort"></i></th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        tasks.forEach(task => {
            const isCompleted = task.status === 'completed';
            const row = tbody.insertRow();
            row.dataset.taskId = task.id;

            const formatTime = (timeStr) => {
                if (!timeStr) return 'N/A';
                return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            };

            row.innerHTML = `
                <td><span class="status ${task.status}">${task.status}</span></td>
                <td class="description-cell">${task.description}</td>
                <td><span class="priority ${task.priority}">${task.priority}</span></td>
                <td>${formatTime(task.start_time)}</td>
                <td>${formatTime(task.end_time)}</td>
                <td class="actions-cell">
                    <button class="btn-task-breakdown" title="Breakdown Task"><i class="fas fa-tasks"></i></button>
                    <button class="btn-task-complete" ${isCompleted ? 'disabled' : ''} title="Mark as Complete"><i class="fas fa-check"></i></button>
                    <button class="btn-task-delete" title="Delete Task"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });

        taskListContainer.appendChild(table);

    } catch (error) {
        taskListContainer.innerHTML = '<p class="empty-message">Could not load tasks. Please try again.</p>';
        console.error("Failed to fetch tasks:", error);
    }
}

document.getElementById('task-list-items').addEventListener('click', async (e) => {
    const appToken = localStorage.getItem('snapTaskAppToken');
    
    const breakdownButton = e.target.closest('.btn-task-breakdown');
    if (breakdownButton) {
        e.stopPropagation();
        const taskRow = breakdownButton.closest('tr');
        document.querySelectorAll('tr[data-taskid]').forEach(row => row.classList.remove('breakdown-active'));
        taskRow.classList.add('breakdown-active');
        window.lastBreakdownTaskRow = taskRow;

        breakdownButton.disabled = true;
        breakdownButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        
        try {
            const response = await fetch(`${API_BASE_URL}/tasks/${taskRow.dataset.taskId}/breakdown`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${appToken}` }
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to get breakdown.');
            }
            const data = await response.json();
            populateAiBreakdownModal(data.subtasks);
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            breakdownButton.disabled = false;
            breakdownButton.innerHTML = `<i class="fas fa-tasks"></i>`;
        }
        return;
    }

    const sortHeader = e.target.closest('th[data-sort]');
    if (sortHeader) {
        const sortKey = sortHeader.dataset.sort;
        const table = sortHeader.closest('.task-table');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentOrder = sortHeader.dataset.order || 'desc';
        const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
        
        const priorityOrder = { high: 3, medium: 2, low: 1 };

        rows.sort((rowA, rowB) => {
            let valA, valB;

            if (sortKey === 'start_time' || sortKey === 'end_time') {
                const parseTime = (timeStr) => {
                    if (!timeStr || timeStr === 'N/A') return newOrder === 'asc' ? Infinity : -Infinity;
                    const match = timeStr.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
                    if (match) {
                        let hour = parseInt(match[1], 10);
                        const minute = parseInt(match[2], 10);
                        const ampm = match[3].toUpperCase();
                        if (ampm === 'PM' && hour !== 12) hour += 12;
                        if (ampm === 'AM' && hour === 12) hour = 0;
                        return hour * 60 + minute;
                    }
                    return newOrder === 'asc' ? Infinity : -Infinity;
                };
                valA = parseTime(rowA.cells[sortKey === 'start_time' ? 3 : 4].textContent.trim());
                valB = parseTime(rowB.cells[sortKey === 'start_time' ? 3 : 4].textContent.trim());
                return newOrder === 'asc' ? valA - valB : valB - valA;
            } else if (sortKey === 'priority') {
                valA = priorityOrder[rowA.querySelector('.priority').textContent.trim()] || 0;
                valB = priorityOrder[rowB.querySelector('.priority').textContent.trim()] || 0;
            } else if (sortKey === 'status') {
                valA = rowA.querySelector('.status').textContent.trim();
                valB = rowB.querySelector('.status').textContent.trim();
            } else { 
                valA = rowA.querySelector('.description-cell').textContent.trim().toLowerCase();
                valB = rowB.querySelector('.description-cell').textContent.trim().toLowerCase();
            }
            if (typeof valA === 'string') {
                return newOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return newOrder === 'asc' ? valA - valB : valB - valA;
            }
        });

        rows.forEach(row => tbody.appendChild(row));

        table.querySelectorAll('th[data-sort]').forEach(th => {
            th.dataset.order = '';
            th.querySelector('i').className = 'fas fa-sort';
        });
        sortHeader.dataset.order = newOrder;
        sortHeader.querySelector('i').className = newOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';

        return;
    }
    
    if (!appToken) { return; }

    const completeButton = e.target.closest('.btn-task-complete');
    const deleteButton = e.target.closest('.btn-task-delete');

    if (completeButton) {
        const taskRow = completeButton.closest('tr');
        const taskId = taskRow.dataset.taskId;
        completeButton.disabled = true;
        completeButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        try {
            const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/complete`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${appToken}` }
            });
            if (!response.ok) throw new Error('Failed to update task.');
            const statusSpan = taskRow.querySelector('.status');
            statusSpan.textContent = 'completed';
            statusSpan.className = 'status completed';
            completeButton.innerHTML = `<i class="fas fa-check"></i>`;
            fetchDashboardData();
        } catch (error) {
            alert(error.message);
            completeButton.disabled = false;
            completeButton.innerHTML = `<i class="fas fa-check"></i>`;
        }
    }

    if (deleteButton) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        const taskRow = deleteButton.closest('tr');
        const taskId = taskRow.dataset.taskId;
        deleteButton.disabled = true;
        deleteButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        try {
            const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${appToken}` }
            });
            if (!response.ok) throw new Error('Failed to delete task.');
            gsap.to(taskRow, { autoAlpha: 0, height: 0, duration: 0.3, onComplete: () => {
                taskRow.remove();
                fetchDashboardData();
            }});
        } catch (error) {
            alert(error.message);
            deleteButton.disabled = false;
            deleteButton.innerHTML = `<i class="fas fa-trash-alt"></i>`;
        }
    }
});

const addTaskModal = document.getElementById('add-task-modal');
const openModalBtns = document.querySelectorAll('.open-modal-btn');
const closeModalBtn = addTaskModal.querySelector('.modal-close-btn');

const modalViews = {
    initial: document.getElementById('modal-view-initial'),
    fileUpload: document.getElementById('modal-view-file-upload'),
    ocrResults: document.getElementById('modal-view-ocr-results'),
    manualUpload: document.getElementById('modal-view-manual-upload'),
    aiSchedule: document.getElementById('modal-view-ai-schedule'),
};
let currentModalView = 'initial';
let lastEditorView = 'manualUpload';

function showModalView(viewName) {
    for (const key in modalViews) { if(modalViews[key]) modalViews[key].style.display = 'none'; }
    if(modalViews[viewName]) modalViews[viewName].style.display = 'block';
    currentModalView = viewName;
}

openModalBtns.forEach(btn => btn.addEventListener('click', () => { 
    resetFileUpload();
    showModalView('initial'); 
    addTaskModal.classList.add('visible'); 
}));
function closeModal() { addTaskModal.classList.remove('visible'); }
closeModalBtn.addEventListener('click', closeModal);
addTaskModal.addEventListener('click', (e) => { if (e.target === addTaskModal) closeModal(); });

document.getElementById('btn-show-file-upload').addEventListener('click', () => { 
     lastEditorView = 'ocrResults'; 
     const availabilityContainer = document.querySelector('#ocr-availability-section .availability-rows-container');
     if (availabilityContainer.children.length === 0) {
         availabilityContainer.appendChild(createAvailabilityRow());
     }
     showModalView('fileUpload'); 
});
document.getElementById('btn-show-manual-upload').addEventListener('click', () => {
    const taskList = document.getElementById('manual-task-list');
    if (taskList.children.length === 0) {
        taskList.appendChild(createTaskItemRow());
    }
    const availabilityContainer = document.querySelector('#manual-availability-section .availability-rows-container');
    if (availabilityContainer.children.length === 0) {
        availabilityContainer.appendChild(createAvailabilityRow());
    }
    lastEditorView = 'manualUpload';
    showModalView('manualUpload');
});

addTaskModal.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
        if(currentModalView === 'fileUpload' || currentModalView === 'manualUpload') showModalView('initial');
        else if (currentModalView === 'ocrResults') showModalView('fileUpload');
    });
});

document.querySelector('#modal-view-ai-schedule .btn-back-edit').addEventListener('click', () => { showModalView(lastEditorView); });

const fileUploadInput = document.getElementById('file-upload-input');
const filePreviewContainer = document.getElementById('file-preview-container');
const imagePreview = document.getElementById('image-preview');
const filePreviewDetails = document.getElementById('file-preview-details');
const filePreviewIcon = document.getElementById('file-preview-icon');
const filePreviewName = document.getElementById('file-preview-name');
const uploadLabel = document.querySelector('.upload-label');
const extractTextBtn = document.getElementById('btn-extract-text');
const removeFileBtn = document.getElementById('btn-remove-file');

function resetFileUpload() {
    uploadedFile = null;
    fileUploadInput.value = '';
    imagePreview.src = '#';
    imagePreview.style.display = 'none';
    filePreviewDetails.style.display = 'none';
    filePreviewContainer.style.display = 'none';
    uploadLabel.style.display = 'flex';
    extractTextBtn.disabled = true;
}

removeFileBtn.addEventListener('click', resetFileUpload);

fileUploadInput.addEventListener('change', () => {
    const file = fileUploadInput.files[0];
    if (file) {
        uploadedFile = file;
        uploadLabel.style.display = 'none';
        filePreviewContainer.style.display = 'flex';
        extractTextBtn.disabled = false;

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
                filePreviewDetails.style.display = 'none';
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.style.display = 'none';
            filePreviewDetails.style.display = 'flex';
            filePreviewName.textContent = file.name;
            if (file.type.includes('pdf')) filePreviewIcon.className = 'fas fa-file-pdf';
            else if (file.type.includes('word')) filePreviewIcon.className = 'fas fa-file-word';
            else if (file.type.includes('sheet')) filePreviewIcon.className = 'fas fa-file-excel';
            else filePreviewIcon.className = 'fas fa-file-alt';
        }
    }
});

extractTextBtn.addEventListener('click', async () => {
    if (!uploadedFile) { alert('Please upload a file first.'); return; }
    const appToken = localStorage.getItem('snapTaskAppToken');
    if (!appToken) { alert('Authentication error. Please log in again.'); return; }

    extractTextBtn.disabled = true;
    extractTextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting...';

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
        const response = await fetch(`${API_BASE_URL}/process/file/extract_tasks`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${appToken}` },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to extract tasks from file.');
        }
        
        const result = await response.json();
        populateOcrResults(result.tasks);
        showModalView('ocrResults');

    } catch (error) {
        console.error('Extraction Error:', error);
        alert(`An error occurred during task extraction: ${error.message}`);
    } finally {
        extractTextBtn.disabled = false;
        extractTextBtn.innerHTML = 'Extract Tasks';
    }
});

function createAvailabilityRow() {
    const row = document.createElement('div');
    row.className = 'availability-row';
    const today = new Date().toISOString().split('T')[0];
    row.innerHTML = `
        <input type="date" class="availability-date" value="${today}">
        <input type="time" class="availability-start" value="09:00">
        <span>to</span>
        <input type="time" class="availability-end" value="17:00">
        <button class="remove-availability-btn"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('.remove-availability-btn').addEventListener('click', () => row.remove());
    return row;
}

document.querySelectorAll('.btn-add-availability').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const container = e.target.closest('.availability-section').querySelector('.availability-rows-container');
        container.appendChild(createAvailabilityRow());
    });
});

function createTaskItemRow(taskObj = "") {
    let description = "";
    let priority = "medium";
    let duration = 30;
    if (typeof taskObj === "object" && taskObj !== null) {
        description = taskObj.description || "";
        priority = taskObj.priority || "medium";
        duration = taskObj.estimated_duration_minutes || 30;
    } else {
        description = taskObj;
    }
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    taskItem.innerHTML = `
        <input type="text" placeholder="Task description..." class="manual-task-description" value="${description}">
        <select class="manual-task-priority">
            <option value="medium" ${priority === "medium" ? "selected" : ""}>Medium</option>
            <option value="high" ${priority === "high" ? "selected" : ""}>High</option>
            <option value="low" ${priority === "low" ? "selected" : ""}>Low</option>
        </select>
        <input type="number" placeholder="Mins" value="${duration}" class="manual-task-duration" min="5" step="5">
        <label class="daily-routine-label">
            <input type="checkbox" class="daily-routine-checkbox"> Daily
        </label>
        <button class="remove-task-btn"><i class="fas fa-trash-alt"></i></button>
    `;
    taskItem.querySelector('.remove-task-btn').addEventListener('click', function() { this.parentElement.remove(); });
    return taskItem;
}

function populateOcrResults(tasks) {
    const ocrListContainer = document.getElementById('ocr-task-list');
    ocrListContainer.innerHTML = '';

    if (tasks.length === 0) {
        ocrListContainer.innerHTML = '<p class="empty-message">Could not detect any tasks in the image.</p>';
        return;
    }
    tasks.forEach(taskObj => {
        ocrListContainer.appendChild(createTaskItemRow(taskObj));
    });
    const availabilityContainer = document.querySelector('#ocr-availability-section .availability-rows-container');
    if (availabilityContainer.children.length === 0) {
        availabilityContainer.appendChild(createAvailabilityRow());
    }
}

document.getElementById('btn-ocr-generate-schedule').addEventListener('click', (e) => {
    handleGenerateSchedule(e.currentTarget, '#ocr-task-list', '#ocr-availability-section');
});

function addManualTaskRow() {
    const taskList = document.getElementById('manual-task-list');
    taskList.appendChild(createTaskItemRow());
}
document.getElementById('btn-add-manual-task').addEventListener('click', addManualTaskRow);

async function handleGenerateSchedule(button, taskContainerSelector, availabilityContainerSelector) {
    const appToken = localStorage.getItem('snapTaskAppToken');
    if (!appToken) { alert("Authentication error. Please log in again."); return; }
    
    const tasks = [];
    const taskRows = document.querySelectorAll(`${taskContainerSelector} .task-item`);
    taskRows.forEach(row => {
        const description = row.querySelector('.manual-task-description').value;
        const priority = row.querySelector('.manual-task-priority').value;
        const duration = row.querySelector('.manual-task-duration').value;
        const isDaily = row.querySelector('.daily-routine-checkbox').checked;
        if(description) tasks.push({ 
            description: description, 
            priority: priority, 
            estimated_duration_minutes: parseInt(duration) || 30,
            is_daily_routine: isDaily
        });
    });

    const availability = [];
    const availabilityRows = document.querySelectorAll(`${availabilityContainerSelector} .availability-row`);
    availabilityRows.forEach(row => {
        const date = row.querySelector('.availability-date').value;
        const start_time = row.querySelector('.availability-start').value;
        const end_time = row.querySelector('.availability-end').value;
        if(date && start_time && end_time) {
            availability.push({ date, start_time, end_time });
        }
    });

    if(tasks.length === 0) { alert("Please add at least one task."); return; }
    if(availability.length === 0) { alert("Please define your availability for at least one day."); return; }

    button.disabled = true;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating...`;
    try {
        const response = await fetch(`${API_BASE_URL}/process/ai/generate_schedule`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${appToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks, availability }),
        });
        if (!response.ok) throw new Error(`Failed to generate schedule: ${await response.text()}`);
        const scheduleData = await response.json();
        populateAiSchedule(scheduleData);
        showModalView('aiSchedule');
    } catch (error) {
        console.error("Schedule generation failed:", error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        button.disabled = false;
        button.innerHTML = 'Generate Schedule';
    }
}

document.getElementById('btn-manual-generate-schedule').addEventListener('click', (e) => {
    handleGenerateSchedule(e.currentTarget, '#manual-task-list', '#manual-availability-section');
});

function populateAiSchedule(scheduleData) {
    const scheduleListContainer = document.getElementById('ai-schedule-list');
    const notesContainer = document.getElementById('ai-schedule-notes');
    
    scheduleListContainer.innerHTML = '';
    scheduleListContainer.dataset.scheduleId = scheduleData.schedule_id;
    
    aiGeneratedSchedule = scheduleData.suggested_schedule;

    if(!aiGeneratedSchedule || aiGeneratedSchedule.length === 0) {
        scheduleListContainer.innerHTML = '<p class="empty-message">The AI could not generate a schedule. Please try adjusting your tasks or availability.</p>';
        document.getElementById('btn-approve-schedule').style.display = 'none';
    } else {
         document.getElementById('btn-approve-schedule').style.display = 'inline-flex';
        aiGeneratedSchedule.forEach(item => {
            const scheduleItem = document.createElement('div');
            scheduleItem.className = 'schedule-item';
            const startTime = new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
            const endTime = new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
            scheduleItem.innerHTML = `<span class="schedule-item-description">${item.task_description}</span><span class="schedule-item-time">${startTime} - ${endTime}</span>`;
            scheduleListContainer.appendChild(scheduleItem);
        });
    }

    if (scheduleData.notes) {
        notesContainer.innerHTML = `<p><strong>A quick note from your AI assistant:</strong> ${scheduleData.notes}</p>`;
        notesContainer.style.display = 'block';
    } else {
        notesContainer.style.display = 'none';
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function registerServiceWorkerAndSubscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Sorry, push notifications are not supported by your browser.');
        return;
    }

    try {
        const swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', swRegistration);

        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
            alert('Notification permission was not granted.');
            return;
        }

        let subscription = await swRegistration.pushManager.getSubscription();
        if (subscription === null) {
            const response = await fetch(`${API_BASE_URL}/vapid_public_key`, {
                 headers: { 'Authorization': `Bearer ${localStorage.getItem('snapTaskAppToken')}` }
            });
            const data = await response.json();
            const vapidPublicKey = data.public_key;
            
            if (!vapidPublicKey) {
                alert('Could not retrieve VAPID key from server.');
                return;
            }
            
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

            subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }
        
        const appToken = localStorage.getItem('snapTaskAppToken');
        await fetch(`${API_BASE_URL}/push/subscribe`, {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appToken}`
            }
        });

        alert('Notifications enabled successfully!');
        const enableBtn = document.getElementById('btn-enable-notifications');
        enableBtn.disabled = true;
        enableBtn.innerHTML = '<i class="fas fa-check"></i> Enabled';

    } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        alert('Failed to enable notifications. See console for details.');
    }
}

const enableBtn = document.getElementById('btn-enable-notifications');
if (enableBtn) {
    enableBtn.addEventListener('click', registerServiceWorkerAndSubscribe);
}

document.getElementById('btn-approve-schedule').addEventListener('click', async (e) => {
    const approveButton = e.currentTarget;
    approveButton.disabled = true;
    approveButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

    const appToken = localStorage.getItem('snapTaskAppToken');
    if (!appToken) { 
        alert('Authentication token not found.'); 
        approveButton.disabled = false;
        approveButton.innerHTML = `<i class="fas fa-check"></i> Approve & Save`;
        return; 
    }

    try {
        const syncResponse = await fetch(`${API_BASE_URL}/api/v1/calendar/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${appToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ schedule: aiGeneratedSchedule })
        });

        if (!syncResponse.ok) {
            const error = await syncResponse.json();
            throw new Error(error.detail || 'Failed to save schedule.');
        }
        
        const data = await syncResponse.json();
        alert(data.message);
        closeModal();
        fetchDashboardData();
        fetchAndDisplayTasks();

    } catch (error) {
        console.error("Save schedule failed:", error);
        alert(`Error saving schedule: ${error.message}`);
    } finally {
        approveButton.disabled = false;
        approveButton.innerHTML = `<i class="fas fa-check"></i> Approve & Save`;
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('snapTaskAppToken');
    localStorage.removeItem('snapTaskUserInfo');
    window.location.href = '../index.html';
});

document.getElementById('btn-export-pdf').addEventListener('click', async () => {
    const appToken = localStorage.getItem('snapTaskAppToken');
    if (!appToken) { alert("Authentication error."); return; }
    const exportButton = document.getElementById('btn-export-pdf');
    const originalContent = exportButton.innerHTML;
    exportButton.disabled = true;
    exportButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating...`;
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/`, { headers: { 'Authorization': `Bearer ${appToken}` } });
        if (!response.ok) throw new Error('Could not fetch task list.');
        const tasks = await response.json();
        await new Promise(resolve => setTimeout(resolve, 50));
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const userName = JSON.parse(localStorage.getItem('snapTaskUserInfo')).name || 'User';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        const logoFontSize = 22;
        const letterSpacing = -0.025 * logoFontSize;
        const snap = 'Snap';
        const task = 'Task';
        function getTextWidthWithSpacing(doc, text, spacing) {
            let width = 0;
            for (let i = 0; i < text.length; i++) {
                width += doc.getTextWidth(text[i]);
                if (i < text.length - 1) width += spacing;
            }
            return width;
        }
        const snapWidth = getTextWidthWithSpacing(doc, snap, letterSpacing);
        const taskWidth = getTextWidthWithSpacing(doc, task, letterSpacing);
        const totalWidth = snapWidth + taskWidth;
        const centerX = 105;
        const startX = centerX - totalWidth / 2;
        let logoX = startX;
        doc.setTextColor(0, 0, 0);
        for (let i = 0; i < snap.length; i++) {
            doc.text(snap[i], logoX, 18, { baseline: 'top' });
            logoX += doc.getTextWidth(snap[i]) + letterSpacing;
        }
        doc.setTextColor(139, 92, 246);
        for (let i = 0; i < task.length; i++) {
            doc.text(task[i], logoX, 18, { baseline: 'top' });
            logoX += doc.getTextWidth(task[i]) + letterSpacing;
        }
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(15);
        doc.setTextColor(0, 0, 0);
        doc.text("Your Today's Task Report", 105, 34, { align: 'center' });
        doc.setTextColor(34, 34, 34);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(13);
        doc.text(`Report generated for: ${userName}`, 14, 49);
        doc.setFont('helvetica', 'italic');
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 56);
        doc.setDrawColor(139, 92, 246);
        doc.setLineWidth(1);
        doc.line(14, 61, 196, 61);
        const tableColumn = [
            { header: "Date", dataKey: "date" },
            { header: "Description", dataKey: "description" },
            { header: "Priority", dataKey: "priority" },
            { header: "Status", dataKey: "status" }
        ];
        const tableRows = tasks.map(task => ({
            date: task.start_time ? new Date(task.start_time).toLocaleDateString() : 'Unscheduled',
            description: task.description,
            priority: task.priority.charAt(0).toUpperCase() + task.priority.slice(1),
            status: task.status.charAt(0).toUpperCase() + task.status.slice(1)
        }));
        doc.autoTable({
            columns: tableColumn,
            body: tableRows,
            startY: 67,
            styles: {
                font: 'helvetica',
                fontSize: 11,
                cellPadding: 4,
                valign: 'middle',
                textColor: [34, 34, 34]
            },
            headStyles: {
                fillColor: [139, 92, 246],
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: { fillColor: [245, 245, 255] },
            columnStyles: {
                description: { cellWidth: 70 }
            }
        });
        const pdfPageWidth = doc.internal.pageSize.getWidth();
        const pdfPageHeight = doc.internal.pageSize.getHeight();
        const sigImgWidth = 40;
        const sigImgHeight = 20;
        const sigX = pdfPageWidth - sigImgWidth - 14;
        const sigY = pdfPageHeight - sigImgHeight - 20;
        const img = new window.Image();
        img.src = 'assets/signature.png';
        img.onload = function() {
            doc.addImage(img, 'PNG', sigX, sigY, sigImgWidth, sigImgHeight);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(11);
            doc.setTextColor(80);
            doc.text('Dhinesh E, CEO of SnapTask', pdfPageWidth - 14, pdfPageHeight - 8, { align: 'right' });
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.setTextColor(120);
            doc.text("SnapTask — Productivity made simple", 105, doc.internal.pageSize.height - 2, { align: "center" });
            doc.save(`${userName.replace(/\s/g, '_')}_SnapTask_Report.pdf`);
        };
        img.onerror = function() {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.setTextColor(120);
            doc.text("SnapTask — Productivity made simple", 105, doc.internal.pageSize.height - 2, { align: "center" });
            doc.save(`${userName.replace(/\s/g, '_')}_SnapTask_Report.pdf`);
        };
    } catch(error) {
      console.error("PDF Export failed:", error);
      alert("Could not generate PDF report.");
    } finally {
      exportButton.disabled = false;
      exportButton.innerHTML = originalContent;
    }
});

document.getElementById('btn-reset-tasks').addEventListener('click', async () => {
    if (!confirm("Are you sure you want to delete ALL of your tasks?")) return;
    
    const appToken = localStorage.getItem('snapTaskAppToken');
    if (!appToken) {
        alert("Authentication error.");
        return;
    }

    const resetButton = document.getElementById('btn-reset-tasks');
    resetButton.disabled = true;
    resetButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Resetting...`;

    try {
        const response = await fetch('http://localhost:8000/tasks/reset', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${appToken}`
            }
        });

        if (response.status === 204) {
            alert("All tasks have been reset.");
            fetchDashboardData();
            fetchAndDisplayTasks();
        } else {
            const error = await response.text();
            alert(`Reset failed: ${error}`);
        }
    } catch (err) {
        alert("An error occurred while resetting tasks.");
        console.error(err);
    } finally {
        resetButton.disabled = false;
        resetButton.innerHTML = `<i class="fas fa-trash-restore"></i> Reset Task`;
    }
});


document.getElementById('home-task-widget').addEventListener('click', () => {
    showSection(tasksSection, navTasks);
    fetchAndDisplayTasks();
});

document.getElementById('profile-task-widget').addEventListener('click', () => {
    showSection(tasksSection, navTasks);
    fetchAndDisplayTasks();
});

window.onload = function () {
    updateUserInfo();
    fetchDashboardData();
    gsap.set([homeContent], { autoAlpha: 1 });
    gsap.set([profileSection, tasksSection], { autoAlpha: 0, display: 'none' });
    gsap.from(".header", { autoAlpha: 0, y: -30, delay: 0.2, duration: 0.6 });
    gsap.from(homeContent.children, { autoAlpha: 0, y: 25, stagger: 0.15, delay: 0.4, duration: 0.5 });
};

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('dynamicNightSkyCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars = [];
    let comets = [];
    let lastCometTime = 0;
    const COMET_INTERVAL = 2500;
    let animationFrameId;

    function random(min, max) { return Math.random() * (max - min) + min; }

    class Star {
        constructor() { this.x = random(0, canvas.width); this.y = random(0, canvas.height); this.radius = random(0.5, 1.5); this.baseOpacity = random(0.3, 0.5); this.currentOpacity = this.baseOpacity; this.isBlinking = false; this.blinkProgress = 0; this.blinkDuration = random(1000, 2000); this.blinkStartTime = 0; this.blinkMaxOpacity = Math.min(1.0, this.baseOpacity + random(0.5, 0.7)); }
        update(timestamp) { if (!this.isBlinking && Math.random() < 0.0001) { this.isBlinking = true; this.blinkStartTime = timestamp; } if (this.isBlinking) { const elapsed = timestamp - this.blinkStartTime; this.blinkProgress = elapsed / this.blinkDuration; if (this.blinkProgress < 1) { this.currentOpacity = this.baseOpacity + (this.blinkMaxOpacity - this.baseOpacity) * Math.sin(this.blinkProgress * Math.PI); } else { this.currentOpacity = this.baseOpacity; this.isBlinking = false; } } }
        draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 224, ${this.currentOpacity})`; ctx.fill(); }
    }
    class Comet {
        constructor() { this.x = random(0, canvas.width); this.y = random(-30, -5); this.length = random(80, 150); this.speed = random(1.5, 4); this.angle = random(Math.PI * 0.3, Math.PI * 0.7); this.dx = Math.cos(this.angle) * this.speed; this.dy = Math.sin(this.angle) * this.speed; }
        update() { this.x += this.dx; this.y += this.dy; }
        draw() { const tailX = this.x - this.dx * (this.length / this.speed); const tailY = this.y - this.dy * (this.length / this.speed); const gradient = ctx.createLinearGradient(this.x, this.y, tailX, tailY); gradient.addColorStop(0, 'rgba(255, 255, 224, 1)'); gradient.addColorStop(0.3, 'rgba(255, 255, 224, 0.5)'); gradient.addColorStop(1, 'rgba(255, 255, 224, 0)'); ctx.strokeStyle = gradient; ctx.lineWidth = random(0.5, 2.5); ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(tailX, tailY); ctx.stroke(); }
        isOffscreen() { return this.y > canvas.height + this.length || this.x < -this.length || this.x > canvas.width + this.length; }
    }

    function setup() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        stars = [];
        comets = [];
        const starCount = Math.floor(canvas.width / 10);
        for (let i = 0; i < starCount; i++) { stars.push(new Star()); }
        lastCometTime = performance.now();
    }
    function animate(timestamp) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        stars.forEach(star => { star.update(timestamp); star.draw(); });
        if (timestamp - lastCometTime > COMET_INTERVAL && comets.length < 4) { comets.push(new Comet()); lastCometTime = timestamp; }
        comets = comets.filter(comet => { comet.update(); comet.draw(); return !comet.isOffscreen(); });
        animationFrameId = requestAnimationFrame(animate);
    }
    window.addEventListener('resize', () => { cancelAnimationFrame(animationFrameId); setup(); animate(0); });
    setup();
    animate(0);
});

function populateAiBreakdownModal(subtasks) {
    const subtaskList = document.getElementById('ai-subtask-list');
    subtaskList.innerHTML = '';
    if (!subtasks || subtasks.length === 0) {
        subtaskList.innerHTML = '<p class="empty-message">No sub-tasks found.</p>';
        return;
    }
    subtasks.forEach((subtask) => {
        const item = document.createElement('div');
        item.className = 'subtask-item';
        item.innerHTML = `<span>${subtask.description}</span>`;
        subtaskList.appendChild(item);
    });
    document.getElementById('ai-breakdown-modal').classList.add('visible');
}

const aiBreakdownModalActions = document.querySelector('#ai-breakdown-modal .modal-actions');
aiBreakdownModalActions.innerHTML = '';

const aiBreakdownModal = document.getElementById('ai-breakdown-modal');
const aiBreakdownCloseBtn = aiBreakdownModal.querySelector('.modal-close-btn');
aiBreakdownCloseBtn.addEventListener('click', () => {
    aiBreakdownModal.classList.remove('visible');
});
document.addEventListener("DOMContentLoaded", () => {
    const userInfo = JSON.parse(localStorage.getItem("snapTaskUserInfo"));

    if (userInfo) {
        const profileImg = document.getElementById("profile-picture");
        const userName = document.getElementById("profile-user-name");

        if (userInfo.picture) {
            profileImg.src = userInfo.picture;

            // Optional fallback if Google image fails
            profileImg.onerror = () => {
                profileImg.src = "/static/assets/default-profile.png";
            };
        }

        if (userInfo.name) {
            userName.textContent = userInfo.name;
        }
    } else {
        console.warn("No user info found in localStorage.");
    }
});

