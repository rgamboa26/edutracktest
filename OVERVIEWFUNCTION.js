document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    loadUserTasks();
});

const currentUser = 'member1';

function addTask() {
    const taskName = document.getElementById('task-name').value;
    const taskDue = document.getElementById('task-due').value;
    const assignMember = document.getElementById('assign-member').value;

    if (!taskName || !taskDue || !assignMember) {
        alert('Please fill in all fields');
        return;
    }

    const normalizedDueDate = new Date(taskDue);
    normalizedDueDate.setHours(0, 0, 0, 0); // Set time to midnight

    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks.push({ name: taskName, due: normalizedDueDate.toISOString().split('T')[0], member: assignMember, status: 'not-started' });
    localStorage.setItem('tasks', JSON.stringify(tasks));

    alert('Task added successfully');
    loadTasks();
    loadUserTasks();

    const events = JSON.parse(localStorage.getItem('events')) || {};
    const dueDateKey = normalizedDueDate.toISOString().split('T')[0];
    if (!events[dueDateKey]) {
        events[dueDateKey] = [];
    }
    events[dueDateKey].push(taskName);
    localStorage.setItem('events', JSON.stringify(events));
}

function removeTask() {
    const taskName = document.getElementById('remove-task-name').value;

    if (!taskName) {
        alert('Please select a task to remove');
        return;
    }

    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const taskToRemove = tasks.find(task => task.name === taskName);

    if (taskToRemove) {

        tasks = tasks.filter(task => task.name !== taskName);
        localStorage.setItem('tasks', JSON.stringify(tasks));

        const events = JSON.parse(localStorage.getItem('events')) || {};
        const dueDateKey = taskToRemove.due;
        if (events[dueDateKey]) {
            events[dueDateKey] = events[dueDateKey].filter(event => event !== taskName);
            if (events[dueDateKey].length === 0) {
                delete events[dueDateKey];
            }
            localStorage.setItem('events', JSON.stringify(events));
        }

        alert('Task removed successfully');
        loadTasks();
        loadUserTasks();
        updateOverviewTable();
    } else {
        alert('Task not found!');
    }
}

function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const removeTaskSelect = document.getElementById('remove-task-name');

    if (removeTaskSelect) {
        removeTaskSelect.innerHTML = '<option value="" disabled selected>Select a task to remove</option>';
        tasks.forEach(task => {
            const option = document.createElement('option');
            option.value = task.name;
            option.textContent = task.name;
            removeTaskSelect.appendChild(option);
        });
    }
}

function updateOverviewTable() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const overviewTableBody = document.querySelector('#overview-table-body');

    if (overviewTableBody) {
        overviewTableBody.innerHTML = '';

        const todoTasks = tasks.filter(task => task.status === 'not-started');
        const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
        const completedTasks = tasks.filter(task => task.status === 'completed');

        const maxRows = Math.max(todoTasks.length, inProgressTasks.length, completedTasks.length);

        for (let i = 0; i < maxRows; i++) {
            const newRow = document.createElement('tr');

            newRow.innerHTML = `
                <td>${todoTasks[i] ? `<div class="box todo"><p class="overviewText">${todoTasks[i].name}</p></div>` : ''}</td>
                <td>${inProgressTasks[i] ? `<div class="box in-progress"><p class="overviewText">${inProgressTasks[i].name}</p></div>` : ''}</td>
                <td>${completedTasks[i] ? `<div class="box completed"><p class="overviewText">${completedTasks[i].name}</p></div>` : ''}</td>
            `;

            overviewTableBody.appendChild(newRow);
        }
    }
}

function loadUserTasks() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const taskList = document.getElementById('tasks');
    const searchInput = document.getElementById('task-search');
    const statusFilter = document.getElementById('status-filter');
    const currentUser = window.currentUser || localStorage.getItem('currentUser') || 'member1';

    if (!taskList) {
        console.error('Task list element not found!');
        return;
    }

    // filter values
    const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const statusValue = statusFilter ? statusFilter.value : 'all';

    // filter task base on user
    let userTasks = tasks.filter(task => task.member === currentUser);
    if (searchValue) {
        userTasks = userTasks.filter(task => task.name.toLowerCase().includes(searchValue));
    }
    if (statusValue !== 'all') {
        userTasks = userTasks.filter(task => task.status === statusValue);
    }

    taskList.innerHTML = '';
    userTasks.forEach(task => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span>${task.name} - ${task.type ? task.type : ''} - ${task.member}</span>
            <select onchange="changeTaskStatus('${task.name}', this.value)">
                <option value="not-started" ${task.status === 'not-started' ? 'selected' : ''}>Not Started</option>
                <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
        `;
        taskList.appendChild(listItem);
    });
}

function changeTaskStatus(taskName, newStatus) {
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let updatedStatus = newStatus;

    if (newStatus === 'completed') {
        updatedStatus = 'in-progress';

        let pendingReviews = JSON.parse(localStorage.getItem('pendingReviews')) || [];
        const taskObj = tasks.find(task => task.name === taskName);
        if (taskObj && !pendingReviews.some(t => t.name === taskName)) {
            pendingReviews.push(taskObj);
            localStorage.setItem('pendingReviews', JSON.stringify(pendingReviews));
        }

        alert('Task is pending review and must be approved before completion.');
    }

    tasks = tasks.map(task => {
        if (task.name === taskName) {
            task.status = updatedStatus;
        }
        return task;
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
    loadUserTasks();
    if (typeof updateOverviewTable === 'function') updateOverviewTable();
}

function updateTaskStatus(task, columnIndex, ticketElement) {
    let newStatus = '';
    if (columnIndex === 0) {
        task.status = 'not-started';
        ticketElement.className = 'box todo';
        newStatus = 'Not Started';
    } else if (columnIndex === 1) {
        task.status = 'in-progress';
        ticketElement.className = 'box in-progress';
        newStatus = 'In Progress';
    } else if (columnIndex === 2) {

        task.status = 'in-progress';
        ticketElement.className = 'box in-progress';
        newStatus = 'Pending Review';

        let pendingReviews = JSON.parse(localStorage.getItem('pendingReviews')) || [];
        if (!pendingReviews.some(t => t.name === task.name)) {
            pendingReviews.push(task);
            localStorage.setItem('pendingReviews', JSON.stringify(pendingReviews));
        }

        alert('Task is pending review and must be approved before completion.');
    }

    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const taskIndex = tasks.findIndex(t => t.name === task.name);
    if (taskIndex !== -1) {
        tasks[taskIndex] = task;
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    if (typeof updateOverviewTable === 'function') updateOverviewTable();
}