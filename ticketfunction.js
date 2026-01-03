// client-side db using IndexedDB

const DB_NAME = 'edutrackTickets';
const DB_VERSION = 1;
const DEFAULT_USER = { name: 'John Carlo Bauzon', role: 'admin', email: 'member1@edutrack.local' };
const MEMBERS = {
    member1: { id: 'member1', name: 'John Carlo Bauzon', email: 'member1@edutrack.local' },
    member2: { id: 'member2', name: 'Zidane Condino', email: 'member2@edutrack.local' },
    member3: { id: 'member3', name: 'Rhamuel Gamboa', email: 'member3@edutrack.local' },
    member4: { id: 'member4', name: 'Brent Tarog', email: 'member4@edutrack.local' },
    member5: { id: 'member5', name: 'Timothy Villegas', email: 'member5@edutrack.local' },
};
const STATUS_FLOW = {
    new: 'open',
    open: 'pending_review',
    pending_review: 'resolved',
    resolved: 'closed',
    closed: 'reopened',
    reopened: 'open',
};

const ROLE_PERMISSIONS = {
    enduser: ['create', 'update_own', 'comment'],
    agent: ['create', 'update', 'assign', 'transition', 'comment'],
    admin: ['create', 'update', 'assign', 'transition', 'comment', 'manage_users'],
};

let db;

document.addEventListener('DOMContentLoaded', () => {
    initCurrentUser();
    initDb().then(() => {
        hydrateTicketTable();
        hydrateAuditFeed();
    });
    populateAssigneeSelect();
    wireUi();
});

function wireUi() {
    const ticketForm = document.getElementById('ticket-form');
    const ticketTableBody = document.getElementById('ticket-rows');
    const searchForm = document.getElementById('ticket-search-form');
    const searchInput = document.getElementById('ticket-search-input');

    if (ticketForm) {
        ticketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(ticketForm);
            const currentUser = getCurrentUser();
            if (!hasPermission(currentUser, 'create')) {
                alert('You do not have permission to create tickets.');
                return;
            }

            const attachments = await readAttachments(formData.getAll('attachments'));
            const ticket = buildTicketPayload(formData, currentUser, attachments);
            await createTicket(ticket);
            ticketForm.reset();
            populateAssigneeSelect();
            hydrateTicketTable();
            hydrateAuditFeed();
        });
    }

    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (!query) return;
            const match = await findTicketByIdOrPrefix(query);
            if (match) {
                await showTicketDetails(match.id);
            } else {
                alert('No ticket found for that ID.');
            }
        });
    }

    if (ticketTableBody) {
        ticketTableBody.addEventListener('click', async (e) => {
            const action = e.target.getAttribute('data-action');
            const ticketId = e.target.getAttribute('data-id');
            
            // If clicking on ticket title or row (not button), show details
            if (!action && ticketId) {
                await showTicketDetails(ticketId);
                return;
            }
            
            if (!action || !ticketId) return;

            const currentUser = getCurrentUser();
            if (action === 'transition') {
                await transitionTicket(ticketId, currentUser);
                hydrateTicketTable();
                hydrateAuditFeed();
            } else if (action === 'reopen') {
                await setStatus(ticketId, 'reopened', currentUser);
                hydrateTicketTable();
                hydrateAuditFeed();
            } else if (action === 'audit') {
                await showAudit(ticketId);
            } else if (action === 'view') {
                await showTicketDetails(ticketId);
            }
        });
    }
}

function initCurrentUser() {
    const saved = getCurrentUser();
    localStorage.setItem('currentUser', JSON.stringify(saved));
    renderCurrentUser(saved);
}

function getCurrentUser() {
    return { ...DEFAULT_USER };
}

function renderCurrentUser(user) {
    const badge = document.getElementById('current-user-badge');
    if (badge) {
        badge.textContent = `${user.name || 'Anonymous'} (${user.role || 'enduser'})`;
    }
    const nameField = document.getElementById('userName');
    const roleField = document.getElementById('userRole');
    if (nameField) nameField.value = user.name || '';
    if (roleField) roleField.value = user.role || 'enduser';
}

function populateAssigneeSelect() {
    const select = document.getElementById('assigneeId');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Unassigned</option>';
    Object.values(MEMBERS).forEach((member) => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        select.appendChild(option);
    });
    if (currentValue) select.value = currentValue;
}

function hasPermission(user, permission) {
    const role = user?.role || 'enduser';
    return ROLE_PERMISSIONS[role]?.includes(permission);
}

