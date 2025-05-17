document.addEventListener('DOMContentLoaded', loadPendingReviews);

function loadPendingReviews() {
  const reviewsList = document.getElementById('reviews-list');
  reviewsList.innerHTML = '';
  const pendingReviews = JSON.parse(localStorage.getItem('pendingReviews')) || [];
  const currentUser = window.currentUser || localStorage.getItem('currentUser') || 'member1';

  if (pendingReviews.length === 0) {
    reviewsList.innerHTML = '<li>No tasks are awaiting review.</li>';
    return;
  }
  pendingReviews.forEach(task => {
    const li = document.createElement('li');
    li.textContent = `${task.name} (Assigned to: ${task.member})`;
    if (currentUser === 'member1') {
      const approveBtn = document.createElement('button');
      approveBtn.textContent = 'Approve';
      approveBtn.className = 'approve-btn';
      approveBtn.onclick = function() {
        approveTask(task.name);
      };
      li.appendChild(approveBtn);
    }
    reviewsList.appendChild(li);
  });
}

function approveTask(taskName) {
  // remove from pending 
  let pendingReviews = JSON.parse(localStorage.getItem('pendingReviews')) || [];
  pendingReviews = pendingReviews.filter(task => task.name !== taskName);
  localStorage.setItem('pendingReviews', JSON.stringify(pendingReviews));

  // set to completed in tasks
  let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  tasks = tasks.map(task => {
    if (task.name === taskName) {
      task.status = 'completed';
    }
    return task;
  });
  localStorage.setItem('tasks', JSON.stringify(tasks));

  loadPendingReviews();
  if (typeof updateOverviewTable === 'function') updateOverviewTable();
}








