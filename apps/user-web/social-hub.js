const SocialHub = {
    user: null,
    posts: [],
    stories: [],
    activeTab: 'feed',
    chatTarget: null,
    chatPollingInterval: null,
    currentStoryIndex: 0,
    storyProgressInterval: null,

    init: async function() {
        console.log("📖 Social Hub v3 Initializing...");
        const token = localStorage.getItem('wander_token');
        if (!token) {
            this.showGuestLanding();
            return;
        }
        await this.loadUserProfile();
        await this.fetchFeed();
        await this.fetchStories();
        this.setupEventListeners();
        this.fetchPendingFriends();
        this.loadFriendSuggestions();
        this.loadFriendsList();
        this.loadConversations();
        this.renderTrending();
        this.startStoriesAutoRefresh();
        
        // Handle URL parameters for direct chat/tab linking
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            this.switchTab(tab);
            // Clean up URL
            window.history.replaceState({}, document.title, "social-hub.html");
        }
        const chatId = params.get('chat');
        if (chatId) {
            // Need to fetch user details to open chat
            try {
                const res = await fetch(`/api/social/users/${chatId}`, { headers: { 'x-auth-token': token } });
                const data = await res.json();
                if (data.success) {
                    this.openChat(data.data._id, data.data.displayName || data.data.name, data.data.avatar);
                }
            } catch(e) {}
        }
    },

    loadUserProfile: async function() {
        try {
            const res = await fetch('/api/auth/user/me', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) {
                this.user = data.user;
                const nameEl = document.getElementById('mini-name');
                const rankEl = document.getElementById('mini-rank');
                if (nameEl) nameEl.textContent = this.user.displayName || this.user.name;
                if (rankEl) rankEl.textContent = `Hạng ${this.user.rank || 'Đồng'} ${this.user.rankTier || 'I'}`;
                if (this.user.avatar) document.querySelectorAll('#mini-avatar, #post-avatar').forEach(img => img.src = this.user.avatar);
                // Update stats
                const postCount = document.getElementById('stat-posts');
                const friendCount = document.getElementById('stat-friends');
                if (postCount) { try { const r = await fetch(`/api/social/posts/user/${this.user._id}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } }); const d = await r.json(); if (d.success) postCount.textContent = d.data.length; } catch(e){} }
                if (friendCount) { try { const r = await fetch('/api/social/friends', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } }); const d = await r.json(); if (d.success) friendCount.textContent = d.data.length; } catch(e){} }
            }
        } catch (err) { console.error("Lỗi tải hồ sơ:", err); }
    },

    // ========== STORIES SYSTEM ==========
    fetchStories: async function() {
        try {
            const res = await fetch('/api/social/stories', { 
                headers: { 'x-auth-token': localStorage.getItem('wander_token') } 
            });
            const data = await res.json();
            if (data.success) {
                this.stories = data.data;
                this.renderStories();
            }
        } catch (err) { 
            console.error("Lỗi tải stories:", err);
            this.renderStories(); // Render với stories rỗng
        }
    },

    renderStories: function() {
        const container = document.getElementById('stories-container');
        if (!container) return;
        
        // Lấy danh sách stories đã xem từ localStorage
        const viewedStories = JSON.parse(localStorage.getItem('wander_viewed_stories') || '[]');
        
        let storiesHtml = `
            <div class="story-card create-story" onclick="SocialHub.openCreateStoryModal()">
                <div class="story-thumb" style="background-image: url('${this.user?.avatar || 'assets/default-avatar.svg'}')"></div>
                <div class="story-add">+</div>
                <span>Tạo tin</span>
            </div>
        `;
        
        // Group stories theo user
        const userStories = {};
        this.stories.forEach(story => {
            if (!userStories[story.userId]) {
                userStories[story.userId] = {
                    user: story.user,
                    stories: [],
                    hasUnviewed: false
                };
            }
            userStories[story.userId].stories.push(story);
            if (!viewedStories.includes(story._id)) {
                userStories[story.userId].hasUnviewed = true;
            }
        });
        
        // Render mỗi user chỉ 1 story card (hiển thị story mới nhất)
        Object.values(userStories).forEach(group => {
            const latestStory = group.stories[group.stories.length - 1];
            const isViewed = viewedStories.includes(latestStory._id);
            const ringClass = isViewed ? 'story-viewed' : 'story-unviewed';
            
            storiesHtml += `
                <div class="story-card ${ringClass}" onclick="SocialHub.openStoryViewer('${group.user._id}')">
                    <div class="story-thumb" style="background-image: url('${latestStory.media?.[0]?.url || group.user?.avatar || 'assets/default-avatar.svg'}')"></div>
                    <span>${group.user?.displayName || group.user?.name || 'Người dùng'}</span>
                </div>
            `;
        });
        
        container.innerHTML = storiesHtml;
    },

    openStoryViewer: function(userId) {
        // Tìm tất cả stories của user này
        const userStories = this.stories.filter(s => s.userId === userId);
        if (userStories.length === 0) return;
        
        this.currentStoryUserId = userId;
        this.currentStoryIndex = 0;
        this.viewedStoriesList = userStories;
        
        // Tạo story viewer overlay
        const overlay = document.createElement('div');
        overlay.id = 'story-viewer-overlay';
        overlay.className = 'story-viewer-overlay';
        overlay.innerHTML = `
            <div class="story-viewer">
                <div class="story-progress-bars">
                    ${userStories.map((_, i) => `<div class="story-progress-bar ${i === 0 ? 'active' : ''}" data-index="${i}"><div class="progress-fill"></div></div>`).join('')}
                </div>
                <div class="story-header">
                    <div class="story-user-info">
                        <img src="${userStories[0].user?.avatar || 'assets/default-avatar.svg'}" class="story-user-avatar">
                        <span class="story-user-name">${userStories[0].user?.displayName || userStories[0].user?.name}</span>
                        <span class="story-time">${this.formatTime(userStories[0].createdAt)}</span>
                    </div>
                    <button class="story-close" onclick="SocialHub.closeStoryViewer()">×</button>
                </div>
                <div class="story-content" id="story-content"></div>
                <div class="story-nav story-prev" onclick="SocialHub.prevStory()"></div>
                <div class="story-nav story-next" onclick="SocialHub.nextStory()"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        
        // Show first story
        this.showStory(0);
        
        // Start progress
        this.startStoryProgress();
        
        // Đánh dấu đã xem
        this.markStoryAsViewed(userStories[0]._id);
    },

    showStory: function(index) {
        const story = this.viewedStoriesList[index];
        if (!story) return;
        
        const content = document.getElementById('story-content');
        const media = story.media?.[0];
        
        if (media?.type === 'video') {
            content.innerHTML = `<video src="${media.url}" autoplay class="story-media"></video>`;
        } else {
            content.innerHTML = `<img src="${media?.url || story.user?.avatar}" class="story-media">`;
        }
        
        // Update progress bars
        document.querySelectorAll('.story-progress-bar').forEach((bar, i) => {
            bar.classList.toggle('active', i === index);
            bar.classList.toggle('completed', i < index);
        });
        
        // Update time
        document.querySelector('.story-time').textContent = this.formatTime(story.createdAt);
    },

    startStoryProgress: function() {
        if (this.storyProgressInterval) clearInterval(this.storyProgressInterval);
        
        let progress = 0;
        const duration = 5000; // 5 seconds per story
        const interval = 50; // Update every 50ms
        const step = 100 / (duration / interval);
        
        this.storyProgressInterval = setInterval(() => {
            progress += step;
            const activeBar = document.querySelector('.story-progress-bar.active .progress-fill');
            if (activeBar) activeBar.style.width = `${Math.min(progress, 100)}%`;
            
            if (progress >= 100) {
                this.nextStory();
            }
        }, interval);
    },

    nextStory: function() {
        if (this.currentStoryIndex < this.viewedStoriesList.length - 1) {
            this.currentStoryIndex++;
            this.showStory(this.currentStoryIndex);
            this.markStoryAsViewed(this.viewedStoriesList[this.currentStoryIndex]._id);
            this.startStoryProgress();
        } else {
            this.closeStoryViewer();
        }
    },

    prevStory: function() {
        if (this.currentStoryIndex > 0) {
            this.currentStoryIndex--;
            this.showStory(this.currentStoryIndex);
            this.startStoryProgress();
        }
    },

    closeStoryViewer: function() {
        if (this.storyProgressInterval) clearInterval(this.storyProgressInterval);
        const overlay = document.getElementById('story-viewer-overlay');
        if (overlay) overlay.remove();
        document.body.style.overflow = '';
    },

    markStoryAsViewed: function(storyId) {
        const viewed = JSON.parse(localStorage.getItem('wander_viewed_stories') || '[]');
        if (!viewed.includes(storyId)) {
            viewed.push(storyId);
            localStorage.setItem('wander_viewed_stories', JSON.stringify(viewed));
        }
    },

    openCreateStoryModal: function() {
        // Tạo modal tạo story
        const modal = document.createElement('div');
        modal.id = 'create-story-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="create-story-modal">
                <div class="modal-header">
                    <h3>Tạo tin mới</h3>
                    <button onclick="document.getElementById('create-story-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="story-upload-area" onclick="document.getElementById('story-file-input').click()">
                        <span class="upload-icon">📷</span>
                        <p>Chọn ảnh hoặc video</p>
                        <input type="file" id="story-file-input" accept="image/*,video/*" hidden onchange="SocialHub.handleStoryUpload(this)">
                    </div>
                    <div id="story-preview" style="display:none; margin-top:1rem;">
                        <img id="story-preview-img" style="max-width:100%; border-radius:12px;">
                        <video id="story-preview-video" style="max-width:100%; border-radius:12px; display:none;" controls></video>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn--primary btn--block" onclick="SocialHub.submitStory()" id="story-submit-btn" disabled>Đăng tin</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    handleStoryUpload: function(input) {
        const file = input.files[0];
        if (!file) return;
        
        const preview = document.getElementById('story-preview');
        const img = document.getElementById('story-preview-img');
        const video = document.getElementById('story-preview-video');
        
        preview.style.display = 'block';
        
        if (file.type.startsWith('video/')) {
            img.style.display = 'none';
            video.style.display = 'block';
            video.src = URL.createObjectURL(file);
        } else {
            video.style.display = 'none';
            img.style.display = 'block';
            img.src = URL.createObjectURL(file);
        }
        
        document.getElementById('story-submit-btn').disabled = false;
        this.storyFileToUpload = file;
    },

    submitStory: async function() {
        if (!this.storyFileToUpload) return;
        
        const formData = new FormData();
        formData.append('media', this.storyFileToUpload);
        
        try {
            const res = await fetch('/api/social/stories', {
                method: 'POST',
                headers: { 'x-auth-token': localStorage.getItem('wander_token') },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('create-story-modal').remove();
                this.storyFileToUpload = null;
                this.fetchStories(); // Refresh stories
                if (window.WanderUI) WanderUI.showToast('Đã đăng tin!', 'success');
            }
        } catch (err) {
            console.error("Lỗi đăng story:", err);
            if (window.WanderUI) WanderUI.showToast('Lỗi đăng tin', 'error');
        }
    },

    startStoriesAutoRefresh: function() {
        // Refresh stories mỗi 2 phút
        setInterval(() => {
            this.fetchStories();
        }, 120000);
    },

    fetchFeed: async function() {
        const feedContainer = document.getElementById('feed-container');
        if (!feedContainer) return;
        feedContainer.innerHTML = '<div class="loading-shimmer" style="padding:40px;text-align:center">Đang tải bảng tin...</div>';
        try {
            const res = await fetch('/api/social/feed', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) { this.posts = data.data; this.renderFeed(); }
        } catch (err) { feedContainer.innerHTML = '<p class="error" style="text-align:center;padding:40px;">Không thể tải bảng tin.</p>'; }
    },

    renderFeed: function() {
        const feedContainer = document.getElementById('feed-container');
        if (!feedContainer) return;
        if (this.posts.length === 0) {
            feedContainer.innerHTML = '<div class="glass-card" style="text-align:center;padding:60px;"><p style="font-size:1.2rem;margin-bottom:8px;">📝</p><p style="color:var(--text-muted)">Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!</p></div>';
            return;
        }
        feedContainer.innerHTML = this.posts.map(post => this.renderPostCard(post)).join('');
    },

    renderPostCard: function(post) {
        // Xử lý reactions (6 loại: like, love, wow, haha, sad, angry)
        const reactions = post.reactions || {};
        const userReaction = reactions[this.user?._id] || null;
        const totalReactions = Object.values(reactions).length;
        
        // Đếm từng loại reaction
        const reactionCounts = { like: 0, love: 0, wow: 0, haha: 0, sad: 0, angry: 0 };
        Object.values(reactions).forEach(r => {
            if (reactionCounts[r] !== undefined) reactionCounts[r]++;
        });
        
        // Top 3 reactions để hiển thị
        const topReactions = Object.entries(reactionCounts)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type]) => type);
        
        const postAuthorId = post.userId?._id || post.userId;
        const isOwner = postAuthorId === this.user?._id || postAuthorId?.toString() === this.user?._id;
        const commentsHtml = (post.comments || []).slice(-3).map(c => this.renderCommentItem(c, postAuthorId)).join('');

        return `
            <div class="glass-card post-card" data-post-id="${post._id}">
                <div class="post-header">
                    <div class="post-user" onclick="SocialHub.viewProfile('${post.userId}')">
                        <img src="${post.userAvatar || 'assets/default-avatar.svg'}" alt="" class="avatar-sm" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}">
                        <div>
                            <h4>${post.userName}</h4>
                            <span class="post-time">${this.formatTime(post.createdAt)}${post.location?.name ? ' · 📍' + post.location.name : ''}</span>
                        </div>
                    </div>
                    ${isOwner ? `
                        <div class="post-menu-dropdown">
                            <button class="btn-icon post-menu-btn" onclick="SocialHub.togglePostMenu('${post._id}')">⋯</button>
                            <div class="post-menu" id="post-menu-${post._id}" style="display:none">
                                <button onclick="SocialHub.editPost('${post._id}')">✏️ Chỉnh sửa</button>
                                <button onclick="SocialHub.deletePost('${post._id}')" class="text-danger">🗑️ Xóa</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="post-content">${this.linkifyContent(post.content)}</div>
                ${post.media && post.media.length > 0 ? `
                    <div class="post-media ${post.media.length > 1 ? 'media-grid' : ''}">
                        ${post.media.map((m, i) => m.type === 'image' 
                            ? `<img src="${m.url}" alt="Ảnh bài viết" onclick="SocialHub.viewImage('${m.url}')" onerror="this.style.display='none'">` 
                            : `<video src="${m.url}" controls ${i === 0 ? 'autoplay muted' : ''}></video>`
                        ).join('')}
                    </div>
                ` : ''}
                
                <!-- Reactions Bar -->
                <div class="post-reactions-bar">
                    ${topReactions.length > 0 ? `
                        <div class="reactions-display" onclick="SocialHub.showReactionsList('${post._id}')">
                            ${topReactions.map(r => `<span class="reaction-emoji">${this.getReactionEmoji(r)}</span>`).join('')}
                            <span class="reaction-count">${totalReactions}</span>
                        </div>
                    ` : '<div></div>'}
                    <span class="comments-shares-count">${(post.comments || []).length} bình luận · ${post.shares || 0} lượt chia sẻ</span>
                </div>
                
                <!-- Action Buttons -->
                <div class="post-footer">
                    <div class="reaction-wrapper" 
                         onmouseleave="SocialHub.hideReactionPicker('${post._id}')">
                        <button class="post-action ${userReaction ? 'has-reaction reaction-' + userReaction : ''}" 
                                onclick="SocialHub.toggleReaction('${post._id}')"
                                onmouseenter="SocialHub.showReactionPicker('${post._id}')">
                            ${userReaction ? `<span class="reaction-active-emoji">${this.getReactionEmoji(userReaction)}</span> ${this.getReactionLabel(userReaction)}` : '<i class="far fa-heart"></i> Thích'}
                        </button>
                        <!-- Reaction Picker -->
                        <div class="reaction-picker" id="reaction-picker-${post._id}">
                            <span onclick="SocialHub.setReaction('${post._id}', 'like')" class="reaction-btn">❤️</span>
                            <span onclick="SocialHub.setReaction('${post._id}', 'love')" class="reaction-btn">😍</span>
                            <span onclick="SocialHub.setReaction('${post._id}', 'wow')" class="reaction-btn">😮</span>
                            <span onclick="SocialHub.setReaction('${post._id}', 'haha')" class="reaction-btn">😂</span>
                            <span onclick="SocialHub.setReaction('${post._id}', 'sad')" class="reaction-btn">😢</span>
                            <span onclick="SocialHub.setReaction('${post._id}', 'angry')" class="reaction-btn">😠</span>
                        </div>
                    </div>
                    <button class="post-action" onclick="SocialHub.toggleCommentBox('${post._id}')">💬 Bình luận</button>
                    <button class="post-action" onclick="SocialHub.sharePost('${post._id}')">↗️ Chia sẻ</button>
                </div>
                
                <!-- Comments Section -->
                <div class="comment-section" id="comments-${post._id}" style="display:none">
                    <div class="comments-list" id="comments-list-${post._id}">
                        ${commentsHtml || '<p class="no-comments">Chưa có bình luận. Hãy là người đầu tiên!</p>'}
                    </div>
                    ${(post.comments || []).length > 3 ? `<button class="show-all-comments" onclick="SocialHub.showAllComments('${post._id}')">Xem tất cả ${post.comments.length} bình luận</button>` : ''}
                    <div class="comment-input-wrap">
                        <img src="${this.user?.avatar || 'assets/default-avatar.svg'}" class="comment-avatar" alt="" onerror="this.src='assets/default-avatar.svg'">
                        <div class="comment-input-box">
                            <input type="text" placeholder="Viết bình luận..." id="comment-input-${post._id}" 
                                   onkeydown="if(event.key==='Enter')SocialHub.addComment('${post._id}')">
                            <button class="comment-send-btn" onclick="SocialHub.addComment('${post._id}')">➤</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ========== REACTIONS SYSTEM ==========
    getReactionEmoji: function(type) {
        const emojis = { like: '❤️', love: '😍', wow: '😮', haha: '😂', sad: '😢', angry: '😠' };
        return emojis[type] || '❤️';
    },

    getReactionLabel: function(type) {
        const labels = { like: 'Thích', love: 'Yêu thích', wow: 'Wow', haha: 'Haha', sad: 'Buồn', angry: 'Phẫn nộ' };
        return labels[type] || 'Thích';
    },

    toggleReaction: function(postId) {
        // Toggle like mặc định nếu chưa có reaction
        const post = this.posts.find(p => p._id === postId);
        if (!post) return;
        
        const currentReaction = post.reactions?.[this.user._id];
        if (currentReaction) {
            this.removeReaction(postId);
        } else {
            this.setReaction(postId, 'like');
        }
    },

    setReaction: function(postId, reactionType) {
        // Gửi reaction lên server
        fetch(`/api/social/posts/${postId}/reaction`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('wander_token')
            },
            body: JSON.stringify({ reaction: reactionType })
        }).then(res => res.json()).then(data => {
            if (data.success) {
                // Cập nhật local
                const post = this.posts.find(p => p._id === postId);
                if (post) {
                    if (!post.reactions) post.reactions = {};
                    post.reactions[this.user._id] = reactionType;
                    this.renderFeed();
                }
                this.hideReactionPicker(postId);
            }
        }).catch(err => console.error('Reaction error:', err));
    },

    removeReaction: function(postId) {
        fetch(`/api/social/posts/${postId}/reaction`, {
            method: 'DELETE',
            headers: { 'x-auth-token': localStorage.getItem('wander_token') }
        }).then(res => res.json()).then(data => {
            if (data.success) {
                const post = this.posts.find(p => p._id === postId);
                if (post && post.reactions) {
                    delete post.reactions[this.user._id];
                    this.renderFeed();
                }
            }
        }).catch(err => console.error('Remove reaction error:', err));
    },

    showReactionPicker: function(postId) {
        if (this.pickerTimeout) clearTimeout(this.pickerTimeout);
        const picker = document.getElementById(`reaction-picker-${postId}`);
        if (picker) picker.classList.add('visible');
    },

    hideReactionPicker: function(postId) {
        this.pickerTimeout = setTimeout(() => {
            const picker = document.getElementById(`reaction-picker-${postId}`);
            if (picker) picker.classList.remove('visible');
        }, 300);
    },

    showReactionsList: function(postId) {
        const post = this.posts.find(p => p._id === postId);
        if (!post || !post.reactions) return;
        
        // Tạo modal hiển thị danh sách người đã react
        const reactions = post.reactions;
        const users = Object.entries(reactions).map(([userId, reaction]) => ({ userId, reaction }));
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay reactions-list-modal';
        modal.innerHTML = `
            <div class="glass-card reactions-modal-content">
                <div class="modal-header">
                    <h3>Lượt thích · ${Object.keys(reactions).length}</h3>
                    <button onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="reactions-tabs">
                    <button class="tab active" data-tab="all">Tất cả</button>
                    ${['like', 'love', 'wow', 'haha', 'sad', 'angry'].map(r => 
                        `<button class="tab" data-tab="${r}">${this.getReactionEmoji(r)}</button>`
                    ).join('')}
                </div>
                <div class="reactions-list">
                    ${users.map(u => `
                        <div class="reaction-user-item">
                            <img src="assets/default-avatar.svg" class="avatar-sm">
                            <span>Người dùng</span>
                            <span class="user-reaction">${this.getReactionEmoji(u.reaction)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    renderCommentItem: function(comment, postAuthorId) {
        const isAuthor = (comment.userId?._id || comment.userId) === postAuthorId;
        return `
            <div class="comment-item" data-comment-id="${comment._id}">
                <img src="${comment.userAvatar || 'assets/default-avatar.svg'}" class="comment-avatar" 
                     onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}">
                <div class="comment-content">
                    <div class="comment-bubble">
                        <div class="comment-user-info">
                            <strong>${comment.userName}</strong>
                            ${isAuthor ? '<span class="author-badge">Tác giả</span>' : ''}
                        </div>
                        <span class="comment-text">${this.linkifyContent(comment.text)}</span>
                    </div>
                    <div class="comment-actions">
                        <button onclick="SocialHub.likeComment('${comment._id}')">Thích</button>
                        <button onclick="SocialHub.replyComment('${comment._id}')">Trả lời</button>
                        <span class="comment-time">${this.formatTime(comment.createdAt)}</span>
                    </div>
                    ${comment.replies?.length > 0 ? `
                        <div class="comment-replies">
                            ${comment.replies.map(r => this.renderCommentItem(r, postAuthorId)).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    togglePostMenu: function(postId) {
        const menu = document.getElementById(`post-menu-${postId}`);
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    editPost: function(postId) {
        // TODO: Implement edit functionality
        if (window.WanderUI) WanderUI.showToast('Tính năng chỉnh sửa đang phát triển', 'info');
    },

    linkifyContent: function(text) {
        if (!text) return '';
        return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
                   .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
                   .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
                   .replace(/\n/g, '<br>');
    },

    setupEventListeners: function() {
        // Open post modal
        const openBtn = document.getElementById('open-post-modal');
        if (openBtn) openBtn.onclick = () => { this.openPostModal(); };
        
        // Post tools triggers
        document.querySelectorAll('.post-tool').forEach((tool, idx) => {
            tool.onclick = (e) => {
                e.stopPropagation();
                this.openPostModal();
                if (idx === 0) document.getElementById('media-upload')?.click();
                if (idx === 1) document.getElementById('tag-location')?.click();
                if (idx === 2) alert("Tính năng Cảm xúc sẽ sớm ra mắt!");
            };
        });

        // Close post modal
        document.getElementById('close-modal-btn')?.addEventListener('click', () => { document.getElementById('post-modal')?.setAttribute('hidden', ''); });
        document.getElementById('post-modal')?.addEventListener('click', (e) => { if(e.target.id === 'post-modal') e.target.setAttribute('hidden', ''); });
        
        // Close post modal v2
        document.getElementById('close-post-modal')?.addEventListener('click', () => { document.getElementById('post-modal')?.setAttribute('hidden', ''); });
        
        // Submit post
        document.getElementById('submit-post')?.addEventListener('click', () => this.submitPost());
        
        // Tag location
        document.getElementById('tag-location')?.addEventListener('click', () => {
            const name = prompt("Nhập tên địa điểm:"); 
            if (name) { 
                document.getElementById('tag-location').innerHTML = `📍 ${name}`; 
                document.getElementById('tag-location').dataset.location = name; 
                document.getElementById('tag-location').classList.add('active');
            }
        });
        // Upload media
        document.getElementById('media-upload')?.addEventListener('change', (e) => {
            const preview = document.getElementById('media-preview');
            if (!preview) return;
            preview.innerHTML = '';
            Array.from(e.target.files).forEach(f => {
                const url = URL.createObjectURL(f);
                preview.innerHTML += f.type.startsWith('image') ? `<img src="${url}" class="preview-thumb">` : `<video src="${url}" class="preview-thumb" controls></video>`;
            });
        });
        // Search users
        const searchInput = document.getElementById('user-search-input');
        if (searchInput) {
            let debounce;
            searchInput.oninput = () => { clearTimeout(debounce); debounce = setTimeout(() => this.searchUsers(searchInput.value), 300); };
        }
        // Chat drawer close
        document.getElementById('close-chat')?.addEventListener('click', () => this.closeChat());
        // Chat send
        document.getElementById('chat-send-btn')?.addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendMessage(); });
        // Tab switching (including mobile)
        document.querySelectorAll('.social-nav-tab, .mobile-nav-item').forEach(tab => {
            tab.onclick = (e) => { e.preventDefault(); this.switchTab(tab.dataset.tab); };
        });
    },

    openPostModal: function() {
        const m = document.getElementById('post-modal');
        if (m) {
            m.removeAttribute('hidden');
            document.getElementById('post-content')?.focus();
        }
    },

    switchTab: function(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.social-nav-tab, .mobile-nav-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.tab-panel').forEach(p => p.style.display = p.id === `panel-${tab}` ? 'block' : 'none');
        
        // Scroll to top when switching tabs
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    searchUsers: async function(query) {
        const resultsEl = document.getElementById('search-results');
        if (!resultsEl || !query || query.length < 2) { if (resultsEl) resultsEl.innerHTML = ''; return; }
        try {
            const res = await fetch(`/api/social/users/search?q=${encodeURIComponent(query)}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) {
                resultsEl.innerHTML = data.data.map(u => `
                    <div class="search-result-item" onclick="SocialHub.viewProfile('${u._id}')">
                        <img src="${u.avatar || 'assets/default-avatar.svg'}" class="avatar-xs" alt="" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}">
                        <div class="search-info">
                            <strong>${u.displayName || u.name}</strong>
                            <span>Hạng ${u.rank || 'Đồng'} · ${u.points || 0} XP</span>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {}
    },

    submitPost: async function() {
        const content = document.getElementById('post-content')?.value;
        const fileInput = document.getElementById('media-upload');
        const locationEl = document.getElementById('tag-location');
        const submitBtn = document.getElementById('submit-post');
        if (!content?.trim() && (!fileInput?.files || fileInput.files.length === 0)) return alert("Vui lòng nhập nội dung hoặc chọn ảnh!");
        
        submitBtn.disabled = true; 
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Đang đăng...';
        
        try {
            let res;
            if (fileInput?.files?.length > 0) {
                const formData = new FormData();
                formData.append('content', content || '');
                if (locationEl?.dataset?.location) formData.append('locationName', locationEl.dataset.location);
                Array.from(fileInput.files).forEach(f => formData.append('media', f));
                res = await fetch('/api/social/posts/media', { method: 'POST', headers: { 'x-auth-token': localStorage.getItem('wander_token') }, body: formData });
            } else {
                res = await fetch('/api/social/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ content, location: locationEl?.dataset?.location ? { name: locationEl.dataset.location } : null }) });
            }
            const data = await res.json();
            if (data.success) {
                document.getElementById('post-modal')?.setAttribute('hidden', '');
                document.getElementById('post-content').value = '';
                if (fileInput) fileInput.value = '';
                document.getElementById('media-preview').innerHTML = '';
                if (locationEl) { 
                    locationEl.innerHTML = '📍 Gắn thẻ địa điểm'; 
                    delete locationEl.dataset.location; 
                    locationEl.classList.remove('active');
                }
                await this.fetchFeed();
                await this.loadUserProfile(); // Refresh stats
            }
        } catch (err) { alert("Lỗi khi đăng bài!"); }
        finally { submitBtn.disabled = false; submitBtn.textContent = "Đăng bài"; }
    },

    toggleLike: async function(postId, isLiked) {
        try {
            const endpoint = isLiked ? '/api/social/unlike' : '/api/social/like';
            await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ targetId: postId, targetType: 'post' }) });
            await this.fetchFeed();
        } catch (err) {}
    },

    toggleCommentBox: function(postId) {
        const section = document.getElementById(`comments-${postId}`);
        if (section) { 
            const isHidden = section.style.display === 'none';
            section.style.display = isHidden ? 'block' : 'none';
            if (isHidden) section.querySelector('input')?.focus();
        }
    },

    showAllComments: function(postId) {
        const post = this.posts.find(p => p._id === postId);
        if (!post) return;
        const list = document.querySelector(`#comments-${postId} .comments-list`);
        if (list) {
            list.innerHTML = post.comments.map(c => `
                <div class="comment-item">
                    <img src="${c.userAvatar || 'assets/default-avatar.svg'}" class="comment-avatar" alt="" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}">
                    <div class="comment-body"><strong>${c.userName}</strong> ${c.text}</div>
                </div>
            `).join('');
        }
    },

    addComment: async function(postId) {
        const input = document.getElementById(`comment-input-${postId}`);
        const text = input?.value?.trim();
        if (!text) return;
        input.value = '';
        try {
            await fetch(`/api/social/posts/${postId}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ text }) });
            await this.fetchFeed();
            setTimeout(() => { const s = document.getElementById(`comments-${postId}`); if (s) s.style.display = 'block'; }, 100);
        } catch (err) {}
    },

    sharePost: async function(postId) {
        const postUrl = `${window.location.origin}/social-hub.html?post=${postId}`;
        try {
            await navigator.clipboard.writeText(postUrl);
            const btn = event.currentTarget;
            const originalText = btn.innerHTML;
            btn.innerHTML = '✅ Đã sao chép';
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        } catch (err) {
            alert("Không thể sao chép liên kết!");
        }
    },

    deletePost: async function(postId) {
        if (!window.WanderUI || !WanderUI.confirm) {
            if (!confirm("Bạn có chắc muốn xóa bài viết này?")) return;
        } else {
            const ok = await WanderUI.confirm("Xóa bài viết", "Bạn có chắc chắn muốn xóa bài viết này không? Hành động này không thể hoàn tác.");
            if (!ok) return;
        }
        try {
            await fetch(`/api/social/posts/${postId}`, { method: 'DELETE', headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            await this.fetchFeed();
            await this.loadUserProfile(); // Update stats
        } catch (err) {}
    },

    viewProfile: function(userId) {
        window.location.href = `profile.html?id=${userId}`;
    },

    viewImage: function(url) {
        const overlay = document.createElement('div');
        overlay.className = 'image-viewer-overlay';
        overlay.innerHTML = `
            <div class="viewer-content">
                <img src="${url}">
                <button class="close-viewer">&times;</button>
            </div>
        `;
        overlay.onclick = (e) => { if (e.target.tagName !== 'IMG') overlay.remove(); };
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('active'), 10);
    },

    // ========== GUEST STATE HANDLING ==========
    showGuestLanding: function() {
        const main = document.querySelector('.social-main');
        if (!main) return;
        main.innerHTML = `
            <div class="container" style="max-width: 800px; padding: 6rem 1rem; text-align: center;">
                <div class="glass-panel" style="padding: 4rem 2rem; border-radius: 32px;">
                    <h1 style="font-size: 2.5rem; margin-bottom: 1rem; font-family: var(--font-display);">👋 Chào mừng đến với Cộng đồng</h1>
                    <p style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 2.5rem; line-height: 1.6;">
                        Hãy đăng nhập để kết nối với hàng nghìn du khách, chia sẻ trải nghiệm và nhận những gợi ý du lịch độc quyền từ cộng đồng WanderViệt.
                    </p>
                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn--primary btn--large" onclick="WanderUI.openAuthModal('login')">Đăng nhập ngay</button>
                        <button class="btn btn--outline btn--large" onclick="WanderUI.openAuthModal('register')">Tạo tài khoản mới</button>
                    </div>
                </div>
            </div>
        `;
    },

    // ========== TRENDING ==========
    renderTrending: function() {
        const container = document.querySelector('.trending-list');
        if (!container) return;
        
        // Dynamic trending topics based on actual community activity (mocked for now but looking real)
        const trends = [
            { tag: '#WanderViet2024', count: '1.4k bài viết', hot: true },
            { tag: '#PhuQuocIsland', count: '920 bài viết', hot: false },
            { tag: '#HaGiangLoop', count: '750 bài viết', hot: true },
            { tag: '#DuLichVietNam', count: '2.1k bài viết', hot: false },
            { tag: '#TayBacCheckin', count: '430 bài viết', hot: false }
        ];

        container.innerHTML = trends.map(t => `
            <li>
                <div class="trend-item" onclick="SocialHub.searchHashtag('${t.tag}')">
                    <div class="trend-info">
                        <strong>${t.tag}</strong>
                        <span>${t.count}</span>
                    </div>
                    ${t.hot ? '<span class="hot-badge">🔥</span>' : ''}
                </div>
            </li>
        `).join('');
    },

    searchHashtag: function(tag) {
        const input = document.getElementById('user-search-input');
        if (input) {
            input.value = tag;
            this.searchUsers(tag);
        }
    },

    // ========== FRIENDS ==========
    fetchPendingFriends: async function() {
        const container = document.getElementById('friend-suggestions');
        if (!container) return;
        try {
            const res = await fetch('/api/social/friends/pending', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                container.innerHTML = data.data.map(f => `
                    <div class="friend-request-card">
                        <img src="${f.requester?.avatar || 'assets/default-avatar.svg'}" class="avatar-sm" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}" onclick="SocialHub.viewProfile('${f.requester?._id}')" style="cursor:pointer">
                        <div class="friend-info">
                            <strong>${f.requester?.displayName || f.requester?.name || 'Người dùng'}</strong>
                            <span>Hạng ${f.requester?.rank || 'Đồng'}</span>
                        </div>
                        <div class="friend-actions">
                            <button class="btn-xs btn--accept" onclick="SocialHub.respondFriend('${f._id}', 'accept')">✓</button>
                            <button class="btn-xs btn--decline" onclick="SocialHub.respondFriend('${f._id}', 'decline')">&times;</button>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="empty-state-text">Không có lời mời mới.</p>';
            }
        } catch (err) {}
    },

    respondFriend: async function(id, action) {
        try {
            await fetch('/api/social/friends/respond', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ friendshipId: id, action }) });
            this.fetchPendingFriends();
            this.loadFriendsList();
            this.loadUserProfile(); // Update friend count
        } catch (err) {}
    },

    loadFriendsList: async function() {
        const container = document.getElementById('friends-list-container');
        if (!container) return;
        try {
            const res = await fetch('/api/social/friends', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                container.innerHTML = data.data.map(f => `
                    <div class="friend-item" onclick="SocialHub.viewProfile('${f._id}')">
                        <img src="${f.avatar || 'assets/default-avatar.svg'}" class="avatar-sm" alt="" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}">
                        <div class="friend-info">
                            <strong>${f.displayName || f.name}</strong>
                            <span>Hạng ${f.rank || 'Đồng'}</span>
                        </div>
                        <button class="btn-xs btn--chat" onclick="event.stopPropagation(); SocialHub.openChat('${f._id}', '${(f.displayName || f.name).replace(/'/g, '')}', '${f.avatar || ''}')">💬</button>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="empty-state-text">Chưa có bạn bè.</p>';
            }
        } catch (err) {}
    },

    // ========== MESSAGING ==========
    loadConversations: async function() {
        const container = document.getElementById('conversations-list');
        if (!container) return;
        try {
            const res = await fetch('/api/social/conversations', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                container.innerHTML = data.data.map(c => `
                    <div class="convo-item" onclick="SocialHub.openChat('${c.otherUser?._id || ''}', '${(c.otherUser?.displayName || c.otherUser?.name || '').replace(/'/g, '')}', '${c.otherUser?.avatar || ''}')">
                        <img src="${c.otherUser?.avatar || 'assets/default-avatar.svg'}" class="avatar-sm" alt="" onerror="this.src='assets/default-avatar.svg'">
                        <div class="convo-info">
                            <strong>${c.otherUser?.displayName || c.otherUser?.name || 'Người dùng'}</strong>
                            <p>${c.lastMessage?.substring(0, 40) || ''}${c.lastMessage?.length > 40 ? '...' : ''}</p>
                        </div>
                        <span class="convo-time">${this.formatTime(c.lastTime)}</span>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="empty-state-text">Chưa có cuộc trò chuyện.</p>';
            }
        } catch (err) {}
    },

    openChat: async function(userId, name, avatar) {
        this.chatTarget = { userId, name, avatar };
        const drawer = document.getElementById('chat-drawer');
        if (!drawer) return;
        drawer.classList.add('open');
        document.getElementById('chat-target-name').textContent = name;
        document.getElementById('chat-target-avatar').src = avatar || 'assets/default-avatar.svg';
        const body = document.getElementById('chat-messages');
        body.innerHTML = '<div class="chat-loading"><span class="loading-spinner"></span> Đang tải...</div>';
        try {
            const res = await fetch(`/api/social/messages/${userId}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) {
                if (data.data.length === 0) {
                    body.innerHTML = '<div class="chat-empty">Bắt đầu cuộc trò chuyện với <strong>' + name + '</strong></div>';
                } else {
                    body.innerHTML = data.data.map(m => `
                        <div class="chat-msg ${m.senderId === this.user._id || m.senderId?.toString() === this.user._id ? 'sent' : 'received'}">
                            <p>${m.text}</p>
                            <span class="msg-time">${this.formatTime(m.createdAt)}</span>
                        </div>
                    `).join('');
                }
                body.scrollTop = body.scrollHeight;
            }
        } catch (err) { body.innerHTML = '<p class="chat-error">Lỗi tải tin nhắn.</p>'; }

        // Start polling
        if (this.chatPollingInterval) clearInterval(this.chatPollingInterval);
        this.chatPollingInterval = setInterval(() => this.refreshChatMessages(), 3000);
    },

    refreshChatMessages: async function() {
        if (!this.chatTarget) return;
        const body = document.getElementById('chat-messages');
        if (!body) return;
        try {
            const res = await fetch(`/api/social/messages/${this.chatTarget.userId}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                const currentCount = body.querySelectorAll('.chat-msg').length;
                if (data.data.length > currentCount) {
                    const isScrolledToBottom = body.scrollHeight - body.clientHeight <= body.scrollTop + 50;
                    body.innerHTML = data.data.map(m => `
                        <div class="chat-msg ${m.senderId === this.user._id || m.senderId?.toString() === this.user._id ? 'sent' : 'received'}">
                            <p>${m.text}</p>
                            <span class="msg-time">${this.formatTime(m.createdAt)}</span>
                        </div>
                    `).join('');
                    if (isScrolledToBottom) body.scrollTop = body.scrollHeight;
                }
            }
        } catch (err) {}
    },

    closeChat: function() {
        document.getElementById('chat-drawer')?.classList.remove('open');
        this.chatTarget = null;
        if (this.chatPollingInterval) {
            clearInterval(this.chatPollingInterval);
            this.chatPollingInterval = null;
        }
    },

    sendMessage: async function() {
        if (!this.chatTarget) return;
        const input = document.getElementById('chat-input');
        const text = input?.value?.trim();
        if (!text) return;
        input.value = '';
        // Optimistic UI
        const body = document.getElementById('chat-messages');
        const emptyMsg = body.querySelector('.chat-empty, .chat-loading');
        if (emptyMsg) emptyMsg.remove();
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg sent';
        msgDiv.innerHTML = `<p>${text}</p><span class="msg-time">Vừa xong</span>`;
        body.appendChild(msgDiv);
        body.scrollTop = body.scrollHeight;
        
        try {
            await fetch('/api/social/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ recipientId: this.chatTarget.userId, text }) });
        } catch (err) {}
    },

    // ========== FRIEND SUGGESTIONS ==========
    loadFriendSuggestions: async function() {
        const container = document.getElementById('friend-recommendations');
        if (!container) return;
        try {
            const res = await fetch('/api/social/friends/suggestions', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                container.innerHTML = data.data.map(u => `
                    <div class="friend-request-card">
                        <img src="${u.avatar || 'assets/default-avatar.svg'}" class="avatar-sm" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}" onclick="SocialHub.viewProfile('${u._id}')" style="cursor:pointer">
                        <div class="friend-info">
                            <strong>${u.displayName || u.name}</strong>
                            <span>Hạng ${u.rank || 'Đồng'} · ${u.points || 0} XP</span>
                        </div>
                        <button class="btn-xs btn--accept" onclick="SocialHub.sendFriendRequest('${u._id}', this)">Kết bạn</button>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="empty-state-text">Không có đề xuất.</p>';
            }
        } catch (err) { container.innerHTML = '<p class="empty-state-text">Lỗi tải đề xuất.</p>'; }
    },

    sendFriendRequest: async function(userId, btn) {
        try {
            const res = await fetch('/api/social/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ recipientId: userId }) });
            const data = await res.json();
            if (data.success) { 
                btn.textContent = 'Đã gửi'; 
                btn.disabled = true; 
                btn.style.opacity = '0.6';
            } else { 
                alert(data.message || 'Lỗi!'); 
            }
        } catch (err) { alert('Lỗi gửi lời mời!'); }
    },

    // ========== UTILS ==========
    formatTime: function(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now - date) / 1000;
        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
        if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
        if (diff < 604800) return Math.floor(diff / 86400) + ' ngày trước';
        return date.toLocaleDateString('vi-VN');
    }
};

window.SocialHub = SocialHub;
document.addEventListener('DOMContentLoaded', () => SocialHub.init());
