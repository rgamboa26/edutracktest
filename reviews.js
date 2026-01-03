// Review workflow using IndexedDB tickets: approve pending_review -> resolved

const DB_NAME = 'edutrackTickets';
const DB_VERSION = 1;

document.addEventListener('DOMContentLoaded', () => {
  initDb().then(loadPendingReviews);
});

let db;

function initDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onupgradeneeded = () => {
      db = req.result;
      if (!db.objectStoreNames.contains('tickets')) {
        const store = db.createObjectStore('tickets', { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('audit')) {
        const auditStore = db.createObjectStore('audit', { keyPath: 'entryId', autoIncrement: true });
        auditStore.createIndex('ticketId', 'ticketId', { unique: false });
      }
    };
  });
}

function tx(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function loadPendingReviews() {
  const reviewsList = document.getElementById('reviews-list');
  reviewsList.innerHTML = '';

  getTicketsByStatus('pending_review').then((tickets) => {
    if (!tickets.length) {
      reviewsList.innerHTML = '<li>No tickets are awaiting review.</li>';
      return;
    }

    tickets.forEach((ticket) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <div><strong>${ticket.title}</strong></div>
          <div class="review-meta">${ticket.id.slice(0,8)} • Priority: ${ticket.priority} • Assignee: ${ticket.assignee?.name || 'Unassigned'}</div>
        </div>
      `;

      const approveBtn = document.createElement('button');
      approveBtn.textContent = 'Approve & Resolve';
      approveBtn.className = 'approve-btn';
      approveBtn.onclick = async function() {
        await approveTicket(ticket.id);
        loadPendingReviews();
      };

      li.appendChild(approveBtn);
      reviewsList.appendChild(li);
    });
  });
}

async function getTicketsByStatus(status) {
  const tickets = await new Promise((resolve, reject) => {
    const store = tx('tickets');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  return tickets.filter(t => t.status === status);
}

async function approveTicket(ticketId) {
  const ticket = await getTicket(ticketId);
  if (!ticket) return;
  const now = new Date().toISOString();
  const history = ticket.history || [];
  history.push({ status: 'resolved', at: now, by: 'Reviewer' });

  const updated = { ...ticket, status: 'resolved', updatedAt: now, history };
  await putTicket(updated);
  await addAudit(ticketId, 'status:resolved', { by: { name: 'Reviewer' }, status: 'resolved' });
}

async function getTicket(id) {
  return new Promise((resolve, reject) => {
    const request = tx('tickets').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putTicket(ticket) {
  return new Promise((resolve, reject) => {
    const request = tx('tickets', 'readwrite').put(ticket);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function addAudit(ticketId, action, details) {
  const entry = {
    ticketId,
    action,
    details: JSON.stringify(details || {}),
    at: new Date().toISOString(),
    by: details?.by?.name || 'reviewer',
  };
  return new Promise((resolve, reject) => {
    const request = tx('audit', 'readwrite').add(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}








