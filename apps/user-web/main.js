"use strict";

(function () {
  "use strict";

  // PLACES sẽ được nạp từ API MongoDB, fallback về dữ liệu tĩnh nếu API lỗi
  var PLACES = [];
  var userPos = null; // Tọa độ GPS người dùng
  var routeLayer = null; // Layer vẽ đường đi OSRM
  var transportMode = "driving"; // "driving" (ô tô) hoặc "motorcycle" (xe máy)

  function debounce(func, wait) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        func.apply(context, args);
      }, wait);
    };
  }

  function loadPlacesFromAPI() {
    // Cache PLACES in session storage to speed up page transitions
    const cached = sessionStorage.getItem('wv_cached_places');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data && data.length > 0) {
          PLACES = data;
          renderDestCards();
          return Promise.resolve(true);
        }
      } catch (e) {}
    }

    renderSkeletons();
    return fetch('/api/places').then(function (res) {
      return res.json();
    }).then(function (json) {
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        PLACES = json.data;
        sessionStorage.setItem('wv_cached_places', JSON.stringify(PLACES));
        return true;
      }
      throw new Error("Invalid format");
    }).catch(function (e) {
      console.warn('Không thể tải từ API, dùng dữ liệu tĩnh:', e);
      if (Array.isArray(window.WANDER_PLACES) && window.WANDER_PLACES.length > 0) {
        PLACES = window.WANDER_PLACES;
      }
      return false;
    }).finally(function() {
      renderDestCards();
    });
  }

  function loadPublicStats() {
    const cached = sessionStorage.getItem('wv_cached_stats');
    if (cached) {
      const d = JSON.parse(cached);
      fillStatsUI(d);
      return;
    }

    fetch('/api/public/stats')
      .then(function(res) { return res.json(); })
      .then(function(json) {
        if (!json.success || !json.data) return;
        sessionStorage.setItem('wv_cached_stats', JSON.stringify(json.data));
        fillStatsUI(json.data);
      }).catch(function(e) { console.warn('Lỗi tải stats', e); });
  }

  function fillStatsUI(d) {
    var sUser = document.getElementById('landing-stat-users');
    var sPlace = document.getElementById('landing-stat-places');
    var sReview = document.getElementById('landing-stat-reviews');
    if (sUser && d.userCount !== undefined) sUser.textContent = (d.userCount || 0).toLocaleString('vi-VN') + '+';
    if (sPlace && d.placeCount !== undefined) sPlace.textContent = (d.placeCount || 0).toLocaleString('vi-VN') + '+';
    if (sReview && d.feedbackCount !== undefined) sReview.textContent = (d.feedbackCount || 0).toLocaleString('vi-VN') + '+';
  }

  function loadPublicReviews() {
    var track = document.getElementById('review-track-dynamic');
    if (!track) return;
    
    const cached = sessionStorage.getItem('wv_cached_reviews');
    if (cached) {
      track.innerHTML = cached;
      if (typeof initReviewSlider === 'function') setTimeout(initReviewSlider, 100);
      return;
    }

    fetch('/api/public/reviews')
      .then(function(res) { return res.json(); })
      .then(function(json) {
        if (!json.success || !json.data || json.data.length === 0) return;
        var html = json.data.map(function(r) {
          var name = r.name || 'Khách ẩn danh';
          var msg = (r.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return '<blockquote class="review-card">' +
            '<p>“' + msg + '”</p>' +
            '<footer><cite>' + name + '</cite></footer>' +
            '</blockquote>';
        }).join('');
        track.innerHTML = html;
        sessionStorage.setItem('wv_cached_reviews', html);
        if (typeof initReviewSlider === 'function') {
          setTimeout(initReviewSlider, 100);
        }
      }).catch(function(e) { console.warn('Lỗi tải reviews', e); });
  }
  var STORAGE = {
    users: "wander_users",
    session: "wander_session",
    prefs: "wander_prefs",
    profile: "wander_profile",
    trips: "wander_trips",
    wishlist: "wander_wishlist",
    tripDraft: "wander_trip_draft",
    searchHistory: "wander_search_history"
  };
  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        // Xóa dữ liệu cũ để giải phóng chỗ
        localStorage.removeItem('wander_search_history');
        localStorage.removeItem('wander_trip_draft');
        try {
          localStorage.setItem(key, JSON.stringify(val));
        } catch (e2) {
          console.error('Cannot save even after cleanup');
          if (window.WanderUI && WanderUI.showToast) {
            WanderUI.showToast('Bộ nhớ trình duyệt đầy, đã xóa dữ liệu cũ', 'warning');
          }
        }
      }
    }
  }
  function normalize(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function getSession() {
    return loadJSON(STORAGE.session, null);
  }
  function setSession(email) {
    if (email) saveJSON(STORAGE.session, {
      email: email
    });else localStorage.removeItem(STORAGE.session);
  }
  function getUsers() {
    return loadJSON(STORAGE.users, []);
  }
  function getPrefs() {
    return loadJSON(STORAGE.prefs, {
      budget: 2,
      pace: "vua",
      interests: [],
      habits: []
    });
  }
  function savePrefs(p) {
    saveJSON(STORAGE.prefs, p);
  }
  function getProfile() {
    var sess = getSession();
    var all = loadJSON(STORAGE.profile, {});
    if (sess && sess.email && all[sess.email]) return all[sess.email];
    return {
      displayName: "",
      notes: ""
    };
  }
  function saveProfileForUser(email, profile) {
    var all = loadJSON(STORAGE.profile, {});
    all[email] = profile;
    saveJSON(STORAGE.profile, all);
  }
  window.WanderUI_getProfile = getProfile;

  // --- UI Elements ---
  var userBubble = document.querySelector("[data-user-bubble]");
  var authBtn = document.querySelector("[data-auth-open]");
  var userToggle = document.querySelector("[data-user-toggle]");
  var userDropdown = document.querySelector("[data-user-dropdown]");
  var userInitial = document.querySelector("[data-user-initial]");
  var userAvatarImg = document.querySelector("[data-user-avatar]");
  var userNameEl = document.querySelector("[data-user-name]");
  var openProfileBtn = document.querySelector("[data-open-profile]");
  var openSettingsBtn = document.querySelector("[data-open-settings]");
  var bizLink = document.querySelector("[data-biz-link]");
  var bizWorkspace = document.querySelector("[data-biz-workspace]");
  var myTripsLink = document.querySelector("a[href='my-trips.html'], a[href='/my-trips.html']");
  var logoutBtn = document.querySelector("[data-logout]");
  var profileForm = document.getElementById("profile-form");

  // Modals
  var authModal = document.getElementById("modal-auth");
  var profileModal = document.getElementById("modal-profile");
  var settingsModal = document.getElementById("modal-settings");
  var placeModal = document.getElementById("modal-place");
  var partnerWizardModal = document.getElementById("modal-partner-wizard");

  /** Điều hướng sau đăng nhập: Ba kênh hoạt động ĐỘC LẬP */
  function handleLoginRedirection(user) {
    if (!user || !user.role) return;
    if (window.location.pathname.includes('auth.html')) {
      window.location.href = 'index.html';
    } else {
      refreshAuthUI();
    }
  }
  function refreshAuthUI() {
    if (window.WanderUI && WanderUI.syncAuthUI) {
      WanderUI.syncAuthUI();
    }
  }
  function syncRoleFromToken() {
    try {
      var token = localStorage.getItem("wander_token");
      if (!token) return;
      var parts = token.split('.');
      if (parts.length !== 3) throw new Error('invalid token');
      var base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var padding = '='.repeat((4 - base64.length % 4) % 4);
      var payload = JSON.parse(decodeURIComponent(escape(atob(base64 + padding))));
      var u = payload.user || payload.account || payload;
      var sess = getSession();
      if (!sess || !sess.email) return;
      var existing = getProfile() || {};
      var next = Object.assign({}, existing);
      if (typeof u.isBusiness === "boolean") next.isBusiness = u.isBusiness;
      if (typeof u.isAdmin === "boolean") next.isAdmin = u.isAdmin;
      if (u.displayName && !existing.displayName) next.displayName = u.displayName;
      saveProfileForUser(sess.email, next);
    } catch (e) {
      /* ignore */
    }
  }
  function getWishlist() {
    return loadJSON(STORAGE.wishlist, []);
  }
  function setWishlist(ids) {
    saveJSON(STORAGE.wishlist, ids);
  }
  function toggleWish(placeId) {
    var w = getWishlist();
    var i = w.indexOf(placeId);
    var action = (i === -1) ? 'add' : 'remove';
    
    if (i === -1) w.push(placeId); else w.splice(i, 1);
    setWishlist(w);

    // Sync to user profile if logged in
    var token = localStorage.getItem("wander_token");
    if (token) {
      // 1. Sync user's private favorites list
      fetch('/api/auth/user/sync-favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ favorites: w })
      }).catch(err => console.debug('Sync user favorites failed:', err));

      // 2. Sync global place favorites count and notify business
      fetch(`/api/places/${placeId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ action: action })
      }).catch(err => console.debug('Sync global favorites failed:', err));
    }
    
    return i === -1;
  }
  function budgetLabel(n) {
    if (n <= 1) return "Tiết kiệm";
    if (n >= 3) return "Cao cấp";
    return "Vừa phải";
  }
  function paceVi(p) {
    if (p === "cham") return "Thong thả";
    if (p === "nhanh") return "Năng động";
    return "Cân bằng";
  }
  function scorePlace(place, prefs) {
    var sc = 0;
    var reasons = [];
    var ub = Number(prefs.budget) || 2;
    if (place.budget <= ub) {
      sc += 3;
      reasons.push("Ngân sách phù hợp");
    } else if (place.budget === ub + 1) {
      sc += 1;
      reasons.push("Hơi cao hơn mức chọn");
    }
    if (prefs.pace && place.pace === prefs.pace) {
      sc += 2;
      reasons.push("Nhịp chuyến khớp");
    }
    var ints = prefs.interests || [];
    ints.forEach(function (it) {
      var low = normalize(it);
      var tags = Array.isArray(place.tags) ? place.tags : [];
      var interests = Array.isArray(place.interests) ? place.interests : [];
      
      var hit = tags.some(function (t) {
        return normalize(t).indexOf(low) !== -1;
      }) || interests.some(function (x) {
        return normalize(x).indexOf(low) !== -1;
      });
      if (hit) {
        sc += 2;
        reasons.push("Sở thích: " + it);
      }
    });
    (prefs.habits || []).forEach(function (h) {
      if ((place.habits || []).indexOf(h) !== -1) {
        sc += 2;
        reasons.push("Thói quen: " + h);
      }
    });
    if (place.top) sc += 1;
    return {
      score: sc,
      reasons: reasons
    };
  }
  function sortByScore(prefs) {
    return PLACES.map(function (p) {
      var r = scorePlace(p, prefs);
      return {
        place: p,
        score: r.score,
        reasons: r.reasons
      };
    }).sort(function (a, b) {
      return b.score - a.score;
    });
  }

  // Redundant header/nav logic removed. Handled by SharedUI.js
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ——— Modals ——— */
  var backdrop = document.querySelector("[data-modal-backdrop]");
  window.openModal = function(name) {
    var m = document.querySelector('[data-modal="' + name + '"]');
    if (!m) return;
    m.hidden = false;
    var useBackdrop = true;
    if (m.classList.contains('slide-drawer')) {
      requestAnimationFrame(function () {
        m.classList.add('is-open');
      });
      // Don't lock scroll for slide relative drawers, keep it multitasking
      if (name === 'place') {
        useBackdrop = false; // no backdrop for place to allow map scrolling
      } else {
        document.documentElement.style.overflow = "hidden";
      }
    } else {
      document.documentElement.style.overflow = "hidden";
    }
    if (backdrop && useBackdrop) backdrop.hidden = false;
    var closeBtn = m.querySelector("[data-modal-close]");
    if (closeBtn) closeBtn.focus();
  }
  function closeModals() {
    document.querySelectorAll("[data-modal]").forEach(function (m) {
      if (m.classList.contains('slide-drawer')) {
        m.classList.remove('is-open');
        setTimeout(function () {
          if (!m.classList.contains('is-open')) m.hidden = true;
        }, 350);
      } else {
        m.hidden = true;
      }
    });
    if (backdrop) backdrop.hidden = true;
    document.documentElement.style.overflow = "";
  }

  /* --- Partner Onboarding Wizard Logic --- */
  var currentWizardStep = 1;
  var totalWizardSteps = 4;
  function updateWizardUI() {
    // Steps
    document.querySelectorAll('[data-wizard-step]').forEach(function (s) {
      var stepValue = parseInt(s.getAttribute('data-wizard-step'));
      s.hidden = stepValue !== currentWizardStep;
      s.classList.toggle('is-active', stepValue === currentWizardStep);
    });
    // Dots
    document.querySelectorAll('[data-wizard-dot]').forEach(function (d) {
      var stepNum = parseInt(d.getAttribute('data-wizard-dot'));
      d.classList.toggle('is-active', stepNum === currentWizardStep);
      d.style.background = stepNum <= currentWizardStep ? 'var(--accent-primary)' : 'var(--bg-muted)';
    });
    // Nav buttons
    var prevBtn = document.querySelector('[data-wizard-prev]');
    var nextBtn = document.querySelector('[data-wizard-next]');
    if (prevBtn) {
      prevBtn.style.opacity = currentWizardStep === 1 ? '0' : '1';
      prevBtn.style.pointerEvents = currentWizardStep === 1 ? 'none' : 'auto';
    }
    if (nextBtn) {
      nextBtn.textContent = currentWizardStep === totalWizardSteps ? 'Đã hiểu' : 'Tiếp tục';
      nextBtn.style.display = currentWizardStep === totalWizardSteps ? 'none' : 'block';
    }
  }
  document.querySelectorAll('[data-wizard-next]').forEach(function (btn) {
    btn.onclick = function () {
      if (currentWizardStep < totalWizardSteps) {
        currentWizardStep++;
        updateWizardUI();
      } else {
        closeModals();
      }
    };
  });
  document.querySelectorAll('[data-wizard-prev]').forEach(function (btn) {
    btn.onclick = function () {
      if (currentWizardStep > 1) {
        currentWizardStep--;
        updateWizardUI();
      }
    };
  });
  document.querySelectorAll('[data-wizard-final-btn]').forEach(function (btn) {
    btn.onclick = function () {
      closeModals();
      setTimeout(function () {
        openModal('auth');
        var bizTab = document.querySelector('[data-auth-tab="register-biz"]');
        if (bizTab) bizTab.click();
      }, 300);
    };
  });

  // Bind all "Become a Partner" buttons
  document.querySelectorAll('[data-auth-open-biz]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      currentWizardStep = 1;
      updateWizardUI();
      openModal('partner-wizard');
    });
  });
  document.querySelectorAll("[data-modal-close]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeModals();
    });
  });
  if (backdrop) backdrop.addEventListener("click", closeModals);
  // Dùng event delegation để hỗ trợ các phần tử được thêm động (như trong Leaderboard)
  document.addEventListener("click", function(e) {
    var authBtn = e.target.closest("[data-auth-open]");
    if (authBtn) {
      e.preventDefault();
      openModal("auth");
      return;
    }
    
    var modalTrigger = e.target.closest("[data-modal-open]");
    if (modalTrigger) {
      e.preventDefault();
      var name = modalTrigger.getAttribute("data-modal-open");
      openModal(name);
    }
  });

  /* Auth tabs */
  var authTabs = document.querySelectorAll("[data-auth-tab]");
  var authPanels = document.querySelectorAll("[data-auth-panel]");
  authTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var id = tab.getAttribute("data-auth-tab");
      authTabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      authPanels.forEach(function (p) {
        p.hidden = p.getAttribute("data-auth-panel") !== id;
      });
    });
  });
  function showAuthMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", !ok && !!text);
    el.classList.toggle("is-ok", !!ok && !!text);
  }
  var isSubmitting = false;
  var loginForm = document.querySelector('[data-auth-panel="login"]');
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (isSubmitting) return;
      
      var btn = loginForm.querySelector('button[type="submit"]');
      isSubmitting = true;
      WanderUI.setButtonLoading(btn, true);
      var fd = new FormData(loginForm);
      var email = String(fd.get("email") || "").trim().toLowerCase();
      var password = String(fd.get("password") || "");
      var msg = loginForm.querySelector("[data-auth-msg-login]");
      fetch('/api/auth/user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password,
          requiredRole: 'user'
        })
      }).then(function (res) {
        return res.json();
      }).then(function (json) {
        if (!json.success) {
          showAuthMsg(msg, json.message || "Đăng nhập thất bại.", false);
        } else {
          setSession(email);
          localStorage.setItem("wander_token", json.token);
          saveProfileForUser(email, json.user);
          WanderUI.showToast("Đăng nhập thành công!", "success");
          window.setTimeout(function () {
            closeModals();
            loginForm.reset();
            showAuthMsg(msg, "", true);
            refreshAuthUI();
            handleLoginRedirection(json.user);
          }, 400);
        }
      }).catch(function (err) {
        showAuthMsg(msg, "Lỗi kết nối máy chủ.", false);
      }).finally(function () {
        isSubmitting = false;
        WanderUI.setButtonLoading(btn, false);
      });
    });
  }
  var regForm = document.querySelector('[data-auth-panel="register"]');
  if (regForm) {
    regForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (isSubmitting) return;

      var btn = regForm.querySelector('button[type="submit"]');
      isSubmitting = true;
      WanderUI.setButtonLoading(btn, true);
      var fd = new FormData(regForm);
      var name = String(fd.get("name") || "").trim();
      var email = String(fd.get("email") || "").trim().toLowerCase();
      var password = String(fd.get("password") || "");
      var msg = regForm.querySelector("[data-auth-msg-register]");
      fetch('/api/auth/user/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          email: email,
          password: password,
          isBusiness: false
        })
      }).then(function (res) {
        return res.json();
      }).then(function (json) {
        if (!json.success) {
          showAuthMsg(msg, json.message || "Đăng ký thất bại.", false);
        } else {
          setSession(email);
          localStorage.setItem("wander_token", json.token);
          saveProfileForUser(email, json.user);
          showAuthMsg(msg, "Tạo tài khoản thành công. Bạn đã được đăng nhập.", true);
          window.setTimeout(function () {
            closeModals();
            regForm.reset();
            showAuthMsg(msg, "", true);
            refreshAuthUI();
          }, 500);
        }
      }).catch(function (err) {
        showAuthMsg(msg, "Lỗi kết nối máy chủ.", false);
      }).finally(function () {
        WanderUI.setButtonLoading(btn, false);
      });
    });
  }


  // Helper: Cập nhật preview trong modal hồ sơ
  function applyAvatarPreview(base64) {
    var previewImg = document.querySelector('[data-avatar-preview-img]');
    var previewInitial = document.querySelector('[data-avatar-preview-initial]');
    var sess = getSession();
    var prof = getProfile() || {};
    var dis = prof.displayName || prof.name || (sess && sess.email ? sess.email.split('@')[0] : '') || '?';
    if (base64) {
      if (previewImg) {
        previewImg.src = base64;
        previewImg.removeAttribute('hidden');
      }
      if (previewInitial) previewInitial.style.display = 'none';
    } else {
      if (previewImg) {
        previewImg.setAttribute('hidden', '');
        previewImg.src = '';
      }
      if (previewInitial) {
        previewInitial.style.display = 'flex';
        previewInitial.textContent = dis.charAt(0).toUpperCase() || '?';
      }
    }
  }

  // Redundant menu listeners removed. Handled globally by SharedUI.js




  // Theme Switching Logic
  var themeOptions = document.querySelectorAll("[data-theme-set]");
  var autoThemeCheck = document.getElementById("auto-theme");
  function setTheme(theme, save) {
    if (save === undefined) save = true;
    document.documentElement.setAttribute("data-theme", theme);
    themeOptions.forEach(function (opt) {
      opt.classList.toggle("is-active", opt.getAttribute("data-theme-set") === theme);
    });
    if (save) {
      localStorage.setItem("wander_theme", theme);
      if (autoThemeCheck) autoThemeCheck.checked = false;
    }
  }
  themeOptions.forEach(function (opt) {
    opt.addEventListener("click", function () {
      setTheme(this.getAttribute("data-theme-set"));
    });
  });
  if (autoThemeCheck) {
    autoThemeCheck.addEventListener("change", function () {
      if (this.checked) {
        localStorage.removeItem("wander_theme");
        applyAutoTheme();
      }
    });
  }
  function applyAutoTheme() {
    var saved = localStorage.getItem("wander_theme");
    if (saved) {
      setTheme(saved, false);
      if (autoThemeCheck) autoThemeCheck.checked = false;
    } else {
      var isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(isDark ? "dark" : "light", false);
      if (autoThemeCheck) autoThemeCheck.checked = true;
    }
  }
  applyAutoTheme();

  // Privacy & Permissions Logic
  var permLocation = document.getElementById("perm-location");
  var permMic = document.getElementById("perm-mic");
  var permStorage = document.getElementById("perm-storage");
  var btnClearData = document.querySelector('[data-settings-panel="privacy"] .btn--outline');
  function loadPermissions() {
    if (permLocation) permLocation.checked = localStorage.getItem("perm_location") !== "false";
    if (permMic) permMic.checked = localStorage.getItem("perm_mic") !== "false";
    if (permStorage) permStorage.checked = localStorage.getItem("perm_storage") !== "false";
  }
  if (permLocation) {
    permLocation.addEventListener("change", function () {
      localStorage.setItem("perm_location", this.checked);
      if (this.checked) {
        WanderUI.showToast("Đã cho phép truy cập vị trí.", "success");
      }
    });
  }
  if (permMic) {
    permMic.addEventListener("change", function () {
      localStorage.setItem("perm_mic", this.checked);
      if (this.checked) {
        WanderUI.showToast("Đã kích hoạt quyền hội thoại giọng nói.", "success");
      }
    });
  }
  if (permStorage) {
    permStorage.addEventListener("change", function () {
      localStorage.setItem("perm_storage", this.checked);
    });
  }
  if (btnClearData) {
    btnClearData.addEventListener("click", function () {
      if (confirm("Hành động này sẽ xóa toàn bộ lịch trình và sở thích đã lưu cục bộ. Bạn có chắc chắn không?")) {
        localStorage.clear();
        WanderUI.showToast("Toàn bộ dữ liệu đã được xóa. Đang nạp lại...", "info");
        setTimeout(function () {
          window.location.reload();
        }, 1500);
      }
    });
  }
  loadPermissions();

  // File input: đọc ảnh và cập nhật preview ngay lập tức
  var avatarFileInput = document.querySelector('[data-avatar-file-input]');
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 2 MB.');
        this.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        applyAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  // Nút Xóa ảnh
  var avatarRemoveBtn = document.querySelector('[data-avatar-remove]');
  if (avatarRemoveBtn) {
    avatarRemoveBtn.addEventListener('click', function () {
      var fileInput = document.querySelector('[data-avatar-file-input]');
      if (fileInput) fileInput.value = '';
      // Đánh dấu xóa avatar = lưu chuỗi rỗng
      var sess = getSession();
      if (sess && sess.email) {
        var existing = getProfile();
        saveProfileForUser(sess.email, Object.assign({}, existing, {
          avatar: ''
        }));
        refreshAuthUI();
      }
      applyAvatarPreview(null);
    });
  }
  if (logoutBtn) logoutBtn.addEventListener("click", function () {
    var sess = getSession();
    // Clear JWT token
    localStorage.removeItem("wander_token");
    // Clear session (keeps profile data for next login)
    setSession(null);
    // Clear any redirect messages
    sessionStorage.removeItem('wander_redirect_msg');
    toggleUserMenu(false);
    refreshAuthUI();
    WanderUI.showToast("Đã đăng xuất.", "info");
  });
  var profileForm = document.querySelector("[data-profile-form-v2]");
  if (profileForm) {
    profileForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var sess = getSession();
      if (!sess || !sess.email) return;
      var fd = new FormData(profileForm);

      // Đọc ảnh từ file input (nếu có chọn file mới)
      var fileInput = profileForm.querySelector('[data-avatar-file-input]');
      var file = fileInput && fileInput.files && fileInput.files[0];
      function finishSave(avatarDataUrl) {
        var existing = getProfile();
        // Nếu avatarDataUrl === undefined → giữ nguyên avatar cũ
        var avatarVal = avatarDataUrl !== undefined ? avatarDataUrl : existing.avatar || '';
        var newProf = {
          displayName: String(fd.get("displayName") || "").trim(),
          notes: String(fd.get("notes") || "").trim(),
          phone: String(fd.get("phone") || "").trim(),
          avatar: avatarVal
        };
        var token = localStorage.getItem('wander_token');
        if (token) {
        fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': token
            },
            body: JSON.stringify({
              displayName: newProf.displayName,
              notes: newProf.notes,
              phone: newProf.phone,
              avatar: newProf.avatar
            })
          }).then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.success) {
              if (window.WanderUI) WanderUI.showToast("Đã cập nhật hồ sơ thành công!", "success");
            } else {
              if (window.WanderUI) WanderUI.showToast("Có lỗi khi lưu hồ sơ.", "error");
            }
            refreshAuthUI();
          })
          .catch(function () {
            if (window.WanderUI) WanderUI.showToast("Lỗi kết nối máy chủ.", "error");
          });
        }
        saveProfileForUser(sess.email, Object.assign({}, existing, newProf));
        var st = profileForm.querySelector("[data-profile-status]");
        if (st) {
          st.textContent = "✔ Đã lưu hồ sơ.";
          st.style.color = '#4ade80';
        }
        window.setTimeout(function () {
          if (st) {
            st.textContent = "";
            st.style.color = '';
          }
        }, 2500);
      }
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          alert('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 2 MB.');
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
          finishSave(ev.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        // Không chọn file mới → giữ avatar hiện tại
        finishSave(undefined);
      }
    });
  }
  var passwordForm = document.querySelector("[data-password-form]");
  if (passwordForm) {
    passwordForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(passwordForm);
      var oldPass = fd.get("oldPassword");
      var newPass = fd.get("newPassword");
      var statusEl = passwordForm.querySelector("[data-password-status]");
      var token = localStorage.getItem("wander_token");
      if (!token) {
        statusEl.textContent = "Vui lòng đăng nhập.";
        return;
      }
      statusEl.textContent = "Đang cập nhật...";
      statusEl.style.color = "var(--text-muted)";
      fetch('/api/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          oldPassword: oldPass,
          newPassword: newPass
        })
      }).then(function (res) {
        return res.json();
      }).then(function (json) {
        if (json.success) {
          statusEl.textContent = "✔ Đổi mật khẩu thành công!";
          statusEl.style.color = "#4ade80"; // green-400
          passwordForm.reset();
        } else {
          statusEl.textContent = "✖ " + (json.message || "Lỗi cập nhật mật khẩu");
          statusEl.style.color = "#f87171"; // red-400
        }
      }).catch(function (err) {
        statusEl.textContent = "✖ Lỗi kết nối đến máy chủ";
        statusEl.style.color = "#f87171";
      });
      setTimeout(function () {
        if (statusEl) statusEl.textContent = "";
      }, 4000);
    });
  }
  var profileSync = document.querySelector("[data-profile-sync]");
  if (profileSync) profileSync.addEventListener("click", function () {
    var prefs = readSmartForm();
    savePrefs(prefs);
    var st = profileForm && profileForm.querySelector("[data-profile-status]");
    if (st) st.textContent = "Đã đồng bộ sở thích từ form tìm kiếm.";
    renderPersonalSection();
  });
  function readSmartForm() {
    var form = document.querySelector("[data-smart-form]");
    if (!form) return getPrefs();
    var fd = new FormData(form);
    var budget = Number(fd.get("budget")) || 2;
    var pace = fd.get("pace") || "vua";
    var interests = [];
    form.querySelectorAll('input[name="interest"]:checked').forEach(function (i) {
      interests.push(i.value);
    });
    var habits = [];
    form.querySelectorAll('input[name="habit"]:checked').forEach(function (i) {
      habits.push(i.value);
    });
    return {
      budget: budget,
      pace: pace,
      interests: interests,
      habits: habits
    };
  }
  function fillSmartForm(prefs) {
    var form = document.querySelector("[data-smart-form]");
    if (!form) return;
    form.querySelectorAll('[name="budget"]').forEach(function (r) {
      r.checked = String(r.value) === String(prefs.budget);
    });
    form.querySelectorAll('[name="pace"]').forEach(function (r) {
      r.checked = r.value === prefs.pace;
    });
    form.querySelectorAll('[name="interest"]').forEach(function (c) {
      c.checked = (prefs.interests || []).indexOf(c.value) !== -1;
    });
    form.querySelectorAll('[name="habit"]').forEach(function (c) {
      c.checked = (prefs.habits || []).indexOf(c.value) !== -1;
    });
  }
  var smartForm = document.querySelector("[data-smart-form]");
  if (smartForm) {
    fillSmartForm(getPrefs());
    smartForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var prefs = readSmartForm();
      savePrefs(prefs);
      var ranked = sortByScore(prefs);
      renderSmartResults(ranked);
      var hint = document.querySelector("[data-smart-hint]");
      if (hint) {
        hint.hidden = false;
        hint.textContent = "Đã cập nhật tiêu chí — danh sách bên dưới, trang chủ cá nhân hóa đã làm mới.";
      }
      renderPersonalSection();
      // Track quest activity: Tìm kiếm (Smart)
      try {
        var qa = JSON.parse(localStorage.getItem('wv_quest_activity') || '{}');
        qa.dailySearch = (qa.dailySearch || 0) + 1;
        localStorage.setItem('wv_quest_activity', JSON.stringify(qa));
      } catch(e) {}
    });
  }
  var savePrefsBtn = document.querySelector("[data-save-prefs]");
  if (savePrefsBtn) savePrefsBtn.addEventListener("click", function () {
    var prefs = readSmartForm();
    savePrefs(prefs);
    var hint = document.querySelector("[data-smart-hint]");
    if (hint) {
      hint.hidden = false;
      hint.textContent = "Đã lưu vào hồ sơ trình duyệt (sở thích & thói quen).";
    }
    renderPersonalSection();
  });
  function renderSmartResults(ranked) {
    var box = document.querySelector("[data-smart-results]");
    if (!box) return;
    box.innerHTML = "";
    ranked.forEach(function (row) {
      var p = row.place;
      var el = document.createElement("article");
      el.className = "smart-result";
      var verifiedBadge = p.verified ? '<div class="verified-badge" style="position:static; padding:0.2rem 0.6rem; margin-bottom:0.5rem;"><span class="icon">🛡️</span> Verified' + (p.sourceName ? ' - ' + escapeHtml(p.sourceName) : '') + '</div>' : '';
      el.innerHTML = "<div>" + verifiedBadge + "<h3 class=\"dest-card-title\" style=\"margin:0 0 0.25rem\">" + escapeHtml(p.name) + '</h3><p style="margin:0;font-size:0.85rem;color:var(--accent)">' + escapeHtml(p.region) + "</p><p>" + escapeHtml(p.text) + '</p><div class="dest-card-actions">' + '<button type="button" class="btn btn--ghost btn--small" data-smart-detail="' + escapeAttr(p.id) + '">Chi tiết</button>' + '<button type="button" class="btn btn--primary btn--small" data-add-plan="' + escapeAttr(p.id) + '">Thêm vào lịch</button></div></div>' + '<div class="smart-result__score">Điểm: ' + row.score + "</div>";
      var sub = document.createElement("p");
      sub.style.fontSize = "0.82rem";
      sub.style.marginTop = "0.35rem";
      sub.textContent = row.reasons.length ? row.reasons.join(" · ") : "Gợi ý chung";
      el.querySelector("div").appendChild(sub);
      box.appendChild(el);
    });
    box.querySelectorAll("[data-smart-detail]").forEach(function (b) {
      b.addEventListener("click", function () {
        openPlaceModal(b.getAttribute("data-smart-detail"));
      });
    });
    box.querySelectorAll("[data-add-plan]").forEach(function (b) {
      b.addEventListener("click", function () {
        addStopById(b.getAttribute("data-add-plan"));
        var pl = document.getElementById("planner");
        if (pl) pl.scrollIntoView({
          behavior: "smooth"
        });
      });
    });
  }
  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  /* ——— Destination grid ——— */
  var destGrid = document.querySelector("[data-dest-grid]");
  var filterBtns = document.querySelectorAll("[data-dest-filter]");
  var searchInput = document.querySelector("[data-search-input]");
  var searchEmpty = document.querySelector("[data-search-empty]");
  var chipBtns = document.querySelectorAll("[data-filter-tag]");
  var currentFilter = "all";
  function wishIsOn(id) {
    return getWishlist().indexOf(id) !== -1;
  }
  function renderSkeletons() {
    if (!destGrid) return;
    destGrid.innerHTML = '<div class="skeleton-cards">' +
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>' +
      '</div>';
  }

  function renderDestCards() {
    if (!destGrid) return;
    try {
      if (PLACES.length === 0) {
        destGrid.innerHTML = '<p class="section-desc">Không có dữ liệu điểm đến.</p>';
        return;
      }
      
      var fragment = document.createDocumentFragment();
      var q = searchInput ? searchInput.value.trim() : "";
      
      PLACES.forEach(function (p) {
        var tags = (p.tags || []).join(" ");
        var art = document.createElement("article");
        art.className = "dest-card";
        art.setAttribute("data-tags", tags);
        art.setAttribute("data-place-id", p.id);
        
        // Basic initial visibility check
        var matchesFilter = (currentFilter === "all" || tags.toLowerCase().indexOf(currentFilter.toLowerCase()) !== -1);
        var matchesSearch = (!q || normalize(p.name + " " + p.region + " " + p.text).indexOf(normalize(q)) !== -1);
        if (!matchesFilter || !matchesSearch) art.classList.add("is-hidden");

        var topBadge = p.top ? '<span class="dest-badge">Top</span>' : "";
        var verifiedBadge = p.verified ? '<div class="verified-badge"><span class="icon">🛡️</span> Verified</div>' : '';
        var wOn = wishIsOn(p.id) ? " is-on" : "";
        var displayImg = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "");
        var favCount = parseInt(p.favoritesCount) || 0;
        if (wishIsOn(p.id) && favCount === 0) favCount = 1;

        art.innerHTML = '<div class="dest-card-media">' + 
                          '<img src="' + displayImg + '" loading="lazy" alt="' + escapeAttr(p.name || '') + '" class="dest-card-img" />' +
                          topBadge + verifiedBadge + 
                        '</div>' +
                       '<div class="dest-card-body">' +
                         '<div class="dest-card-meta">' + escapeHtml(p.region || 'Việt Nam') + '</div>' +
                         '<h3 class="dest-card-title">' + escapeHtml(p.name || '') + '</h3>' +
                         '<p class="dest-card-text">' + escapeHtml(p.text || 'Khám phá vẻ đẹp tiềm ẩn của địa danh này...') + '</p>' +
                         '<div class="dest-card-actions" style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem;">' +
                           '<a href="#dest-details" class="dest-card-link" onclick="openPlaceModal(\'' + p.id + '\')">Chi tiết →</a>' +
                           '<button type="button" class="btn btn--primary btn--small btn-add-trip" data-add-stop-id="' + escapeAttr(p.id) + '"><span>+</span> Chuyến đi</button>' +
                         '</div>' +
                       '</div>';
        fragment.appendChild(art);
      });

      destGrid.innerHTML = "";
      destGrid.appendChild(fragment);
      
      if (typeof applyDestFilters === 'function') applyDestFilters();
    } catch (err) {
      console.error('Error in renderDestCards:', err);
    }
  }
  function cardMatchesFilter(card, filter) {
    if (filter === "all") return true;
    var tags = (card.getAttribute("data-tags") || "").toLowerCase();
    return tags.indexOf(filter.toLowerCase()) !== -1;
  }
  function cardMatchesSearch(card, q) {
    if (!q) return true;
    var text = normalize(card.textContent || "");
    return text.indexOf(normalize(q)) !== -1;
  }
  function applyDestFilters() {
    if (!destGrid) return;
    var q = searchInput ? searchInput.value.trim() : "";
    var visible = 0;
    destGrid.querySelectorAll(".dest-card").forEach(function (card) {
      var show = cardMatchesFilter(card, currentFilter) && cardMatchesSearch(card, q);
      card.classList.toggle("is-hidden", !show);
      if (show) visible++;
    });
    if (searchEmpty) {
      var hideMsg = visible > 0;
      searchEmpty.classList.toggle("visually-hidden", hideMsg);
      searchEmpty.setAttribute("aria-hidden", hideMsg ? "true" : "false");
    }
  }
  function bindDestInteractions() {
    if (!destGrid) return;
    destGrid.addEventListener("click", function (e) {
      var t = e.target;
      if (t.closest("[data-detail]")) openPlaceModal(t.closest("[data-detail]").getAttribute("data-detail"));
      var w = t.closest("[data-wish]");
      if (w) {
        var id = w.getAttribute("data-wish");
        var on = toggleWish(id);
        w.classList.toggle("is-on", on);
        
        // Cập nhật UI ngay lập tức (Optimistic Update)
        var place = PLACES.find(function (p) { return p.id === id; });
        var currentCount = 0;
        if (place) {
          // Ép kiểu số để tránh lỗi nối chuỗi
          var baseCount = parseInt(place.favoritesCount) || 0;
          if (on) currentCount = baseCount + 1;
          else currentCount = Math.max(0, baseCount - 1);
          place.favoritesCount = currentCount;
        } else {
          // Nếu không tìm thấy trong PLACES (hiếm), giả định ít nhất là 1 khi bật
          currentCount = on ? 1 : 0;
        }
        
        var updateBtnUI = function(count) {
          var icon = on ? '♥' : '♡';
          var label = on ? 'Đã lưu' : 'Yêu thích';
          // Luôn hiển thị số nếu > 0 để người dùng thấy rõ sự thay đổi
          var countHtml = (count > 0) ? ' <span class="wish-count">' + count + '</span>' : '';
          w.innerHTML = icon + ' ' + label + countHtml;
        };
        
        updateBtnUI(currentCount);

        // Gọi API MongoDB để đồng bộ
        fetch('/api/places/' + id + '/favorite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: on ? 'add' : 'remove' })
        }).then(function (res) {
          return res.json();
        }).then(function (json) {
          if (json.success) {
            var serverCount = parseInt(json.favoritesCount) || 0;
            if (place) place.favoritesCount = serverCount;
            updateBtnUI(serverCount); 
          }
        }).catch(function (err) {
          console.error("Favorite API Error:", err);
          // Rollback nếu lỗi kết nối
          if (place) {
            if (on) place.favoritesCount -= 1;
            else place.favoritesCount += 1;
            updateBtnUI(place.favoritesCount);
          }
        });
      }
      var a = t.closest("[data-add-stop-id]");
      if (a) {
        addStopById(a.getAttribute("data-add-stop-id"));
        document.getElementById("planner").scrollIntoView({
          behavior: "smooth"
        });
      }
    });
  }
  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      currentFilter = btn.getAttribute("data-dest-filter") || "all";
      filterBtns.forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      applyDestFilters();
    });
  });
  if (searchInput) {
    searchInput.addEventListener("input", debounce(applyDestFilters, 300));
    var searchForm = searchInput.closest("form");
    if (searchForm) searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var dest = document.getElementById("destinations");
      if (dest) dest.scrollIntoView({
        behavior: "smooth"
      });
      applyDestFilters();
      // Track quest activity: Tìm kiếm (General)
      try {
        var qa = JSON.parse(localStorage.getItem('wv_quest_activity') || '{}');
        qa.dailySearch = (qa.dailySearch || 0) + 1;
        localStorage.setItem('wv_quest_activity', JSON.stringify(qa));
      } catch(e) {}
    });
  }
  chipBtns.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var tag = chip.getAttribute("data-filter-tag");
      if (!tag) return;
      currentFilter = tag;
      filterBtns.forEach(function (b) {
        var f = b.getAttribute("data-dest-filter");
        b.classList.toggle("is-active", f === tag);
      });
      chipBtns.forEach(function (c) {
        c.classList.toggle("is-active", c === chip);
      });
      var dest = document.getElementById("destinations");
      if (dest) dest.scrollIntoView({
        behavior: "smooth"
      });
      applyDestFilters();
    });
  });

  // Tracking for Promo Offers
  try {
    var promoBtns = document.querySelectorAll('#offers .btn');
    promoBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        try {
          var qa = JSON.parse(localStorage.getItem('wv_quest_activity') || '{}');
          qa.expOffers = 1;
          localStorage.setItem('wv_quest_activity', JSON.stringify(qa));
        } catch(e) {}
      });
    });
  } catch(e) {}

  window._poiCache = {};
  function fetchWithTimeout(url, timeout) {
    var controller = new AbortController();
    var id = setTimeout(function () {
      controller.abort();
    }, timeout);
    return fetch(url, {
      signal: controller.signal
    }).then(function (resp) {
      clearTimeout(id);
      return resp;
    }).catch(function (err) {
      clearTimeout(id);
      throw err;
    });
  }
  function fetchNearbyPOIs(lat, lng) {
    var query = '[out:json][timeout:25];' + '(' + 'node["tourist"~"viewpoint|attraction|museum|information|theme_park"](' + (lat - 0.02) + ',' + (lng - 0.03) + ',' + (lat + 0.02) + ',' + (lng + 0.03) + ');' + 'node["shop"~"gift|souvenir|mall"](' + (lat - 0.01) + ',' + (lng - 0.01) + ',' + (lat + 0.01) + ',' + (lng + 0.01) + ');' + 'node["amenity"~"restaurant|cafe|fast_food|bar|pub|hotel|hostel|guest_house|playground"](' + (lat - 0.015) + ',' + (lng - 0.015) + ',' + (lat + 0.015) + ',' + (lng + 0.015) + ');' + ');' + 'out center;';
    var mirrors = ["https://overpass-api.de/api/interpreter", "https://lz4.overpass-api.de/api/interpreter", "https://overpass.osm.ch/api/interpreter"];
    function tryMirror(index) {
      if (index >= mirrors.length) {
        return Promise.resolve([]);
      }
      var mirror = mirrors[index];
      var url = mirror + "?data=" + encodeURIComponent(query);
      return fetchWithTimeout(url, 12000).then(function (response) {
        if (response.ok) {
          return response.json().then(function (data) {
            return data.elements || [];
          });
        }
        return tryMirror(index + 1);
      }).catch(function (err) {
        console.warn("Mirror failed: " + mirror);
        return tryMirror(index + 1);
      });
    }
    return tryMirror(0);
  }
  // Individual map instances will manage their own layers locally to avoid global dependency issues.
  function getPOICategory(item) {
    if (item.tags.amenity === 'restaurant' || item.tags.amenity === 'cafe' || item.tags.amenity === 'bar' || item.tags.amenity === 'pub') return 'eating';
    if (item.tags.tourism === 'hotel' || item.tags.tourism === 'hostel' || item.tags.tourism === 'guest_house' || item.tags.tourism === 'resort') return 'sleeping';
    if (item.tags.tourism === 'attraction' || item.tags.tourism === 'museum' || item.tags.leisure === 'park' || item.tags.leisure === 'water_park' || item.tags.tourism === 'theme_park') return 'playing';
    return 'attraction';
  }
  function getPOIIcon(category) {
    switch (category) {
      case 'eating':
        return '🍴';
      case 'sleeping':
        return '🛌';
      case 'playing':
        return '🎡';
      case 'attraction':
        return '🏛️';
      default:
        return '📍';
    }
  }
  window.openPlaceModal = function(id) {
    var wrap = document.querySelector("[data-place-detail]");
    if (!wrap) return;

    wrap.innerHTML = '<div class="modal-loading-placeholder"><div class="skeleton-title skeleton" style="width:40%; margin-left:0;"></div><div class="skeleton-img skeleton" style="height:280px; border-radius:24px;"></div><div class="skeleton-text skeleton"></div><div class="skeleton-text skeleton" style="width:70%"></div></div>';
    openModal("place");

    fetch('/api/places/' + id).then(function(r) { return r.json(); }).then(function(json) {
      if (!json.success || !json.data) {
        wrap.innerHTML = '<p style="padding:2rem; text-align:center;">Không tìm thấy thông tin chi tiết.</p>';
        return;
      }
      var p = json.data;

      var heroImage = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "");
      var galleryHtml = "";
      if (p.images && p.images.length > 1) {
        galleryHtml = '<div class="place-detail__gallery">' + p.images.map(function(img, i) {
          return '<div class="gallery-thumb' + (i===0?' is-active':'') + '" data-full="' + escapeAttr(img) + '"><img src="' + escapeAttr(img) + '" alt="Thumbnail"></div>';
        }).join("") + '</div>';
      }

      var acts = (p.activities || []).map(function (a) {
        var color = "#38bdf8"; // default blue
        if (a.dayPart.toLowerCase().indexOf("sáng") !== -1) color = "#fbbf24"; // amber
        if (a.dayPart.toLowerCase().indexOf("chiều") !== -1) color = "#f43f5e"; // rose
        if (a.dayPart.toLowerCase().indexOf("tối") !== -1) color = "#818cf8"; // indigo

        return '<div class="act-row-v2">' + 
                 '<div class="act-dot" style="background:' + color + '"></div>' +
                 '<div class="act-content">' +
                   '<strong style="color:' + color + '">' + escapeHtml(a.dayPart) + ': ' + escapeHtml(a.title) + '</strong>' +
                   '<p>' + escapeHtml(a.tip) + '</p>' +
                 '</div>' +
               '</div>';
      }).join("");

      function createCardHtml(item, type, idx) {
        var subtitle = "";
        if (type === 'amusementPlaces') subtitle = "⭐ " + (item.rating || 5) + "/5";
        else if (type === 'accommodations') subtitle = "🏨 " + (item.priceRange || "Liên hệ");
        else if (type === 'diningPlaces') subtitle = "🍲 " + (item.priceRange || "Giá bình dân");
        else if (type === 'checkInSpots') subtitle = "📸 Điểm check-in nổi tiếng";
        
        return '<div class="detail-item-card" data-category="' + type + '" data-idx="' + idx + '">' + 
               '<div class="detail-item-img"><img src="' + escapeAttr(item.image) + '" alt="' + escapeAttr(item.name) + '" loading="lazy"></div>' + 
               '<div class="detail-item-info">' + 
                 '<h4 class="detail-item-title">' + escapeHtml(item.name) + '</h4>' + 
                 '<div class="detail-item-subtitle">' + subtitle + '</div>' + 
               '</div>' + 
               '</div>';
      }

      function renderSection(title, list, type, emoji) {
        if (!list || !list.length) return "";
        var cardsHtml = list.map(function (item, idx) { return createCardHtml(item, type, idx); }).join("");
        return '<div class="place-detail__section">' + 
                 '<h4 class="detail-section-title">' + emoji + ' ' + title + '</h4>' + 
                 '<div class="detail-card-grid">' + cardsHtml + '</div>' + 
               '</div>';
      }

      var sectionsHtml = renderSection("Các địa điểm vui chơi", p.amusementPlaces, "amusementPlaces", "🎢") + 
                         renderSection("Nơi nghỉ ngơi lý tưởng", p.accommodations, "accommodations", "🛌") + 
                         renderSection("Địa điểm ăn uống", p.diningPlaces, "diningPlaces", "🍲") + 
                         renderSection("Điểm check-in nổi tiếng", p.checkInSpots, "checkInSpots", "🤳");

      var verifiedBadge = p.verified ? '<div class="verified-badge-v2"><span class="icon">🛡️</span> Đã kiểm chứng' + (p.sourceName ? ' bởi ' + escapeHtml(p.sourceName) : '') + '</div>' : '';
      
      var placeViewHtml = '<div class="place-view-content animate-in">' + 
          '<div class="place-detail__hero">' +
            '<img src="' + escapeAttr(heroImage) + '" class="hero-main-img" id="hero-target">' +
            verifiedBadge +
          '</div>' +
          galleryHtml +
          
          '<div class="place-detail__body-grid">' +
            '<div class="place-detail__main-col">' +
              '<div class="place-detail__info-header">' +
                '<h3 class="place-detail__title-v2">' + escapeHtml(p.name) + '</h3>' +
                '<p class="place-detail__meta-v2">📍 ' + escapeHtml(p.region) + " · " + budgetLabel(p.budget) + " · " + paceVi(p.pace) + '</p>' +
              '</div>' +
              '<div class="place-detail__desc">' + escapeHtml(p.text || "") + '</div>' +
              '<div class="place-detail__guide">' +
                '<p><strong>🚗 Di chuyển:</strong> ' + escapeHtml(p.transportTips || "Thông tin đang cập nhật...") + '</p>' + 
                (p.sourceUrl ? '<p><strong>🔗 Tham khảo:</strong> <a href="' + escapeAttr(p.sourceUrl) + '" target="_blank">' + escapeHtml(p.sourceName || "Website chính thức") + '</a></p>' : "") + 
              '</div>' +
              '<div class="place-detail__activities-v2">' + 
                '<h4 class="detail-section-title">📅 Lịch trình gợi ý</h4>' +
                acts + 
              '</div>' + 
              sectionsHtml + 
              '<div id="place-map" class="place-detail__map-v2"></div>' + 
            '</div>' +
            
            '<aside class="place-detail__side-col">' +
              '<div class="place-detail__reviews-v2">' +
                '<h4 class="detail-section-title">💬 Đánh giá từ khách du lịch</h4>' +
                '<div class="reviews-list" id="modal-reviews-list">' + (p.reviews && p.reviews.length > 0 ? p.reviews.map(function(r){
                  return '<div class="review-item-v2">' +
                    '<div class="review-header"><strong>' + escapeHtml(r.userName || 'Người dùng WanderViệt') + '</strong><span class="review-stars">' + '★'.repeat(r.rating) + '☆'.repeat(5-r.rating) + '</span></div>' +
                    '<p class="review-text">' + escapeHtml(r.comment) + '</p>' +
                    '<div class="review-date">' + new Date(r.createdAt).toLocaleDateString('vi-VN') + '</div>' +
                  '</div>';
                }).join('') : '<p class="empty-reviews">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>') + '</div>' +
                (getSession() ? '<div class="review-form-v2">' +
                  '<h5>Gửi đánh giá của bạn</h5>' +
                  '<div class="rating-input" id="modal-rating-input">' + [5,4,3,2,1].map(function(s){ return '<span data-star="' + s + '">☆</span>'; }).join('') + '</div>' +
                  '<textarea id="modal-review-text" placeholder="Chia sẻ trải nghiệm của bạn tại đây..."></textarea>' +
                  '<button type="button" class="btn btn--primary btn--block" id="btn-submit-review">Gửi đánh giá</button>' +
                '</div>' : '<p class="review-login-hint">Vui lòng <a href="#" onclick="openModal(\'auth\'); return false;">đăng nhập</a> để gửi đánh giá.</p>') +
              '</div>' +
            '</aside>' +
          '</div>' +

          '<div class="place-detail__sticky-actions">' + 
            (p.ownerId ? '<button type="button" class="btn btn--accent-warm" id="btn-open-booking">🚀 Đặt dịch vụ ngay</button>' : '') +
            '<button type="button" class="btn btn--primary" data-modal-add="' + escapeAttr(p.id) + '">Thêm vào lịch trình</button>' + 
            '<button type="button" class="btn btn--ghost" data-modal-wish="' + escapeAttr(p.id) + '">' + (wishIsOn(p.id) ? '♥ Đã lưu' : '♡ Yêu thích') + (p.favoritesCount ? ' <span class="wish-count">' + p.favoritesCount + '</span>' : '') + '</button>' +
          '</div>' +
        '</div>';

      wrap.innerHTML = placeViewHtml + '<div class="am-view-content" style="display:none;"></div>';
      
      // Gallery interaction
      wrap.querySelectorAll('.gallery-thumb').forEach(function(thumb) {
        thumb.addEventListener('click', function() {
          var target = wrap.querySelector('#hero-target');
          if (target) target.src = this.getAttribute('data-full');
          wrap.querySelectorAll('.gallery-thumb').forEach(function(t) { t.classList.remove('is-active'); });
          this.classList.add('is-active');
        });
      });

      // Item card interactions
      var pv = wrap.querySelector('.place-view-content');
      var av = wrap.querySelector('.am-view-content');
      wrap.querySelectorAll('.detail-item-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var cat = this.getAttribute('data-category');
          var idx = this.getAttribute('data-idx');
          var item = p[cat][idx];
          if (!item) return;
          var detailedHtml = '<div class="am-detail-view animate-in">' + 
              '<button type="button" class="btn btn--ghost btn-back-am">← Quay lại</button>' + 
              '<div class="am-detail-media"><img src="' + escapeAttr(item.image) + '"></div>' + 
              '<h3 class="am-detail-title">' + escapeHtml(item.name) + '</h3>' + 
              '<div class="am-detail-rating">⭐ ' + (item.rating || '4.5') + ' / 5.0</div>' + 
              '<p class="am-detail-desc">' + escapeHtml(item.description || '') + '</p>' + 
              '<div class="am-detail-meta-box">📍 ' + escapeHtml(item.address || p.region) + '</div>' + 
              '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.name + ' ' + (item.address || p.region)) + '" target="_blank" class="btn btn--outline btn--block">Xem trên bản đồ</a>' + 
              '</div>';
          av.innerHTML = detailedHtml;
          av.querySelector('.btn-back-am').addEventListener('click', function () { av.style.display='none'; pv.style.display='block'; wrap.scrollTop=0; });
          pv.style.display = 'none'; av.style.display = 'block'; wrap.scrollTop = 0;
        });
      });

      wrap.querySelector("[data-modal-add]").addEventListener("click", function () { addStopById(p.id); closeModals(); var pl = document.getElementById("planner"); if (pl) pl.scrollIntoView({ behavior: "smooth" }); });
      wrap.querySelector("[data-modal-wish]").addEventListener("click", function () {
        const on = toggleWish(p.id);
        const wb = wrap.querySelector("[data-modal-wish]");
        if (on) p.favoritesCount = (p.favoritesCount || 0) + 1; else if (p.favoritesCount > 0) p.favoritesCount -= 1;
        wb.innerHTML = (on ? '♥ Đã lưu' : '♡ Yêu thích') + (p.favoritesCount > 0 ? ' <span class="wish-count">' + p.favoritesCount + '</span>' : '');
        fetch('/api/places/' + p.id + '/favorite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: on ? 'add' : 'remove' }) }).then(function(r){return r.json();}).then(function(j){ if(j.success){ p.favoritesCount=j.favoritesCount; renderDestCards(); renderPersonalSection(); }});
      });

      const btnOpenBooking = wrap.querySelector("#btn-open-booking");
      if (btnOpenBooking) {
        btnOpenBooking.addEventListener("click", function() {
          const sess = getSession();
          if (!sess) {
            alert('Vui lòng đăng nhập để đặt dịch vụ');
            openModal('auth');
            return;
          }
          if (typeof window.openBookingModal === 'function') {
            window.openBookingModal(p.id);
          } else {
            // Fallback for old form
            var idEl = document.getElementById('booking-place-id');
            if (idEl) idEl.value = p.id;
            var nameEl = document.getElementById('booking-place-name');
            if (nameEl) nameEl.textContent = p.name;
            var custNameEl = document.getElementById('booking-customer-name');
            if (custNameEl) custNameEl.value = getProfile().displayName || '';
            openModal('booking');
          }
        });
      }

      // Review Submission Logic
      const reviewBtn = wrap.querySelector("#btn-submit-review");
      if (reviewBtn) {
        let selectedRating = 5;
        const stars = wrap.querySelectorAll("#modal-rating-input span");
        stars.forEach(s => {
          s.onclick = function() {
            selectedRating = parseInt(this.getAttribute('data-star'));
            stars.forEach(st => {
              const val = parseInt(st.getAttribute('data-star'));
              st.innerHTML = val <= selectedRating ? '★' : '☆';
              st.style.color = val <= selectedRating ? '#fbbf24' : '#64748b';
            });
          };
        });

        reviewBtn.onclick = async function() {
          const text = wrap.querySelector("#modal-review-text").value.trim();
          if (!text) return WanderToast.error("Vui lòng nhập nội dung đánh giá");
          
          reviewBtn.disabled = true;
          reviewBtn.textContent = "Đang gửi...";
          
          try {
            const res = await fetch('/api/places/' + p.id + '/review', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('wander_token')
              },
              body: JSON.stringify({ rating: selectedRating, comment: text })
            });
            const data = await res.json();
            if (data.success) {
              WanderToast.success("Cảm ơn bạn đã đánh giá!");
              // Close and reopen to refresh (simple way)
              openPlaceModal(p.id);
            } else {
              WanderToast.error(data.message || "Không thể gửi đánh giá");
              reviewBtn.disabled = false;
              reviewBtn.textContent = "Gửi đánh giá";
            }
          } catch(e) {
            WanderToast.error("Lỗi kết nối máy chủ");
            reviewBtn.disabled = false;
            reviewBtn.textContent = "Gửi đánh giá";
          }
        };
      }

      setTimeout(function () { initPlaceMap(p); }, 200);
    }).catch(function(err) { wrap.innerHTML = '<p style="padding:2rem; text-align:center;">Lỗi tải dữ liệu.</p>'; });
  };

  function initPlaceMap(p) {
    var mapEl = document.getElementById("place-map");
    // Ensure lat/lng are valid numbers
    var lat = parseFloat(p.lat);
    var lng = parseFloat(p.lng);
    if (!mapEl || isNaN(lat) || isNaN(lng) || typeof L === 'undefined') {
      if (mapEl) mapEl.style.display = 'none';
      return;
    }
    
    if (window._placeMapInstance) {
      window._placeMapInstance.remove();
      window._placeMapInstance = null;
    }
    window._placeMapInstance = L.map("place-map", { scrollWheelZoom: false }).setView([lat, lng], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(window._placeMapInstance);

    var layers = {
      playing: L.layerGroup().addTo(window._placeMapInstance),
      eating: L.layerGroup().addTo(window._placeMapInstance),
      sleeping: L.layerGroup().addTo(window._placeMapInstance),
      attraction: L.layerGroup().addTo(window._placeMapInstance)
    };

    var legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.innerHTML = '<div class="legend-loading">Đang tìm địa điểm xung quanh...</div>' + 
                       '<div class="legend-item" data-layer="playing"><div class="legend-dot" style="background:#f43f5e"></div> Vui chơi</div>' + 
                       '<div class="legend-item" data-layer="eating"><div class="legend-dot" style="background:#f59e0b"></div> Ăn uống</div>' + 
                       '<div class="legend-item" data-layer="sleeping"><div class="legend-dot" style="background:#10b981"></div> Nghỉ ngơi</div>' + 
                       '<div class="legend-item" data-layer="attraction"><div class="legend-dot" style="background:#0ea5e9"></div> Tham quan</div>';
    mapEl.appendChild(legend);

    legend.querySelectorAll('.legend-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        var layerName = this.getAttribute('data-layer');
        var layer = layers[layerName];
        if (window._placeMapInstance.hasLayer(layer)) {
          window._placeMapInstance.removeLayer(layer);
          this.classList.add('is-inactive');
        } else {
          window._placeMapInstance.addLayer(layer);
          this.classList.remove('is-inactive');
        }
      });
    });

    var mainIcon = L.divIcon({
      className: 'main-dest-marker',
      html: "<div style='background-color:var(--accent); width:20px; height:20px; border-radius:50%; border:4px solid white; box-shadow:0 0 15px var(--accent);'></div>",
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    L.marker([lat, lng], { icon: mainIcon }).bindPopup('<b>' + escapeHtml(p.name) + '</b><br>Tâm điểm du lịch').addTo(window._placeMapInstance);

    // Plot static data (amusement, dining, etc.)
    var staticItems = [];
    if (p.amusementPlaces) p.amusementPlaces.forEach(function(i) { staticItems.push(Object.assign({}, i, { cat: 'playing' })); });
    if (p.accommodations) p.accommodations.forEach(function(i) { staticItems.push(Object.assign({}, i, { cat: 'sleeping' })); });
    if (p.diningPlaces) p.diningPlaces.forEach(function(i) { staticItems.push(Object.assign({}, i, { cat: 'eating' })); });
    if (p.checkInSpots) p.checkInSpots.forEach(function(i) { staticItems.push(Object.assign({}, i, { cat: 'attraction' })); });

    staticItems.forEach(function (item, index) {
      var angle = index / (staticItems.length || 1) * 2 * Math.PI;
      var dist = 0.003 + Math.random() * 0.004;
      var itemLat = lat + Math.sin(angle) * dist;
      var itemLon = lng + Math.cos(angle) * dist;
      var category = item.cat || 'attraction';
      var poiIcon = L.divIcon({
        className: 'poi-marker poi-marker-static poi-marker-' + category,
        html: '<div class="poi-marker-inner">' + getPOIIcon(category) + '</div>',
        iconSize: [36, 36], iconAnchor: [18, 18]
      });
      var popup = '<div class="poi-popup"><span class="poi-popup-category" style="color:#fcd34d">Đề xuất</span><strong class="poi-popup-title">' + escapeHtml(item.name) + '</strong><p style="font-size:0.7rem; margin:4px 0">' + escapeHtml(item.description || "") + '</p></div>';
      L.marker([itemLat, itemLon], { icon: poiIcon }).bindPopup(popup).addTo(layers[category] || layers.attraction);
    });

    // Fetch real-world POIs
    fetchNearbyPOIs(lat, lng).then(function (elements) {
      var loadingHint = legend.querySelector('.legend-loading');
      if (loadingHint) loadingHint.style.display = 'none';
      elements.forEach(function (item) {
        var lat = item.lat || (item.center && item.center.lat);
        var lon = item.lon || (item.center && item.center.lon);
        if (!lat || !lon) return;
        var cat = getPOICategory(item);
        var poiIcon = L.divIcon({
          className: 'poi-marker poi-marker-' + cat,
          html: '<div class="poi-marker-inner">' + getPOIIcon(cat) + '</div>',
          iconSize: [32, 32], iconAnchor: [16, 16]
        });
        var popup = '<div class="poi-popup"><span class="poi-popup-category">' + cat + '</span><strong class="poi-popup-title">' + (item.tags.name || "Địa điểm") + '</strong></div>';
        L.marker([lat, lon], { icon: poiIcon }).bindPopup(popup).addTo(layers[cat] || layers.attraction);
      });
    }).catch(function() {
      var loadingHint = legend.querySelector('.legend-loading');
      if (loadingHint) loadingHint.innerText = "Không thể tải thêm địa điểm.";
    });

    // Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (pos) {
        var userIcon = L.divIcon({
          className: 'user-marker-icon',
          html: "<div style='background-color:#fff; width:14px; height:14px; border-radius:50%; border:3px solid #0ea5e9; box-shadow:0 0 10px rgba(0,0,0,0.5);'></div>",
          iconSize: [20, 20], iconAnchor: [10, 10]
        });
        L.marker([pos.coords.latitude, pos.coords.longitude], { icon: userIcon }).bindPopup('Vị trí của bạn').addTo(window._placeMapInstance);
      });
    }

    setTimeout(function () {
      if (window._placeMapInstance) window._placeMapInstance.invalidateSize();
    }, 200);
  }
  function renderPersonalSection() {
    var sec = document.querySelector("[data-personal-section]");
    var grid = document.querySelector("[data-personal-grid]");
    if (!sec || !grid) return;
    var prefs = getPrefs();
    var hasPrefs = prefs.interests && prefs.interests.length || prefs.habits && prefs.habits.length;
    var sess = getSession();
    if (!hasPrefs && !sess) {
      sec.hidden = true;
      return;
    }
    sec.hidden = false;
    var ranked = sortByScore(prefs).slice(0, 3);
    grid.innerHTML = "";
    if (!ranked.length) return;
    ranked.forEach(function (row) {
      var p = row.place;
      var div = document.createElement("div");
      div.className = "dest-card";
      div.style.cursor = "pointer";
      var verifiedBadge = p.verified ? '<div class="verified-badge"><span class="icon">🛡️</span> Verified</div>' : '';
      div.innerHTML = '<div class="dest-card-media" style="--img: url(\'' + String(p.image).replace(/'/g, "\\'") + '\')">' + verifiedBadge + '</div><div class="dest-card-body"><h3 class="dest-card-title">' + escapeHtml(p.name) + '</h3><p class="dest-card-meta">Điểm phù hợp: ' + row.score + "</p><p class=\"dest-card-text\">" + escapeHtml(row.reasons.slice(0, 2).join(" · ") || p.text) + '</p><div class="dest-card-actions">' + '<button type="button" class="btn btn--primary btn--small btn-detail">Chi tiết</button>' + '<button type="button" class="btn btn--ghost btn--small btn-add-trip" data-add-personal="' + p.id + '">+ Lịch</button>' + '</div></div>';
      div.querySelector(".btn-detail").addEventListener("click", function (e) {
        e.stopPropagation();
        openPlaceModal(p.id);
      });
      div.querySelector("[data-add-personal]").addEventListener("click", function (e) {
        e.stopPropagation();
        addStopById(p.id);
        var pl = document.getElementById("planner");
        if (pl) pl.scrollIntoView({
          behavior: "smooth"
        });
      });
      div.addEventListener("click", function () {
        openPlaceModal(p.id);
      });
      grid.appendChild(div);
    });
  }

  /* ——— Planner & map ——— */
  var tripMap = null;
  var markersLayer = null;
  var stopList = [];
  function loadDraftStops() {
    var d = loadJSON(STORAGE.tripDraft, null);
    if (d && Array.isArray(d.stops)) return d.stops;
    return [];
  }
  function saveDraftStops() {
    var nameEl = document.querySelector("[data-trip-name]");
    saveJSON(STORAGE.tripDraft, {
      name: nameEl ? nameEl.value : "",
      stops: stopList
    });
  }
  function placeById(id) {
    var p = PLACES.find(function (x) {
      return x.id === id;
    });
    if (p) return p;
    // Tìm trong danh sách ảo (custom stops) nếu không thấy trong PLACES chính
    if (window._CUSTOM_PLACES && window._CUSTOM_PLACES[id]) {
      return window._CUSTOM_PLACES[id];
    }
    return null;
  }

  // --- Partner Onboarding Wizard Logic ---
  var currentWizardStep = 1;
  var totalWizardSteps = 4;
  function updateWizardUI() {
    // Update steps visibility
    document.querySelectorAll('[data-wizard-step]').forEach(function (el) {
      var step = parseInt(el.getAttribute('data-wizard-step'));
      el.hidden = step !== currentWizardStep;
      el.classList.toggle('is-active', step === currentWizardStep);
    });

    // Update dots
    document.querySelectorAll('[data-wizard-dot]').forEach(function (el) {
      var stepValue = parseInt(el.getAttribute('data-wizard-dot'));
      el.style.background = stepValue <= currentWizardStep ? 'var(--accent-warm)' : 'rgba(255,255,255,0.1)';
      el.classList.toggle('is-active', stepValue === currentWizardStep);
    });

    // Nav buttons
    var prevBtn = document.querySelector('[data-wizard-prev]');
    var nextBtn = document.querySelector('[data-wizard-next]');
    if (prevBtn) {
      prevBtn.style.opacity = currentWizardStep === 1 ? '0' : '1';
      prevBtn.style.pointerEvents = currentWizardStep === 1 ? 'none' : 'auto';
    }
    if (nextBtn) {
      nextBtn.textContent = currentWizardStep === totalWizardSteps ? 'Đã hiểu' : 'Tiếp tục';
    }
  }
  document.querySelectorAll('[data-wizard-next]').forEach(function (btn) {
    btn.onclick = function () {
      if (currentWizardStep < totalWizardSteps) {
        currentWizardStep++;
        updateWizardUI();
      } else {
        closeModals();
      }
    };
  });
  document.querySelectorAll('[data-wizard-prev]').forEach(function (btn) {
    btn.onclick = function () {
      if (currentWizardStep > 1) {
        currentWizardStep--;
        updateWizardUI();
      }
    };
  });
  document.querySelectorAll('[data-wizard-final-btn]').forEach(function (btn) {
    btn.onclick = function () {
      closeModals();
      setTimeout(function () {
        openModal('auth');
        var bizTab = document.querySelector('[data-auth-tab="register-biz"]');
        if (bizTab) bizTab.click();
      }, 300);
    };
  });

  // Bind all "Become a Partner" buttons
  document.querySelectorAll('[data-auth-open-biz], [data-role-partner-only]').forEach(function (btn) {
    btn.onclick = function (e) {
      if (e) e.preventDefault();
      currentWizardStep = 1;
      updateWizardUI();
      openModal('partner-wizard');
    };
  });
  function initMapIfNeeded() {
    if (tripMap || typeof L === "undefined") return;
    var el = document.getElementById("trip-map");
    if (!el) return;
    tripMap = L.map(el).setView([16.05, 107.0], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(tripMap);
    markersLayer = L.layerGroup().addTo(tripMap);
    routeLayer = L.geoJSON(null, {
      style: {
        color: "#00F0FF",
        weight: 5,
        opacity: 0.7
      }
    }).addTo(tripMap);
  }
  function redrawMap() {
    initMapIfNeeded();
    if (!tripMap || !markersLayer || !routeLayer) return;
    markersLayer.clearLayers();
    if (routeLayer) routeLayer.clearLayers();
    var waypoints = [];
    var latlngs = [];

    // 1. User Position
    if (userPos && userPos.lat && userPos.lng) {
      var uLL = [userPos.lat, userPos.lng];
      waypoints.push(userPos.lng + "," + userPos.lat);
      latlngs.push(uLL);
      var userIcon = L.divIcon({
        className: 'user-marker-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker(uLL, {
        icon: userIcon
      }).bindPopup("<strong>Vị trí của bạn</strong>").addTo(markersLayer);
    }

    // 2. Itinerary Stops
    stopList.forEach(function (sid, i) {
      var p = placeById(sid);
      if (!p) return;
      var ll = [p.lat, p.lng];
      waypoints.push(p.lng + "," + p.lat);
      latlngs.push(ll);
      L.marker(ll).bindPopup("<strong>" + (i + 1) + ". " + p.name + "</strong>").addTo(markersLayer);
    });

    // 3. OSRM Routing (Vietnam Optimized)
    var stepsListEl = document.querySelector("[data-steps-list]");
    var toggleStepsBtn = document.querySelector("[data-toggle-steps]");
    if (waypoints.length >= 2) {
      // Logic neo lộ trình trên lãnh thổ Việt Nam cho các chặng dài (Bắc <-> Nam)
      var finalWaypoints = [];
      for (var k = 0; k < waypoints.length - 1; k++) {
        var startCoord = waypoints[k].split(",").map(Number); // [lng, lat]
        var endCoord = waypoints[k + 1].split(",").map(Number);
        finalWaypoints.push(waypoints[k]);

        // Nếu đoạn thẳng có khoảng cách vĩ độ > 0.9 (~100km) -> Khâu chặt vào lộ trình QL1A
        var latDiff = Math.abs(startCoord[1] - endCoord[1]);
        if (latDiff > 0.9) {
          // 23 điểm neo chiến lược dọc QL1A từ Lạng Sơn đến Cà Mau
          var anchors = [{
            lat: 21.85,
            lng: 106.76,
            name: "Lạng Sơn"
          }, {
            lat: 21.02,
            lng: 105.84,
            name: "Hà Nội"
          }, {
            lat: 20.60,
            lng: 105.92,
            name: "Phủ Lý"
          }, {
            lat: 20.25,
            lng: 105.97,
            name: "Ninh Bình"
          }, {
            lat: 19.80,
            lng: 105.77,
            name: "Thanh Hóa"
          }, {
            lat: 18.67,
            lng: 105.68,
            name: "Vinh"
          }, {
            lat: 18.34,
            lng: 105.90,
            name: "Hà Tĩnh"
          }, {
            lat: 17.47,
            lng: 106.62,
            name: "Đồng Hới"
          }, {
            lat: 16.82,
            lng: 107.10,
            name: "Đông Hà"
          }, {
            lat: 16.46,
            lng: 107.59,
            name: "Huế"
          }, {
            lat: 16.05,
            lng: 108.20,
            name: "Đà Nẵng"
          }, {
            lat: 15.57,
            lng: 108.47,
            name: "Tam Kỳ"
          }, {
            lat: 15.12,
            lng: 108.80,
            name: "Quảng Ngãi"
          }, {
            lat: 13.78,
            lng: 109.21,
            name: "Quy Nhơn"
          }, {
            lat: 13.09,
            lng: 109.30,
            name: "Tuy Hòa"
          }, {
            lat: 12.24,
            lng: 109.19,
            name: "Nha Trang"
          }, {
            lat: 11.56,
            lng: 108.99,
            name: "Phan Rang"
          }, {
            lat: 10.93,
            lng: 108.10,
            name: "Phan Thiết"
          }, {
            lat: 10.95,
            lng: 106.82,
            name: "Biên Hòa"
          }, {
            lat: 10.76,
            lng: 106.66,
            name: "TP.HCM"
          }, {
            lat: 10.03,
            lng: 105.78,
            name: "Cần Thơ"
          }, {
            lat: 9.60,
            lng: 105.97,
            name: "Sóc Trăng"
          }, {
            lat: 9.18,
            lng: 105.15,
            name: "Cà Mau"
          }];
          var isNorthToSouth = startCoord[1] > endCoord[1];
          var relevantAnchors = anchors.filter(function (a) {
            return isNorthToSouth ? a.lat < startCoord[1] && a.lat > endCoord[1] : a.lat > startCoord[1] && a.lat < endCoord[1];
          });
          if (!isNorthToSouth) relevantAnchors.reverse();
          relevantAnchors.forEach(function (a) {
            finalWaypoints.push(a.lng + "," + a.lat);
          });
        }
      }
      finalWaypoints.push(waypoints[waypoints.length - 1]);
      var osrmProfile = transportMode === "motorcycle" ? "driving" : "driving"; // OSRM demo only has driving
      var url = "https://router.project-osrm.org/route/v1/" + osrmProfile + "/" + finalWaypoints.join(";") + "?overview=full&geometries=geojson&steps=true&continue_straight=true";
      fetch(url).then(function (r) {
        return r.json();
      }).then(function (data) {
        if (data.code === "Ok" && data.routes[0]) {
          var route = data.routes[0];
          routeLayer.addData(route.geometry);
          if (stepsListEl) {
            stepsListEl.innerHTML = "";
            route.legs.forEach(function (leg, legIdx) {
              // Chỉ hiện tiêu đề chặn nếu thực sự là chặng của người dùng (không phải điểm neo tự động)
              // OSRM treats each semicolon as a leg. We can filter legs that are extremely short or matching anchors.
              var legTitle = document.createElement("li");
              legTitle.className = "leg-header";
              var stopIndex = userPos ? legIdx : legIdx + 1;
              var targetPlace = placeById(stopList[stopIndex]);
              var destName = targetPlace ? targetPlace.name : "Điểm đến";
              legTitle.innerHTML = '<span>🚗 Chặng ' + (legIdx + 1) + '</span><strong>Hướng tới: ' + escapeHtml(destName) + '</strong>';
              stepsListEl.appendChild(legTitle);
              leg.steps.forEach(function (step) {
                stepsListEl.appendChild(createStepItem(step));
              });
            });
            if (toggleStepsBtn) toggleStepsBtn.hidden = false;
          }
        }
      }).catch(function (e) {
        console.warn("OSRM error:", e);
      });
    } else {
      if (stepsListEl) stepsListEl.innerHTML = "";
      if (toggleStepsBtn) toggleStepsBtn.hidden = true;
    }
    if (latlngs.length === 1) tripMap.setView(latlngs[0], 13);else if (latlngs.length > 1) tripMap.fitBounds(latlngs, {
      padding: [80, 80],
      maxZoom: 14
    });else tripMap.setView([16.4, 107.5], 6);

    // 4. Google Maps Link
    var dirLink = document.querySelector("[data-directions-link]");
    if (dirLink && latlngs.length >= 2) {
      var gmPath = latlngs.map(function (ll) {
        return ll[0] + "," + ll[1];
      }).join("/");
      var gmMode = transportMode === "motorcycle" ? "motorcycle" : "driving";
      dirLink.href = "https://www.google.com/maps/dir/" + gmPath + "/?hl=vi&travelmode=" + gmMode;
      dirLink.hidden = false;
    } else if (dirLink) {
      dirLink.hidden = true;
    }
    setTimeout(function () {
      if (tripMap) tripMap.invalidateSize();
    }, 400);
  }
  function createStepItem(step) {
    var li = document.createElement("li");
    li.className = "step-item";
    var icon = "⬆️";
    var maneuver = step.maneuver;
    if (maneuver.type.includes("turn")) {
      if (maneuver.modifier.includes("left")) icon = "⬅️";else if (maneuver.modifier.includes("right")) icon = "➡️";else if (maneuver.modifier.includes("uturn")) icon = "↩️";
    } else if (maneuver.type.includes("roundabout")) icon = "🔄";else if (maneuver.type.includes("arrive")) icon = "🏁";else if (maneuver.type.includes("depart")) icon = "🚗";
    li.innerHTML = '<div class="step-visual"><div class="step-dot"></div><div class="step-icon">' + icon + '</div></div>' + '<div class="step-detail">' + '<div class="step-instruction">' + escapeHtml(maneuver.instruction) + '</div>' + '<div class="step-meta">' + '<span class="step-dist">' + (step.distance >= 1000 ? (step.distance / 1000).toFixed(1) + " km" : Math.round(step.distance) + " m") + '</span>' + '<span class="step-time">≈ ' + Math.ceil(step.duration / 60) + ' phút</span>' + '</div>' + '</div>' + '<button type="button" class="btn-zoom-step" title="Xem trên bản đồ">🔍</button>';
    li.addEventListener("click", function () {
      // Zoom map to internal instruction point
      var coords = maneuver.location; // [lng, lat]
      tripMap.setView([coords[1], coords[0]], 17);

      // Highlight current step
      document.querySelectorAll(".step-item").forEach(function (el) {
        el.classList.remove("is-focused");
      });
      li.classList.add("is-focused");
    });
    return li;
  }
  function renderStopListUI() {
    var listEl = document.querySelector("[data-stop-list]");
    var emptyEl = document.querySelector("[data-stop-empty]");
    if (!listEl) return;
    listEl.innerHTML = "";
    stopList.forEach(function (sid, idx) {
      var p = placeById(sid);
      if (!p) return;
      var li = document.createElement("li");
      li.className = "planner-stop-item";
      li.innerHTML = "<strong>" + (idx + 1) + ". " + escapeHtml(p.name) + "</strong>" + "<span>" + escapeHtml(p.region) + "</span>" + '<div class="planner-stop-btns">' + '<button type="button" aria-label="Lên" data-up="' + idx + '">↑</button>' + '<button type="button" aria-label="Xuống" data-down="' + idx + '">↓</button>' + '<button type="button" aria-label="Xóa" data-remove="' + idx + '">×</button>' + "</div>";
      listEl.appendChild(li);
    });
    if (emptyEl) emptyEl.style.display = stopList.length ? "none" : "block";
    listEl.querySelectorAll("[data-up]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-up"));
        if (i > 0) {
          var t = stopList[i - 1];
          stopList[i - 1] = stopList[i];
          stopList[i] = t;
          saveDraftStops();
          renderStopListUI();
          redrawMap();
        }
      });
    });
    listEl.querySelectorAll("[data-down]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-down"));
        if (i < stopList.length - 1) {
          var t = stopList[i + 1];
          stopList[i + 1] = stopList[i];
          stopList[i] = t;
          saveDraftStops();
          renderStopListUI();
          redrawMap();
        }
      });
    });
    listEl.querySelectorAll("[data-remove]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-remove"));
        stopList.splice(i, 1);
        saveDraftStops();
        renderStopListUI();
        redrawMap();
      });
    });
  }
  function addStopById(id) {
    if (stopList.indexOf(id) === -1) stopList.push(id);
    saveDraftStops();
    renderStopListUI();
    redrawMap();
    var st = document.querySelector("[data-trip-status]");
    if (st) st.textContent = "Đã thêm " + (placeById(id) && placeById(id).name) + ".";
  }
  var placeSelect = document.querySelector("[data-place-select]");
  if (placeSelect) {
    PLACES.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name + " — " + p.region;
      placeSelect.appendChild(o);
    });
  }
  function renderWarehouseGrid() {
    var grid = document.querySelector("[data-warehouse-grid]");
    if (!grid) return;
    grid.innerHTML = "";

    // Sắp xếp địa điểm theo tên hoặc meta
    var sorted = PLACES.slice().sort(function (a, b) {
      if (a.top && !b.top) return -1;
      if (!a.top && b.top) return 1;
      return 0;
    });
    sorted.forEach(function (p) {
      var item = document.createElement("div");
      item.className = "warehouse-card";
      item.innerHTML = '<div class="warehouse-card-img" style="background-image: url(\'' + String(p.image).replace(/'/g, "\\'") + '\')"></div>' + '<div class="warehouse-card-info">' + '<div class="warehouse-card-name">' + escapeHtml(p.name) + '</div>' + '</div>' + '<button type="button" class="btn-add-mini" title="Thêm vào lộ trình" data-id="' + p.id + '">+</button>';
      item.querySelector(".btn-add-mini").addEventListener("click", function (e) {
        e.stopPropagation();
        addStopById(p.id);
      });
      item.addEventListener("click", function () {
        openPlaceModal(p.id);
      });
      grid.appendChild(item);
    });
  }
  var clearTripBtn = document.querySelector("[data-clear-trip]");
  if (clearTripBtn) clearTripBtn.addEventListener("click", function () {
    stopList = [];
    saveDraftStops();
    renderStopListUI();
    redrawMap();
  });

  // Manual Stop Logic
  var manualStopBtn = document.getElementById("btn-add-manual-stop");
  var manualStopInput = document.getElementById("manual-stop-input");
  if (manualStopBtn && manualStopInput) {
    manualStopBtn.addEventListener("click", function () {
      var addr = manualStopInput.value.trim();
      if (!addr) return;
      manualStopBtn.disabled = true;
      manualStopBtn.textContent = "...";
      var st = document.querySelector("[data-trip-status]");
      if (st) st.textContent = "Đang tìm địa chỉ: " + addr;
      var url = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(addr + ", Vietnam") + "&limit=1";
      fetch(url).then(function (res) {
        return res.json();
      }).then(function (data) {
        if (data && data.length > 0) {
          var hit = data[0];
          var customId = "custom-" + Date.now();
          var newPlace = {
            id: customId,
            name: addr,
            region: hit.display_name.split(',').slice(-3).join(',').trim(),
            lat: parseFloat(hit.lat),
            lng: parseFloat(hit.lon),
            image: "https://images.unsplash.com/photo-1499591934245-40b55745b905?w=400&q=80",
            // Placeholder cho điểm manual
            text: "Địa chỉ tùy chỉnh được thêm thủ công.",
            tags: ["tùy chỉnh"],
            isCustom: true
          };
          if (!window._CUSTOM_PLACES) window._CUSTOM_PLACES = {};
          window._CUSTOM_PLACES[customId] = newPlace;
          addStopById(customId);
          manualStopInput.value = "";
          if (st) st.textContent = "✅ Đã thêm địa chỉ tùy chỉnh!";
        } else {
          if (st) st.textContent = "❌ Không tìm thấy địa chỉ này tại VN.";
        }
      }).catch(function (e) {
        if (st) st.textContent = "❌ Lỗi kết nối máy chủ địa lý.";
      }).finally(function () {
        manualStopBtn.disabled = false;
        manualStopBtn.textContent = "Thêm";
      });
    });
    manualStopInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") manualStopBtn.click();
    });
  }
  var saveTripBtn = document.querySelector("[data-save-trip]");
  if (saveTripBtn) saveTripBtn.addEventListener("click", function () {
    var nameEl = document.querySelector("[data-trip-name]");
    var name = nameEl && nameEl.value.trim() || "Chuyến đi mới";
    var st = document.querySelector("[data-trip-status]");
    var token = localStorage.getItem("wander_token");
    if (token) {
      if (st) st.textContent = "Đang lưu vĩnh viễn...";

      // Chuyển ID sang tên địa điểm để hiển thị trong DB
      var stopNames = stopList.map(function (id) {
        var p = placeById(id);
        return p ? p.name : id;
      });
      fetch('/api/planner/save-manual', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token
        },
        body: JSON.stringify({
          destination: name,
          stops: stopNames,
          tripDate: new Date().toISOString().split('T')[0] // Mặc định ngày hôm nay
        })
      }).then(function (res) {
        return res.json();
      }).then(function (json) {
        if (json.success) {
          if (st) {
            st.textContent = "✅ Đã lưu vào Chuyến đi của tôi!";
            st.style.color = "#10b981";
          }
        } else {
          fallbackSave();
        }
      }).catch(function (err) {
        console.error("Save API Error:", err);
        fallbackSave();
      });
      return;
    }
    fallbackSave();
    function fallbackSave() {
      // Fallback cho khách hoặc khi lỗi API
      var trips = loadJSON(STORAGE.trips, []);
      trips.unshift({
        id: "t-" + Date.now(),
        name: name,
        stops: stopList.slice(),
        savedAt: new Date().toISOString()
      });
      saveJSON(STORAGE.trips, trips.slice(0, 20));
      if (st) {
        st.textContent = token ? "⚠️ Lỗi server, đã lưu tạm vào trình duyệt." : "Đã lưu bản nháp vào trình duyệt (localStorage). Đăng nhập để lưu vĩnh viễn.";
        if (token) st.style.color = "#f59e0b";
      }
    }
  });
  var tripNameInput = document.querySelector("[data-trip-name]");
  if (tripNameInput) tripNameInput.addEventListener("change", saveDraftStops);

  /* ——— Itinerary tabs (existing) ——— */
  var itinTabs = document.querySelectorAll("[data-itin]");
  var panels = document.querySelectorAll("[data-panel]");
  function showPanel(id) {
    itinTabs.forEach(function (tab) {
      var active = tab.getAttribute("data-itin") === id;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach(function (panel) {
      var match = panel.getAttribute("data-panel") === id;
      panel.classList.toggle("is-visible", match);
      panel.hidden = !match;
    });
  }
  itinTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var id = tab.getAttribute("data-itin");
      if (id) showPanel(id);
    });
  });

  /* ——— Review carousel ——— */
  var track = document.querySelector("[data-review-track]");
  var prevBtn = document.querySelector("[data-review-prev]");
  var nextBtn = document.querySelector("[data-review-next]");
  var dotsWrap = document.querySelector("[data-review-dots]");
  if (track) {
    var cards = Array.prototype.slice.call(track.querySelectorAll(".review-card"));
    var index = 0;
    var dots = [];
    function renderReview() {
      cards.forEach(function (card, i) {
        card.classList.toggle("is-active", i === index);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === index);
        dot.setAttribute("aria-current", i === index ? "true" : "false");
      });
    }
    function go(delta) {
      index = (index + delta + cards.length) % cards.length;
      renderReview();
    }
    if (dotsWrap && cards.length) {
      cards.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "review-dot" + (i === 0 ? " is-active" : "");
        dot.setAttribute("aria-label", "Xem đánh giá " + (i + 1));
        dot.addEventListener("click", function () {
          index = i;
          renderReview();
        });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });
      dotsWrap.setAttribute("aria-hidden", "false");
    }
    if (prevBtn) prevBtn.addEventListener("click", function () {
      go(-1);
    });
    if (nextBtn) nextBtn.addEventListener("click", function () {
      go(1);
    });
    renderReview();
    var timer = window.setInterval(function () {
      go(1);
    }, 7000);
    track.addEventListener("mouseenter", function () {
      window.clearInterval(timer);
    });
    track.addEventListener("mouseleave", function () {
      timer = window.setInterval(function () {
        go(1);
      }, 7000);
    });
  }

  /* ——— Contact form ——— */
  function updateContactPrefill() {
    var form = document.querySelector("[data-contact-form]");
    var sess = getSession();
    if (!form || !sess) return;
    var u = getUsers().find(function (x) {
      return x.email === sess.email;
    });
    var em = form.querySelector('input[name="email"]');
    var nm = form.querySelector('input[name="name"]');
    if (em && !em.value) em.value = sess.email;
    if (nm && u && !nm.value) nm.value = u.name || "";
  }
  var form = document.querySelector("[data-contact-form]");
  var statusEl = document.querySelector("[data-form-status]");
  var nameWrap = document.getElementById("field-name-wrap");
  var emailWrap = document.getElementById("field-email-wrap");
  var nameInput = document.getElementById("contact-name");
  var emailInput = document.getElementById("contact-email");
  var imageInput = document.getElementById("contact-image");
  var imagePreviewWrap = document.getElementById("contact-image-preview");
  var imagePreviewImg = imagePreviewWrap ? imagePreviewWrap.querySelector("img") : null;
  var currentImageBase64 = null;

  if (imageInput && imagePreviewWrap && imagePreviewImg) {
    imageInput.addEventListener("change", function(e) {
      var file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          if (window.WanderUI) WanderUI.showToast("Ảnh vượt quá dung lượng 5MB", "error");
          imageInput.value = "";
          return;
        }
        var reader = new FileReader();
        reader.onload = function(evt) {
          currentImageBase64 = evt.target.result;
          imagePreviewImg.src = currentImageBase64;
          imagePreviewWrap.style.display = "block";
        };
        reader.readAsDataURL(file);
      } else {
        currentImageBase64 = null;
        imagePreviewWrap.style.display = "none";
      }
    });
  }
  if (form && statusEl) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      
      // Validate email
      var emailVal = emailInput ? emailInput.value.trim() : "";
      if (!emailVal || !emailVal.includes('@') || !emailVal.includes('.')) {
        statusEl.textContent = "✖ Email không hợp lệ";
        statusEl.classList.add("is-error");
        if (window.WanderUI) WanderUI.showToast('Email không hợp lệ', 'error');
        return;
      }
      
      // Validate message
      var messageVal = form.querySelector('textarea[name="message"]').value.trim();
      if (messageVal.length < 10) {
        statusEl.textContent = "✖ Nội dung quá ngắn (tối thiểu 10 ký tự)";
        statusEl.classList.add("is-error");
        if (window.WanderUI) WanderUI.showToast('Nội dung quá ngắn', 'error');
        return;
      }
      
      statusEl.textContent = "Đang gửi…";
      statusEl.classList.remove("is-success", "is-error");
      var fd = new FormData(form);
      var payload = {
        name: fd.get("name") || "",
        email: fd.get("email") || "",
        message: fd.get("message") || "",
        image: currentImageBase64
      };
      fetch('/api/feedback', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) { return res.json(); })
      .then(function (json) {
        if (json.success) {
          statusEl.textContent = "✔ Đã gửi yêu cầu! Cảm ơn bạn.";
          statusEl.classList.add("is-success");
          form.reset();
          currentImageBase64 = null;
          if (imagePreviewWrap) imagePreviewWrap.style.display = "none";
          updateContactPrefill();
        } else {
          statusEl.textContent = "✖ Lỗi: " + (json.message || "Không thể gửi.");
          statusEl.classList.add("is-error");
        }
      }).catch(function () {
        statusEl.textContent = "✖ Lỗi kết nối máy chủ.";
        statusEl.classList.add("is-error");
      });
    });
  }

  /* ——— Chatbot managed by SharedUI.js ——— */


  /* Chatbot handled by SharedUI.js */






  /* ——— Ticker Tự Động (Destinations) ——— */
  function initDestinationsTicker() {
    if (!destGrid) return;

    // Bật giao diện ticker trong styles.css
    destGrid.setAttribute('data-ticker', 'true');
    var isHovering = false;
    destGrid.addEventListener('mouseenter', function () {
      isHovering = true;
    });
    destGrid.addEventListener('mouseleave', function () {
      isHovering = false;
    });
    setInterval(function () {
      // Dừng cuộn nếu người dùng đang đưa chuột vào khu vực để xem
      if (isHovering || destGrid.scrollWidth <= destGrid.clientWidth) return;
      var nextScroll = destGrid.scrollLeft + 320;
      if (nextScroll + destGrid.clientWidth >= destGrid.scrollWidth - 10) {
        nextScroll = 0; // Quay về đầu
      }
      destGrid.scrollTo({
        left: nextScroll,
        behavior: 'smooth'
      });
    }, 4500);
  }

  /* ——— Newsletter form ——— */
  var newsletterForm = document.querySelector(".newsletter-form");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = newsletterForm.querySelector('input[type="email"]').value;
      if (email) {
        alert("Cảm ơn bạn! Chúng tôi sẽ gửi những ưu đãi mới nhất đến " + email);
        newsletterForm.reset();
      }
    });
  }

  /* --- Search Suggestions & History --- */
  function initSearchSuggestions() {
    var searchForm = document.getElementById('heroSearchForm');
    var searchInput = document.getElementById('heroSearchInput');
    var suggestionsBox = document.getElementById('searchSuggestions');
    var suggestionList = document.getElementById('suggestionList');
    var suggestionLabel = document.getElementById('suggestionLabel');
    var clearAllBtn = document.getElementById('clearSearchHistory');

    if (!searchForm || !searchInput) return;

    function getHistory() {
      return loadJSON(STORAGE.searchHistory, []);
    }

    function performSearch(query) {
      if (!query) return;
      
      // Save to history
      var history = getHistory();
      var existingIdx = history.indexOf(query);
      if (existingIdx !== -1) history.splice(existingIdx, 1);
      history.unshift(query);
      if (history.length > 10) history.pop();
      saveJSON(STORAGE.searchHistory, history);

      searchInput.value = query;
      suggestionsBox.classList.remove('is-visible');

      // Action based on current page
      var destSection = document.getElementById('destinations');
      if (destSection) {
        // On Homepage: scroll and filter locally
        destSection.scrollIntoView({ behavior: 'smooth' });
        
        // Trigger the internal filter logic of main.js
        if (typeof applyDestFilters === 'function') {
          applyDestFilters();
        } else {
          // Fallback if internal filter not exposed or different
          window.location.href = 'places.html?search=' + encodeURIComponent(query);
        }
      } else {
        // On other pages: redirect
        window.location.href = 'places.html?search=' + encodeURIComponent(query);
      }
    }

    function updateSuggestions(query) {
      if (!suggestionList) return;
      suggestionList.innerHTML = '';
      var history = getHistory();
      var normQuery = normalize(query);

      if (!normQuery) {
        // Show History OR Popular
        if (history.length === 0) {
          // Popular Fallback
          suggestionLabel.textContent = 'Gợi ý phổ biến';
          if (clearAllBtn) clearAllBtn.style.display = 'none';
          var popular = ['Đà Lạt', 'Hội An', 'Phú Quốc', 'Hạ Long', 'Sa Pa'];
          popular.forEach(function(item) {
            var li = document.createElement('div');
            li.className = 'search-item';
            li.innerHTML = '<span class="search-item__history-icon">🔥</span>' +
                           '<div class="search-item__info">' +
                             '<span class="search-item__name">' + item + '</span>' +
                           '</div>';
            li.onclick = function() {
              performSearch(item);
            };
            suggestionList.appendChild(li);
          });
        } else {
          suggestionLabel.textContent = 'Lịch sử tìm kiếm';
          if (clearAllBtn) clearAllBtn.style.display = 'block';
          
          history.forEach(function(item, idx) {
            var li = document.createElement('div');
            li.className = 'search-item';
            li.innerHTML = '<span class="search-item__history-icon">🕒</span>' +
                           '<div class="search-item__info">' +
                             '<span class="search-item__name">' + item + '</span>' +
                           '</div>' +
                           '<button type="button" class="search-item__delete" data-delete-idx="' + idx + '" title="Xóa">×</button>';
            
            li.onclick = function(e) {
              if (e.target.classList.contains('search-item__delete')) return;
              performSearch(item);
            };
            suggestionList.appendChild(li);
          });
        }
      } else {
        // Show Place Suggestions
        suggestionLabel.textContent = 'Gợi ý điểm đến';
        if (clearAllBtn) clearAllBtn.style.display = 'none';

        var matches = (PLACES || []).filter(function(p) {
          return normalize(p.name).indexOf(normQuery) !== -1 || normalize(p.province).indexOf(normQuery) !== -1;
        }).slice(0, 6);

        if (matches.length === 0) {
          suggestionList.innerHTML = '<div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.9rem;">Không tìm thấy điểm đến phù hợp</div>';
        } else {
          matches.forEach(function(p) {
            var li = document.createElement('div');
            li.className = 'search-item';
            li.innerHTML = '<img src="' + (p.image || 'assets/img/default-place.jpg') + '" class="search-item__img" alt="">' +
                           '<div class="search-item__info">' +
                             '<span class="search-item__name">' + p.name + '</span>' +
                             '<span class="search-item__meta">📍 ' + (p.province || p.region) + '</span>' +
                           '</div>';
            li.onclick = function() {
              performSearch(p.name);
            };
            suggestionList.appendChild(li);
          });
        }
      }
      suggestionsBox.classList.add('is-visible');
    }

    searchInput.addEventListener('focus', function() {
      updateSuggestions(searchInput.value);
    });

    searchInput.addEventListener('click', function() {
      updateSuggestions(searchInput.value);
    });

    searchInput.addEventListener('input', function() {
      updateSuggestions(searchInput.value);
    });

    document.addEventListener('click', function(e) {
      if (!searchForm.contains(e.target)) {
        suggestionsBox.classList.remove('is-visible');
      }
    });

    suggestionList.addEventListener('click', function(e) {
      if (e.target.classList.contains('search-item__delete')) {
        e.stopPropagation();
        var idx = parseInt(e.target.getAttribute('data-delete-idx'));
        var history = getHistory();
        history.splice(idx, 1);
        saveJSON(STORAGE.searchHistory, history);
        updateSuggestions(searchInput.value);
      }
    });

    if (clearAllBtn) {
      clearAllBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử tìm kiếm?')) {
          saveJSON(STORAGE.searchHistory, []);
          updateSuggestions(searchInput.value);
          if (typeof WanderUI !== 'undefined' && WanderUI.showToast) WanderUI.showToast('Đã xóa toàn bộ lịch sử tìm kiếm', 'info');
        }
      };
    }

    searchForm.onsubmit = function(e) {
      e.preventDefault();
      performSearch(searchInput.value);
    };
  }

  function initHeroSlideshow() {
    var container = document.getElementById('heroSlideshow');
    if (!container) return;

    // Reduced resolution to 1200px for faster loading
    var images = [
      'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=1200', // Hoi An
      'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=1200', // Ha Long
      'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?q=80&w=1200', // Sapa
      'https://images.unsplash.com/photo-1559592442-7e182c9403db?q=80&w=1200', // Golden Bridge
      'https://images.unsplash.com/photo-1589785834230-fb760205273d?q=80&w=1200', // Phu Quoc
      'https://images.unsplash.com/photo-1563270412-2976f9d3b733?q=80&w=1200', // Hue
      'https://images.unsplash.com/photo-1506462945848-ac8ea6f609cc?q=80&w=1200', // Mui Ne
      'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=1200', // Ninh Binh
      'https://images.unsplash.com/photo-1582234372722-50d7ccc30ebd?q=80&w=1200', // Ha Giang
      'https://images.unsplash.com/photo-1555944858-752c8a522644?q=80&w=1200'  // Saigon Skyline
    ];

    var currentIndex = 0;
    var zIndexCounter = 10;
    
    // Safety Net: Set container background to first image immediately
    container.style.backgroundImage = 'url(' + images[0] + ')';
    container.style.backgroundSize = 'cover';
    container.style.backgroundPosition = 'center';

    function createSlide(url, active) {
      var slide = document.createElement('div');
      slide.className = 'hero-v2__slide';
      slide.style.backgroundImage = 'url(' + url + ')';
      if (active) {
        slide.classList.add('is-active');
        slide.style.zIndex = zIndexCounter;
      }
      container.appendChild(slide);
      return slide;
    }

    var currentSlide = createSlide(images[0], true);

    function next() {
      var nextIndex = (currentIndex + 1) % images.length;
      var nextUrl = images[nextIndex];
      
      // Step 1: Create the next slide (it will start hidden and start loading)
      zIndexCounter++;
      var nextSlide = createSlide(nextUrl, false);
      nextSlide.style.zIndex = zIndexCounter;
      
      // Step 2: Trigger fade in after a tiny delay to ensure DOM insertion
      requestAnimationFrame(function() {
        nextSlide.classList.add('is-active');
      });

      // Step 3: Keep the old slide for a while, then clean up
      var oldSlide = currentSlide;
      setTimeout(function() {
        container.style.backgroundImage = 'url(' + nextUrl + ')';
        if (oldSlide && oldSlide.parentNode) {
          oldSlide.parentNode.removeChild(oldSlide);
        }
      }, 2000); 

      currentSlide = nextSlide;
      currentIndex = nextIndex;
    }

    // Faster rotation: Every 4 seconds
    setInterval(next, 4000);
  }

  /* ——— Boot ——— */
  function init() {
    // 0. Kiểm tra thông báo redirect từ Route Guard (vd: bị đá ra từ business.html)
    var redirectMsg = sessionStorage.getItem('wander_redirect_msg');
    if (redirectMsg) {
      sessionStorage.removeItem('wander_redirect_msg');
      // Hiển thị toast thông báo
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.95);color:#f8fafc;padding:0.8rem 1.5rem;border-radius:999px;font-size:0.9rem;z-index:9999;border:1px solid rgba(248,113,113,0.5);box-shadow:0 4px 20px rgba(0,0,0,0.4);backdrop-filter:blur(10px);animation:fadeIn 0.3s ease;';
      toast.textContent = '🔒 ' + redirectMsg;
      document.body.appendChild(toast);
      setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(function () {
          toast.remove();
        }, 500);
      }, 4000);
      // Mở modal đăng nhập sau 500ms
      setTimeout(function () {
        openModal('auth');
      }, 600);
    }

    // 1. Tải dữ liệu từ MongoDB trước khi render
    return loadPlacesFromAPI().then(function () {
      // 2. Yêu cầu vị trí người dùng (Geolocation)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          userPos = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          redrawMap();
        }, function (err) {
          console.log("No GPS permission:", err.message);
        }, {
          enableHighAccuracy: true
        });
      }

      // 3. Xử lý nút ẩn/hiện danh sách chỉ đường
      // 3. Xử lý nút toàn màn hình bản đồ
      var mapFullscreenBtn = document.querySelector("[data-map-fullscreen-btn]");
      var mapWrap = document.querySelector(".planner-map-wrap");
      
      if (mapFullscreenBtn && mapWrap) {
        mapFullscreenBtn.addEventListener("click", function() {
          var isFull = mapWrap.classList.toggle("is-fullscreen");
          this.innerHTML = isFull ? "✖" : "⛶";
          this.title = isFull ? "Thoát toàn màn hình" : "Toàn màn hình";
          
          // Đảm bảo Leaflet cập nhật lại kích thước mượt mà sau khi CSS transition chạy
          setTimeout(function() {
            if (tripMap) tripMap.invalidateSize({ animate: true });
          }, 500);
        });
      }

      var toggleStepsBtn = document.querySelector("[data-toggle-steps]");
      var stepsPanel = document.querySelector("[data-route-steps]");
      function toggleStepPanel() {
        if (!stepsPanel) return;
        var isHidden = stepsPanel.hidden;
        stepsPanel.hidden = !isHidden;
        if (toggleStepsBtn) toggleStepsBtn.textContent = isHidden ? "✖ Ẩn danh sách chỉ đường" : "📋 Xem danh sách chỉ đường";
      }
      if (toggleStepsBtn) toggleStepsBtn.addEventListener("click", toggleStepPanel);

      // 4. Xử lý nút chọn phương tiện (Xe máy / Ô tô)
      var modeBtnEls = document.querySelectorAll("[data-mode]");
      modeBtnEls.forEach(function (btn) {
        btn.addEventListener("click", function () {
          modeBtnEls.forEach(function (b) {
            b.classList.remove("is-active");
          });
          btn.classList.add("is-active");
          transportMode = btn.getAttribute("data-mode");
          redrawMap();
        });
      });
      renderDestCards();
      renderWarehouseGrid();
      bindDestInteractions();
      applyDestFilters();
      initDestinationsTicker();
      stopList = loadDraftStops();
      var draft = loadJSON(STORAGE.tripDraft, null);
      if (tripNameInput && draft && draft.name) tripNameInput.value = draft.name;
      renderStopListUI();
      initSearchSuggestions();
      initHeroSlideshow();
      // --- Hero Tags ---
      document.querySelectorAll('.glass-chip').forEach(function (chip) {
        chip.onclick = function () {
          var tag = this.getAttribute('data-filter-tag');
          var destSection = document.getElementById('destinations');
          if (destSection) {
            destSection.scrollIntoView({
              behavior: 'smooth'
            });
            var filterBtn = document.querySelector('[data-dest-filter="' + tag + '"]');
            if (filterBtn) filterBtn.click();
          }
        };
      });

      // Ensure Workspace link is correct
      function refreshContactPrefill() {
        var sess = getSession();
        var chk = document.getElementById('chk-anonymous');
        var nameWrap = document.getElementById('field-name-wrap');
        var emailWrap = document.getElementById('field-email-wrap');
        if (chk && nameWrap && emailWrap) {
          chk.onclick = function () {
            nameWrap.style.opacity = this.checked ? '0.3' : '1';
            emailWrap.style.opacity = this.checked ? '0.3' : '1';
            nameWrap.querySelector('input').disabled = this.checked;
            emailWrap.querySelector('input').disabled = this.checked;
          };
        }
      }
    });
  }

  // Load everything on startup
  function startup() {
    var token = localStorage.getItem("wander_token") || localStorage.getItem("wander_admin_token");
    // Refresh UI immediately so user sees profile instead of "Tham gia" right away
    refreshAuthUI();

    if (typeof initNotificationPolling === 'function') initNotificationPolling();
    window.requestAnimationFrame(function () {
      redrawMap();
    });
    var rankedInit = sortByScore(getPrefs());
    renderSmartResults(rankedInit);
    refreshAuthUI();
    if (profileForm && getSession() && token) {
      fetch('/api/auth/user/me', { headers: { 'x-auth-token': token } })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.success && d.user) {
            var u = d.user;
            if (profileForm.elements.displayName) profileForm.elements.displayName.value = u.displayName || u.name || "";
            if (profileForm.elements.notes) profileForm.elements.notes.value = u.notes || "";
            if (profileForm.elements.phone) profileForm.elements.phone.value = u.phone || "";
          }
        }).catch(function(){});
    }

    // -- Kết nối VoiceGuide với Chatbot --
    if (window.voiceGuide) {
      // Nút Mic Trợ lý (Expert Mode) trong khung Chat
      var companionBtn = document.getElementById('companion-toggle');
      if (companionBtn) {
        companionBtn.addEventListener('click', function (e) {
          e.preventDefault();
          if (!window.voiceGuide.recognition) {
            if (window.SharedUI && window.SharedUI.showToast) {
              window.SharedUI.showToast("Trình duyệt không hỗ trợ Mic hoặc chưa cấp quyền.", "error");
            } else {
              alert("Trình duyệt không hỗ trợ Mic.");
            }
            return;
          }
          var active = this.classList.toggle('is-active');
          window.voiceGuide.setCompanionMode(active);
        });
      }
      window.voiceGuide.onStatusChange = function (status) {
        // Đồng bộ trạng thái visual của nút Mic
        if (companionBtn) {
          companionBtn.classList.toggle('is-listening', status === 'listening');
        }
      };
      window.voiceGuide.onResultCallback = function (text) {
        if (!text) return;
        setChatOpen(true);
        appendChat("user", text);

        // Hiệu ứng "đang suy nghĩ"
        var tempBubble = document.createElement("div");
        tempBubble.className = "chat-bubble chat-bubble--bot";
        tempBubble.textContent = "AI đang suy nghĩ...";
        chatLog.appendChild(tempBubble);
        chatLog.scrollTop = chatLog.scrollHeight;
        botReply(text).then(function (reply) {
          if (tempBubble && tempBubble.parentNode) chatLog.removeChild(tempBubble);
          appendChat("bot", reply);

          // Phát âm thanh trả lời
          window.voiceGuide.speak(reply);
        });
      };
    }
  }
  init().then(function () {
    startup();
    loadPublicStats();
    loadPublicReviews();
    
    // Auto-open settings or place modal if requested via URL
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openSettings') === 'true') {
      setTimeout(function () {
        var sess = getSession();
        if (sess && sess.email && openSettingsBtn) {
          openSettingsBtn.click();
        }
      }, 500);
    }
    
    var autoPlaceId = urlParams.get('place');
    if (autoPlaceId) {
      setTimeout(function() {
        if (typeof window.openPlaceModal === 'function') {
          window.openPlaceModal(autoPlaceId);
        }
      }, 500);
    }
  });

  // Handle Hash Actions (for Quests redirection)
  function handleHashActions() {
    var hash = window.location.hash;
    if (hash === '#chat') {
      var chatBtn = document.querySelector('.chat-brain-toggle');
      if (chatBtn) {
        chatBtn.click();
        setTimeout(function() {
          var chatInput = document.querySelector('.chat-brain-input');
          if (chatInput) chatInput.focus();
        }, 300);
      }
    } else if (hash === '#destinations') {
      var destSec = document.getElementById('destinations');
      if (destSec) destSec.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === '#search') {
      var searchSec = document.getElementById('smart-search');
      if (searchSec) searchSec.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === '#reviews') {
      var revSec = document.getElementById('reviews');
      if (revSec) revSec.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === '#offers') {
      var offerSec = document.getElementById('offers');
      if (offerSec) offerSec.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === '#planner') {
      var plannerSec = document.getElementById('planner');
      if (plannerSec) {
        plannerSec.hidden = false;
        plannerSec.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  // --- Booking Form Submission ---
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.onsubmit = function(e) {
      e.preventDefault();
      const token = localStorage.getItem('wander_token');
      if (!token) { alert('Vui lòng đăng nhập lại'); return; }

      const data = {
        placeId: document.getElementById('booking-place-id').value,
        useDate: document.getElementById('booking-date').value,
        peopleCount: parseInt(document.getElementById('booking-people').value),
        customerName: document.getElementById('booking-customer-name').value,
        customerPhone: document.getElementById('booking-phone').value
      };

      fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify(data)
      })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          alert('Đặt chỗ thành công! Doanh nghiệp sẽ sớm liên hệ xác nhận với bạn.');
          closeModals();
        } else {
          alert('Lỗi: ' + json.message);
        }
      })
      .catch(err => {
        console.error('Booking error:', err);
        alert('Lỗi kết nối máy chủ');
      });
    };
  }

  // --- Business Services (Partner Tours) ---
  function renderBusinessServices() {
    const grid = document.getElementById('biz-services-grid');
    if (!grid) return;

    // Skip if we are on the dedicated business-services.html page to avoid duplication
    if (window.location.pathname.includes('business-services.html')) return;


    fetch('/api/places')
      .then(r => r.json())
      .then(json => {
        if (!json.success) {
          grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:2rem;">Lỗi tải dữ liệu đối tác</p>';
          return;
        }

        // Filter places that have an owner (business services)
        const bizPlaces = json.data.filter(p => p.ownerId);
        window._allBizPlaces = bizPlaces; // Ensure booking modal can find them

        if (bizPlaces.length === 0) {
          grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:4rem;color:#94a3b8;">Hiện chưa có tour du lịch nào từ đối tác.</p>';
          return;
        }

        grid.innerHTML = bizPlaces.map(p => {
          const rating = p.rating || (4 + Math.random()).toFixed(1); // Mock high ratings for premium look
          const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
          
          return `
            <article class="biz-card">
              <div class="biz-card__badge">Dịch vụ Đối tác</div>
              <div class="biz-card__img" style="background-image: url('${p.image || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80'}')"></div>
              <div class="biz-card__content">
                <h3 class="biz-card__title">${p.name}</h3>
                <div class="biz-card__meta">
                  <div class="biz-card__rating">
                    ${stars} <span>(${p.reviewsCount || Math.floor(Math.random() * 50) + 10})</span>
                  </div>
                  <div style="color:var(--accent); font-weight:800; font-size:0.85rem;">
                    ❤️ ${p.favoritesCount || Math.floor(Math.random() * 100) + 20}
                  </div>
                </div>
                <div class="biz-card__actions">
                  <button class="btn-biz btn-biz--primary" onclick="openPlaceModal('${p._id || p.id}')">Chi tiết & Đặt lịch</button>
                  <button class="btn-biz btn-biz--outline" onclick="openChatWithBusiness('${p.ownerId}', '${p.name}')" title="Nhắn tin tư vấn">💬</button>
                </div>
              </div>
            </article>
          `;
        }).join('');
      })
      .catch(err => {
        console.error('Error fetching biz services:', err);
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:2rem;">Lỗi kết nối máy chủ</p>';
      });
  }

  window.openChatWithBusiness = function(ownerId, placeName) {
    // This will toggle the existing chatbot and send a special message or context
    const chatBtn = document.querySelector('.chat-brain-toggle');
    if (chatBtn) {
      chatBtn.click();
      // Wait for chat to open then inject context
      setTimeout(() => {
        const chatInput = document.querySelector('.chat-brain-input');
        if (chatInput) {
          chatInput.value = `Xin chào, tôi muốn hỏi về dịch vụ "${placeName}" của quý đối tác.`;
          chatInput.focus();
        }
      }, 500);
    }
  };

  renderBusinessServices();

  // --- Smart Header Scroll Logic ---
  (function initSmartHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var lastScrollY = window.scrollY;
    var scrollThreshold = 80; // Minimum scroll before hiding

    window.addEventListener('scroll', function() {
      var currentScrollY = window.scrollY;
      
      // Hide if scrolling down and past threshold
      if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold) {
        header.classList.add('header-hidden');
      } 
      // Show if scrolling up
      else if (currentScrollY < lastScrollY) {
        header.classList.remove('header-hidden');
      }
      
      lastScrollY = Math.max(0, currentScrollY);
    }, { passive: true });
  })();

  window.addEventListener('hashchange', handleHashActions);
  setTimeout(handleHashActions, 1000); // Initial check
})();

