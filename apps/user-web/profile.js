const UserProfile = {
    user: null,
    activeTab: 'diary',
    isOwnProfile: true,
    profileUserId: null,

    init: async function() {
        console.log("👤 Profile Page v2 Initializing...");
        const token = localStorage.getItem('wander_token');
        if (!token) { window.location.href = "index.html"; return; }
        // Check if viewing another user's profile
        const params = new URLSearchParams(window.location.search);
        this.profileUserId = params.get('id');
        
        await this.loadCurrentUser();
        
        if (this.user) {
            if (this.profileUserId && this.profileUserId !== this.user._id) {
                this.isOwnProfile = false;
                await this.loadOtherProfile(this.profileUserId);
            } else {
                this.profileUserId = this.user._id;
                this.isOwnProfile = true;
                await this.loadFullProfile();
            }
        } else {
            console.error("User not found or not logged in");
            if (this.profileUserId) {
                this.isOwnProfile = false;
                await this.loadOtherProfile(this.profileUserId);
            }
        }

        this.setupEventListeners();
        
        // Handle URL parameters for tab linking
        const tab = params.get('tab');
        const shouldEdit = params.get('edit') === 'true';

        if (tab) {
            this.switchTab(tab);
            document.querySelectorAll('.tab-item').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === tab);
            });
        } else {
            this.switchTab('diary');
        }

        if (shouldEdit && this.isOwnProfile) {
            this.toggleEditMode(true);
        }
    },

    loadCurrentUser: async function() {
        try {
            const res = await fetch('/api/auth/user/me', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) this.user = data.user;
        } catch (err) { console.error("Lỗi tải user:", err); }
    },

    loadFullProfile: async function() {
        if (!this.user) return;
        document.getElementById('user-display-name').textContent = this.user.displayName || this.user.name;
        document.getElementById('user-bio').textContent = this.user.notes || 'Chưa có tiểu sử.';
        document.getElementById('user-id-tag').textContent = `ID: ${this.user.customId || this.user._id?.substring(0,10)}`;
        document.getElementById('user-rank-badge').textContent = `Hạng ${this.user.rank || 'Đồng'} ${this.user.rankTier || 'I'}`;
        document.getElementById('user-points').textContent = this.user.points || 0;
        if (this.user.avatar) {
            const avatarImg = document.getElementById('user-avatar-big');
            avatarImg.src = this.user.avatar;
            avatarImg.onerror = () => avatarImg.src = 'assets/default-avatar.svg';
        }
        if (this.user.cover) {
            const coverEl = document.querySelector('.profile-cover');
            coverEl.style.backgroundImage = `url(${this.user.cover})`;
        }
        // Ensure edit buttons are shown
        const coverBtn = document.getElementById('btn-edit-cover');
        if (coverBtn) coverBtn.style.display = 'flex';
        const avatarBtn = document.getElementById('btn-change-avatar');
        if (avatarBtn) avatarBtn.style.display = 'flex';
        const joinDate = new Date(this.user.createdAt);
        document.getElementById('user-joined').textContent = `${joinDate.getMonth() + 1}/${joinDate.getFullYear()}`;
        // Show edit button, hide social buttons
        const editBtn = document.getElementById('edit-profile-btn');
        if (editBtn) editBtn.style.display = 'inline-flex';
        const socialBtns = document.getElementById('profile-social-btns');
        if (socialBtns) socialBtns.style.display = 'none';
    },

    loadOtherProfile: async function(userId) {
        try {
            const res = await fetch(`/api/social/users/${userId}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) {
                const u = data.data;
                document.getElementById('user-display-name').textContent = u.displayName || u.name;
                document.getElementById('user-bio').textContent = u.notes || 'Chưa có tiểu sử.';
                document.getElementById('user-id-tag').textContent = `ID: ${u.customId || u._id?.substring(0,10)}`;
                document.getElementById('user-rank-badge').textContent = `Hạng ${u.rank || 'Đồng'} ${u.rankTier || 'I'}`;
                document.getElementById('user-points').textContent = u.points || 0;
                if (u.avatar) {
                    const avatarImg = document.getElementById('user-avatar-big');
                    avatarImg.src = u.avatar;
                    avatarImg.onerror = () => {
                        if (!avatarImg.dataset.errorHandled) {
                            avatarImg.dataset.errorHandled = 'true';
                            avatarImg.src = 'assets/default-avatar.svg';
                        }
                    };
                }
                if (u.cover) document.querySelector('.profile-cover').style.backgroundImage = `url(${u.cover})`;
                const joinDate = new Date(u.createdAt);
                document.getElementById('user-joined').textContent = `${joinDate.getMonth() + 1}/${joinDate.getFullYear()}`;
                // Hide edit, show social buttons
                const editBtn = document.getElementById('edit-profile-btn');
                if (editBtn) editBtn.style.display = 'none';
                const socialBtns = document.getElementById('profile-social-btns');
                if (socialBtns) socialBtns.style.display = 'flex';
                // Hide cover edit
                const coverBtn = document.querySelector('.btn-edit-cover');
                if (coverBtn) coverBtn.style.display = 'none';
                const avatarBtn = document.querySelector('.btn-change-avatar');
                if (avatarBtn) avatarBtn.style.display = 'none';
                // Check friendship status
                await this.checkFriendshipStatus(userId);
            }
        } catch (err) { console.error("Lỗi tải hồ sơ:", err); }
    },

    checkFriendshipStatus: async function(userId) {
        try {
            const res = await fetch(`/api/social/friends/status/${userId}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            const addBtn = document.getElementById('btn-add-friend');
            const msgBtn = document.getElementById('btn-send-message');
            if (!addBtn) return;
            switch (data.status) {
                case 'friends':
                    addBtn.innerHTML = '✅ Đã là bạn bè';
                    addBtn.classList.add('btn--secondary');
                    addBtn.onclick = () => this.unfriend(userId);
                    if (msgBtn) msgBtn.style.display = 'inline-flex';
                    break;
                case 'sent':
                    addBtn.innerHTML = '⏳ Đã gửi lời mời';
                    addBtn.disabled = true;
                    break;
                case 'received':
                    addBtn.innerHTML = '✅ Chấp nhận kết bạn';
                    addBtn.onclick = () => this.respondFriend(data.friendshipId, 'accept');
                    break;
                default:
                    addBtn.innerHTML = '➕ Kết bạn';
                    addBtn.onclick = () => this.sendFriendRequest(userId);
            }
        } catch (err) {}
    },

    sendFriendRequest: async function(userId) {
        try {
            const res = await fetch('/api/social/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ recipientId: userId }) });
            const data = await res.json();
            if (data.success) { alert('Đã gửi lời mời kết bạn!'); this.checkFriendshipStatus(userId); }
            else alert(data.message || 'Lỗi!');
        } catch (err) { alert('Lỗi gửi lời mời!'); }
    },

    unfriend: async function(userId) {
        if (!confirm('Bạn có chắc muốn hủy kết bạn?')) return;
        try {
            await fetch('/api/social/friends/unfriend', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ friendId: userId }) });
            this.checkFriendshipStatus(userId);
        } catch (err) {}
    },

    respondFriend: async function(id, action) {
        try {
            await fetch('/api/social/friends/respond', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ friendshipId: id, action }) });
            this.checkFriendshipStatus(this.profileUserId);
        } catch (err) {}
    },

    setupEventListeners: function() {
        document.querySelectorAll('.tab-item').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.switchTab(btn.dataset.tab);
            };
        });

        // Edit Profile Button
        const editBtn = document.getElementById('edit-profile-btn');
        if (editBtn) {
            editBtn.onclick = (e) => {
                e.preventDefault();
                console.log("Edit button clicked, isEditing:", this.isEditing);
                if (this.isEditing) this.saveProfile();
                else this.toggleEditMode(true);
            };
        }

        // Camera buttons
        const avatarBtn = document.getElementById('btn-change-avatar');
        if (avatarBtn) {
            avatarBtn.onclick = (e) => {
                e.preventDefault();
                console.log("Avatar cam clicked");
                document.getElementById('avatar-input').click();
            };
        }
        const coverBtn = document.getElementById('btn-edit-cover');
        if (coverBtn) {
            coverBtn.onclick = (e) => {
                e.preventDefault();
                console.log("Cover cam clicked");
                document.getElementById('cover-input').click();
            };
        }

        // Hidden input listeners
        const avatarIn = document.getElementById('avatar-input');
        const coverIn = document.getElementById('cover-input');
        
        if (avatarIn) avatarIn.onchange = (e) => {
            console.log("Avatar file selected");
            this.handleImageChange(e, 'avatar');
        };
        if (coverIn) coverIn.onchange = (e) => {
            console.log("Cover file selected");
            this.handleImageChange(e, 'cover');
        };

        // Message button
        const msgBtn = document.getElementById('btn-send-message');
        if (msgBtn) {
            msgBtn.onclick = () => { window.location.href = `social-hub.html?tab=messages&chat=${this.profileUserId}`; };
        }
    },

    isEditing: false,
    toggleEditMode: function(active) {
        this.isEditing = active;
        const nameEl = document.getElementById('user-display-name');
        const bioEl = document.getElementById('user-bio');
        const editBtn = document.getElementById('edit-profile-btn');

        if (!nameEl || !bioEl || !editBtn) return;

        if (active) {
            // Transform to inputs
            const currentName = nameEl.textContent;
            const currentBio = bioEl.textContent === 'Chưa có tiểu sử.' ? '' : bioEl.textContent;

            nameEl.innerHTML = `<input type="text" id="edit-name-input" value="${currentName}" class="inline-edit-input">`;
            bioEl.innerHTML = `<textarea id="edit-bio-input" class="inline-edit-textarea" placeholder="Nhập tiểu sử của bạn...">${currentBio}</textarea>`;
            
            editBtn.innerHTML = '💾 Lưu thay đổi';
            editBtn.classList.add('btn-saving');

            // Add Cancel button
            if (!document.getElementById('cancel-edit-btn')) {
                const cancelBtn = document.createElement('button');
                cancelBtn.id = 'cancel-edit-btn';
                cancelBtn.className = 'btn btn--ghost';
                cancelBtn.style.marginLeft = '8px';
                cancelBtn.innerHTML = 'Hủy';
                cancelBtn.onclick = (e) => {
                    e.preventDefault();
                    this.toggleEditMode(false);
                };
                editBtn.parentNode.appendChild(cancelBtn);
            }
        } else {
            // Restore static text
            this.loadFullProfile();
            editBtn.innerHTML = '✏️ Chỉnh sửa hồ sơ';
            editBtn.classList.remove('btn-saving');
            const cancelBtn = document.getElementById('cancel-edit-btn');
            if (cancelBtn) cancelBtn.remove();
            
            // Clear file inputs
            const avatarIn = document.getElementById('avatar-input');
            const coverIn = document.getElementById('cover-input');
            if (avatarIn) avatarIn.value = '';
            if (coverIn) coverIn.value = '';
        }
    },

    handleImageChange: async function(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert("Ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.");
            e.target.value = '';
            return;
        }

        console.log(`Previewing ${type}: ${file.name}`);
        // Preview immediately
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (type === 'avatar') {
                const img = document.getElementById('user-avatar-big');
                if (img) img.src = ev.target.result;
            } else {
                const cover = document.querySelector('.profile-cover');
                if (cover) cover.style.backgroundImage = `url(${ev.target.result})`;
            }
        };
        reader.readAsDataURL(file);

        // If not in editing mode, start it
        if (!this.isEditing) this.toggleEditMode(true);
    },

    saveProfile: async function() {
        const nameInput = document.getElementById('edit-name-input');
        const bioInput = document.getElementById('edit-bio-input');
        const avatarInput = document.getElementById('avatar-input');
        const coverInput = document.getElementById('cover-input');

        const editBtn = document.getElementById('edit-profile-btn');
        const originalHtml = editBtn.innerHTML;
        editBtn.innerHTML = '⌛ Đang lưu...';
        editBtn.disabled = true;

        try {
            const payload = {
                displayName: nameInput ? nameInput.value.trim() : this.user.displayName,
                notes: bioInput ? bioInput.value.trim() : this.user.notes
            };

            // Handle images if any
            if (avatarInput.files[0]) {
                payload.avatar = await this.toBase64(avatarInput.files[0]);
            }
            if (coverInput.files[0]) {
                payload.cover = await this.toBase64(coverInput.files[0]);
            }

            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (data.success) {
                if (window.WanderUI) window.WanderUI.showToast("Đã lưu hồ sơ!", "success");
                this.user = Object.assign(this.user, payload);
                this.toggleEditMode(false);
                
                // Re-render current tab to update avatars in posts
                this.switchTab(this.activeTab);
                
                // Refresh global header avatar
                if (typeof window.refreshAuthUI === 'function') window.refreshAuthUI();
                else if (typeof syncAuthUI === 'function') syncAuthUI();
            } else {
                alert(data.message || "Lỗi khi lưu");
            }
        } catch (err) {
            console.error(err);
            alert("Lỗi kết nối máy chủ");
        } finally {
            editBtn.innerHTML = originalHtml;
            editBtn.disabled = false;
        }
    },

    toBase64: file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    }),

    switchTab: function(tab) {
        this.activeTab = tab;
        const content = document.getElementById('profile-tab-content');
        if (!content) return;
        content.innerHTML = '<div class="loading-shimmer" style="padding:40px;text-align:center">Đang tải...</div>';

        switch (tab) {
            case 'diary': this.loadDiary(); break;
            case 'trips': this.loadTrips(); break;
            case 'friends': this.loadFriends(); break;
            case 'medals': this.loadMedals(); break;
            case 'settings': this.loadSettings(); break;
        }
    },

    loadSettings: function() {
        if (!this.isOwnProfile) {
            document.getElementById('profile-tab-content').innerHTML = '<div class="glass-card" style="text-align:center;padding:60px;"><p style="color:var(--text-muted)">Bạn không có quyền chỉnh sửa hồ sơ này.</p></div>';
            return;
        }
        const content = document.getElementById('profile-tab-content');
        const template = document.getElementById('settings-form-container');
        content.innerHTML = template.innerHTML;

        // Populate data
        const f = content.querySelector('form');
        if (f && this.user) {
            f.elements.displayName.value = this.user.displayName || this.user.name || "";
            f.elements.notes.value = this.user.notes || "";
            f.elements.phone.value = this.user.phone || "";
            
            const avatarPreview = content.querySelector('[data-avatar-preview-img]');
            const avatarInitial = content.querySelector('[data-avatar-preview-initial]');
            if (avatarPreview && this.user.avatar) {
                avatarPreview.src = this.user.avatar;
                avatarPreview.hidden = false;
                if (avatarInitial) avatarInitial.style.display = 'none';
            }
            
            // Re-setup preview logic for the new DOM elements
            const fileInput = content.querySelector('[data-avatar-file-input]');
            if (fileInput) {
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            if (avatarPreview) {
                                avatarPreview.src = ev.target.result;
                                avatarPreview.hidden = false;
                            }
                            if (avatarInitial) avatarInitial.style.display = 'none';
                        };
                        reader.readAsDataURL(file);
                    }
                };
            }
            
            const removeBtn = content.querySelector('[data-avatar-remove]');
            if (removeBtn) {
                removeBtn.onclick = () => {
                    if (avatarPreview) {
                        avatarPreview.src = "";
                        avatarPreview.hidden = true;
                    }
                    if (avatarInitial) avatarInitial.style.display = 'flex';
                    if (fileInput) fileInput.value = "";
                };
            }

            // Important: Re-attach submission logic because main.js only bound to the initial (hidden) form if any
            // Actually, we should trigger the main.js logic if possible, or just replicate it.
            // Replicating it is safer since we are in a separate JS module context.
            f.onsubmit = async (e) => {
                e.preventDefault();
                const btn = f.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                btn.innerHTML = '⌛ Đang lưu...';
                btn.disabled = true;

                const fd = new FormData(f);
                const file = fileInput.files[0];
                
                const saveData = async (avatarDataUrl) => {
                    try {
                        const payload = {
                            displayName: fd.get('displayName').trim(),
                            phone: fd.get('phone').trim(),
                            notes: fd.get('notes').trim(),
                            avatar: avatarDataUrl !== undefined ? avatarDataUrl : this.user.avatar
                        };
                        
                        const res = await fetch('/api/auth/profile', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') },
                            body: JSON.stringify(payload)
                        });
                        const data = await res.json();
                        if (data.success) {
                            if (window.WanderUI) window.WanderUI.showToast("Cập nhật thành công!", "success");
                            this.user = Object.assign(this.user, payload);
                            this.loadFullProfile(); // Update header
                        } else {
                            if (window.WanderUI) window.WanderUI.showToast(data.message || "Lỗi cập nhật", "error");
                        }
                    } catch (err) {
                        if (window.WanderUI) window.WanderUI.showToast("Lỗi kết nối", "error");
                    } finally {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }
                };

                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => saveData(ev.target.result);
                    reader.readAsDataURL(file);
                } else {
                    // Check if avatar was removed
                    const isRemoved = avatarPreview.hidden;
                    saveData(isRemoved ? "" : undefined);
                }
            };
        }
    },

    loadDiary: async function() {
        const content = document.getElementById('profile-tab-content');
        if (!this.profileUserId) return;
        
        let html = '';
        
        // Add FB-style Post Composer if own profile
        if (this.isOwnProfile) {
            html += `
                <div class="fb-card composer-card" style="padding:12px 16px;">
                    <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
                        <img src="${this.user.avatar || 'assets/default-avatar.svg'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
                        <div style="flex:1;background:#3a3b3c;border-radius:20px;padding:8px 16px;color:#b0b3b8;cursor:pointer;" onclick="window.location.href='social-hub.html'">
                            Bạn đang nghĩ gì?
                        </div>
                    </div>
                    <div style="display:flex;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);justify-content:space-around;font-size:0.9rem;font-weight:600;color:#b0b3b8;">
                        <span style="display:flex;align-items:center;gap:8px;cursor:pointer;"><i style="color:#f3425f;">📹</i> Video trực tiếp</span>
                        <span style="display:flex;align-items:center;gap:8px;cursor:pointer;"><i style="color:#45bd62;">🖼️</i> Ảnh/video</span>
                        <span style="display:flex;align-items:center;gap:8px;cursor:pointer;"><i style="color:#f7b928;">😊</i> Cảm xúc/hoạt động</span>
                    </div>
                </div>
            `;
        }

        try {
            const res = await fetch(`/api/social/posts/user/${this.profileUserId}`, { 
                headers: { 'x-auth-token': localStorage.getItem('wander_token') } 
            });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                // Collect photos for the sidebar grid
                const allPhotos = [];
                data.data.forEach(p => {
                    if (p.media) p.media.forEach(m => allPhotos.push(m.url));
                });
                this.updatePhotoGrid(allPhotos);

                content.innerHTML = html + data.data.map(post => {
                    const displayAvatar = (this.isOwnProfile && post.userId === this.user?._id) 
                        ? (this.user?.avatar || 'assets/default-avatar.svg') 
                        : (post.userAvatar || 'assets/default-avatar.svg');

                    return `
                        <div class="glass-card post-card" style="margin-bottom:1.5rem;padding:1.25rem;">
                            <div class="post-header" style="display:flex;align-items:center;gap:12px;margin-bottom:15px;">
                                <img src="${displayAvatar}" class="avatar-sm" alt="" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}">
                                <div style="flex:1;">
                                    <h4 style="margin:0;font-size:0.95rem;color:#fff;">${post.userName}</h4>
                                    <span style="font-size:0.75rem;color:var(--text-muted)">${this.formatTime(post.createdAt)}</span>
                                </div>
                                <button class="btn-xs btn--ghost" style="opacity:0.6;">•••</button>
                            </div>
                            <div class="post-content" style="font-size:0.95rem;line-height:1.6;color:rgba(255,255,255,0.9);margin-bottom:12px;">
                                ${post.content}
                            </div>
                            ${post.media?.length > 0 ? `
                                <div class="post-media-grid" style="display:grid;grid-template-columns:repeat(${Math.min(post.media.length, 2)}, 1fr);gap:8px;border-radius:16px;overflow:hidden;margin-bottom:15px;">
                                    ${post.media.map(m => `
                                        <img src="${m.url}" style="width:100%;max-height:450px;object-fit:cover;cursor:pointer;" onclick="UserProfile.viewImage('${m.url}')" onerror="this.style.display='none'">
                                    `).join('')}
                                </div>
                            ` : ''}
                            <div class="post-footer" style="display:flex;align-items:center;gap:20px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);">
                                <button class="post-action-btn" onclick="UserProfile.toggleLike('${post._id}')" style="background:none;border:none;color:var(--text-muted);display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem;">
                                    <span style="font-size:1.1rem;">❤️</span> ${post.likes?.length || 0}
                                </button>
                                <button class="post-action-btn" onclick="UserProfile.focusComment('${post._id}')" style="background:none;border:none;color:var(--text-muted);display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem;">
                                    <span style="font-size:1.1rem;">💬</span> ${post.comments?.length || 0}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                content.innerHTML = html + `
                    <div class="profile-empty-state">
                        <i>📝</i>
                        <p>Chưa có bài viết nào trong nhật ký.</p>
                        ${this.isOwnProfile ? '<button class="btn btn--primary" style="margin-top:15px;" onclick="window.location.href=\'social-hub.html\'">Đăng bài ngay</button>' : ''}
                    </div>
                `;
            }
        } catch (err) { 
            console.error(err);
            content.innerHTML = '<div class="glass-card" style="padding:40px;text-align:center;"><p class="error">Không thể tải bài viết. Vui lòng thử lại sau.</p></div>'; 
        }
    },

    loadTrips: async function() {
        const content = document.getElementById('profile-tab-content');
        if (this.isOwnProfile && this.user?.savedTrips?.length > 0) {
            content.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:1.5rem;">
                    ${this.user.savedTrips.map(trip => `
                        <div class="glass-card trip-summary-card" style="padding:1.5rem;position:relative;overflow:hidden;cursor:pointer;" onclick="window.location.href='planner.html?tripId=${trip._id}'">
                            <div style="position:relative;z-index:2;">
                                <h4 style="margin:0 0 10px;color:#fff;display:flex;align-items:center;gap:10px;">
                                    <span style="font-size:1.4rem;">🗺️</span> ${trip.name}
                                </h4>
                                <div style="display:flex;gap:15px;font-size:0.8rem;color:var(--text-muted);">
                                    <span>📍 ${trip.stops?.length || 0} địa điểm</span>
                                    <span>📅 ${this.formatTime(trip.updatedAt || trip.createdAt)}</span>
                                </div>
                            </div>
                            <div style="position:absolute;right:-10px;bottom:-10px;font-size:5rem;opacity:0.05;transform:rotate(-15deg);">🎒</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="profile-empty-state">
                    <i>🎒</i>
                    <p>${this.isOwnProfile ? 'Bạn chưa lưu chuyến đi nào. Hãy bắt đầu lên kế hoạch ngay!' : 'Người dùng này chưa có chuyến đi công khai.'}</p>
                    ${this.isOwnProfile ? '<button class="btn btn--primary" style="margin-top:15px;" onclick="window.location.href=\'planner.html\'">Lên kế hoạch</button>' : ''}
                </div>
            `;
        }
    },

    loadFriends: async function() {
        const content = document.getElementById('profile-tab-content');
        try {
            const res = await fetch('/api/social/friends', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                content.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;">${data.data.map(f => `
                    <div class="glass-card" style="padding:1.25rem;text-align:center;cursor:pointer;" onclick="window.location.href='profile.html?id=${f._id}'">
                        <img src="${f.avatar || 'assets/default-avatar.svg'}" style="width:60px;height:60px;border-radius:16px;object-fit:cover;margin:0 auto 10px;display:block;" onerror="this.src='assets/default-avatar.svg'">
                        <strong style="font-size:0.9rem;">${f.displayName || f.name}</strong>
                        <p style="font-size:0.78rem;color:var(--text-muted);margin:4px 0 0;">Hạng ${f.rank || 'Đồng'} · ${f.points || 0} XP</p>
                    </div>
                `).join('')}</div>`;
            } else {
                content.innerHTML = '<div class="glass-card" style="text-align:center;padding:60px;"><p style="font-size:2rem;margin-bottom:8px;">👥</p><p style="color:var(--text-muted)">Chưa có bạn bè.</p></div>';
            }
        } catch (err) { content.innerHTML = '<p class="error">Lỗi tải danh sách bạn bè.</p>'; }
    },

    loadMedals: async function() {
        const content = document.getElementById('profile-tab-content');
        const points = this.isOwnProfile ? (this.user?.points || 0) : 0;
        const rank = this.isOwnProfile ? (this.user?.rank || 'Đồng') : 'Đồng';
        const quests = this.isOwnProfile ? (this.user?.claimedQuests?.length || 0) : 0;
        content.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;">
                <div class="glass-card" style="padding:1.5rem;text-align:center;">
                    <p style="font-size:2.5rem;margin:0;">🏅</p>
                    <strong style="font-size:1.2rem;">${points}</strong>
                    <p style="color:var(--text-muted);font-size:0.85rem;margin:4px 0 0;">Điểm tích lũy</p>
                </div>
                <div class="glass-card" style="padding:1.5rem;text-align:center;">
                    <p style="font-size:2.5rem;margin:0;">⭐</p>
                    <strong style="font-size:1.2rem;">Hạng ${rank}</strong>
                    <p style="color:var(--text-muted);font-size:0.85rem;margin:4px 0 0;">Cấp bậc hiện tại</p>
                </div>
                <div class="glass-card" style="padding:1.5rem;text-align:center;">
                    <p style="font-size:2.5rem;margin:0;">🎯</p>
                    <strong style="font-size:1.2rem;">${quests}</strong>
                    <p style="color:var(--text-muted);font-size:0.85rem;margin:4px 0 0;">Nhiệm vụ hoàn thành</p>
                </div>
            </div>
        `;
    },

    formatTime: function(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now - date) / 1000;
        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
        if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
        return date.toLocaleDateString('vi-VN');
    },

    updatePhotoGrid: function(photos) {
        const grid = document.getElementById('profile-photos-preview');
        if (!grid) return;
        if (!photos || photos.length === 0) {
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:0.8rem;padding:20px;">Chưa có ảnh nào.</p>';
            return;
        }
        
        // Show only last 9 photos
        const slice = photos.slice(0, 9);
        grid.innerHTML = slice.map(src => `
            <div style="position:relative;overflow:hidden;border-radius:12px;aspect-ratio:1/1;background:rgba(255,255,255,0.05);">
                <img src="${src}" style="width:100%;height:100%;object-fit:cover;transition:0.3s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" onclick="UserProfile.viewImage('${src}')" onerror="this.style.display='none'">
            </div>
        `).join('');
    },

    viewImage: function(url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(10px);';
        overlay.innerHTML = `<img src="${url}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:8px;box-shadow:0 0 50px rgba(0,0,0,0.5);">`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    },

    toggleLike: async function(postId) {
        // Simple like toggle logic
        try {
            await fetch('/api/social/like', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, 
                body: JSON.stringify({ targetId: postId, targetType: 'post' }) 
            });
            this.loadDiary(); // Refresh
        } catch (err) {}
    }
};

window.UserProfile = UserProfile;
document.addEventListener('DOMContentLoaded', () => UserProfile.init());
