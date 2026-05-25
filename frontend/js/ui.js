/**
 * ui.js — Shared UI helpers: toast, modal, confirm dialog, skeleton, sidebar
 */

// ── Toast Notifications ───────────────────────────────────────────────────────
(function initToastContainer() {
  if (!document.getElementById('toast-container')) {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
})();

function showToast(message, type = 'success', detail = '') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || '📢'}</span>
    <div class="toast-text">
      <p>${message}</p>
      ${detail ? `<span>${detail}</span>` : ''}
    </div>`;

  const container = document.getElementById('toast-container');
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'fadeOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function showConfirm(message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <div class="modal-header">
        <h3>⚠️ Confirm Action</h3>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:.9rem;">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="conf-cancel">Cancel</button>
        <button class="btn btn-danger"    id="conf-ok">Delete</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#conf-cancel').onclick = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };
  overlay.querySelector('#conf-ok').onclick = () => {
    overlay.remove();
    onConfirm();
  };
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
}

// ── Sidebar active state ──────────────────────────────────────────────────────
function setSidebarActive(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

// ── Populate user info in sidebar ─────────────────────────────────────────────
function populateSidebarUser() {
  const user = API.getUser();
  if (!user) return;

  const avatarEl = document.getElementById('user-avatar');
  const nameEl   = document.getElementById('user-name');
  const roleEl   = document.getElementById('user-role');

  if (avatarEl) avatarEl.textContent = user.name ? user.name[0].toUpperCase() : 'U';
  if (nameEl)   nameEl.textContent   = user.name  || 'User';
  if (roleEl)   roleEl.textContent   = user.role  || '';
}

// ── Role-based UI hiding ───────────────────────────────────────────────────────
function applyRoleVisibility() {
  const user = API.getUser();
  if (!user) return;

  // Hide elements that require specific roles
  document.querySelectorAll('[data-require-role]').forEach(el => {
    const roles = el.dataset.requireRole.split(',').map(r => r.trim());
    if (!roles.includes(user.role)) {
      el.style.display = 'none';
    }
  });
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function showTableSkeleton(tbodyId, cols = 5, rows = 5) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = Array(rows).fill('').map(() =>
    `<tr>${Array(cols).fill('').map(() =>
      `<td><div class="skeleton" style="height:16px;border-radius:4px;"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  return '₨ ' + Number(n).toLocaleString('en-PK');
}
function statusBadge(status) {
  const map = {
    'In Stock':    'badge-green',
    'Low Stock':   'badge-yellow',
    'Out of Stock':'badge-red',
    'Active':      'badge-green',
    'Ongoing':     'badge-blue',
    'Completed':   'badge-gray',
    'Pending':     'badge-yellow',
    'On Hold':     'badge-gray',
    'approved':    'badge-green',
    'pending':     'badge-yellow',
    'rejected':    'badge-red',
    'Received':    'badge-green',
    'Available':   'badge-green',
    'Busy':        'badge-yellow',
    'Inactive':    'badge-gray',
  };
  const cls = map[status] || 'badge-gray';
  return `<span class="badge ${cls}">${status || '—'}</span>`;
}

// ── Pagination renderer ───────────────────────────────────────────────────────
function renderPagination(containerId, total, page, totalPages, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const start = total === 0 ? 0 : ((page - 1) * 15) + 1;
  const end   = Math.min(page * 15, total);

  el.innerHTML = `
    <span>Showing ${start}–${end} of ${total} records</span>
    <div class="pagination-controls">
      <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="${onPageChange}(${page - 1})">← Prev</button>
      <button class="page-btn active">${page} of ${totalPages}</button>
      <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="${onPageChange}(${page + 1})">Next →</button>
    </div>`;
}

// ── Expose globals ────────────────────────────────────────────────────────────
window.UI = {
  showToast,
  showConfirm,
  openModal,
  closeModal,
  closeAllModals,
  setSidebarActive,
  populateSidebarUser,
  applyRoleVisibility,
  showTableSkeleton,
  fmtDate,
  fmtMoney,
  statusBadge,
  renderPagination,
};
