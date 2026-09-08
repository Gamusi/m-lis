// M-LIS Core State & Navigation Layer
window.app = window.app || {};

Object.assign(window.app, {
  currentUser: null,
  currentView: 'clients',
  theme: null,
  inactivityTimer: null,
  inactivityTimeout: 15 * 60 * 1000,
  lastActivityTime: 0,

  init: __async(function*() {
    yield this.loadTheme();
    yield this.checkAuth();
    this.setupInactivityListeners();
    this.setupGlobalKeyboardShortcuts();
  }),

  loadTheme: __async(function*() {
    try {
      let facData = null;
      try {
        const facRes = yield fetch('/api/config/facility?t=' + Date.now());
        if (facRes.ok) {
          facData = yield facRes.json();
        }
      } catch (err) {
        // Fallback gracefully if API not ready
      }

      const res = yield fetch('/assets/branding/theme.json?t=' + Date.now());
      if (res.ok) {
        this.theme = yield res.json();
      } else {
        this.theme = {};
      }

      if (facData) {
        this.theme.facility_name = facData.facility_name || this.theme.facility_name;
        this.theme.facility_acronym = facData.facility_acronym || this.theme.facility_acronym;
        this.facilitySettings = facData;
      }

      const appTitleEl = document.getElementById('app-title');
      const facNameEl = document.getElementById('facility-name');
      const footerEl = document.getElementById('footer-text');
      const logoEl = document.getElementById('header-logo');

      if (appTitleEl) appTitleEl.textContent = this.theme.app_title || 'M-LIS';
      if (facNameEl) facNameEl.textContent = this.theme.facility_name || 'Ahmadiyya Muslim Hospital';
      if (footerEl) footerEl.textContent = this.theme.footer_text || '© M-LIS 2026';
      if (logoEl) logoEl.src = this.theme.logo_path || '/assets/branding/logo_white.png';
    } catch (e) {
      console.warn('Theme loading warning:', e);
    }
  }),

  checkAuth: __async(function*() {
    try {
      const res = yield fetch('/api/auth/me');
      if (res.ok) {
        this.currentUser = yield res.json();
        this.renderUserNav();
        this.closeModal('login-modal');
        document.getElementById('app-nav').style.display = 'flex';
        this.startInactivityTimer();

        if (this.currentUser.password_reset_required) {
          this.showResetPasswordModal();
        } else {
          this.navigate(this.currentView);
        }
      } else {
        this.showLogin();
      }
    } catch (e) {
      this.showLogin();
    }
  }),

  showLogin: function(noticeMessage) {
    this.currentUser = null;
    this.stopInactivityTimer();
    this.cleanseDOM();
    document.getElementById('app-nav').style.display = 'none';
    document.getElementById('user-nav').innerHTML = '';
    this.openModal('login-modal');
    this.showLoginForm();
    if (noticeMessage) {
      const errDiv = document.getElementById('login-error');
      if (errDiv) {
        errDiv.textContent = noticeMessage;
        errDiv.style.display = 'block';
      }
    }
  },

  handleLogin: __async(function*(event) {
    event.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    const errDiv = document.getElementById('login-error');
    errDiv.style.display = 'none';

    try {
      const res = yield fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });

      if (res.ok) {
        const data = yield res.json();
        this.currentUser = data.user;
        this.closeModal('login-modal');
        document.getElementById('app-nav').style.display = 'flex';
        this.renderUserNav();
        this.startInactivityTimer();

        if (data.status === 'reset_required' || (data.user && data.user.password_reset_required)) {
          this.showResetPasswordModal();
        } else {
          this.navigate('clients');
        }
      } else {
        const err = yield res.json();
        errDiv.textContent = err.detail || 'Login failed';
        errDiv.style.display = 'block';
      }
    } catch (e) {
      errDiv.textContent = 'Connection error. Please try again.';
      errDiv.style.display = 'block';
    }
  }),

  handleLogout: __async(function*(noticeMessage) {
    this.stopInactivityTimer();
    yield fetch('/api/auth/logout', { method: 'POST' });
    this.showLogin(noticeMessage);
  }),

  showResetPasswordModal: function() {
    const modal = document.getElementById('reset-password-modal');
    if (modal) {
      this.openModal(modal);
      const err = document.getElementById('reset-password-error');
      if (err) {
        err.textContent = '';
        err.style.display = 'none';
      }
      const form = document.getElementById('reset-password-form');
      if (form) form.reset();
      const oldPw = document.getElementById('reset-old-password');
      if (oldPw) oldPw.focus();
    }
  },

  handleChangePassword: __async(function*(event) {
    event.preventDefault();
    const oldPassword = document.getElementById('reset-old-password').value;
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const errDiv = document.getElementById('reset-password-error');

    errDiv.style.display = 'none';

    if (!newPassword || newPassword.trim().length < 4) {
      errDiv.textContent = 'New password must be at least 4 characters.';
      errDiv.style.display = 'block';
      return;
    }

    if (newPassword !== confirmPassword) {
      errDiv.textContent = 'New password and confirmation do not match.';
      errDiv.style.display = 'block';
      return;
    }

    try {
      const res = yield fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        })
      });

      if (res.ok) {
        if (this.currentUser) {
          this.currentUser.password_reset_required = false;
        }
        this.closeModal('reset-password-modal');
        document.getElementById('reset-password-form').reset();
        this.showNotificationModal("Success", 'Password changed successfully!', false);
        this.navigate('clients');
      } else {
        const err = yield res.json();
        errDiv.textContent = err.detail || 'Failed to change password.';
        errDiv.style.display = 'block';
      }
    } catch (e) {
      errDiv.textContent = 'Connection error. Please try again.';
      errDiv.style.display = 'block';
    }
  }),

  showRegisterForm: function(event) {
    if (event) event.preventDefault();
    document.getElementById('login-form-container').style.display = 'none';
    const forgot = document.getElementById('forgot-password-container');
    if (forgot) forgot.style.display = 'none';
    document.getElementById('register-form-container').style.display = 'block';
    document.getElementById('register-error').style.display = 'none';
    document.getElementById('register-success').style.display = 'none';
  },

  showLoginForm: function(event) {
    if (event) event.preventDefault();
    document.getElementById('register-form-container').style.display = 'none';
    const forgot = document.getElementById('forgot-password-container');
    if (forgot) forgot.style.display = 'none';
    document.getElementById('login-form-container').style.display = 'block';
    document.getElementById('login-error').style.display = 'none';
  },

  showForgotPassword: function(event) {
    if (event) event.preventDefault();
    document.getElementById('login-form-container').style.display = 'none';
    document.getElementById('register-form-container').style.display = 'none';
    const forgot = document.getElementById('forgot-password-container');
    if (forgot) forgot.style.display = 'block';
  },

  handleRegister: __async(function*(event) {
    event.preventDefault();
    const fullname = document.getElementById('register-fullname').value.trim().toUpperCase();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const cadre = document.getElementById('register-cadre').value;
    const errDiv = document.getElementById('register-error');
    const successDiv = document.getElementById('register-success');
    
    errDiv.style.display = 'none';
    successDiv.style.display = 'none';

    try {
      const res = yield fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullname, username: username, password: password, cadre: cadre })
      });

      if (res.ok) {
        const data = yield res.json();
        if (data.is_active) {
          successDiv.textContent = 'Super Admin account registered successfully! Redirecting...';
        } else {
          successDiv.textContent = 'Registration submitted! Access is pending Admin approval.';
        }
        successDiv.style.display = 'block';
        document.getElementById('register-form').reset();
        setTimeout(() => {
          this.showLoginForm();
        }, 3000);
      } else {
        const err = yield res.json();
        errDiv.textContent = err.detail || 'Registration failed';
        errDiv.style.display = 'block';
      }
    } catch (e) {
      errDiv.textContent = 'Connection error. Please try again.';
      errDiv.style.display = 'block';
    }
  }),

  setupInactivityListeners: function() {
    const reset = () => this.resetInactivityTimer();
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('click', reset);
    window.addEventListener('scroll', reset);
  },

  startInactivityTimer: function() {
    this.resetInactivityTimer();
  },

  resetInactivityTimer: function() {
    const now = Date.now();
    if (now - this.lastActivityTime < 5000) {
      return;
    }
    this.lastActivityTime = now;

    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    
    if (this.currentUser) {
      this.inactivityTimer = setTimeout(() => {
        console.log("Inactivity timeout reached. Logging out...");
        this.handleLogout("Logged out automatically due to inactivity.");
      }, this.inactivityTimeout);
    }
  },

  stopInactivityTimer: function() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  },

  togglePasswordVisibility: function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
    
    const btn = input.nextElementSibling;
    if (btn) {
      if (type === 'text') {
        btn.innerHTML = `<svg class="lucide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" x2="22" y1="2" y2="22"></line></svg>`;
      } else {
        btn.innerHTML = `<svg class="lucide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      }
    }
  },

  cleanseDOM: function() {
    // Reset all password input types back to password
    ['login-password', 'register-password', 'reset-old-password', 'reset-new-password', 'reset-confirm-password'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.setAttribute('type', 'password');
        const btn = input.nextElementSibling;
        if (btn) {
          btn.innerHTML = `<svg class="lucide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
      }
    });

    // Reset all forms in modal/app
    document.querySelectorAll('form').forEach(form => form.reset());

    // Comprehensive modal & overlay dismissal: hide every modal overlay on screen
    document.querySelectorAll('.modal-overlay').forEach(function(modalEl) {
      modalEl.style.display = 'none';
    });
    this._modalStack = [];

    // Reset dynamic view container content to default placeholder
    const container = document.getElementById('view-container');
    if (container) {
      container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 40px;">Session inactive. Please sign in.</p>';
    }

    // Reset state caches to prevent data leakage between technician shifts
    this.currentClient = null;
    this.currentOrder = null;
  },

  renderUserNav: function() {
    const nav = document.getElementById('user-nav');
    if (!this.currentUser) return;

    const isPrivileged = this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin';
    const isSuper = this.currentUser.role === 'superadmin';
    
    const adminTabs = document.querySelectorAll('.admin-only');
    adminTabs.forEach(tab => {
      tab.style.display = isPrivileged ? 'inline-block' : 'none';
    });
    
    const superAdminTabs = document.querySelectorAll('.superadmin-only');
    superAdminTabs.forEach(tab => {
      tab.style.display = isSuper ? 'inline-block' : 'none';
    });

    const roleLabel = this.currentUser.role === 'superadmin' ? 'Super Admin'
      : (this.currentUser.role === 'admin' ? 'Admin' : 'Staff');

    nav.innerHTML = `
      <div class="user-badge">
        ${this.icon('user')} <strong>${this.escape(this.currentUser.full_name)}</strong> (${this.escape(roleLabel)}${this.currentUser.cadre ? ' - ' + this.escape(this.currentUser.cadre) : ''})
      </div>
      <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="app.openShortcutsModal()" title="Keyboard Shortcuts (Alt+H or ?)">${this.icon('keyboard')} Shortcuts</button>
      <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.8rem;" onclick="app.handleLogout()">${this.icon('log-out')} Logout</button>
    `;
  },

  openShortcutsModal: function() {
    this.openModal('shortcuts-modal');
  },

  navigate: function(viewName) {
    if (this.currentUser && this.currentUser.password_reset_required) {
      this.showResetPasswordModal();
      return;
    }

    const isPrivileged = this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin');
    const isSuper = this.currentUser && this.currentUser.role === 'superadmin';
    if ((viewName === 'reports' || viewName === 'config') && !isPrivileged) {
      this.showNotificationModal("Access Denied", "This tab requires Administrator privileges.", true);
      return;
    }
    if (viewName === 'audit' && !isSuper) {
      this.showNotificationModal("Access Denied", "This tab requires Super Admin privileges.", true);
      return;
    }

    this.currentView = viewName;
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });

    const activeBtn = Array.from(document.querySelectorAll('.nav-tab')).find(b => {
      const onclickAttr = b.getAttribute('onclick');
      return onclickAttr && onclickAttr.indexOf(viewName) !== -1;
    });
    if (activeBtn) activeBtn.classList.add('active');

    const container = document.getElementById('view-container');
    if (viewName === 'daily-log') this.renderDailyLog(container);
    else if (viewName === 'backlog') this.renderBacklog(container);
    else if (viewName === 'inventory') this.renderInventory(container);
    else if (viewName === 'reports') this.renderReports(container);
    else if (viewName === 'clients') this.renderClients(container);
    else if (viewName === 'config') this.renderConfig(container);
    else if (viewName === 'audit') this.renderAuditLog(container);
  },

  _modalStack: [],
  _previouslyFocusedElement: null,

  openModal: function(modalIdOrElem) {
    const el = typeof modalIdOrElem === 'string' ? document.getElementById(modalIdOrElem) : modalIdOrElem;
    if (!el) return;
    
    if (this._modalStack.length === 0) {
      this._previouslyFocusedElement = document.activeElement;
    }

    this._modalStack = this._modalStack.filter(function(m) { return m !== el; });
    this._modalStack.push(el);
    
    const isHighPriority = el.id === 'notification-modal' || el.id === 'confirm-modal' || el.id === 'prompt-modal';
    const baseOffset = isHighPriority ? 10000 : 2000;
    el.style.zIndex = (baseOffset + (this._modalStack.length * 50)).toString();
    el.style.display = 'flex';

    setTimeout(function() {
      const focusTarget = el.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button.btn-primary:not([disabled]), button:not([disabled])');
      if (focusTarget) {
        focusTarget.focus();
        if (typeof focusTarget.select === 'function') {
          focusTarget.select();
        }
      }
    }, 50);
  },

  closeModal: function(modalIdOrElem) {
    const el = typeof modalIdOrElem === 'string' ? document.getElementById(modalIdOrElem) : modalIdOrElem;
    if (!el) return;
    
    el.style.display = 'none';
    this._modalStack = this._modalStack.filter(function(m) { return m !== el; });

    if (this._modalStack.length === 0 && this._previouslyFocusedElement && typeof this._previouslyFocusedElement.focus === 'function') {
      try {
        this._previouslyFocusedElement.focus();
      } catch(e) {}
      this._previouslyFocusedElement = null;
    }
  },


});