async function initDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            db = req.result;
            resolve();
        };
        req.onupgradeneeded = () => {
            db = req.result;
            if (!db.objectStoreNames.contains('tickets')) {
                const store = db.createObjectStore('tickets', { keyPath: 'id' });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('assignee', 'assignee.email', { unique: false });
                store.createIndex('requester', 'requester.email', { unique: false });
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

async function createTicket(ticket) {
    await putTicket(ticket);
    await addAudit(ticket.id, 'created', { by: ticket.requester, status: ticket.status });
}

async function findTicketByIdOrPrefix(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;

    // Try direct get first (full ID)
    const direct = await getTicket(query);
    if (direct) return direct;

    // Fallback to prefix search across all tickets
    const tickets = await getAllTickets();
    return tickets.find(t => t.id.toLowerCase().startsWith(normalized)) || null;
}

function buildTicketPayload(formData, currentUser, attachments) {
    const now = new Date().toISOString();
    const assigneeId = formData.get('assigneeId');
    const assignee = assigneeId ? getMemberById(assigneeId) : null;
    return {
        id: crypto.randomUUID(),
        title: formData.get('title'),
        description: formData.get('description'),
        category: formData.get('category') || 'general',
        type: formData.get('type') || 'request',
        priority: formData.get('priority') || 'low',
        status: 'new',
        source: formData.get('source') || 'web',
        tags: (formData.get('tags') || '').split(',').map(t => t.trim()).filter(Boolean),
        attachments,
        requester: {
            name: currentUser.name,
            role: currentUser.role,
        },
        assignee: assignee
            ? { id: assignee.id, name: assignee.name, email: assignee.email }
            : null,
        createdAt: now,
        updatedAt: now,
            history: [
                { status: 'new', at: now, by: currentUser.name },
            ],
    };
}

async function readAttachments(files) {
    const attachments = [];
    for (const file of files) {
        if (!(file instanceof File)) continue;
        const data = await fileToDataUrl(file);
        attachments.push({ name: file.name, type: file.type, data });
    }
    return attachments;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function hydrateTicketTable() {
    const tbody = document.getElementById('ticket-rows');
    if (!tbody) return;
    const tickets = await getAllTickets();
    tbody.innerHTML = '';
    tickets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    tickets.forEach((ticket) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${ticket.id.slice(0, 8)}</td>
            <td class="ticket-title-cell" data-id="${ticket.id}" style="cursor: pointer; color: var(--color-primary); font-weight: 500;">${ticket.title}</td>
            <td><span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span></td>
            <td><span class="status-badge status-${ticket.status}">${ticket.status}</span></td>
            <td>${ticket.assignee?.name || 'Unassigned'}</td>
            <td>${new Date(ticket.updatedAt).toLocaleString()}</td>
            <td>
                <button class="btn-link" data-action="view" data-id="${ticket.id}">View</button>
                <button class="btn-link" data-action="audit" data-id="${ticket.id}">Audit</button>
                ${renderStatusButtons(ticket)}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderStatusButtons(ticket) {
    const currentUser = getCurrentUser();
    if (!hasPermission(currentUser, 'transition')) return '';
    const next = STATUS_FLOW[ticket.status];
    if (!next) return '';
    if (next === 'resolved') {
        return '<span class="status-note">Resolve via Review page</span>';
    }
    const label = next === 'pending_review' ? 'Send for Reviewing' : `Move to ${next}`;
    const reopenBtn = ticket.status === 'closed' ? `<button class="btn-link" data-action="reopen" data-id="${ticket.id}">Reopen</button>` : '';
    return `
        <button class="btn-link" data-action="transition" data-id="${ticket.id}">${label}</button>
        ${reopenBtn}
    `;
}

async function hydrateAuditFeed() {
    const feed = document.getElementById('audit-feed');
    if (!feed) return;
    const entries = await getRecentAudit();
    feed.innerHTML = '';
    entries.forEach((entry) => {
        const li = document.createElement('li');
        li.textContent = `[${new Date(entry.at).toLocaleString()}] Ticket ${entry.ticketId.slice(0, 8)}: ${entry.action}`;
        feed.appendChild(li);
    });
}

async function showAudit(ticketId) {
    const modal = document.getElementById('audit-modal');
    const body = document.getElementById('audit-modal-body');
    if (!modal || !body) return;
    const entries = await getAuditForTicket(ticketId);
    body.innerHTML = entries
        .map((e) => `<p><strong>${new Date(e.at).toLocaleString()}</strong> - ${e.action} by ${e.by || 'system'} ${e.details ? `(${e.details})` : ''}</p>`)
        .join('') || '<p>No audit records yet.</p>';
    modal.style.display = 'block';
    const close = document.getElementById('audit-modal-close');
    close.onclick = () => { modal.style.display = 'none'; };
    window.onclick = (event) => { if (event.target === modal) modal.style.display = 'none'; };
}

async function showTicketDetails(ticketId) {
    const modal = document.getElementById('ticket-detail-modal');
    const body = document.getElementById('ticket-detail-body');
    if (!modal || !body) return;
    
    const ticket = await getTicket(ticketId);
    if (!ticket) return;
    
    const tagsHtml = ticket.tags?.length 
        ? ticket.tags.map(tag => `<span class="tag-chip">${tag}</span>`).join('')
        : '<em>No tags</em>';
    
    const attachmentsHtml = ticket.attachments?.length
        ? ticket.attachments.map(att => `
            <div class="attachment-item">
                <span class="material-icons-sharp">attach_file</span>
                <a href="${att.data}" download="${att.name}">${att.name}</a>
            </div>
        `).join('')
        : '<em>No attachments</em>';
    
    const historyHtml = ticket.history?.length
        ? ticket.history.map(h => `
            <div class="history-item">
                <strong>${new Date(h.at).toLocaleString()}</strong> - Status changed to <span class="status-badge status-${h.status}">${h.status}</span> by ${h.by}
            </div>
        `).join('')
        : '<em>No history</em>';
    
    body.innerHTML = `
        <div class="ticket-detail-header">
            <h2>${ticket.title}</h2>
            <span class="status-badge status-${ticket.status}">${ticket.status}</span>
        </div>
        
        <div class="ticket-detail-grid">
            <div class="detail-section">
                <label>Ticket ID</label>
                <p>${ticket.id}</p>
            </div>
            
            <div class="detail-section">
                <label>Priority</label>
                <p><span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span></p>
            </div>
            
            <div class="detail-section">
                <label>Type</label>
                <p>${ticket.type}</p>
            </div>
            
            <div class="detail-section">
                <label>Category</label>
                <p>${ticket.category}</p>
            </div>
            
            <div class="detail-section">
                <label>Source</label>
                <p>${ticket.source}</p>
            </div>
            
            <div class="detail-section">
                <label>Created</label>
                <p>${new Date(ticket.createdAt).toLocaleString()}</p>
            </div>
            
            <div class="detail-section">
                <label>Updated</label>
                <p>${new Date(ticket.updatedAt).toLocaleString()}</p>
            </div>
            
            <div class="detail-section">
                <label>Requester</label>
                <p>${ticket.requester.name}</p>
            </div>
            
            <div class="detail-section">
                <label>Assignee</label>
                <p>${ticket.assignee ? `${ticket.assignee.name} (${ticket.assignee.email})` : 'Unassigned'}</p>
            </div>
        </div>
        
        <div class="detail-section-full">
            <label>Description</label>
            <div class="description-box">${ticket.description}</div>
        </div>
        
        <div class="detail-section-full">
            <label>Tags</label>
            <div class="tags-container">${tagsHtml}</div>
        </div>
        
        <div class="detail-section-full">
            <label>Attachments</label>
            <div class="attachments-container">${attachmentsHtml}</div>
        </div>
        
        <div class="detail-section-full">
            <label>History</label>
            <div class="history-container">${historyHtml}</div>
        </div>
    `;
    
    modal.style.display = 'block';
    const close = document.getElementById('ticket-detail-close');
    close.onclick = () => { modal.style.display = 'none'; };
    window.onclick = (event) => { if (event.target === modal) modal.style.display = 'none'; };
}

async function transitionTicket(ticketId, actor) {
    const ticket = await getTicket(ticketId);
    if (!ticket) return;
    const nextStatus = STATUS_FLOW[ticket.status];
    if (!nextStatus) return;
    await setStatus(ticketId, nextStatus, actor);
}

async function setStatus(ticketId, status, actor) {
    const ticket = await getTicket(ticketId);
    if (!ticket) return;
    const now = new Date().toISOString();
    const history = ticket.history || [];
    history.push({ status, at: now, by: actor.email || actor.name });
    await updateTicket(ticketId, { status, updatedAt: now, history });
    await addAudit(ticketId, `status:${status}`, { by: actor, status });
}

async function putTicket(ticket) {
    return new Promise((resolve, reject) => {
        const request = tx('tickets', 'readwrite').put(ticket);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function updateTicket(id, patch) {
    const ticket = await getTicket(id);
    if (!ticket) return;
    const updated = { ...ticket, ...patch };
    await putTicket(updated);
}

async function getTicket(id) {
    return new Promise((resolve, reject) => {
        const request = tx('tickets').get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllTickets() {
    return new Promise((resolve, reject) => {
        const request = tx('tickets').getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function addAudit(ticketId, action, details) {
    const entry = {
        ticketId,
        action,
        details: JSON.stringify(details || {}),
        at: new Date().toISOString(),
        by: details?.by?.name || 'system',
    };
    return new Promise((resolve, reject) => {
        const request = tx('audit', 'readwrite').add(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function getMemberById(id) {
    return MEMBERS[id] || null;
}

async function getAuditForTicket(ticketId) {
    return new Promise((resolve, reject) => {
        const store = tx('audit');
        const index = store.index('ticketId');
        const request = index.getAll(ticketId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function getRecentAudit(limit = 10) {
    return new Promise((resolve, reject) => {
        const store = tx('audit');
        const entries = [];
        const cursorReq = store.openCursor(null, 'prev');
        cursorReq.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && entries.length < limit) {
                entries.push(cursor.value);
                cursor.continue();
            } else {
                resolve(entries);
            }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
    });
}