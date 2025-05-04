document.addEventListener('DOMContentLoaded', () => {
    updateOverviewTable();
    setupMemberClickEvents();
    loadRecentUpdates();
});

const currentUser = 'member1'; // assume the current user is "member1"
const members = {
    member1: 'John Carlo Bauzon',
    member2: 'Zidane Condino',
    member3: 'Rhamuel Gamboa',
    member4: 'Brent Tarog',
    member5: 'Timothy Villegas',
};

const memberImages = {
    member1: 'long.jpg',
    member2: 'zidane.jpg',
    member3: 'rham.jpg',
    member4: 'brent.jpg',
    member5: 'tim.jpg',
};

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
                <td ondrop="drop(event)" ondragover="allowDrop(event)">
                    ${todoTasks[i] ? `<div class="box todo" id="task-${todoTasks[i].name}" draggable="${todoTasks[i].member === currentUser}" ondragstart="drag(event)"><p class="overviewText">${todoTasks[i].name}</p></div>` : ''}
                </td>
                <td ondrop="drop(event)" ondragover="allowDrop(event)">
                    ${inProgressTasks[i] ? `<div class="box in-progress" id="task-${inProgressTasks[i].name}" draggable="${inProgressTasks[i].member === currentUser}" ondragstart="drag(event)"><p class="overviewText">${inProgressTasks[i].name}</p></div>` : ''}
                </td>
                <td ondrop="drop(event)" ondragover="allowDrop(event)">
                    ${completedTasks[i] ? `<div class="box completed" id="task-${completedTasks[i].name}" draggable="${completedTasks[i].member === currentUser}" ondragstart="drag(event)"><p class="overviewText">${completedTasks[i].name}</p></div>` : ''}
                </td>
            `;

            overviewTableBody.appendChild(newRow);
        }
    }
}

function allowDrop(event) {
    event.preventDefault(); // pang drop
}

function drag(event) {
    event.dataTransfer.setData("text", event.target.id); // store drage ID
}

function drop(event) {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("text"); // get dragg ID
    const ticket = document.getElementById(ticketId); // get drag
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const taskName = ticketId.replace('task-', '');
    const task = tasks.find(t => t.name === taskName);

    if (!task || task.member !== currentUser) {
        alert("You can only move tasks assigned to you.");
        return;
    }

    const targetCell = event.target.closest('td');
    if (!targetCell) return;

    // check if column is empty
    if (targetCell.querySelector('.box')) {
        // find next empty row
        let nextRow = targetCell.parentElement.nextElementSibling;
        while (nextRow) {
            const nextCell = nextRow.children[targetCell.cellIndex];
            if (!nextCell.querySelector('.box')) {
                nextCell.appendChild(ticket);

                // update task status localstorage
                updateTaskStatus(task, targetCell.cellIndex, ticket);
                return;
            }
            nextRow = nextRow.nextElementSibling;
        }

        // if no avail row, create new
        const overviewTableBody = document.querySelector('#overview-table-body');
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td></td>
            <td></td>
            <td></td>
        `;
        overviewTableBody.appendChild(newRow);

        const newCell = newRow.children[targetCell.cellIndex];
        newCell.appendChild(ticket);

        updateTaskStatus(task, targetCell.cellIndex, ticket);
        return;
    }

    targetCell.appendChild(ticket);

    updateTaskStatus(task, targetCell.cellIndex, ticket);
}

function updateTaskStatus(task, columnIndex, ticketElement) {

    let newStatus = '';
    if (columnIndex === 0) {
        task.status = 'not-started';
        ticketElement.className = 'box todo'; // update for new stat
        newStatus = 'Not Started';
    } else if (columnIndex === 1) {
        task.status = 'in-progress';
        ticketElement.className = 'box in-progress'; 
        newStatus = 'In Progress';
    } else if (columnIndex === 2) {
        task.status = 'completed';
        ticketElement.className = 'box completed'; 
        newStatus = 'Completed';
    }

    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const taskIndex = tasks.findIndex(t => t.name === task.name);
    if (taskIndex !== -1) {
        tasks[taskIndex] = task;
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }


    logTaskUpdate(task.member, task.name, newStatus);
}

function logTaskUpdate(memberId, taskName, newStatus) {
    const memberName = members[memberId];
    const profileImage = memberImages[memberId] || 'default.jpg';
    const updateMessage = ` has updated their task "${taskName}" to "${newStatus}".`;

    // add to recent updates
    const recentUpdates = document.querySelector('.recent-updates .updates');
    const updateDiv = document.createElement('div');
    updateDiv.classList.add('update');
    updateDiv.innerHTML = `
        <div>
            <img class="profile-photo" src="./images/${profileImage}" />
            <p class="message">
                <b>${memberName}</b> ${updateMessage}
            </p>
            <small class="text-muted">${new Date().toLocaleTimeString()}</small>
        </div>
    `;
    recentUpdates.prepend(updateDiv);

    // member updates
    const memberUpdates = JSON.parse(localStorage.getItem('memberUpdates')) || {};
    if (!memberUpdates[memberId]) {
        memberUpdates[memberId] = [];
    }
    memberUpdates[memberId].push(updateMessage);
    localStorage.setItem('memberUpdates', JSON.stringify(memberUpdates));

    const allRecentUpdates = JSON.parse(localStorage.getItem('recentUpdates')) || [];
    allRecentUpdates.unshift({
        memberId,
        memberName,
        message: updateMessage,
        time: new Date().toLocaleTimeString(),
        profileImage,
    });
    localStorage.setItem('recentUpdates', JSON.stringify(allRecentUpdates));
}

function loadRecentUpdates() {
    const recentUpdates = JSON.parse(localStorage.getItem('recentUpdates')) || [];
    const updatesContainer = document.querySelector('.recent-updates .updates');

    updatesContainer.innerHTML = ''; 

    recentUpdates.forEach(update => {
        const updateDiv = document.createElement('div');
        updateDiv.classList.add('update');
        updateDiv.innerHTML = `
            <div>
                <img class="profile-photo" src="./images/${update.profileImage}" />
                <p class="message">
                    <b>${update.memberName}</b> ${update.message}
                </p>
                <small class="text-muted">${update.time}</small>
            </div>
        `;
        updatesContainer.appendChild(updateDiv);
    });
}

function setupMemberClickEvents() {
    const groupListItems = document.querySelectorAll('.groupList');
    const modal = document.getElementById('member-updates-modal');
    const modalMemberName = document.getElementById('modal-member-name');
    const modalUpdates = document.getElementById('modal-updates');
    const closeButton = document.querySelector('.close-button');

    groupListItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            const memberId = `member${index + 1}`;
            const memberUpdates = JSON.parse(localStorage.getItem('memberUpdates')) || {};
            const updates = memberUpdates[memberId] || [];

            // latest first
            const reversedUpdates = updates.slice().reverse();

            // modal contnet
            modalMemberName.textContent = `Updates for ${members[memberId]}`;
            modalUpdates.innerHTML = reversedUpdates.length
                ? reversedUpdates.map(update => `<p>${update}</p>`).join('')
                : '<p>No updates available.</p>';

            // Show modal
            modal.style.display = 'block';
        });
    });

    // close modal
    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // close modal
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}