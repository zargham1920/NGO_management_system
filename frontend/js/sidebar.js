/**
 * sidebar.js — Renders the sidebar and handles navigation
 * Included in every page via <script src="../js/sidebar.js">
 */
function renderSidebar(activePage) {
  const navItems = [
    { page: 'dashboard',      icon: '📊', label: 'Dashboard',        href: 'dashboard.html' },
    { page: 'beneficiaries',  icon: '👥', label: 'Beneficiaries',    href: 'beneficiaries.html' },
    { page: 'donors',         icon: '💰', label: 'Donors',           href: 'donors.html' },
    { page: 'donations',      icon: '🎁', label: 'Donations',        href: 'donations.html' },
    { page: 'projects',       icon: '🏗️', label: 'Projects',         href: 'projects.html' },
    { page: 'volunteers',     icon: '🙋', label: 'Volunteers',       href: 'volunteers.html' },
    { page: 'inventory',      icon: '📦', label: 'Inventory',        href: 'inventory.html' },
    { page: 'distributions',  icon: '🚚', label: 'Aid Distribution', href: 'distributions.html' },
    { page: 'reports',        icon: '📈', label: 'Reports',          href: 'reports.html' },
  ];

  const adminItems = [
    { page: 'users',          icon: '⚙️',  label: 'User Management',  href: 'users.html', role: 'NGO Admin' },
  ];

  const user = API.getUser();

  const navHTML = navItems.map(item => `
    <a href="${item.href}" class="nav-item ${activePage === item.page ? 'active' : ''}" data-page="${item.page}">
      <span class="icon">${item.icon}</span> ${item.label}
    </a>`).join('');

  const adminHTML = user && user.role === 'NGO Admin' ? `
    <div class="nav-section-label">Administration</div>
    ${adminItems.map(item => `
      <a href="${item.href}" class="nav-item ${activePage === item.page ? 'active' : ''}" data-page="${item.page}">
        <span class="icon">${item.icon}</span> ${item.label}
      </a>`).join('')}` : '';

  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  sidebarEl.innerHTML = `
    <div class="sidebar-logo">
      <h1>🌿 Umeed-e-Sahar</h1>
      <p>Resource Distribution Management</p>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">Main Menu</div>
      ${navHTML}
      ${adminHTML}
    </nav>
    <div class="sidebar-footer">
      <div class="user-pill">
        <div class="user-avatar" id="user-avatar">U</div>
        <div class="user-info">
          <p id="user-name">Loading…</p>
          <span id="user-role"></span>
        </div>
      </div>
      <button class="logout-btn" onclick="handleLogout()">🚪 Logout</button>
    </div>`;

  // Populate user info
  if (user) {
    const avatarEl = document.getElementById('user-avatar');
    const nameEl   = document.getElementById('user-name');
    const roleEl   = document.getElementById('user-role');
    if (avatarEl) avatarEl.textContent = user.name ? user.name[0].toUpperCase() : 'U';
    if (nameEl)   nameEl.textContent   = user.name || 'User';
    if (roleEl)   roleEl.textContent   = user.role || '';
  }
}

async function handleLogout() {
  try { await API.auth.logout(); } catch (_) {}
  API.clearAuth();
  window.location.href = '../index.html';
}

window.renderSidebar = renderSidebar;
window.handleLogout  = handleLogout;
