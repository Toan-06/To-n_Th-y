"use strict";
document.addEventListener('DOMContentLoaded', function() {
  var token = localStorage.getItem('wander_token');
  var tabs = document.querySelectorAll('[data-trip-tab]');
  var tripsList = document.getElementById('tripsList');
  var currentTab = 'planned'; // planned, experienced, missed, deleted

  // Fetch the data
  function fetchActivities() {
    return fetch('/api/auth/user/activity', {
      headers: { 'x-auth-token': token }
    }).then(function(res) { return res.json(); });
  }

  function fetchTrips() {
    return fetch('/api/planner/my-trips', {
      headers: { 'x-auth-token': token }
    }).then(function(res) { return res.json(); });
  }

  function fetchRank() {
    return fetch('/api/auth/user/rank', {
      headers: { 'x-auth-token': token }
    }).then(function(res) { return res.json(); });
  }

  function fetchLeaderboard() {
    return fetch('/api/auth/leaderboard', {
      headers: { 'x-auth-token': token }
    }).then(function(res) { return res.json(); });
  }

  function renderEmpty(msg) {
    tripsList.innerHTML = '<div style="background: var(--bg-elevated); padding: 2.5rem; border-radius: 1rem; text-align: center; box-shadow: var(--shadow-sm);">' +
      '<p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 1rem;">' + msg + '</p>' +
      '</div>';
  }

  // --- DELETE AND STATUS FUNCTIONS ---
  window.markTripStatus = function(tripId, status) {
    fetch('/api/auth/user/activity/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ placeId: tripId, status: status })
    }).then(function(res) { return res.json(); })
      .then(function(json) {
        if (json.success) {
          alert("Đã cập nhật trạng thái chuyến đi!");
          loadTab(currentTab);
          loadRank(); // Refresh rank info
        }
      });
  };

  window.deleteTrip = function(itemType, tripId, name) {
    console.log("deleteTrip called:", itemType, tripId, name);
    if (!confirm("Bạn có chắc chắn muốn xóa chuyến đi '" + name + "'?")) return;
    fetch('/api/auth/user/activity/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ itemType: itemType || 'trip', itemId: tripId, name: name })
    }).then(function(res) { return res.json(); })
      .then(function(json) {
        console.log("deleteTrip response:", json);
        if (json.success) {
          alert("Đã chuyển vào Thùng rác!");
          loadTab(currentTab);
        }
      }).catch(function(err) {
        console.error("deleteTrip error:", err);
      });
  };

  window.restoreTrip = function(itemType, tripId) {
    console.log("restoreTrip called:", itemType, tripId);
    fetch('/api/auth/user/activity/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ itemType: itemType || 'trip', itemId: tripId })
    }).then(function(res) { return res.json(); })
      .then(function(json) {
        console.log("restoreTrip response:", json);
        if (json.success) {
          alert("Đã khôi phục chuyến đi!");
          loadTab(currentTab);
        }
      }).catch(function(err) {
        console.error("restoreTrip error:", err);
      });
  };

  window.rescheduleTrip = function(tripId) {
    if (!confirm("Bạn muốn lập lịch lại cho chuyến đi này? Trạng thái sẽ chuyển về 'Đang lên lịch' và ngày khởi hành sẽ được dời sang ngày mai.")) return;
    
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var newDateStr = tomorrow.toISOString();

    // 1. Update Status
    fetch('/api/auth/user/activity/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ placeId: tripId, status: 'scheduled' })
    }).then(function(res) { 
        if (!res.ok) throw new Error("Cập nhật trạng thái thất bại");
        // 2. Update Date to make it show in Planned tab
        return fetch('/api/planner/update-date', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
          body: JSON.stringify({ itineraryId: tripId, newDate: newDateStr })
        });
    }).then(function(res) { return res.json(); })
      .then(function(json) {
        if (json.success) {
          alert("✅ Đã chuyển chuyến đi về mục 'Đang lên lịch'!");
          loadTab('planned');
        } else {
          alert("⚠️ Lỗi: " + json.message);
        }
      }).catch(function(err) {
        alert("❌ Lỗi kết nối hệ thống: " + err.message);
      });
  };

  window.purgeTrip = function(tripId) {
    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn lịch trình này? Thao tác này không thể hoàn tác.")) return;
    fetch('/api/planner/' + tripId, {
      method: 'DELETE',
      headers: { 'x-auth-token': token }
    }).then(function(res) { return res.json(); })
      .then(function(json) {
        if (json.success) {
          alert("Đã xóa vĩnh viễn.");
          loadTab('deleted');
        }
      });
  };

  function renderTripItems(tripsArray, activityLog, deleteHistory, mode) {
    tripsList.innerHTML = '';
    var filtered = [];
    
    // Create lookup maps
    var statusMap = {};
    if (activityLog) {
      activityLog.forEach(function(a) { statusMap[a.placeId] = a.status; });
    }
    var deletedMap = {};
    if (deleteHistory) {
      deleteHistory.forEach(function(d) { 
        if (d.itemType === 'trip' || d.itemType === 'itinerary') {
          deletedMap[d.itemId] = true; 
        }
      });
    }

    if (mode === 'deleted') {
      if (!deleteHistory || deleteHistory.length === 0) {
        return renderEmpty('Thùng rác trống.');
      }
      deleteHistory.forEach(function(d) {
        if (d.itemType === 'trip' || d.itemType === 'itinerary') {
          var card = document.createElement('div');
          card.style.cssText = 'background: var(--bg-elevated); border-radius: 1rem; padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border);';
          var dt = new Date(d.deletedAt).toLocaleDateString('vi-VN');
          
          var info = '<div style="opacity: 0.9;">' +
                     '<h3 style="margin: 0 0 0.5rem; color: var(--text); font-family: var(--font-display);">' + d.name + '</h3>' +
                     '<p style="margin: 0; color: var(--text-muted); font-size: 0.9rem;">Xóa ngày: ' + dt + '</p>' +
                     '</div>';
          
          var actions = '<div style="display: flex; gap: 0.5rem;">' +
                        '<button class="btn btn--outline btn--small" onclick="restoreTrip(\'itinerary\', \'' + d.itemId + '\')">🔄 Khôi phục</button>' +
                        '<button class="btn btn--danger btn--small" onclick="purgeTrip(\'' + d.itemId + '\')">🗑️ Xóa vĩnh viễn</button>' +
                        '</div>';
          
          card.innerHTML = info + actions;
          tripsList.appendChild(card);
        }
      });
      return;
    }

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    tripsArray.forEach(function(trip) {
      var id = trip._id;
      var isDeleted = deletedMap[id];
      var dbStatus = statusMap[id] || 'scheduled'; 
      var tripDate = trip.tripDate ? new Date(trip.tripDate) : null;
      if (tripDate) tripDate.setHours(0, 0, 0, 0);

      if (isDeleted) return; // Hide deleted from other tabs

      // === Strict Tab Classification Logic ===
      if (mode === 'experienced' && dbStatus === 'experienced') {
        filtered.push(trip);
      } else if (mode === 'planned') {
        // Only show if scheduled AND not past due
        if (dbStatus === 'scheduled' && (!tripDate || tripDate >= today)) {
          filtered.push(trip);
        }
      } else if (mode === 'missed') {
        // Show if explicitly missed OR scheduled but past due
        if (dbStatus === 'missed') {
          filtered.push(trip);
        } else if (dbStatus === 'scheduled' && tripDate && tripDate < today) {
          filtered.push(trip);
        }
      }
    });

    if (filtered.length === 0) {
      return renderEmpty('Không có chuyến đi nào trong mục này.');
    }

    filtered.forEach(function (it) {
      var dbDate = new Date(it.createdAt);
      var dpDateString = dbDate.toLocaleDateString('vi-VN');
      var card = document.createElement('div');
      card.style.cssText = 'background: var(--bg-elevated); border-radius: 1rem; padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 1rem; border: 1px solid var(--border);';

      var jsonStr = JSON.stringify(it.planJson || {});
      var tripDateLabel = '';
      var tripDateBadge = '';
      
      var currentStatus = statusMap[it._id] || 'scheduled';
      
      if (currentStatus === 'experienced') {
        tripDateBadge = '<span style="background:#10b981;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">✅ Đã đi</span>';
      } else if (currentStatus === 'missed') {
        tripDateBadge = '<span style="background:#f43f5e;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">❌ Bỏ lỡ</span>';
      } else if (it.tripDate) {
        var tripD = new Date(it.tripDate);
        var tripDateStr = tripD.toLocaleDateString('vi-VN');
        var today = new Date(); today.setHours(0, 0, 0, 0);
        tripD.setHours(0, 0, 0, 0);
        var diffDays = Math.round((tripD - today) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
          tripDateBadge = '<span style="background:#10b981;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">🔔 HÔM NAY!</span>';
        } else if (diffDays > 0 && diffDays <= 7) {
          tripDateBadge = '<span style="background:#f59e0b;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">⏳ Còn ' + diffDays + ' ngày</span>';
        } else if (diffDays < 0) {
          tripDateBadge = '<span style="background:#f43f5e;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">⚠️ QUÁ HẠN</span>';
        } else {
          tripDateBadge = '<span style="background:#6366f1;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">📅 Còn ' + diffDays + ' ngày</span>';
        }
      } else if (currentStatus === 'experienced') {
         tripDateBadge = '<span style="background:#10b981;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">✅ Đã đi</span>';
      } else if (currentStatus === 'missed') {
         tripDateBadge = '<span style="background:#f43f5e;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">❌ Bỏ lỡ</span>';
      }
      
      if (it.tripDate) {
        tripDateLabel = '• 🛫 Khởi hành: ' + new Date(it.tripDate).toLocaleDateString('vi-VN');
      }

      var actionsHtml = '';
      var today = new Date(); today.setHours(0,0,0,0);
      var isPast = it.tripDate && new Date(it.tripDate) < today;

      if (mode === 'planned') {
        // Tab Đang lên lịch
        actionsHtml += '<button class="delete-trip-btn btn btn--ghost btn--small" style="color:#f43f5e;" data-id="' + it._id + '" data-name="' + (it.destination || 'Chuyến đi') + '">Xóa</button>';
        actionsHtml += '<button class="mark-experienced-btn btn btn--outline btn--small" style="color:#10b981; border-color:#10b981;" data-id="' + it._id + '">Đã đi</button>';
        if (!isPast) {
           actionsHtml += '<button class="start-trip-btn btn btn--primary btn--small" style="border-radius: 8px;" data-dest="' + (it.destination || '') + '" data-json=\'' + jsonStr.replace(/'/g, "&#39;") + '\'>🚀 Lên đường ngay</button>';
        }
      } else if (mode === 'experienced') {
        actionsHtml += '<button class="delete-trip-btn btn btn--ghost btn--small" style="color:#f43f5e;" data-id="' + it._id + '" data-name="' + (it.destination || 'Chuyến đi') + '">Xóa</button>';
        actionsHtml += '<button class="reschedule-trip-btn btn btn--outline btn--small" style="color:#6366f1; border-color:#6366f1;" data-id="' + it._id + '">🔄 Lập lịch lại</button>';
      } else if (mode === 'missed') {
        actionsHtml += '<button class="delete-trip-btn btn btn--ghost btn--small" style="color:#f43f5e;" data-id="' + it._id + '" data-name="' + (it.destination || 'Chuyến đi') + '">Xóa</button>';
        actionsHtml += '<button class="mark-experienced-btn btn btn--outline btn--small" style="color:#10b981; border-color:#10b981;" data-id="' + it._id + '">Đã đi</button>';
        actionsHtml += '<button class="reschedule-trip-btn btn btn--outline btn--small" style="color:#6366f1; border-color:#6366f1;" data-id="' + it._id + '">🔄 Lập lịch lại</button>';
      }

      // Trích xuất thêm thông tin từ planJson
      var p = it.planJson || {};
      var costInfo = p.estimatedCost ? ' • 💰 ' + p.estimatedCost : (it.budget ? ' • 💰 ' + it.budget : '');
      var hotelInfo = p.suggestedHotel ? ' • 🏨 ' + p.suggestedHotel : '';
      var companionInfo = it.companion ? ' • 👥 ' + it.companion : '';
      
      var inner = '' +
        '<div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">' +
          '<div>' +
            '<div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem; flex-wrap: wrap;">' +
              '<h2 style="font-size: 1.5rem; color: var(--text); margin: 0; font-family: var(--font-display);">' + (it.destination || 'Điểm đến') + '</h2>' +
              tripDateBadge +
            '</div>' +
            '<p style="color: var(--text-muted); font-size: 0.95rem;">🕒 Xếp lịch: ' + (it.days || 0) + ' Ngày' + companionInfo + costInfo + hotelInfo + ' ' + tripDateLabel + ' • 📅 Lưu ngày ' + dpDateString + '</p>' +
          '</div>' +
          '<div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">' +
            actionsHtml +
            '<button class="view-detail-btn btn btn--outline btn--small" style="border-radius: 8px;" data-id="' + it._id + '" data-json=\'' + jsonStr.replace(/'/g, "&#39;") + '\'>Xem Lịch Trình</button>' +
          '</div>' +
        '</div>';
      card.innerHTML = inner;
      tripsList.appendChild(card);
    });

    // Rebind all buttons
    document.querySelectorAll('.delete-trip-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var id = btn.getAttribute('data-id');
        var name = btn.getAttribute('data-name');
        deleteTrip('itinerary', id, name);
      });
    });
    document.querySelectorAll('.mark-experienced-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var id = btn.getAttribute('data-id');
        markTripStatus(id, 'experienced');
      });
    });
    document.querySelectorAll('.reschedule-trip-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var id = btn.getAttribute('data-id');
        rescheduleTrip(id);
      });
    });
    document.querySelectorAll('.view-detail-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var id = btn.getAttribute('data-id');
        var jsonText = btn.getAttribute('data-json');
        if (jsonText) {
          sessionStorage.setItem('wander_view_trip', jsonText);
          window.location.href = 'planner.html?itinId=' + id + '&view=true';
        }
      });
    });
    document.querySelectorAll('.start-trip-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var dest = btn.getAttribute('data-dest');
        var jsonText = btn.getAttribute('data-json');
        if (jsonText) {
          sessionStorage.setItem('wander_active_itinerary', jsonText);
          sessionStorage.setItem('wander_active_dest', dest);
          window.location.href = 'navigator.html';
        } else if (dest) {
          window.location.href = 'navigator.html?dest=' + encodeURIComponent(dest);
        }
      });
    });
  }

  function loadTab(mode) {
    tripsList.innerHTML = '<p style="text-align: center; color: #64748b;">Đang tải...</p>';
    
    // Use individual catches to ensure one failure doesn't block the whole page
    var p1 = fetchTrips().catch(function(e) { 
      console.warn("fetchTrips failed:", e); 
      return { success: false, data: [] }; 
    });
    var p2 = fetchActivities().catch(function(e) { 
      console.warn("fetchActivities failed:", e); 
      return { success: false, activityLog: [] }; 
    });

    Promise.all([p1, p2]).then(function(results) {
      var tripsData = results[0];
      var actData = results[1];
      
      var tripsArray = (tripsData && tripsData.success) ? (tripsData.data || []) : [];
      var activityLog = (actData && actData.success) ? (actData.activityLog || []) : [];
      var deleteHistory = (actData && actData.success) ? (actData.deleteHistory || []) : [];
      
      try {
        // Update Badge count defensively
        var deletedIds = new Set();
        if (Array.isArray(deleteHistory)) {
          deleteHistory.forEach(function(d) {
            if (d && (d.itemType === 'trip' || d.itemType === 'itinerary')) {
              deletedIds.add(d.itemId);
            }
          });
        }
        
        var activeCount = 0;
        if (Array.isArray(tripsArray)) {
          activeCount = tripsArray.filter(function(t) { 
            return t && t._id && !deletedIds.has(t._id); 
          }).length;
        }
        
        var badgeEl = document.getElementById('badge-mytrips');
        if (badgeEl) badgeEl.textContent = activeCount;
      } catch (badgeErr) {
        console.warn("Badge calculation error:", badgeErr);
      }

      renderTripItems(tripsArray, activityLog, deleteHistory, mode);
    }).catch(function(err) {
      console.error("Critical loadTab error:", err);
      tripsList.innerHTML = '<p style="color: red; text-align: center;">Lỗi tải dữ liệu: ' + err.message + '</p>';
    });
  }

  // Bind Tabs
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      currentTab = tab.getAttribute('data-trip-tab');
      tabs.forEach(function(t) { 
        t.classList.remove('is-active'); 
        t.classList.add('btn--ghost');
        t.classList.remove('btn--outline');
      });
      tab.classList.add('is-active');
      tab.classList.remove('btn--ghost');
      tab.classList.add('btn--outline');
      loadTab(currentTab);
    });
  });

  // Overwrite tripsContainer display block handling from my-trips.js so it doesn't double render
  // Actually, we can just intercept the tripsList innerHTML since we do our own render.
  // To avoid conflict with my-trips.js, we just load tab which overrides the tripsList HTML.
  // === Voice AI Guide Integration ===
  function initVoiceGuide() {
    if (!window.voiceGuide) return;
    var voiceBtn = document.getElementById('voice-btn');
    var voiceIcon = document.getElementById('voice-icon');
    var voiceIndicator = document.getElementById('voice-indicator');
    var voiceStatusText = document.getElementById('voice-status-text');
    var voiceChatPreview = document.getElementById('status-text');

    window.voiceGuide.onResultCallback = function (text) {
      if (voiceChatPreview) voiceChatPreview.textContent = '🎤: "' + text + '"';
      if (voiceStatusText) voiceStatusText.textContent = 'Đang suy nghĩ...';
      if (voiceIndicator) voiceIndicator.classList.add('active');

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chatHistory: [] })
      }).then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.success) {
            window.voiceGuide.speak(data.answer);
          } else {
            window.voiceGuide.speak("Tớ chưa nghe rõ, bạn nói lại được không?");
          }
        }).catch(function() {
          window.voiceGuide.speak("Lỗi kết nối rồi bạn ơi.");
        });
    };

    window.voiceGuide.onStatusChange = function (status) {
      voiceIndicator.classList.remove('listening', 'speaking');
      voiceIndicator.classList.add('active');
      if (status === 'listening') {
        voiceIndicator.classList.add('listening');
        voiceStatusText.textContent = 'Đang nghe...';
        voiceIcon.textContent = '🎤';
      } else if (status === 'speaking') {
        voiceIndicator.classList.add('speaking');
        voiceStatusText.textContent = 'Đang trả lời...';
        voiceIcon.textContent = '🤖';
      } else if (status === 'idle') {
        setTimeout(function () {
          if (!window.voiceGuide.isListening) {
            voiceIndicator.classList.remove('active');
            voiceIcon.textContent = '🔊';
          }
        }, 3000);
      }
    };

    voiceBtn.addEventListener('click', function () {
      if (window.voiceGuide.isListening) {
        window.voiceGuide.stop();
      } else {
        window.voiceGuide.start();
      }
    });
  }

  // --- RANK & LEADERBOARD LOGIC ---
  function getRankBadge(rank) {
    if (rank.includes('Đồng')) return '🥉';
    if (rank.includes('Bạc')) return '🥈';
    if (rank.includes('Vàng')) return '🥇';
    if (rank.includes('Bạch Kim')) return '💎';
    if (rank.includes('Kim Cương')) return '👑';
    if (rank.includes('Huyền Thoại')) return '🔥';
    return '◈';
  }

  function loadRank() {
    // Rank info removed from My Trips page as per user request
  }

  // Modal events handled by WanderUI in SharedUI.js
  
  // Initial load
  if (!token) {
    document.getElementById('unauthorizedMsg').style.display = 'block';
  } else {
    document.getElementById('tripsContainer').style.display = 'block';
    loadTab('planned');
    loadRank();
    initVoiceGuide();
  }

});
