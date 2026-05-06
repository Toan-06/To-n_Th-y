const UserProfile = {
    user: null,
    activeTab: 'diary',
    isOwnProfile: true,
    profileUserId: null,

    init: function () {
        console.log("👤 Profile Page v2 Initializing...");
        const token = localStorage.getItem('wander_token');
        if (!token) { window.location.href = "index.html"; return; }

        const params = new URLSearchParams(window.location.search);
        this.profileUserId = params.get('id');

        // Immediate UI feedback using cached data if available
        this.renderPlaceholder();

        // Parallelized loading
        this.loadData();

        this.setupEventListeners();

        // Handle URL parameters for tab linking
        const tab = params.get('tab') || 'diary';
        const shouldEdit = params.get('edit') === 'true';

        this.switchTab(tab);
        document.querySelectorAll('.tab-item').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tab);
        });

        if (shouldEdit && this.isOwnProfile) {
            setTimeout(() => this.toggleEditMode(true), 500);
        }
    },

    loadData: async function () {
        const token = localStorage.getItem('wander_token');
        try {
            // Load current user for 'me' context
            const meRes = await fetch('/api/auth/user/me', { headers: { 'x-auth-token': token } });
            const meData = await meRes.json();
            if (meData.success) {
                this.user = meData.user;
                if (!this.profileUserId || this.profileUserId === this.user._id || this.profileUserId === this.user.id || this.profileUserId === this.user.customId) {
                    this.isOwnProfile = true;
                    this.profileUserId = this.user._id || this.user.id;
                    this.loadFullProfile();
                    this.switchTab(this.activeTab); // Re-trigger content load with proper ID
                    return;
                }
            }

            // If viewing someone else
            if (this.profileUserId) {
                this.isOwnProfile = false;
                await this.loadOtherProfile(this.profileUserId);
                this.switchTab(this.activeTab); // Ensure content loads with resolved ID
            }
        } catch (err) {
            console.error("Error loading profile data:", err);
        }
    },

    renderPlaceholder: function () {
        // Try to fill basic info from local storage if own profile
        const cached = localStorage.getItem('wander_user');
        if (cached && (!this.profileUserId || this.profileUserId.length < 5)) {
            try {
                const u = JSON.parse(cached);
                this.user = u;
                this.loadFullProfile();
            } catch (e) { }
        }
    },

    loadCurrentUser: async function () {
        try {
            const res = await fetch('/api/auth/user/me', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) this.user = data.user;
        } catch (err) { console.error("Lỗi tải user:", err); }
    },

    loadFullProfile: async function () {
        if (!this.user) return;

        // Basic Info
        document.getElementById('user-display-name').textContent = this.user.displayName || this.user.name;
        document.getElementById('user-bio').textContent = this.user.notes || 'Chưa có tiểu sử.';
        document.getElementById('user-id-tag').textContent = `🆔 ${this.user.customId || (this.user._id || this.user.id)?.substring(0, 10)}`;
        document.getElementById('user-rank-badge').textContent = `🏆 Hạng ${this.user.rank || 'Đồng'} ${this.user.rankTier || 'I'}`;
        document.getElementById('user-points').textContent = this.user.points || 0;
        document.getElementById('user-location').textContent = this.user.location || 'Việt Nam';

        // Avatar
        const avatarImg = document.getElementById('user-avatar-big');
        if (this.user.avatar) {
            avatarImg.src = this.user.avatar;
            avatarImg.onerror = () => avatarImg.src = 'assets/default-avatar.svg';
        } else {
            avatarImg.src = 'assets/default-avatar.svg';
        }

        // Cover
        const coverEl = document.getElementById('profile-cover-bg');
        if (this.user.cover) {
            coverEl.style.backgroundImage = `url(${this.user.cover})`;
        } else {
            coverEl.style.backgroundImage = "url('https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=2000')";
        }

        // Action Buttons
        const editBtn = document.getElementById('edit-profile-btn');
        if (editBtn) editBtn.style.display = 'inline-flex';
        const socialBtns = document.getElementById('profile-social-btns');
        if (socialBtns) socialBtns.style.display = 'none';

        // Sidebar Info
        const joinDate = new Date(this.user.createdAt || Date.now());
        document.getElementById('user-joined').textContent = `${joinDate.getMonth() + 1}/${joinDate.getFullYear()}`;

        // Helper visibility
        const coverBtn = document.getElementById('btn-edit-cover');
        if (coverBtn) coverBtn.style.display = 'flex';
        const avatarBtn = document.getElementById('btn-change-avatar');
        if (avatarBtn) avatarBtn.style.display = 'flex';

        if (window.WanderUI && window.WanderUI.finishTopLoader) window.WanderUI.finishTopLoader();
    },

    loadOtherProfile: async function (userId) {
        if (!userId || userId === 'undefined') return;
        try {
            const res = await fetch(`/api/social/users/${userId}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) {
                const u = data.data;
                document.getElementById('user-display-name').textContent = u.displayName || u.name;
                document.getElementById('user-bio').textContent = u.notes || 'Chưa có tiểu sử.';
                document.getElementById('user-id-tag').textContent = `🆔 ${u.customId || u._id?.substring(0, 10)}`;
                document.getElementById('user-rank-badge').textContent = `🏆 Hạng ${u.rank || 'Đồng'} ${u.rankTier || 'I'}`;
                document.getElementById('user-points').textContent = u.points || 0;
                document.getElementById('user-location').textContent = u.location || 'Việt Nam';

                const avatarImg = document.getElementById('user-avatar-big');
                if (u.avatar) {
                    avatarImg.src = u.avatar;
                    avatarImg.onerror = () => avatarImg.src = 'assets/default-avatar.svg';
                } else {
                    avatarImg.src = 'assets/default-avatar.svg';
                }

                const coverEl = document.getElementById('profile-cover-bg');
                if (u.cover) {
                    coverEl.style.backgroundImage = `url(${u.cover})`;
                } else {
                    coverEl.style.backgroundImage = "url('https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=2000')";
                }

                const joinDate = new Date(u.createdAt || Date.now());
                document.getElementById('user-joined').textContent = `${joinDate.getMonth() + 1}/${joinDate.getFullYear()}`;

                // Hide edit, show social buttons
                const editBtn = document.getElementById('edit-profile-btn');
                if (editBtn) editBtn.style.display = 'none';
                const socialBtns = document.getElementById('profile-social-btns');
                if (socialBtns) socialBtns.style.display = 'flex';

                // Hide camera buttons
                const coverBtn = document.getElementById('btn-edit-cover');
                if (coverBtn) coverBtn.style.display = 'none';
                const avatarBtn = document.getElementById('btn-change-avatar');
                if (u.avatar) document.getElementById('user-avatar').src = u.avatar;
                if (u.coverImage) document.getElementById('profile-cover').src = u.coverImage;
            }
            if (window.WanderUI && window.WanderUI.finishTopLoader) window.WanderUI.finishTopLoader();
        } catch (err) {
            console.error("Lỗi tải profile:", err);
            if (window.WanderUI && window.WanderUI.finishTopLoader) window.WanderUI.finishTopLoader();
        }
    },

    checkFriendshipStatus: async function (userId) {
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
        } catch (err) { }
    },

    sendFriendRequest: async function (userId) {
        try {
            const res = await fetch('/api/social/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ recipientId: userId }) });
            const data = await res.json();
            if (data.success) { alert('Đã gửi lời mời kết bạn!'); this.checkFriendshipStatus(userId); }
            else alert(data.message || 'Lỗi!');
        } catch (err) { alert('Lỗi gửi lời mời!'); }
    },

    unfriend: async function (userId) {
        if (!confirm('Bạn có chắc muốn hủy kết bạn?')) return;
        try {
            await fetch('/api/social/friends/unfriend', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ friendId: userId }) });
            this.checkFriendshipStatus(userId);
        } catch (err) { }
    },

    respondFriend: async function (id, action) {
        try {
            await fetch('/api/social/friends/respond', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ friendshipId: id, action }) });
            this.checkFriendshipStatus(this.profileUserId);
        } catch (err) { }
    },

    setupEventListeners: function () {
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
    toggleEditMode: function (active) {
        this.isEditing = active;
        const nameEl = document.getElementById('user-display-name');
        const bioEl = document.getElementById('user-bio');
        const editBtn = document.getElementById('edit-profile-btn');

        if (!nameEl || !bioEl || !editBtn) return;

        if (active) {
            const currentName = nameEl.textContent;
            const currentBio = bioEl.textContent === 'Chưa có tiểu sử.' ? '' : bioEl.textContent;

            nameEl.innerHTML = `<input type="text" id="edit-name-input" value="${currentName}" class="inline-edit-input" placeholder="Tên hiển thị">`;
            bioEl.innerHTML = `<textarea id="edit-bio-input" class="inline-edit-textarea" placeholder="Nhập tiểu sử của bạn...">${currentBio}</textarea>`;

            editBtn.innerHTML = '💾 Lưu thay đổi';
            editBtn.classList.add('btn-saving');

            if (!document.getElementById('cancel-edit-btn')) {
                const cancelBtn = document.createElement('button');
                cancelBtn.id = 'cancel-edit-btn';
                cancelBtn.className = 'btn btn--ghost';
                cancelBtn.style.marginLeft = '12px';
                cancelBtn.style.borderRadius = '14px';
                cancelBtn.innerHTML = 'Hủy';
                cancelBtn.onclick = (e) => {
                    e.preventDefault();
                    this.toggleEditMode(false);
                };
                editBtn.parentNode.appendChild(cancelBtn);
            }
        } else {
            this.loadFullProfile();
            editBtn.innerHTML = '✏️ Chỉnh sửa hồ sơ';
            editBtn.classList.remove('btn-saving');
            const cancelBtn = document.getElementById('cancel-edit-btn');
            if (cancelBtn) cancelBtn.remove();

            const avatarIn = document.getElementById('avatar-input');
            const coverIn = document.getElementById('cover-input');
            if (avatarIn) avatarIn.value = '';
            if (coverIn) coverIn.value = '';
        }
    },

    handleImageChange: async function (e, type) {
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
                const cover = document.getElementById('profile-cover-bg');
                if (cover) cover.style.backgroundImage = `url(${ev.target.result})`;
            }
        };
        reader.readAsDataURL(file);

        // If not in editing mode, start it
        if (!this.isEditing) this.toggleEditMode(true);
    },

    saveProfile: async function () {
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

    switchTab: function (tab) {
        this.activeTab = tab;
        const content = document.getElementById('profile-tab-content');
        if (!content) return;

        // Show non-blocking shimmer skeletons
        content.innerHTML = `
            <div class="shimmer-container" style="padding:20px;">
                <div class="loading-shimmer" style="height:150px;border-radius:20px;margin-bottom:20px;"></div>
                <div class="loading-shimmer" style="height:100px;border-radius:20px;margin-bottom:20px;width:80%;"></div>
                <div class="loading-shimmer" style="height:120px;border-radius:20px;width:60%;"></div>
            </div>
        `;

        switch (tab) {
            case 'diary': this.loadDiary(); break;
            case 'trips': this.loadTrips(); break;
            case 'friends': this.loadFriends(); break;
            case 'medals': this.loadMedals(); break;
            case 'settings': this.loadSettings(); break;
        }
    },

    loadSettings: function () {
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

    loadDiary: async function () {
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
                    const myId = this.user?._id || this.user?.id;
                    const displayAvatar = (this.isOwnProfile && (post.userId === myId || post.userId === this.user?.customId))
                        ? (this.user?.avatar || 'assets/default-avatar.svg')
                        : (post.userAvatar || 'assets/default-avatar.svg');

                    return `
                        <div class="post-card">
                            <div class="post-header">
                                <img src="${displayAvatar}" class="avatar-sm" alt="" onerror="this.src='assets/default-avatar.svg'">
                                <div style="flex:1;">
                                    <h4 style="margin:0; font-size:1.1rem; color:var(--text);">${post.userName}</h4>
                                    <span style="font-size:0.85rem; color:var(--text-muted)">${this.formatTime(post.createdAt)}</span>
                                </div>
                                <button class="btn btn--ghost" style="padding:8px; border-radius:12px;">•••</button>
                            </div>
                            <div class="post-content">
                                ${post.content}
                            </div>
                            ${post.media?.length > 0 ? `
                                <div class="post-media-grid" style="grid-template-columns: repeat(${Math.min(post.media.length, 2)}, 1fr);">
                                    ${post.media.map(m => `
                                        <img src="${m.url}" style="width:100%; max-height:500px; object-fit:cover; border-radius:20px;" onclick="UserProfile.viewImage('${m.url}')">
                                    `).join('')}
                                </div>
                            ` : ''}
                            <div class="post-footer">
                                <button class="post-action-btn" onclick="UserProfile.toggleLike('${post._id}')">
                                    <span>❤️</span> <strong>${post.likes?.length || 0}</strong>
                                </button>
                                <button class="post-action-btn" onclick="UserProfile.focusComment('${post._id}')">
                                    <span>💬</span> <strong>${post.comments?.length || 0}</strong>
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

    loadTrips: async function () {
        const content = document.getElementById('profile-tab-content');
        if (this.isOwnProfile && this.user?.savedTrips?.length > 0) {
            content.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:24px;">
                    ${this.user.savedTrips.map(trip => `
                        <div class="premium-card trip-summary-card" style="position:relative;overflow:hidden;cursor:pointer; padding:32px;" onclick="window.location.href='planner.html?tripId=${trip._id}'">
                            <div style="position:relative;z-index:2;">
                                <h4 style="margin:0 0 12px;color:var(--text);display:flex;align-items:center;gap:12px;font-size:1.3rem;">
                                    <span style="font-size:1.6rem;">🗺️</span> ${trip.name}
                                </h4>
                                <div style="display:flex;gap:20px;font-size:0.9rem;color:var(--text-muted);font-weight:600;">
                                    <span>📍 ${trip.stops?.length || 0} địa điểm</span>
                                    <span>📅 ${this.formatTime(trip.updatedAt || trip.createdAt)}</span>
                                </div>
                            </div>
                            <div style="position:absolute;right:-20px;bottom:-20px;font-size:8rem;opacity:0.03;transform:rotate(-15deg);pointer-events:none;">🎒</div>
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

    loadFriends: async function () {
        const content = document.getElementById('profile-tab-content');
        try {
            const res = await fetch('/api/social/friends', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                content.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px;">${data.data.map(f => `
                    <div class="premium-card" style="padding:28px;text-align:center;cursor:pointer; transition:transform 0.3s;" onmouseover="this.style.transform='translateY(-8px)'" onmouseout="this.style.transform='none'" onclick="window.location.href='profile.html?id=${f._id}'">
                        <img src="${f.avatar || 'assets/default-avatar.svg'}" style="width:80px;height:80px;border-radius:24px;object-fit:cover;margin:0 auto 16px;display:block;box-shadow:var(--shadow-md);" onerror="this.src='assets/default-avatar.svg'">
                        <strong style="font-size:1.1rem; color:var(--text);">${f.displayName || f.name}</strong>
                        <p style="font-size:0.85rem;color:var(--text-muted);margin:8px 0 0; font-weight:600;">Hạng ${f.rank || 'Đồng'} · ${f.points || 0} XP</p>
                    </div>
                `).join('')}</div>`;
            } else {
                content.innerHTML = '<div class="premium-card" style="text-align:center;padding:80px;"><p style="font-size:3rem;margin-bottom:16px;">👥</p><p style="color:var(--text-muted); font-size:1.1rem;">Chưa có bạn bè.</p></div>';
            }
        } catch (err) { content.innerHTML = '<p class="error">Lỗi tải danh sách bạn bè.</p>'; }
    },

    loadMedals: async function () {
        const content = document.getElementById('profile-tab-content');
        const points = this.isOwnProfile ? (this.user?.points || 0) : 0;
        const rank = this.isOwnProfile ? (this.user?.rank || 'Đồng') : 'Đồng';
        const quests = this.isOwnProfile ? (this.user?.claimedQuests?.length || 0) : 0;
        content.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:24px;">
                <div class="premium-card" style="padding:40px;text-align:center;">
                    <p style="font-size:3.5rem;margin-bottom:12px;">🏅</p>
                    <strong style="font-size:1.8rem; color:var(--text);">${points}</strong>
                    <p style="color:var(--text-muted);font-size:1rem;margin:8px 0 0; font-weight:600;">Điểm tích lũy</p>
                </div>
                <div class="premium-card" style="padding:40px;text-align:center;">
                    <p style="font-size:3.5rem;margin-bottom:12px;">⭐</p>
                    <strong style="font-size:1.8rem; color:var(--text);">Hạng ${rank}</strong>
                    <p style="color:var(--text-muted);font-size:1rem;margin:8px 0 0; font-weight:600;">Cấp bậc hiện tại</p>
                </div>
                <div class="premium-card" style="padding:40px;text-align:center;">
                    <p style="font-size:3.5rem;margin-bottom:12px;">🎯</p>
                    <strong style="font-size:1.8rem; color:var(--text);">${quests}</strong>
                    <p style="color:var(--text-muted);font-size:1rem;margin:8px 0 0; font-weight:600;">Nhiệm vụ hoàn thành</p>
                </div>
            </div>
        `;
    },

    formatTime: function (dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now - date) / 1000;
        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
        if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
        return date.toLocaleDateString('vi-VN');
    },

    updatePhotoGrid: function (photos) {
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

    viewImage: function (url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(10px);';
        overlay.innerHTML = `<img src="${url}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:8px;box-shadow:0 0 50px rgba(0,0,0,0.5);">`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    },

    toggleLike: async function (postId) {
        // Simple like toggle logic
        try {
            await fetch('/api/social/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') },
                body: JSON.stringify({ targetId: postId, targetType: 'post' })
            });
            this.loadDiary(); // Refresh
        } catch (err) { }
    },

    focusComment: function (postId) {
        // Redirect to social hub with the post highlighted/open
        window.location.href = `social-hub.html?post=${postId}&focus=comments`;
    }
};

window.UserProfile = UserProfile;
document.addEventListener('DOMContentLoaded', () => UserProfile.init());
