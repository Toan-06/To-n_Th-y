const SocialHub = {
    user: null,
    posts: [],
    stories: [],
    activeTab: 'feed',
    chatTarget: null,
    chatPollingInterval: null,
    currentStoryIndex: 0,
    storyProgressInterval: null,
    isStoryMuted: false,
    socket: null,
    map: null,
    mapPickerInitialized: false,
    postMediaFiles: [],
    currentPostAttachment: null,
    editingPostId: null,
    sharingPostId: null,



    init: function () {
        console.log("📖 Social Hub v3 Initializing...");
        const token = localStorage.getItem('wander_token');
        if (!token) {
            this.showGuestLanding();
            if (window.WanderUI && window.WanderUI.finishTopLoader) window.WanderUI.finishTopLoader();
            return;
        }

        // Render placeholders/skeletons immediately
        this.renderSkeletons();

        // Parallelized fetching for instant results
        Promise.all([
            this.loadUserProfile(),
            this.fetchFeed(),
            this.fetchStories()
        ]).then(() => {
            this.fetchPendingFriends();
            this.loadFriendSuggestions();
            this.loadFriendsList();
            this.loadConversations();
            this.renderTrending();
            if (window.WanderUI && window.WanderUI.finishTopLoader) window.WanderUI.finishTopLoader();
        }).catch(err => {
            console.error("Social hub init error:", err);
            if (window.WanderUI && window.WanderUI.finishTopLoader) window.WanderUI.finishTopLoader();
        });

        this.setupEventListeners();
        this.startStoriesAutoRefresh();

        // Handle URL parameters
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            this.switchTab(tab);
            window.history.replaceState({}, document.title, "social-hub.html");
        }

        this.initSocket();
    },

    initSocket: function () {
        const token = localStorage.getItem('wander_token');
        if (!token || typeof io === 'undefined') return;

        console.log("🔌 Connecting to real-time server...");
        this.socket = io({
            auth: { token }
        });

        this.socket.on('connect', () => {
            console.log("✅ Real-time connected! (Socket ID: " + this.socket.id + ")");
        });

        this.socket.on('receive_message', (msg) => {
            console.log("📨 New real-time message:", msg);
            this.handleIncomingMessage(msg);
        });

        this.socket.on('notification', (notif) => {
            console.log("🔔 Real-time notification:", notif);
            if (window.WanderUI) {
                WanderUI.showToast(notif.message, 'info');
            }
            // Refresh counts or list if needed
            if (notif.type === 'friend_request') this.fetchPendingFriends();
        });

        this.socket.on('new_post', (post) => {
            console.log("📝 New post received:", post);
            // Ignore if it's our own post (we handle it optimistically)
            if (this.user && (String(post.userId) === String(this.user._id) || String(post.userId._id) === String(this.user._id))) return;
            
            // Check if post already exists
            if (!this.posts.some(p => p._id === post._id)) {
                this.posts.unshift(post);
                const feedContainer = document.getElementById('feed-container');
                if (feedContainer) {
                    // Remove empty state if present
                    const emptyState = feedContainer.querySelector('.glass-card p');
                    if (emptyState && emptyState.textContent.includes('Chưa có bài viết nào')) {
                        feedContainer.innerHTML = '';
                    }
                    const postHtml = this.renderPostCard(post);
                    feedContainer.insertAdjacentHTML('afterbegin', postHtml);
                }
            }
        });

        this.socket.on('new_comment', (data) => {
            console.log("💬 New comment received:", data);
            const { postId, comment, commentCount } = data;
            
            // Update local posts array
            const post = this.posts.find(p => p._id === postId);
            if (post) {
                if (!post.comments) post.comments = [];
                // Check if comment already exists (for the sender who also receives it)
                if (!post.comments.some(c => c._id === comment._id)) {
                    post.comments.push(comment);
                }
            }

            // Update UI
            const commentList = document.getElementById(`comments-list-${postId}`);
            if (commentList) {
                // Remove empty state
                const noComments = commentList.querySelector('.no-comments');
                if (noComments) noComments.remove();
                
                // Add new comment HTML
                const postAuthorId = post ? (post.userId._id || post.userId) : null;
                const commentHtml = this.renderCommentItem(comment, postAuthorId);
                
                // Check if already exists in DOM
                if (!commentList.querySelector(`[data-comment-id="${comment._id}"]`)) {
                    commentList.insertAdjacentHTML('beforeend', commentHtml);
                }
            }

            // Update comment count
            const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            if (postCard) {
                const countSpan = postCard.querySelector('.comments-shares-count');
                if (countSpan) {
                    const parts = countSpan.textContent.split(' · ');
                    parts[0] = `${commentCount} bình luận`;
                    countSpan.textContent = parts.join(' · ');
                }
            }
        });

        this.socket.on('friend_accepted', (data) => {
            console.log("👥 Friend request accepted:", data);
            if (window.WanderUI) {
                WanderUI.showToast(`${data.friendName} đã chấp nhận lời mời kết bạn!`, 'success');
            }
            this.loadFriendsList();
            this.loadUserProfile();
        });

        this.socket.on('connect_error', (err) => {
            console.warn("🔌 Socket connection error:", err.message);
        });
    },

    handleIncomingMessage: function (msg) {
        // 1. If chat drawer is open with THIS user, append message
        // We check both senderId (ObjectId) and senderCustomId for maximum reliability
        const targetId = String(this.chatTarget?.userId || '');
        const isMatch = targetId === String(msg.senderId) || targetId === String(msg.senderCustomId);

        if (this.chatTarget && isMatch) {
            // Refresh conversation list in background
            this.loadConversations();

            const body = document.getElementById('chat-messages');
            if (body) {
                const emptyMsg = body.querySelector('.chat-empty, .chat-loading');
                if (emptyMsg) emptyMsg.remove();

                let storyRefHtml = '';
                if (msg.storyRef && msg.storyRef.mediaUrl) {
                    storyRefHtml = `
                        <div class="chat-story-ref" onclick="SocialHub.openStoryViewerByRef('${msg.storyRef.id}')">
                            <div class="story-ref-thumb" style="background-image: url('${msg.storyRef.mediaUrl}')">
                                <div class="story-ref-play"><i class="fas fa-play-circle"></i></div>
                            </div>
                            <div class="story-ref-text">Xem thước phim</div>
                        </div>
                    `;
                }

                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-msg received';
                msgDiv.innerHTML = `${storyRefHtml}<p>${msg.text}</p><span class="msg-time">Vừa xong</span>`;
                body.appendChild(msgDiv);
                body.scrollTop = body.scrollHeight;

                // Play sound or notification if tab is not active
                if (document.hidden) {
                    this.playMessageSound();
                }
            }
        } else {
            // 2. Otherwise, show toast and refresh conversation list
            if (window.WanderUI) {
                WanderUI.showToast(`Tin nhắn mới từ ${msg.senderName}: ${msg.text.substring(0, 30)}...`, 'success');
            }
            this.loadConversations();
            this.playMessageSound();
        }
    },

    playMessageSound: function() {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.volume = 0.5;
            audio.play();
        } catch(e) {}
    },

    renderSkeletons: function () {
        const feedContainer = document.getElementById('feed-container');
        if (feedContainer) {
            feedContainer.innerHTML = `
                <div class="skeleton-post" style="padding:20px;margin-bottom:20px;background:rgba(255,255,255,0.05);border-radius:24px;">
                    <div style="display:flex;gap:12px;margin-bottom:12px;">
                        <div class="loading-shimmer" style="width:40px;height:40px;border-radius:50%;"></div>
                        <div style="flex:1;"><div class="loading-shimmer" style="height:14px;width:120px;margin-bottom:8px;"></div><div class="loading-shimmer" style="height:10px;width:80px;"></div></div>
                    </div>
                    <div class="loading-shimmer" style="height:20px;margin-bottom:12px;width:90%;"></div>
                    <div class="loading-shimmer" style="height:200px;border-radius:12px;"></div>
                </div>
            `;
        }
        const storyContainer = document.getElementById('stories-container');
        if (storyContainer) {
            storyContainer.innerHTML = Array(5).fill(0).map(() => `
                <div class="reel-card skeleton" style="background:rgba(255,255,255,0.05);"><div class="loading-shimmer" style="width:100%;height:100%;"></div></div>
            `).join('');
        }
    },

    loadUserProfile: async function () {
        try {
            // First, check cache for instant render
            const cached = localStorage.getItem('wander_user');
            if (cached) {
                this.user = JSON.parse(cached);
                this.updateUserUI();
            }

            const res = await fetch('/api/auth/user/me', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) {
                // Normalize user object to ensure both _id and id exist for compatibility
                const user = data.user;
                if (user) {
                    if (!user._id && user.id) user._id = user.id;
                    if (!user.id && user._id) user.id = user._id;
                }
                this.user = user;
                localStorage.setItem('wander_user', JSON.stringify(this.user)); // Sync cache
                this.updateUserUI();

                // Fetch stats in background
                this.loadUserStats();
            }
        } catch (err) { console.error("Lỗi tải hồ sơ:", err); }
    },

    updateUserUI: function () {
        if (!this.user) return;
        const nameEl = document.getElementById('mini-name');
        const rankEl = document.getElementById('mini-rank');
        if (nameEl) nameEl.textContent = this.user.displayName || this.user.name;
        if (rankEl) rankEl.textContent = `Hạng ${this.user.rank || 'Đồng'} ${this.user.rankTier || 'I'}`;
        if (this.user.avatar) document.querySelectorAll('#mini-avatar, #post-avatar').forEach(img => img.src = this.user.avatar);
    },

    loadUserStats: async function () {
        if (!this.user) return;
        const userId = this.user._id || this.user.id;
        if (!userId) return;

        // Parallel fetch for stats without blocking
        Promise.all([
            fetch(`/api/social/posts/user/${userId}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } }).then(r => r.json()),
            fetch('/api/social/friends', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } }).then(r => r.json())
        ]).then(([posts, friends]) => {
            const postCount = document.getElementById('stat-posts');
            const friendCount = document.getElementById('stat-friends');
            if (postCount && posts.success) postCount.textContent = posts.data.length;
            if (friendCount && friends.success) friendCount.textContent = friends.data.length;
        }).catch(() => { });
    },

    // ========== STORIES SYSTEM ==========
    fetchStories: async function () {
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

    renderStories: function () {
        const container = document.getElementById('stories-container');
        if (!container) return;
        const viewedStories = JSON.parse(localStorage.getItem('wander_viewed_stories') || '[]');

        // Card Tạo tin
        let storiesHtml = `
            <div class="reel-card create-story" onclick="SocialHub.openCreateStoryModal()">
                <div class="reel-thumb" style="background-image: url('${this.user?.avatar || 'assets/default-avatar.svg'}')"></div>
                <div class="reel-create-overlay"><div class="reel-add-btn"><i class="fas fa-plus"></i></div></div>
                <div class="reel-user-info"><img src="${this.user?.avatar || 'assets/default-avatar.svg'}" class="reel-avatar"><span>Tạo tin</span></div>
            </div>
        `;

        // Group stories theo user - dùng userId string làm key
        const userMap = {};
        this.stories.forEach(story => {
            // userId có thể là string (raw) hoặc object (populated)
            const uid = story.user?._id ? String(story.user._id)
                : (story.userId?._id ? String(story.userId._id) : String(story.userId));
            if (!userMap[uid]) {
                userMap[uid] = {
                    uid,
                    user: story.user || story.userId,
                    stories: [],
                    hasUnviewed: false
                };
            }
            userMap[uid].stories.push(story);
            if (!viewedStories.includes(story._id)) userMap[uid].hasUnviewed = true;
        });

        this.storyUserIds = Object.keys(userMap);

        Object.values(userMap).forEach(group => {
            const latest = group.stories[group.stories.length - 1];
            const isViewed = !group.hasUnviewed;
            const isVideo = latest.media?.[0]?.type === 'video';
            // Ưu tiên media thumbnail, fallback avatar
            const thumb = latest.media?.[0]?.url || group.user?.avatar || 'assets/default-avatar.svg';
            const musicBadge = latest.music ? `<div class="reel-music-badge"><i class="fas fa-music"></i> ${latest.music.name}</div>` : '';
            const ringClass = isViewed ? '' : 'reel-unviewed';
            const displayName = group.user?.displayName || group.user?.name || 'Người dùng';
            const avatar = group.user?.avatar || 'assets/default-avatar.svg';
            storiesHtml += `
                <div class="reel-card ${ringClass}" onclick="SocialHub.openStoryViewer('${group.uid}')">
                    <div class="reel-thumb" style="background-image: url('${thumb}')">
                        ${isVideo ? '<div class="reel-video-badge"><i class="fas fa-play"></i></div>' : ''}
                    </div>
                    ${musicBadge}
                    <div class="reel-user-info">
                        <img src="${avatar}" class="reel-avatar">
                        <span>${displayName}</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = storiesHtml;
    },

    openStoryViewer: function (userId, startStoryId = null) {
        const userIdStr = String(userId);
        const userStories = this.stories.filter(s => {
            const sid = s.user?._id ? String(s.user._id)
                : (s.userId?._id ? String(s.userId._id) : String(s.userId));
            return sid === userIdStr;
        });

        if (userStories.length === 0) {
            if (window.WanderUI) WanderUI.showToast('Không tìm thấy thước phim', 'error');
            return;
        }

        this.currentStoryUserId = userId;
        // Tìm index của story cụ thể nếu có
        let startIndex = 0;
        if (startStoryId) {
            const foundIndex = userStories.findIndex(s => String(s._id) === String(startStoryId));
            if (foundIndex > -1) startIndex = foundIndex;
        }

        this.currentStoryIndex = startIndex;
        this.viewedStoriesList = userStories;
        this.storyPaused = false;

        const overlay = document.createElement('div');
        overlay.id = 'story-viewer-overlay';
        overlay.className = 'story-viewer-overlay';
        overlay.innerHTML = `
            <div class="story-viewer" id="story-viewer-main">
                <div class="story-progress-bars">
                    ${userStories.map((_, i) => `<div class="story-progress-bar ${i === 0 ? 'active' : ''}" data-index="${i}"><div class="progress-fill"></div></div>`).join('')}
                </div>
                <div class="story-header">
                    <div class="story-user-info">
                        <img src="${userStories[0].user?.avatar || 'assets/default-avatar.svg'}" class="story-user-avatar">
                        <div class="story-user-text">
                            <div class="story-user-text-top">
                                <span class="story-user-name">${userStories[0].user?.displayName || userStories[0].user?.name}</span>
                                <span class="story-time">${this.formatTime(userStories[0].createdAt)}</span>
                            </div>
                            <div class="story-music-info" id="story-music-info" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="story-header-actions">
                        <button class="sv-btn" id="story-mute-btn" onclick="SocialHub.toggleStoryMute()"><i class="fas fa-volume-up"></i></button>
                        <button class="sv-btn" id="story-pause-btn" onclick="SocialHub.toggleStoryPause()"><i class="fas fa-pause"></i></button>
                        <button class="sv-btn" onclick="SocialHub.closeStoryViewer()"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="story-content" id="story-content"></div>
                <div class="story-nav story-prev" onclick="SocialHub.prevStory()"></div>
                <div class="story-nav story-next" onclick="SocialHub.nextStory()"></div>
                <div class="story-bottom-bar">
                    <div class="story-reply-container">
                        <div class="story-reply-input">
                            <input type="text" placeholder="Viết bình luận..." id="story-comment-input" 
                                onfocus="SocialHub.pauseStoryTimer()" 
                                onblur="SocialHub.resumeStoryTimer()"
                                onkeypress="if(event.key === 'Enter') SocialHub.submitStoryComment()">
                            <button onclick="SocialHub.submitStoryComment()"><i class="fas fa-paper-plane"></i></button>
                        </div>
                        <div class="story-bottom-actions" id="story-viewer-bottom-actions">
                            <!-- Nút Like, Share... sẽ được render động -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Gắn sự kiện click vào thanh progress để "nhảy" story
        setTimeout(() => {
            document.querySelectorAll('.story-progress-bar').forEach(bar => {
                bar.onclick = (e) => {
                    const idx = parseInt(bar.dataset.index);
                    this.currentStoryIndex = idx;
                    this.showStory(idx);
                    this.startStoryProgress();
                };
            });
        }, 100);

        this.showStory(startIndex);
        this.startStoryProgress();
        this.markStoryAsViewed(userStories[startIndex]._id);
    },

    openStoryViewerByRef: function (storyId) {
        // Tìm user chứa story này
        const story = this.stories.find(s => String(s._id) === String(storyId));
        if (!story) {
            if (window.WanderUI) WanderUI.showToast('Không tìm thấy thước phim này', 'error');
            return;
        }
        const authorId = story.userId?._id || story.userId;
        this.openStoryViewer(authorId, storyId);
    },

    toggleStoryPause: function () {
        if (this.storyPaused) this.resumeStoryTimer();
        else this.pauseStoryTimer();
    },

    pauseStoryTimer: function () {
        this.storyPaused = true;
        const btn = document.getElementById('story-pause-btn');
        if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
        const video = document.querySelector('#story-content video');
        const audio = document.querySelector('#story-content audio');
        if (video) video.pause();
        if (audio) audio.pause();
    },

    resumeStoryTimer: function () {
        this.storyPaused = false;
        const btn = document.getElementById('story-pause-btn');
        if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
        const video = document.querySelector('#story-content video');
        const audio = document.querySelector('#story-content audio');
        if (video) video.play().catch(() => {});
        if (audio) audio.play().catch(() => {});
    },

    toggleStoryMute: function () {
        this.isStoryMuted = !this.isStoryMuted;

        const video = document.getElementById('story-video-player');
        if (video) {
            video.muted = this.isStoryMuted;
        }

        const audio = document.getElementById('story-audio-player');
        if (audio) {
            audio.muted = this.isStoryMuted;
        }

        if (this._storyMusicAudio) {
            this._storyMusicAudio.muted = this.isStoryMuted;
        }

        const btn = document.getElementById('story-mute-btn');
        if (btn) {
            btn.innerHTML = this.isStoryMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
        }
    },

    sendStoryReply: function () {
        const input = document.getElementById('story-reply-field');
        if (input?.value?.trim()) {
            if (window.WanderUI) WanderUI.showToast('Đã gửi tin nhắn!', 'success');
            input.value = '';
        }
    },

    shareStory: function (storyId) {
        this.pauseStoryTimer();
        const url = window.location.origin + '/social-hub.html?storyId=' + storyId;
        navigator.clipboard.writeText(url).then(() => {
            if (window.WanderUI) WanderUI.showToast('Đã sao chép liên kết thước phim!', 'success');
        });
    },

    toggleLikeStory: async function (storyId, btn) {
        try {
            const res = await fetch(`/api/social/stories/${storyId}/like`, {
                method: 'POST',
                headers: { 'x-auth-token': localStorage.getItem('wander_token') }
            });
            const data = await res.json();
            if (data.success) {
                const liked = data.isLiked;
                btn.classList.toggle('liked', liked);
                const icon = btn.querySelector('i');
                icon.className = liked ? 'fas fa-heart' : 'far fa-heart';
                const countSpan = btn.querySelector('.action-count');
                if (countSpan) countSpan.textContent = data.likeCount;
                
                // Update local list
                if (!this._likedStories) this._likedStories = [];
                if (liked) {
                    if (!this._likedStories.includes(storyId)) this._likedStories.push(storyId);
                } else {
                    this._likedStories = this._likedStories.filter(id => id !== storyId);
                }
            }
        } catch (e) {
            console.error(e);
        }
    },

    submitStoryComment: async function () {
        const input = document.getElementById('story-comment-input');
        const content = input.value.trim();
        if (!content) return;

        const story = this.viewedStoriesList[this.currentStoryIndex];
        if (!story) return;

        try {
            const res = await fetch(`/api/social/reply-to-story/${story._id}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-auth-token': localStorage.getItem('wander_token') 
                },
                body: JSON.stringify({ content })
            });
            const data = await res.json();
            if (data.success) {
                input.value = '';
                if (window.WanderUI) WanderUI.showToast('Đã gửi phản hồi!', 'success');
            } else {
                if (window.WanderUI) WanderUI.showToast(data.message || 'Lỗi gửi phản hồi', 'error');
            }
        } catch (e) {
            console.error(e);
            if (window.WanderUI) WanderUI.showToast('Không thể kết nối máy chủ', 'error');
        }
    },

    showStory: function (index) {
        const story = this.viewedStoriesList[index];
        if (!story) return;

        const content = document.getElementById('story-content');
        const media = story.media?.[0];

        // Prepare styles for media
        const objectFit = story.objectFit || 'contain';
        const mediaStyle = `
            filter: ${story.filter || 'none'};
            transform: ${story.flipped ? 'scaleX(-1)' : 'none'};
            object-fit: ${objectFit};
            width: 100%;
            height: 100%;
        `;

        let mediaHtml = '';
        if (media?.type === 'video') {
            // Video: try to autoplay, with an ID so we can force play it
            mediaHtml = `<video src="${media.url}" id="story-video-player" autoplay loop playsinline class="story-media" style="${mediaStyle}" onclick="SocialHub.toggleStoryPause()"></video>`;
        } else if (media?.type === 'audio') {
            mediaHtml = `
                <div class="story-audio-wrapper" style="${mediaStyle}">
                    <div class="audio-wave active"><span></span><span></span><span></span><span></span><span></span></div>
                    <i class="fas fa-music"></i>
                    <audio src="${media.url}" id="story-audio-player" autoplay loop></audio>
                </div>
            `;
        } else if (media?.url) {
            // Ảnh thật từ upload
            mediaHtml = `<img src="${media.url}" class="story-media" style="${mediaStyle}" alt="story">`;
        } else {
            // Fallback: avatar người dùng
            const av = story.user?.avatar || story.userId?.avatar || 'assets/default-avatar.svg';
            mediaHtml = `<img src="${av}" class="story-media" style="${mediaStyle}" alt="story">`;
        }

        // Text overlay
        if (story.textOverlay) {
            if (typeof story.textOverlay === 'object' && story.textOverlay.content) {
                const top = story.textOverlay.top || '50%';
                const left = story.textOverlay.left || '50%';
                const color = story.textOverlay.color || '#fff';
                mediaHtml += `<div class="story-viewer-text" style="top:${top};left:${left};color:${color};">${story.textOverlay.content}</div>`;
            } else if (typeof story.textOverlay === 'string') {
                mediaHtml += `<div class="story-viewer-text">${story.textOverlay}</div>`;
            }
        }

        // Nhãn dán (Stickers)
        let stickersHtml = '';
        if (story.stickers && Array.isArray(story.stickers)) {
            story.stickers.forEach(st => {
                stickersHtml += `<div class="story-viewer-sticker" style="top:${st.top};left:${st.left};font-size:${st.fontSize || '3rem'};">${st.content}</div>`;
            });
        }
        mediaHtml += `<div class="story-stickers-overlay">${stickersHtml}</div>`;

        // Cập nhật các nút ở thanh dưới (bottom actions)
        const bottomActions = document.getElementById('story-viewer-bottom-actions');
        if (bottomActions) {
            const liked = (this._likedStories || []).includes(String(story._id));
            bottomActions.innerHTML = `
                <button class="sv-btn ${liked ? 'liked' : ''}" id="story-like-btn" onclick="SocialHub.toggleLikeStory('${story._id}', this)">
                    <i class="${liked ? 'fas' : 'far'} fa-heart"></i>
                    <span class="action-count">${story.likeCount || 0}</span>
                </button>
                <button class="sv-btn" onclick="SocialHub.shareStory('${story._id}')">
                    <i class="fas fa-share"></i>
                </button>
            `;
        }

        // Cập nhật nút mute dựa theo trạng thái
        const muteBtn = document.getElementById('story-mute-btn');
        if (muteBtn) {
            muteBtn.innerHTML = this.isStoryMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
        }

        // Music overlay (inline with user info)
        const musicInfoEl = document.getElementById('story-music-info');
        if (story.music?.name) {
            if (musicInfoEl) {
                musicInfoEl.style.display = 'flex';
                musicInfoEl.innerHTML = `<i class="fas fa-music"></i><marquee scrollamount="3">${story.music.name} — ${story.music.author}</marquee>`;
            }
            // Phát nhạc nếu có URL
            if (story.music.url) {
                if (this._storyMusicAudio) this._storyMusicAudio.pause();
                this._storyMusicAudio = new Audio(story.music.url);
                this._storyMusicAudio.volume = 0.4;
                this._storyMusicAudio.muted = this.isStoryMuted;
                this._storyMusicAudio.play().catch(() => { });
            }
        } else if (media?.type === 'video' || media?.type === 'audio') {
            if (musicInfoEl) {
                musicInfoEl.style.display = 'flex';
                musicInfoEl.innerHTML = `<i class="fas fa-volume-up"></i><span>Âm thanh gốc</span>`;
            }
            if (this._storyMusicAudio) { this._storyMusicAudio.pause(); this._storyMusicAudio = null; }
        } else {
            if (musicInfoEl) musicInfoEl.style.display = 'none';
            if (this._storyMusicAudio) { this._storyMusicAudio.pause(); this._storyMusicAudio = null; }
        }

        content.innerHTML = mediaHtml;

        // Nếu là ảnh và có duration tùy chỉnh, cập nhật timeline
        if (!media?.type || media.type === 'image') {
            if (story.duration) {
                this.startStoryProgress(story.duration);
            }
        }

        // Force play video if present (fixes "không chạy" issue)
        const videoEl = document.getElementById('story-video-player');
        const audioEl = document.getElementById('story-audio-player');

        const handleMetadata = (el) => {
            const duration = el.duration * 1000;
            if (duration && duration > 0) {
                this.startStoryProgress(duration);
            }
        };

        if (videoEl) {
            videoEl.muted = this.isStoryMuted;
            videoEl.onloadedmetadata = () => handleMetadata(videoEl);
            videoEl.play().catch(e => {
                console.warn('Video autoplay blocked, attempting muted autoplay...', e);
                this.isStoryMuted = true; // Auto update global state if blocked
                videoEl.muted = true;
                if (muteBtn) muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
                if (this._storyMusicAudio) this._storyMusicAudio.muted = true;

                videoEl.play().catch(err => console.error('Video totally blocked', err));
            });
        }
        if (audioEl) {
            audioEl.muted = this.isStoryMuted;
            audioEl.onloadedmetadata = () => handleMetadata(audioEl);
            audioEl.play().catch(() => { });
        }

        // Cập nhật progress bars
        document.querySelectorAll('.story-progress-bar').forEach((bar, i) => {
            bar.classList.toggle('active', i === index);
            bar.classList.toggle('completed', i < index);
        });

        // Cập nhật thông tin header
        const storyUser = story.user || story.userId || {};
        const timeEl = document.querySelector('.story-time');
        if (timeEl) timeEl.textContent = this.formatTime(story.createdAt);
        const nameEl = document.querySelector('.story-user-name');
        if (nameEl) nameEl.textContent = storyUser.displayName || storyUser.name || 'Người dùng';
        const avatarEl = document.querySelector('.story-user-avatar');
        if (avatarEl) avatarEl.src = storyUser.avatar || 'assets/default-avatar.svg';
    },

    toggleLikeStory: function (storyId) {
        if (window.WanderUI) WanderUI.showToast('Đã thả tim thước phim này! ❤️', 'success');
        event.currentTarget.querySelector('i').style.color = '#ff3b30';
    },

    startStoryProgress: function (customDuration = null) {
        if (this.storyProgressInterval) clearInterval(this.storyProgressInterval);
        this.storyPaused = false;

        let progress = 0;
        const duration = customDuration || 5000; // 5 seconds default or custom
        const interval = 50; // Update every 50ms
        const step = 100 / (duration / interval);

        this.storyProgressInterval = setInterval(() => {
            if (this.storyPaused) return;
            progress += step;
            const activeBar = document.querySelector('.story-progress-bar.active .progress-fill');
            if (activeBar) activeBar.style.width = `${Math.min(progress, 100)}%`;
            if (progress >= 100) {
                clearInterval(this.storyProgressInterval);
                this.nextStory();
            }
        }, interval);
    },

    nextStory: function () {
        if (this.currentStoryIndex < this.viewedStoriesList.length - 1) {
            this.currentStoryIndex++;
            this.showStory(this.currentStoryIndex);
            this.markStoryAsViewed(this.viewedStoriesList[this.currentStoryIndex]._id);
            this.startStoryProgress();
        } else {
            if (this.storyUserIds) {
                const currentUserIdx = this.storyUserIds.indexOf(String(this.currentStoryUserId));
                if (currentUserIdx !== -1 && currentUserIdx < this.storyUserIds.length - 1) {
                    const nextUserId = this.storyUserIds[currentUserIdx + 1];
                    this.closeStoryViewer();
                    setTimeout(() => this.openStoryViewer(nextUserId), 10);
                    return;
                }
            }
            this.closeStoryViewer();
        }
    },

    prevStory: function () {
        if (this.currentStoryIndex > 0) {
            this.currentStoryIndex--;
            this.showStory(this.currentStoryIndex);
            this.startStoryProgress();
        } else {
            if (this.storyUserIds) {
                const currentUserIdx = this.storyUserIds.indexOf(String(this.currentStoryUserId));
                if (currentUserIdx > 0) {
                    const prevUserId = this.storyUserIds[currentUserIdx - 1];
                    this.closeStoryViewer();
                    setTimeout(() => this.openStoryViewer(prevUserId), 10);
                    return;
                }
            }
        }
    },

    closeStoryViewer: function () {
        if (this.storyProgressInterval) clearInterval(this.storyProgressInterval);
        if (this._storyMusicAudio) { this._storyMusicAudio.pause(); this._storyMusicAudio = null; }
        const overlay = document.getElementById('story-viewer-overlay');
        if (overlay) overlay.remove();
        document.body.style.overflow = '';
    },

    // === STORY ACTIONS ===
    _likedStories: JSON.parse(localStorage.getItem('wander_liked_stories') || '[]'),

    toggleLikeStory: async function (storyId, btnEl) {
        if (!storyId) return;
        const btn = btnEl || document.getElementById('story-like-btn');
        const icon = btn?.querySelector('i');
        const countEl = btn?.querySelector('.action-count');
        const idStr = String(storyId);

        // UI Update (Optimistic)
        const alreadyLiked = this._likedStories.includes(idStr);
        if (alreadyLiked) {
            this._likedStories = this._likedStories.filter(id => id !== idStr);
            if (icon) icon.className = 'far fa-heart';
            if (btn) btn.classList.remove('liked');
            if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent || 0) - 1);
        } else {
            this._likedStories.push(idStr);
            if (icon) icon.className = 'fas fa-heart';
            if (btn) btn.classList.add('liked');
            if (btn) {
                btn.style.transform = 'scale(1.3)';
                setTimeout(() => { btn.style.transform = ''; }, 300);
            }
            if (countEl) countEl.textContent = parseInt(countEl.textContent || 0) + 1;
        }
        localStorage.setItem('wander_liked_stories', JSON.stringify(this._likedStories));

        // API Call
        try {
            const res = await fetch(`/api/social/stories/${storyId}/like`, {
                method: 'POST',
                headers: { 'x-auth-token': localStorage.getItem('wander_token') }
            });
            const data = await res.json();
            if (data.success && countEl) {
                countEl.textContent = data.count;
            }
        } catch (e) {
            console.error("Lỗi like story:", e);
        }
    },

    openStoryComment: function () {
        // Focus vào ô nhập phía dưới
        const input = document.getElementById('story-reply-field');
        if (input) {
            input.focus();
            input.placeholder = 'Viết bình luận...';
            this.toggleStoryPause(); // Tạm dừng story để bình luận
        }
    },

    sendStoryReply: async function () {
        const input = document.getElementById('story-reply-field');
        const text = input?.value?.trim();
        if (!text) return;

        const story = this.viewedStoriesList?.[this.currentStoryIndex];
        if (!story) return;

        const storyUser = story.user || {};
        const targetUserId = storyUser._id;

        // Gửi tin nhắn tới chủ story
        if (targetUserId && String(targetUserId) !== String(this.user?._id)) {
            try {
                await fetch('/api/social/messages', {
                    method: 'POST',
                    headers: {
                        'x-auth-token': localStorage.getItem('wander_token'),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ recipientId: targetUserId, content: `[Story] ${text}` })
                });
                if (window.WanderUI) WanderUI.showToast('Đã gửi tin nhắn!', 'success');
            } catch (e) {
                if (window.WanderUI) WanderUI.showToast('Đã gửi!', 'success');
            }
        } else {
            if (window.WanderUI) WanderUI.showToast('Đã gửi!', 'success');
        }
        input.value = '';
        input.placeholder = 'Gửi tin nhắn...';
        // Tiếp tục phát nếu đang pause
        if (this.storyPaused) this.toggleStoryPause();
    },

    shareStory: function (storyId) {
        const url = `${window.location.origin}/social-hub.html?story=${storyId || ''}`;
        if (navigator.share) {
            navigator.share({ title: 'WanderViệt Thước Phim', url })
                .catch(() => this._copyStoryUrl(url));
        } else {
            this._copyStoryUrl(url);
        }
    },

    _copyStoryUrl: function (url) {
        navigator.clipboard.writeText(url).then(() => {
            if (window.WanderUI) WanderUI.showToast('Đã sao chép liên kết!', 'success');
        }).catch(() => {
            if (window.WanderUI) WanderUI.showToast('Chia sẻ: ' + url, 'info');
        });
    },


    markStoryAsViewed: function (storyId) {
        const viewed = JSON.parse(localStorage.getItem('wander_viewed_stories') || '[]');
        if (!viewed.includes(storyId)) {
            viewed.push(storyId);
            localStorage.setItem('wander_viewed_stories', JSON.stringify(viewed));
        }
    },

    openCreateStoryModal: function () {
        // Tạo modal tạo story (Thước phim ngắn)
        const modal = document.createElement('div');
        modal.id = 'create-story-modal';
        modal.className = 'modal-overlay story-editor-overlay';
        modal.innerHTML = `
            <div class="story-editor-modal">
                <div class="editor-header">
                    <button class="editor-close" onclick="document.getElementById('create-story-modal').remove()">×</button>
                    <h3>Tạo Thước Phim</h3>
                    <button class="editor-publish" onclick="SocialHub.submitStory()" id="story-submit-btn" disabled>Đăng tin</button>
                </div>
                
                <div class="editor-main">
                    <div class="editor-preview-container" id="editor-preview-container">
                        <div class="upload-placeholder" id="upload-placeholder" onclick="document.getElementById('story-file-input').click()">
                            <span class="upload-icon">📷</span>
                            <p>Chọn ảnh hoặc video ngắn</p>
                        </div>
                        <img id="story-preview-img" class="editor-media" style="display:none;">
                        <video id="story-preview-video" class="editor-media" style="display:none;" autoplay loop muted></video>
                        <div id="story-preview-audio" class="editor-media-audio" style="display:none;">
                            <div class="audio-wave"><span></span><span></span><span></span><span></span></div>
                            <i class="fas fa-volume-up"></i>
                            <span id="story-preview-audio-name">Âm thanh đang chọn</span>
                        </div>
                        <div id="story-text-overlay-preview" class="story-text-overlay-preview" style="display:none;"></div>
                        <div id="story-music-overlay-preview" class="story-music-overlay-preview" style="display:none;">
                            <i class="fas fa-music"></i> <marquee id="music-preview-name" scrollamount="4"></marquee>
                            <button class="remove-music-btn" onclick="SocialHub.removeSelectedMusic(event)">×</button>
                        </div>
                    </div>
                    
                    <div class="editor-tools" id="editor-tools" style="opacity: 0.5; pointer-events: none;">
                        <button class="tool-btn" onclick="SocialHub.openMusicSelector()"><i class="fas fa-music"></i><span>Âm thanh</span></button>
                        <button class="tool-btn" onclick="SocialHub.openTextEditor()"><i class="fas fa-font"></i><span>Văn bản</span></button>
                        <button class="tool-btn" onclick="SocialHub.openStickerPicker()"><i class="fas fa-smile"></i><span>Nhãn dán</span></button>
                        <button class="tool-btn" onclick="SocialHub.openFilterPanel()"><i class="fas fa-magic"></i><span>Bộ lọc</span></button>
                        <button class="tool-btn" onclick="SocialHub.toggleStoryFit()"><i class="fas fa-expand"></i><span>Khung hình</span></button>
                        <button class="tool-btn" onclick="SocialHub.openDurationPanel()"><i class="fas fa-clock"></i><span>Thời lượng</span></button>
                        <button class="tool-btn" onclick="SocialHub.flipMedia()"><i class="fas fa-arrows-alt-h"></i><span>Lật</span></button>
                    </div>
                </div>
                <input type="file" id="story-file-input" accept="image/*,video/*,audio/*" hidden onchange="SocialHub.handleStoryUpload(this)">
            </div>
            
            <!-- Music Selector Modal -->
            <div id="music-selector-modal" class="sub-modal" style="display:none;">
                <div class="sub-modal-content">
                    <div class="sub-modal-header">
                        <h4>🎵 Chọn Âm thanh</h4>
                        <button onclick="SocialHub.closeMusicSelector()">×</button>
                    </div>
                    <div class="music-search-bar">
                        <i class="fas fa-search"></i>
                        <input type="text" placeholder="Tìm kiếm bài hát..." id="music-search-input" oninput="SocialHub.filterMusicList(this.value)">
                    </div>
                    <div class="music-list-hint">Nhấn vào bài hát để nghe thử, sau đó nhấn "Dùng" để chọn</div>
                    <div class="music-list" id="music-list-container"></div>
                    <button class="music-stop-btn" onclick="SocialHub.stopMusicPreview()"><i class="fas fa-stop"></i> Dừng phát</button>
                </div>
            </div>

            <!-- Text Editor Modal -->
            <div id="text-editor-modal" class="sub-modal" style="display:none;">
                <div class="sub-modal-content">
                    <div class="sub-modal-header">
                        <h4>Tùy chỉnh Văn bản</h4>
                        <button onclick="document.getElementById('text-editor-modal').style.display='none'">×</button>
                    </div>
                    <div class="text-editor-body">
                        <input type="text" id="story-text-input" placeholder="Nhập nội dung...">
                        <div class="text-style-row">
                            <label style="color:#aaa;font-size:.85rem">Màu chữ</label>
                            <div class="text-color-picker">
                                <span class="color-dot" style="background:#ffffff" onclick="SocialHub.setTextOverlayColor('#ffffff')"></span>
                                <span class="color-dot" style="background:#ff3b30" onclick="SocialHub.setTextOverlayColor('#ff3b30')"></span>
                                <span class="color-dot" style="background:#34c759" onclick="SocialHub.setTextOverlayColor('#34c759')"></span>
                                <span class="color-dot" style="background:#007aff" onclick="SocialHub.setTextOverlayColor('#007aff')"></span>
                                <span class="color-dot" style="background:#ffcc00" onclick="SocialHub.setTextOverlayColor('#ffcc00')"></span>
                                <span class="color-dot" style="background:#ff00cc" onclick="SocialHub.setTextOverlayColor('#ff00cc')"></span>
                                <span class="color-dot" style="background:#000000; border-color:#555" onclick="SocialHub.setTextOverlayColor('#000000')"></span>
                            </div>
                        </div>
                        <div class="text-size-row">
                            <label style="color:#aaa;font-size:.85rem">Cỡ chữ</label>
                            <input type="range" min="16" max="64" value="28" id="story-text-size" oninput="SocialHub.setTextOverlaySize(this.value)">
                        </div>
                        <div class="text-editor-actions">
                            <button class="btn btn--outline" onclick="SocialHub.clearTextOverlay()">Xóa chữ</button>
                            <button class="btn btn--primary" onclick="SocialHub.applyTextOverlay()">Áp dụng</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sticker Picker -->
            <div id="sticker-picker-modal" class="sub-modal" style="display:none;">
                <div class="sub-modal-content">
                    <div class="sub-modal-header"><h4>Chọn Nhãn dán</h4><button onclick="document.getElementById('sticker-picker-modal').style.display='none'">×</button></div>
                    <div class="sticker-grid" id="sticker-grid"></div>
                </div>
            </div>

            <!-- Filter Panel -->
            <div id="filter-panel-modal" class="sub-modal" style="display:none;">
                <div class="sub-modal-content">
                    <div class="sub-modal-header"><h4>Bộ lọc màu</h4><button onclick="document.getElementById('filter-panel-modal').style.display='none'">×</button></div>
                    <div class="filter-list">
                        <div class="filter-item" onclick="SocialHub.applyFilter('none')"><div class="filter-preview fp-none"></div><span>Gốc</span></div>
                        <div class="filter-item" onclick="SocialHub.applyFilter('grayscale(100%)')"><div class="filter-preview fp-bw"></div><span>Trắng đen</span></div>
                        <div class="filter-item" onclick="SocialHub.applyFilter('sepia(80%)')"><div class="filter-preview fp-sepia"></div><span>Cổ điển</span></div>
                        <div class="filter-item" onclick="SocialHub.applyFilter('saturate(200%) brightness(1.1)')"><div class="filter-preview fp-vivid"></div><span>Sống động</span></div>
                        <div class="filter-item" onclick="SocialHub.applyFilter('hue-rotate(90deg) saturate(150%)')"><div class="filter-preview fp-cool"></div><span>Mát lạnh</span></div>
                        <div class="filter-item" onclick="SocialHub.applyFilter('hue-rotate(320deg) saturate(130%)')"><div class="filter-preview fp-warm"></div><span>Ấm áp</span></div>
                    </div>
                </div>
            </div>

            <!-- Duration Panel -->
            <div id="duration-panel-modal" class="sub-modal" style="display:none;">
                <div class="sub-modal-content">
                    <div class="sub-modal-header"><h4>Thời lượng hiển thị</h4><button onclick="document.getElementById('duration-panel-modal').style.display='none'">×</button></div>
                    <div class="duration-body">
                        <div class="duration-display"><span id="duration-val">5</span> giây</div>
                        <input type="range" min="3" max="15" value="5" id="story-duration-range" oninput="SocialHub.setStoryDuration(this.value)">
                        <p style="font-size:0.75rem;color:#888;margin-top:10px;">Lưu ý: Đối với Video/Audio, thời lượng sẽ tự động khớp với tệp gốc.</p>
                        <button class="btn btn--primary" style="margin-top:20px;width:100%" onclick="document.getElementById('duration-panel-modal').style.display='none'">Xong</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.storySelectedMusic = null;
        this.storyTextContent = '';
        this.storyTextColor = '#ffffff';
        this.storyTextPos = { top: '50%', left: '50%' };
        this.storyDuration = 5000;
        this.storyFilter = '';
        this.storyFlipped = false;
        this.storyFit = 'contain';
        this.initTextDrag();
    },

    initTextDrag: function () {
        const textEl = document.getElementById('story-text-overlay-preview');
        const container = document.getElementById('editor-preview-container');
        if (!textEl || !container) return;

        let isDragging = false, startX, startY, initialX, initialY;

        const startDrag = (e) => {
            if (!textEl.textContent.trim()) return;
            isDragging = true;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            const rect = textEl.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            initialX = rect.left - containerRect.left + rect.width / 2;
            initialY = rect.top - containerRect.top + rect.height / 2;
            e.stopPropagation();
        };

        const doDrag = (e) => {
            if (!isDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = clientX - startX;
            const dy = clientY - startY;

            let newX = initialX + dx;
            let newY = initialY + dy;

            textEl.style.left = newX + 'px';
            textEl.style.top = newY + 'px';
            textEl.style.transform = 'translate(-50%, -50%)';
            e.preventDefault();
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                // Save relative position
                const containerRect = container.getBoundingClientRect();
                const textRect = textEl.getBoundingClientRect();
                this.storyTextPos.left = ((textRect.left + textRect.width / 2 - containerRect.left) / containerRect.width * 100).toFixed(2) + '%';
                this.storyTextPos.top = ((textRect.top + textRect.height / 2 - containerRect.top) / containerRect.height * 100).toFixed(2) + '%';
            }
        };

        textEl.addEventListener('mousedown', startDrag);
        textEl.addEventListener('touchstart', startDrag, { passive: false });
        container.addEventListener('mousemove', doDrag);
        container.addEventListener('touchmove', doDrag, { passive: false });
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    },

    setTextOverlayColor: function (color) {
        this.storyTextColor = color;
        const textPreview = document.getElementById('story-text-overlay-preview');
        if (textPreview) textPreview.style.color = color;
        // Highlight selected dot
        document.querySelectorAll('.color-dot').forEach(d => d.style.outline = '');
        event?.currentTarget?.style && (event.currentTarget.style.outline = '3px solid #fff');
    },

    setTextOverlaySize: function (size) {
        const textPreview = document.getElementById('story-text-overlay-preview');
        if (textPreview) textPreview.style.fontSize = size + 'px';
        this.storyTextSize = size;
    },

    openStickerPicker: function () {
        const STICKERS = ['🏖️', '🌊', '🏔️', '🌸', '🔥', '⭐', '🎵', '❤️', '😍', '✈️', '🧳', '📸', '🌈', '🎉', '💫', '🍜', '🍹', '🌺', '🦋', '🏕️'];
        const grid = document.getElementById('sticker-grid');
        if (grid) grid.innerHTML = STICKERS.map(s => `<div class="sticker-item" onclick="SocialHub.addSticker('${s}')">${s}</div>`).join('');
        document.getElementById('sticker-picker-modal').style.display = 'flex';
    },

    addSticker: function (emoji) {
        const container = document.getElementById('editor-preview-container');
        if (!container) return;
        const sticker = document.createElement('div');
        sticker.className = 'editor-sticker';
        sticker.textContent = emoji;
        sticker.style.cssText = 'position:absolute;top:40%;left:40%;font-size:3rem;cursor:grab;z-index:6;user-select:none;';

        // Make sticker draggable
        let isd = false, sx, sy, ix, iy;
        sticker.addEventListener('mousedown', e => {
            isd = true; sx = e.clientX; sy = e.clientY;
            const r = sticker.getBoundingClientRect(), cr = container.getBoundingClientRect();
            ix = r.left + r.width / 2 - cr.left; iy = r.top + r.height / 2 - cr.top;
            e.stopPropagation();
        });
        document.addEventListener('mousemove', e => {
            if (!isd) return;
            sticker.style.left = (ix + e.clientX - sx) + 'px';
            sticker.style.top = (iy + e.clientY - sy) + 'px';
        });
        document.addEventListener('mouseup', () => { isd = false; });

        container.appendChild(sticker);
        document.getElementById('sticker-picker-modal').style.display = 'none';
        if (window.WanderUI) WanderUI.showToast(`Đã thêm nhãn dán! Nhấn đúp để xóa.`, 'info');
        
        // Double click to remove
        sticker.addEventListener('dblclick', () => {
            sticker.remove();
            if (window.WanderUI) WanderUI.showToast('Đã xóa nhãn dán', 'success');
        });
    },

    openFilterPanel: function () {
        document.getElementById('filter-panel-modal').style.display = 'flex';
    },

    openDurationPanel: function () {
        document.getElementById('duration-panel-modal').style.display = 'flex';
    },

    setStoryDuration: function (seconds) {
        this.storyDuration = seconds * 1000;
        const display = document.getElementById('duration-val');
        if (display) display.textContent = seconds;
    },

    removeSelectedMusic: function (e) {
        if (e) e.stopPropagation();
        this.storySelectedMusic = null;
        document.getElementById('story-music-overlay-preview').style.display = 'none';
        if (window.WanderUI) WanderUI.showToast('Đã gỡ nhạc', 'info');
    },

    clearTextOverlay: function () {
        this.storyTextContent = '';
        document.getElementById('story-text-input').value = '';
        const textPreview = document.getElementById('story-text-overlay-preview');
        if (textPreview) textPreview.style.display = 'none';
        document.getElementById('text-editor-modal').style.display = 'none';
    },

    applyFilter: function (filterVal) {
        const img = document.getElementById('story-preview-img');
        const vid = document.getElementById('story-preview-video');
        if (img && img.style.display !== 'none') img.style.filter = filterVal === 'none' ? '' : filterVal;
        if (vid && vid.style.display !== 'none') vid.style.filter = filterVal === 'none' ? '' : filterVal;
        this.storyFilter = filterVal === 'none' ? '' : filterVal;
        document.getElementById('filter-panel-modal').style.display = 'none';
        if (window.WanderUI) WanderUI.showToast('Đã áp dụng bộ lọc!', 'success');
    },

    flipMedia: function () {
        const img = document.getElementById('story-preview-img');
        const vid = document.getElementById('story-preview-video');
        this.storyFlipped = !this.storyFlipped;
        const val = this.storyFlipped ? 'scaleX(-1)' : 'scaleX(1)';
        if (img) img.style.transform = val;
        if (vid) vid.style.transform = val;
    },

    toggleStoryFit: function () {
        this.storyFit = (this.storyFit === 'contain') ? 'cover' : 'contain';
        const img = document.getElementById('story-preview-img');
        const vid = document.getElementById('story-preview-video');
        if (img) img.style.objectFit = this.storyFit;
        if (vid) vid.style.objectFit = this.storyFit;
        if (window.WanderUI) WanderUI.showToast(`Chế độ: ${this.storyFit === 'cover' ? 'Toàn màn hình' : 'Vừa khung hình'}`, 'info');
    },


    // Danh sách nhạc mẫu (free audio URLs)
    MUSIC_TRACKS: [
        { id: 1, name: 'Sunny Day Vibes', author: 'WanderViệt', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', genre: 'Pop', emoji: '☀️' },
        { id: 2, name: 'Chill Travel', author: 'Lofi Studio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', genre: 'Lofi', emoji: '🌊' },
        { id: 3, name: 'Adventure Awaits', author: 'Epic Sounds', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', genre: 'Epic', emoji: '🏔️' },
        { id: 4, name: 'Vietnam Morning', author: 'WanderViệt', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', genre: 'Acoustic', emoji: '🌸' },
        { id: 5, name: 'Street Food Beat', author: 'City Vibes', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', genre: 'Electronic', emoji: '🍜' },
        { id: 6, name: 'Mekong Sunset', author: 'Indie Folk', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', genre: 'Folk', emoji: '🌅' },
    ],

    closeMusicSelector: function () {
        this.stopMusicPreview();
        document.getElementById('music-selector-modal').style.display = 'none';
    },

    stopMusicPreview: function () {
        if (this._previewAudio) {
            this._previewAudio.pause();
            this._previewAudio = null;
        }
        document.querySelectorAll('.music-item').forEach(el => el.classList.remove('previewing'));
    },

    filterMusicList: function (query) {
        const q = query.toLowerCase();
        const list = document.getElementById('music-list-container');
        if (!list) return;
        list.innerHTML = this.MUSIC_TRACKS
            .filter(t => t.name.toLowerCase().includes(q) || t.author.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q))
            .map(t => `
                <div class="music-item" id="music-track-${t.id}" onclick="SocialHub.previewMusic(${t.id})">
                    <div class="music-icon">${t.emoji}</div>
                    <div class="music-info"><b>${t.name}</b><span>${t.author} &bull; ${t.genre}</span></div>
                    <button class="music-use-btn" onclick="event.stopPropagation(); SocialHub.selectMusic(${t.id})">Dùng</button>
                </div>
            `).join('');
    },

    openMusicSelector: function () {
        const list = document.getElementById('music-list-container');
        if (list && !list.innerHTML.trim()) {
            list.innerHTML = this.MUSIC_TRACKS.map(t => `
                <div class="music-item" id="music-track-${t.id}" onclick="SocialHub.previewMusic(${t.id})">
                    <div class="music-icon">${t.emoji}</div>
                    <div class="music-info">
                        <b>${t.name}</b>
                        <span>${t.author} &bull; ${t.genre}</span>
                    </div>
                    <button class="music-use-btn" onclick="event.stopPropagation(); SocialHub.selectMusic(${t.id})">
                        Dùng
                    </button>
                </div>
            `).join('');
        }
        document.getElementById('music-selector-modal').style.display = 'flex';
    },

    previewMusic: function (trackId) {
        const track = this.MUSIC_TRACKS.find(t => t.id === trackId);
        if (!track) return;

        // Dừng preview cũ nếu có
        if (this._previewAudio) {
            this._previewAudio.pause();
            this._previewAudio = null;
        }

        // Tô sáng item đang preview
        document.querySelectorAll('.music-item').forEach(el => el.classList.remove('previewing'));
        document.getElementById(`music-track-${trackId}`)?.classList.add('previewing');

        // Phát thử 10 giây
        const audio = new Audio(track.url);
        audio.volume = 0.6;
        audio.play().catch(() => { });
        setTimeout(() => { if (this._previewAudio === audio) { audio.pause(); this._previewAudio = null; } }, 10000);
        this._previewAudio = audio;
    },

    selectMusic: function (trackId) {
        const track = this.MUSIC_TRACKS.find(t => t.id === trackId);
        if (!track) return;

        // Dừng preview
        if (this._previewAudio) { this._previewAudio.pause(); this._previewAudio = null; }

        this.storySelectedMusic = { name: track.name, author: track.author, url: track.url };

        // Hiển thị overlay music trong preview
        const musicPreview = document.getElementById('story-music-overlay-preview');
        musicPreview.style.display = 'flex';
        document.getElementById('music-preview-name').textContent = `${track.emoji} ${track.name} - ${track.author}`;
        document.getElementById('music-selector-modal').style.display = 'none';
        if (window.WanderUI) WanderUI.showToast(`Âm thanh: ${track.emoji} ${track.name}`, 'success');
    },

    openTextEditor: function () {
        document.getElementById('text-editor-modal').style.display = 'flex';
        const input = document.getElementById('story-text-input');
        input.value = this.storyTextContent;
        input.focus();
    },

    applyTextOverlay: function () {
        const text = document.getElementById('story-text-input').value;
        const textPreview = document.getElementById('story-text-overlay-preview');
        if (text.trim()) {
            this.storyTextContent = text;
            textPreview.style.display = 'block';
            textPreview.textContent = text;
            textPreview.style.color = this.storyTextColor;
            // Make pointer events active so we can drag it
            textPreview.style.pointerEvents = 'auto';
            textPreview.style.cursor = 'grab';
        } else {
            this.storyTextContent = '';
            textPreview.style.display = 'none';
        }
        document.getElementById('text-editor-modal').style.display = 'none';
    },

    handleStoryUpload: function (input) {
        const file = input.files[0];
        if (!file) return;

        const img = document.getElementById('story-preview-img');
        const video = document.getElementById('story-preview-video');
        const placeholder = document.getElementById('upload-placeholder');

        placeholder.style.display = 'none';

        if (file.type.startsWith('video/')) {
            img.style.display = 'none';
            document.getElementById('story-preview-audio').style.display = 'none';
            video.style.display = 'block';
            video.src = URL.createObjectURL(file);
        } else if (file.type.startsWith('audio/')) {
            img.style.display = 'none';
            video.style.display = 'none';
            const audioPreview = document.getElementById('story-preview-audio');
            audioPreview.style.display = 'flex';
            document.getElementById('story-preview-audio-name').textContent = file.name;
        } else {
            video.style.display = 'none';
            document.getElementById('story-preview-audio').style.display = 'none';
            img.style.display = 'block';
            img.src = URL.createObjectURL(file);
        }

        document.getElementById('story-submit-btn').disabled = false;
        document.getElementById('editor-tools').style.opacity = '1';
        document.getElementById('editor-tools').style.pointerEvents = 'auto';
        this.storyFileToUpload = file;
    },

    submitStory: async function () {
        if (!this.storyFileToUpload) return;

        const submitBtn = document.getElementById('story-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span>';

        const formData = new FormData();
        formData.append('media', this.storyFileToUpload);
        if (this.storySelectedMusic) {
            formData.append('musicName', this.storySelectedMusic.name);
            formData.append('musicAuthor', this.storySelectedMusic.author);
            formData.append('musicUrl', this.storySelectedMusic.url || '');
        }
        if (this.storyTextContent) {
            formData.append('textOverlay', this.storyTextContent);
            formData.append('textColor', this.storyTextColor || '#ffffff');
            formData.append('textTop', this.storyTextPos?.top || '50%');
            formData.append('textLeft', this.storyTextPos?.left || '50%');
        }
        if (this.storyDuration) {
            formData.append('duration', this.storyDuration);
        }
        if (this.storyFilter) {
            formData.append('filter', this.storyFilter);
        }
        if (this.storyFlipped) {
            formData.append('flipped', true);
        }
        if (this.storyFit) {
            formData.append('objectFit', this.storyFit);
        }

        // Thu thập nhãn dán (stickers)
        const stickers = [];
        const container = document.getElementById('editor-preview-container');
        if (container) {
            container.querySelectorAll('.editor-sticker').forEach(st => {
                const rect = st.getBoundingClientRect();
                const crect = container.getBoundingClientRect();
                stickers.push({
                    content: st.textContent,
                    top: ((rect.top + rect.height / 2 - crect.top) / crect.height * 100).toFixed(2) + '%',
                    left: ((rect.left + rect.width / 2 - crect.left) / crect.width * 100).toFixed(2) + '%',
                    fontSize: st.style.fontSize || '3rem'
                });
            });
        }
        if (stickers.length > 0) {
            formData.append('stickers', JSON.stringify(stickers));
        }

        try {
            const res = await fetch('/api/social/stories', {
                method: 'POST',
                headers: { 'x-auth-token': localStorage.getItem('wander_token') },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                const modal = document.getElementById('create-story-modal');
                if (modal) modal.remove();

                // Dừng music preview
                if (this._previewAudio) { this._previewAudio.pause(); this._previewAudio = null; }

                // Cập nhật local array
                const newStory = data.data;
                newStory.user = {
                    _id: this.user._id,
                    name: this.user.name,
                    displayName: this.user.displayName,
                    avatar: this.user.avatar
                };

                this.stories.unshift(newStory);
                this.renderStories();

                // Reset states
                this.storyFileToUpload = null;
                this.storySelectedMusic = null;
                this.storyTextContent = '';
                this.storyTextColor = '#ffffff';
                this.storyTextPos = { top: '50%', left: '50%' };
                this.storyFilter = '';
                this.storyFlipped = false;
                this.storyDuration = 5000;
                this.storyFit = 'contain';

                if (window.WanderUI) WanderUI.showToast('Đã đăng thước phim! 🎉', 'success');
            } else {
                if (window.WanderUI) WanderUI.showToast(data.message || 'Lỗi đăng tin', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Đăng tin';
            }
        } catch (err) {
            console.error("Lỗi đăng story:", err);
            if (window.WanderUI) WanderUI.showToast('Lỗi hệ thống', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Đăng tin';
        }
    },

    startStoriesAutoRefresh: function () {
        // Refresh stories mỗi 2 phút
        setInterval(() => {
            this.fetchStories();
        }, 120000);
    },

    fetchFeed: async function () {
        const feedContainer = document.getElementById('feed-container');
        if (!feedContainer) return;
        feedContainer.innerHTML = '<div class="loading-shimmer" style="padding:40px;text-align:center">Đang tải bảng tin...</div>';
        try {
            const res = await fetch('/api/social/feed', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) {
                this.posts = data.data;
                this.renderFeed();
            } else {
                feedContainer.innerHTML = '<div class="glass-card" style="text-align:center;padding:60px;border-radius:24px;"><p style="color:var(--text-muted);font-weight:600;">Không thể tải bảng tin. Vui lòng thử lại.</p></div>';
            }
        } catch (err) {
            console.error('fetchFeed error:', err);
            feedContainer.innerHTML = '<p class="error" style="text-align:center;padding:40px;">Không thể tải bảng tin.</p>';
        }
    },

    renderFeed: function () {
        const feedContainer = document.getElementById('feed-container');
        if (!feedContainer) return;
        if (this.posts.length === 0) {
            feedContainer.innerHTML = '<div class="glass-card" style="text-align:center;padding:60px;border-radius:24px;"><p style="font-size:2.5rem;margin-bottom:16px;color:rgba(255,255,255,0.1);"><i class="fas fa-edit"></i></p><p style="color:var(--text-muted);font-weight:600;">Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!</p></div>';
            return;
        }
        feedContainer.innerHTML = this.posts.map(post => this.renderPostCard(post)).join('');
    },

    renderPostCard: function (post) {
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
                    <div class="post-user" onclick="SocialHub.viewProfile('${postAuthorId}')">
                        <img src="${post.userAvatar || 'assets/default-avatar.svg'}" alt="" class="avatar-sm" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}">
                        <div>
                            <h4>${post.userName}</h4>
                            <span class="post-time">${this.formatTime(post.createdAt)}${post.location?.name ? ' · 📍' + post.location.name : ''}</span>
                        </div>
                    </div>
                        <div class="post-menu-dropdown">
                            <button class="btn-icon post-menu-btn" onclick="SocialHub.togglePostMenu('${post._id}', event)"><i class="fas fa-ellipsis-h"></i></button>
                            <div class="post-menu" id="post-menu-${post._id}" style="display:none">
                                ${isOwner ? `
                                    <button onclick="SocialHub.editPost('${post._id}')"><i class="fas fa-edit"></i> Chỉnh sửa bài viết</button>
                                    <button onclick="SocialHub.deletePost('${post._id}')" class="text-danger"><i class="fas fa-trash-alt"></i> Xóa bài viết</button>
                                    <div class="menu-divider"></div>
                                ` : ''}
                                <button onclick="SocialHub.copyPostLink('${post._id}')"><i class="fas fa-link"></i> Sao chép liên kết</button>
                                <button onclick="SocialHub.sharePost('${post._id}')"><i class="fas fa-share"></i> Chia sẻ lên tường</button>
                                ${!isOwner ? `
                                    <button onclick="SocialHub.hidePost('${post._id}')"><i class="fas fa-eye-slash"></i> Ẩn bài viết này</button>
                                    <button onclick="SocialHub.reportPost('${post._id}')" class="text-danger"><i class="fas fa-flag"></i> Báo cáo vi phạm</button>
                                ` : ''}
                            </div>
                        </div>
                </div>
                <div class="post-content">${this.linkifyContent(post.content)}</div>
                ${post.media && post.media.length > 0 ? `
                    <div class="post-media ${post.mediaLayout ? 'media-layout-' + post.mediaLayout : (post.media.length > 1 ? 'media-grid' : '')}">
                        ${post.media.map((m, i) => {
                            if (m.type === 'image') return `<img src="${m.url}" alt="Ảnh bài viết" onclick="SocialHub.viewImage('${m.url}')" onerror="this.style.display='none'">`;
                            if (m.type === 'video') return `<video src="${m.url}" controls></video>`;
                            if (m.type === 'audio') return `
                                <div class="post-audio-card">
                                    <div class="audio-wave"><span></span><span></span><span></span><span></span></div>
                                    <audio src="${m.url}" controls></audio>
                                </div>
                            `;
                            return '';
                        }).join('')}
                    </div>
                ` : ''}
                
                ${post.attachment && post.attachment.type !== 'none' ? `
                    <div class="post-attachment-card" onclick="window.location.href='${post.attachment.link}'" style="cursor: pointer; margin-top: 0.75rem; padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.05); display: flex; align-items: center; gap: 1rem; border: 1px solid rgba(255,255,255,0.1); transition: all 0.2s;">
                        <span style="font-size: 2rem;">${post.attachment.type === 'itinerary' ? '🎒' : '📍'}</span>
                        <div style="flex: 1;">
                            <h4 style="margin: 0; font-size: 1.1rem; color: #fff;">${post.attachment.title}</h4>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${post.attachment.subtitle}</p>
                        </div>
                        <i class="fas fa-chevron-right" style="color: var(--text-muted);"></i>
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
                    <button class="post-action" onclick="SocialHub.toggleCommentBox('${post._id}')"><i class="far fa-comment"></i> Bình luận</button>
                    <button class="post-action" onclick="SocialHub.sharePost('${post._id}')"><i class="fas fa-share"></i> Chia sẻ</button>
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
                            <button class="comment-send-btn" onclick="SocialHub.addComment('${post._id}')"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ========== REACTIONS SYSTEM ==========
    getReactionEmoji: function (type) {
        const emojis = { like: '❤️', love: '😍', wow: '😮', haha: '😂', sad: '😢', angry: '😠' };
        return emojis[type] || '❤️';
    },

    getReactionLabel: function (type) {
        const labels = { like: 'Thích', love: 'Yêu thích', wow: 'Wow', haha: 'Haha', sad: 'Buồn', angry: 'Phẫn nộ' };
        return labels[type] || 'Thích';
    },

    toggleReaction: function (postId) {
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

    setReaction: function (postId, reactionType) {
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
                    
                    // Update only this post in DOM
                    const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
                    if (postCard) {
                        const newPostHtml = this.renderPostCard(post);
                        postCard.outerHTML = newPostHtml;
                    }
                }
                this.hideReactionPicker(postId);
            }
        }).catch(err => console.error('Reaction error:', err));
    },

    removeReaction: function (postId) {
        fetch(`/api/social/posts/${postId}/reaction`, {
            method: 'DELETE',
            headers: { 'x-auth-token': localStorage.getItem('wander_token') }
        }).then(res => res.json()).then(data => {
            if (data.success) {
                const post = this.posts.find(p => p._id === postId);
                if (post && post.reactions) {
                    delete post.reactions[this.user._id];
                    
                    // Update only this post in DOM
                    const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
                    if (postCard) {
                        const newPostHtml = this.renderPostCard(post);
                        postCard.outerHTML = newPostHtml;
                    }
                }
            }
        }).catch(err => console.error('Remove reaction error:', err));
    },

    showReactionPicker: function (postId) {
        if (this.pickerTimeout) clearTimeout(this.pickerTimeout);
        const picker = document.getElementById(`reaction-picker-${postId}`);
        if (picker) picker.classList.add('visible');
    },

    hideReactionPicker: function (postId) {
        this.pickerTimeout = setTimeout(() => {
            const picker = document.getElementById(`reaction-picker-${postId}`);
            if (picker) picker.classList.remove('visible');
        }, 300);
    },

    showReactionsList: function (postId) {
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

    renderCommentItem: function (comment, postAuthorId) {
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

    togglePostMenu: function (postId, event) {
        if (event) event.stopPropagation();
        const menu = document.getElementById(`post-menu-${postId}`);
        if (menu) {
            // Close all other menus first
            document.querySelectorAll('.post-menu').forEach(m => {
                if (m.id !== `post-menu-${postId}`) m.style.display = 'none';
            });
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    editPost: function (postId) {
        const post = this.posts.find(p => p._id === postId);
        if (!post) return;

        // Close menu
        const menu = document.getElementById(`post-menu-${postId}`);
        if (menu) menu.style.display = 'none';

        this.editingPostId = postId;
        
        // Open modal
        document.getElementById('post-modal')?.removeAttribute('hidden');
        document.querySelector('.modal__title').textContent = 'Chỉnh sửa bài viết';
        document.getElementById('submit-post').textContent = 'Cập nhật';

        // Populate content
        const contentInput = document.getElementById('post-content');
        if (contentInput) contentInput.value = post.content || '';

        // Populate location
        if (post.location?.name) {
            const tagBtn = document.getElementById('tag-location');
            if (tagBtn) {
                tagBtn.querySelector('span').textContent = post.location.name.substring(0, 30) + (post.location.name.length > 30 ? '...' : '');
                tagBtn.dataset.location = post.location.name;
                tagBtn.classList.add('active');
            }
        }

        // Populate attachment
        if (post.attachment && post.attachment.type !== 'none') {
            this.selectAttachment(
                post.attachment.refId || post.attachment.id,
                post.attachment.title,
                post.attachment.type,
                post.attachment.subtitle
            );
        }

        // Populate privacy
        const vis = post.isPublic ? 'public' : 'friends';
        const opt = document.querySelector(`.dropdown-option[data-value="${vis}"]`);
        if (opt) opt.click();

        // Close menu
        this.togglePostMenu(postId);
    },


    linkifyContent: function (text) {
        if (!text) return '';
        return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
            .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
            .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
            .replace(/\n/g, '<br>');
    },

    setupEventListeners: function () {
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
        document.getElementById('post-modal')?.addEventListener('click', (e) => { if (e.target.id === 'post-modal') e.target.setAttribute('hidden', ''); });

        // Close post modal v2
        document.getElementById('close-post-modal')?.addEventListener('click', () => { document.getElementById('post-modal')?.setAttribute('hidden', ''); });

        // Submit post
        document.getElementById('submit-post')?.addEventListener('click', () => this.submitPost());

        // Attach Trip/Destination (Old) - Removed in favor of inline toggle
        /*
        const attachBtn = document.getElementById('attach-trip');
        const attachModal = document.getElementById('attach-trip-modal');
        const closeAttachModal = document.getElementById('close-attach-modal');
        
        if (attachBtn) {
            attachBtn.addEventListener('click', () => this.openAttachModal());
        }
        if (closeAttachModal) {
            closeAttachModal.addEventListener('click', () => {
                if (attachModal) attachModal.style.display = 'none';
            });
        }
        
        const removeAttachBtn = document.getElementById('remove-attachment');
        if (removeAttachBtn) {
            removeAttachBtn.addEventListener('click', () => {
                this.currentPostAttachment = null;
                document.getElementById('attachment-preview-container').style.display = 'none';
            });
        }
        */

        // Audience Dropdown logic (Old) - Removed in favor of privacy-trigger
        /*
        const audOptions = document.querySelectorAll('#audience-dropdown .dropdown-option');
        const audSelected = document.getElementById('audience-selected');
        audOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                audOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                if (audSelected) {
                    audSelected.dataset.value = opt.dataset.value;
                    audSelected.innerHTML = opt.innerHTML + ' <i class="fas fa-chevron-down" style="font-size: 0.7em; margin-left: 4px;"></i>';
                }
                document.getElementById('audience-dropdown')?.blur();
            });
        });
        */

        // Tag location (Old) - Removed in favor of toggleInlineFeature
        /*
        document.getElementById('tag-location')?.addEventListener('click', () => {
            const locContainer = document.getElementById('location-input-container');
            if (locContainer) {
                locContainer.style.display = 'flex';
                document.getElementById('post-location-input')?.focus();
            }
        });
        */

        // Privacy Dropdown (New)
        document.getElementById('privacy-trigger')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const opts = document.getElementById('privacy-options');
            if (opts) opts.style.display = opts.style.display === 'none' ? 'block' : 'none';
        });

        // Use more specific selector to avoid conflicts
        document.querySelectorAll('#privacy-options .dropdown-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = opt.dataset.value;
                const labelText = opt.childNodes[opt.childNodes.length - 1].textContent.trim();
                const selected = document.getElementById('audience-selected');
                const trigger = document.getElementById('privacy-trigger');
                
                if (selected && trigger) {
                    selected.textContent = labelText;
                    selected.dataset.value = val;
                    // Update trigger icon
                    const oldIcon = trigger.querySelector('i.fas:not(.fa-chevron-down)');
                    if (oldIcon) {
                        const newIconClass = opt.querySelector('i').className;
                        oldIcon.className = newIconClass;
                    }
                }
                
                document.querySelectorAll('#privacy-options .dropdown-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                document.getElementById('privacy-options').style.display = 'none';
            });
        });



        document.addEventListener('click', () => {
            const opts = document.getElementById('privacy-options');
            if (opts) opts.style.display = 'none';
            
            // Close all post menus
            document.querySelectorAll('.post-menu').forEach(m => m.style.display = 'none');
        });

        document.getElementById('confirm-share-btn')?.addEventListener('click', () => {
            this.confirmShare();
        });



        // Toggle Inline Features (New)
        document.getElementById('tag-location')?.addEventListener('click', () => {
            this.toggleInlineFeature('map');
        });
        
        document.getElementById('attach-trip')?.addEventListener('click', () => {
            this.toggleInlineFeature('attach');
        });

        // Upload media
        document.getElementById('media-upload')?.addEventListener('change', (e) => {
            this.handleMediaUpload(e);
        });

        // Global Search (Universal support for sidebar & center search bars)
        const allSearchInputs = document.querySelectorAll('#user-search-input, .global-search-input');
        allSearchInputs.forEach(input => {
            input.addEventListener('input', (e) => this.performGlobalSearch(e.target.value, input));
            input.addEventListener('focus', () => this.showSearchSuggestions(input));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.saveSearchHistory(e.target.value);
                    this.openFullSearch(e.target.value);
                    // Clear and hide results
                    const card = input.closest('.search-card');
                    const res = card?.querySelector('#search-results, .search-results-overlay');
                    if (res) res.style.display = 'none';
                }
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-card')) {
                document.querySelectorAll('#search-results, .search-results-overlay').forEach(el => el.style.display = 'none');
            }
        });
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

    openPostModal: function () {
        const m = document.getElementById('post-modal');
        if (m) {
            const nameEl = document.getElementById('modal-post-name');
            const avatarEl = document.getElementById('modal-post-avatar');
            if (nameEl && this.user) nameEl.textContent = this.user.displayName || this.user.name || 'Người dùng';
            if (avatarEl && this.user) avatarEl.src = this.user.avatar || 'assets/default-avatar.svg';
            
            m.removeAttribute('hidden');
            document.getElementById('post-content')?.focus();
        }
    },

    // ========== MAP PICKER SYSTEM ==========
    toggleInlineFeature: function(feature) {
        const mapContainer = document.getElementById('inline-map-picker');
        const attachContainer = document.getElementById('inline-attach-picker');
        
        if (feature === 'map') {
            attachContainer.style.display = 'none';
            if (mapContainer.style.display === 'none') {
                mapContainer.style.display = 'block';
                this.initInlineMap();
            } else {
                mapContainer.style.display = 'none';
            }
        } else if (feature === 'attach') {
            mapContainer.style.display = 'none';
            if (attachContainer.style.display === 'none') {
                attachContainer.style.display = 'block';
                this.initInlineAttach();
            } else {
                attachContainer.style.display = 'none';
            }
        }
    },

    initInlineMap: function() {
        const container = document.getElementById('inline-map-picker');
        container.innerHTML = `
            <div class="inline-map-wrapper">
                <div id="inline-leaflet-map" style="height: 250px; border-radius: 12px; margin-bottom: 10px;"></div>
                <div class="inline-map-controls">
                    <div id="inline-map-address" class="inline-map-address">Đang xác định vị trí...</div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-confirm-loc" style="background:rgba(255,255,255,0.1); color:#fff;" onclick="SocialHub.cancelInlineLocation()">Hủy</button>
                        <button class="btn-confirm-loc" onclick="SocialHub.confirmInlineLocation()">Xác nhận</button>
                    </div>
                </div>
            </div>
        `;

        if (typeof L === 'undefined') return;

        const defaultLat = 21.0285;
        const defaultLng = 105.8542;

        this.inlineMap = L.map('inline-leaflet-map', {
            center: [defaultLat, defaultLng],
            zoom: 15,
            zoomControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.inlineMap);

        let moveTimeout;
        this.inlineMap.on('move', () => {
            document.getElementById('inline-map-address').textContent = "Đang tìm địa chỉ...";
            clearTimeout(moveTimeout);
            moveTimeout = setTimeout(() => this.updateInlineMapAddress(), 500);
        });

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                this.inlineMap.setView([pos.coords.latitude, pos.coords.longitude], 15);
            });
        }
        this.updateInlineMapAddress();
    },

    updateInlineMapAddress: async function() {
        if (!this.inlineMap) return;
        const center = this.inlineMap.getCenter();
        const addrEl = document.getElementById('inline-map-address');
        
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}&zoom=18&addressdetails=1`);
            const data = await res.json();
            
            const addr = data.address || {};
            // Xây dựng địa chỉ chi tiết hơn: Số nhà + Đường + Phường/Xã + Quận/Huyện + Tỉnh/Thành
            const parts = [];
            if (addr.house_number) parts.push(addr.house_number);
            if (addr.road) parts.push(addr.road);
            if (addr.suburb || addr.neighbourhood || addr.village || addr.commune) {
                parts.push(addr.suburb || addr.neighbourhood || addr.village || addr.commune);
            }
            if (addr.city_district || addr.district || addr.county) {
                parts.push(addr.city_district || addr.district || addr.county);
            }
            if (addr.city || addr.province || addr.state) {
                parts.push(addr.city || addr.province || addr.state);
            }

            const finalAddr = parts.length > 0 ? parts.join(', ') : (data.display_name || "Vị trí đã chọn");
            if (addrEl) addrEl.textContent = finalAddr;
            this.lastPickedLocation = { lat: center.lat, lng: center.lng, address: finalAddr };
        } catch (e) {
            if (addrEl) addrEl.textContent = "Không thể lấy địa chỉ";
        }
    },

    confirmInlineLocation: function() {
        if (this.lastPickedLocation) {
            const tagBtn = document.getElementById('tag-location');
            if (tagBtn) {
                tagBtn.querySelector('span').textContent = this.lastPickedLocation.address.substring(0, 30) + (this.lastPickedLocation.address.length > 30 ? '...' : '');
                tagBtn.dataset.location = this.lastPickedLocation.address;
                tagBtn.classList.add('active');
            }
        }
        document.getElementById('inline-map-picker').style.display = 'none';
    },

    cancelInlineLocation: function() {
        document.getElementById('inline-map-picker').style.display = 'none';
    },

    initInlineAttach: function() {
        const container = document.getElementById('inline-attach-picker');
        container.innerHTML = `
            <div class="inline-attach-wrapper">
                <div class="inline-attach-tabs">
                    <button class="inline-tab active" onclick="SocialHub.loadInlineAttachItems('trips', this)">Lịch trình</button>
                    <button class="inline-tab" onclick="SocialHub.loadInlineAttachItems('tours', this)">Tour</button>
                    <button class="inline-tab" onclick="SocialHub.loadInlineAttachItems('places', this)">Địa điểm</button>
                </div>
                <div id="inline-attach-list" class="inline-attach-list">Đang tải...</div>
            </div>
        `;
        this.loadInlineAttachItems('trips');
    },

    loadInlineAttachItems: async function(type, btn) {
        if (btn) {
            document.querySelectorAll('.inline-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
        const listEl = document.getElementById('inline-attach-list');
        listEl.innerHTML = '<div class="loader-sm"></div>';
        
        try {
            const token = localStorage.getItem('wander_token');
            let items = [];
            
            if (type === 'trips') {
                const res = await fetch('/api/planner/my-trips', { headers: { 'x-auth-token': token } });
                const data = await res.json();
                items = (data.trips || data.data || []).map(t => ({
                    id: t._id,
                    title: t.name || t.destination,
                    subtitle: `${t.days || 0} ngày`,
                    icon: '🎒',
                    type: 'itinerary'
                }));
            } else {
                // Lấy thông tin user để biết danh sách favorites
                const meRes = await fetch('/api/auth/user/me', { headers: { 'x-auth-token': token } });

                const meData = await meRes.json();
                const favorites = meData.user?.favorites || [];

                const res = await fetch('/api/places', { headers: { 'x-auth-token': token } });
                const data = await res.json();
                
                // Lọc theo favorites của user nếu là tab 'places'
                let allPlaces = data.data || [];
                if (type === 'places') {
                    allPlaces = allPlaces.filter(p => favorites.includes(p.id) || favorites.includes(p._id));
                } else if (type === 'tours') {
                    // Đối với Tour, có thể lấy các địa điểm có tag tour hoặc đơn giản là lọc riêng
                    allPlaces = allPlaces.filter(p => p.kind === 'tour' || p.category === 'tour');
                }

                items = allPlaces.slice(0, 10).map(p => ({
                    id: p._id || p.id,
                    title: p.name,
                    subtitle: p.region || 'Địa điểm',
                    icon: type === 'tours' ? '🚌' : '📍',
                    type: type === 'tours' ? 'tour' : 'place'
                }));
            }

            if (items.length === 0) {
                listEl.innerHTML = `<p class="empty-inline" style="text-align:center; color:var(--text-muted); padding:20px;">Bạn chưa lưu ${type === 'trips' ? 'lịch trình' : type === 'tours' ? 'tour' : 'địa điểm'} nào.</p>`;
                return;
            }

            listEl.innerHTML = items.map(item => `
                <div class="inline-attach-item" onclick="SocialHub.selectAttachment('${item.id}', '${item.title.replace(/'/g, "\\'")}', '${item.type}', '${item.subtitle}')">
                    <span style="font-size: 1.2rem;">${item.icon}</span>
                    <div class="info">
                        <strong>${item.title}</strong>
                        <small>${item.subtitle}</small>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error(e);
            listEl.innerHTML = '<p class="error-inline">Lỗi tải dữ liệu.</p>';
        }
    },



    initMapPicker: function() {
        if (typeof L === 'undefined') {
            console.error("Leaflet not loaded");
            return;
        }

        // Default to Hanoi
        const defaultLat = 21.0285;
        const defaultLng = 105.8542;

        this.map = L.map('leaflet-map', {
            center: [defaultLat, defaultLng],
            zoom: 15,
            zoomControl: false
        });

        L.control.zoom({ position: 'bottomright' }).addTo(this.map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        this.mapPickerInitialized = true;

        // Handle address update on map move
        let moveTimeout;
        this.map.on('move', () => {
            document.getElementById('map-picked-address').textContent = "Đang xác định...";
            clearTimeout(moveTimeout);
            moveTimeout = setTimeout(() => {
                this.updateMapAddress();
            }, 500);
        });

        // Try to get user's current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const latlng = [pos.coords.latitude, pos.coords.longitude];
                this.map.setView(latlng, 15);
            });
        }

        this.updateMapAddress();
    },

    updateMapAddress: async function() {
        if (!this.map) return;
        const center = this.map.getCenter();
        const addrEl = document.getElementById('map-picked-address');
        
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}&zoom=18&addressdetails=1`);
            const data = await res.json();
            const address = data.display_name || "Vị trí đã chọn";
            if (addrEl) addrEl.textContent = address;
            this.lastPickedLocation = {
                lat: center.lat,
                lng: center.lng,
                address: address
            };
        } catch (e) {
            if (addrEl) addrEl.textContent = "Không thể lấy địa chỉ";
        }
    },

    // ========== MEDIA HANDLING SYSTEM ==========
    handleMediaUpload: function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Append new files to the list
        files.forEach(file => {
            if (!this.postMediaFiles.some(f => f.name === file.name && f.size === file.size)) {
                this.postMediaFiles.push(file);
            }
        });

        this.renderMediaPreview();
        // Clear input to allow re-selecting same file
        e.target.value = '';
    },

    removeMedia: function(index) {
        this.postMediaFiles.splice(index, 1);
        this.renderMediaPreview();
    },

    renderMediaPreview: function() {
        const container = document.getElementById('media-preview');
        if (!container) return;

        if (this.postMediaFiles.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.className = 'media-preview-grid';
        container.innerHTML = this.postMediaFiles.map((file, index) => {
            const url = URL.createObjectURL(file);
            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');
            
            let mediaHtml = `<img src="${url}">`;
            if (isVideo) mediaHtml = `<video src="${url}"></video>`;
            if (isAudio) mediaHtml = `
                <div class="audio-preview-item">
                    <i class="fas fa-volume-up"></i>
                    <span>${file.name.substring(0, 15)}...</span>
                </div>
            `;
            
            return `
                <div class="preview-item">
                    ${mediaHtml}
                    <button class="btn-remove-media" onclick="SocialHub.removeMedia(${index})">&times;</button>
                </div>
            `;
        }).join('');
        
        // Add layout selector if multiple images
        if (this.postMediaFiles.length > 1) {
            const currentLayout = this.mediaLayout || 'grid';
            container.insertAdjacentHTML('afterend', `
                <div class="media-layout-selector" id="layout-selector-wrap">
                    <div class="layout-opt ${currentLayout === 'grid' ? 'active' : ''}" onclick="SocialHub.setMediaLayout('grid')">Lưới</div>
                    <div class="layout-opt ${currentLayout === 'column' ? 'active' : ''}" onclick="SocialHub.setMediaLayout('column')">Cột</div>
                    <div class="layout-opt ${currentLayout === 'carousel' ? 'active' : ''}" onclick="SocialHub.setMediaLayout('carousel')">Trượt</div>
                </div>
            `);
            // Remove old selector if exists
            const oldSelectors = document.querySelectorAll('#layout-selector-wrap');
            if (oldSelectors.length > 1) oldSelectors[0].remove();
        } else {
            document.getElementById('layout-selector-wrap')?.remove();
        }
    },

    setMediaLayout: function(layout) {
        this.mediaLayout = layout;
        document.querySelectorAll('.layout-opt').forEach(opt => {
            opt.classList.toggle('active', opt.textContent.toLowerCase() === (layout === 'grid' ? 'lưới' : layout === 'column' ? 'cột' : 'trượt'));
        });
    },

    switchTab: function (tab) {
        this.activeTab = tab;
        document.querySelectorAll('.social-nav-tab, .mobile-nav-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.tab-panel').forEach(p => p.style.display = p.id === `panel-${tab}` ? 'block' : 'none');

        // Scroll to top when switching tabs
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    openAttachModal: function(type = 'trips') {
        const m = document.getElementById('attach-modal');
        if (!m) return;
        m.style.display = 'flex';
        document.querySelectorAll('.attach-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.type === type);
        });
        this.loadAttachItems(type);
    },

    loadAttachItems: async function(type) {
        const listEl = document.getElementById('attach-list');
        if (!listEl) return;
        listEl.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 1rem;"><i class="fas fa-spinner fa-spin"></i> Đang tải...</div>';
        
        try {
            const token = localStorage.getItem('wander_token');
            if (type === 'trips') {
                const res = await fetch('/api/planner/my-trips', { headers: { 'x-auth-token': token } });
                const data = await res.json();
                if (data.trips && data.trips.length > 0) {
                    listEl.innerHTML = data.trips.map(t => `
                        <div class="attach-item" onclick="SocialHub.selectAttachment('${t._id}', '${t.name.replace(/'/g, "\\'")}', 'itinerary')">
                            <div style="font-size: 1.5rem; width: 40px; text-align: center;">🎒</div>
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">${t.name}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${t.days} ngày - ${new Date(t.startDate).toLocaleDateString('vi-VN')}</div>
                            </div>
                        </div>
                    `).join('');
                } else if (data.data && data.data.length > 0) {
                    // Fallback for different API response structure
                    listEl.innerHTML = data.data.map(t => `
                        <div class="attach-item" onclick="SocialHub.selectAttachment('${t._id}', '${(t.name || t.destination).replace(/'/g, "\\'")}', 'itinerary')">
                            <div style="font-size: 1.5rem; width: 40px; text-align: center;">🎒</div>
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">${t.name || t.destination}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${t.days} ngày</div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    listEl.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 1rem;">Bạn chưa có lịch trình nào.</div>';
                }
            } else if (type === 'tours') {
                // Tours currently don't have a dedicated endpoint in the provided routes, 
                // but we can fetch featured places that are marked as 'tour' or similar.
                // For now, let's fetch a few destinations from places API.
                const res = await fetch('/api/places', { headers: { 'x-auth-token': token } });
                const data = await res.json();
                if (data.success && data.data && data.data.length > 0) {
                    listEl.innerHTML = data.data.slice(0, 5).map(p => `
                        <div class="attach-item" onclick="SocialHub.selectAttachment('${p._id}', '${p.name.replace(/'/g, "\\'")}', 'tour')">
                            <div style="font-size: 1.5rem; width: 40px; text-align: center; color: #10b981;"><i class="fas fa-bus"></i></div>
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">${p.name}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${p.region || 'Việt Nam'} • ${p.priceFrom || 'Liên hệ'}</div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    listEl.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 1rem;">Không tìm thấy tour khả dụng.</div>';
                }
            } else if (type === 'places') {
                const res = await fetch('/api/places', { headers: { 'x-auth-token': token } });
                const data = await res.json();
                if (data.success && data.data && data.data.length > 0) {
                    listEl.innerHTML = data.data.slice(0, 10).map(p => `
                        <div class="attach-item" onclick="SocialHub.selectAttachment('${p._id}', '${p.name.replace(/'/g, "\\'")}', 'place')">
                            <div style="font-size: 1.5rem; width: 40px; text-align: center; color: #f43f5e;"><i class="fas fa-location-dot"></i></div>
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">${p.name}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${p.region || 'Địa điểm'} • ${p.verified ? '✅ Đã xác minh' : 'Chưa xác minh'}</div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    listEl.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 1rem;">Không tìm thấy địa điểm nào.</div>';
                }
            }
        } catch(e) {
            listEl.innerHTML = '<div style="text-align:center; color: #f43f5e; padding: 1rem;">Lỗi tải dữ liệu.</div>';
        }
    },

    selectAttachment: function(id, title, type, subtitle = '') {
        // Map types to schema: itinerary -> itinerary, others -> destination
        const schemaType = type === 'itinerary' ? 'itinerary' : 'destination';
        this.currentPostAttachment = { refId: id, title, type: schemaType, subtitle };

        
        const attachPreview = document.getElementById('attachment-preview-container');
        const attachTitle = document.getElementById('attachment-preview-title');
        const attachSubtitle = document.getElementById('attachment-preview-subtitle');
        const attachIcon = document.getElementById('attachment-preview-icon');
        
        if (attachPreview) {
            if (attachTitle) attachTitle.textContent = title;
            if (attachSubtitle) attachSubtitle.textContent = subtitle;
            if (attachIcon) {
                if(type === 'itinerary') attachIcon.textContent = '🎒';
                else if(type === 'tour') attachIcon.innerHTML = '<i class="fas fa-bus" style="color:#fbbf24;"></i>';
                else attachIcon.innerHTML = '<i class="fas fa-map-marker-alt" style="color:#f43f5e;"></i>';
            }
            attachPreview.style.display = 'flex';
        }
        
        document.getElementById('inline-attach-picker').style.display = 'none';
        const attachBtn = document.getElementById('attach-trip');
        if (attachBtn) attachBtn.classList.add('active');
    },

    removeAttachment: function() {
        this.currentPostAttachment = null;
        document.getElementById('attachment-preview-container').style.display = 'none';
        document.getElementById('attach-trip').classList.remove('active');
    },


    submitPost: async function () {
        const contentInput = document.getElementById('post-content');
        const content = contentInput ? contentInput.value : '';
        const fileInput = document.getElementById('media-upload');
        const locationEl = document.getElementById('tag-location');
        const submitBtn = document.getElementById('submit-post');

        if (!content.trim() && this.postMediaFiles.length === 0 && !this.currentPostAttachment) {
            return alert("Vui lòng nhập nội dung, chọn ảnh hoặc đính kèm lịch trình!");
        }


        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loading-spinner"></span> Đang đăng...';
        }

        try {
            let res;
            const token = localStorage.getItem('wander_token');
            const visSelect = document.getElementById('audience-selected');
            const visibility = visSelect ? visSelect.dataset.value : 'public';

            if (this.editingPostId) {
                // UPDATE POST (Media update not supported via simple PUT yet, just JSON fields)
                res = await fetch(`/api/social/posts/${this.editingPostId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                    },
                    body: JSON.stringify({
                        content,
                        location: locationEl?.dataset?.location ? { name: locationEl.dataset.location } : null,
                        attachment: this.currentPostAttachment,
                        visibility: visibility
                    })
                });
            } else if (this.postMediaFiles.length > 0) {
                const formData = new FormData();
                formData.append('content', content || '');
                formData.append('visibility', visibility);
                if (locationEl?.dataset?.location) formData.append('locationName', locationEl.dataset.location);
                if (this.currentPostAttachment) formData.append('attachment', JSON.stringify(this.currentPostAttachment));
                if (this.mediaLayout) formData.append('mediaLayout', this.mediaLayout);
                
                this.postMediaFiles.forEach(f => formData.append('media', f));
                
                res = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    const progContainer = document.getElementById('upload-progress-container');
                    const progBar = document.getElementById('upload-progress-bar');
                    const progPercent = document.getElementById('upload-percent');
                    
                    if (progContainer) progContainer.style.display = 'block';

                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            if (progBar) progBar.style.width = percent + '%';
                            if (progPercent) progPercent.textContent = percent + '%';
                        }
                    });

                    xhr.onreadystatechange = () => {
                        if (xhr.readyState === 4) {
                            if (progContainer) progContainer.style.display = 'none';
                            try {
                                const response = JSON.parse(xhr.responseText);
                                resolve({ ok: xhr.status >= 200 && xhr.status < 300, json: () => Promise.resolve(response) });
                            } catch (e) {
                                reject(new Error("Lỗi phản hồi từ server"));
                            }
                        }
                    };

                    xhr.onerror = () => {
                        if (progContainer) progContainer.style.display = 'none';
                        reject(new Error("Lỗi kết nối mạng"));
                    };

                    xhr.open('POST', '/api/social/posts/media');
                    xhr.setRequestHeader('x-auth-token', token);
                    xhr.send(formData);
                });
            } else {
                res = await fetch('/api/social/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                    },
                    body: JSON.stringify({
                        content,
                        location: locationEl?.dataset?.location ? { name: locationEl.dataset.location } : null,
                        attachment: this.currentPostAttachment,
                        visibility: visibility
                    })
                });
            }

            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Không thể đăng bài");
            }
                
            // Clear attachment state and UI
            this.currentPostAttachment = null;
            const attachPreview = document.getElementById('attachment-preview-container');
            if (attachPreview) attachPreview.style.display = 'none';

            await this.loadUserProfile();
            
            // Optimistic UI: Prepend to feed and update local array
            const newPost = data.post;

                if (newPost) {
                    if (!this.posts.some(p => p._id === newPost._id)) {
                        this.posts.unshift(newPost);
                        const feedContainer = document.getElementById('feed-container');
                        if (feedContainer) {
                            // Remove empty state if present
                            const emptyState = feedContainer.querySelector('.glass-card p');
                            if (emptyState && emptyState.textContent && emptyState.textContent.includes('Chưa có bài viết nào')) {
                                feedContainer.innerHTML = '';
                            }
                            const postHtml = this.renderPostCard(newPost);
                            feedContainer.insertAdjacentHTML('afterbegin', postHtml);
                        }
                    }
                    if (window.WanderUI) WanderUI.showToast(this.editingPostId ? 'Đã cập nhật bài viết! ✨' : 'Đã đăng bài viết! 🎉', 'success');
                    
                    // Reset modal state
                    this.editingPostId = null;
                    document.querySelector('.modal__title').textContent = 'Tạo bài viết mới';
                    document.getElementById('submit-post').textContent = 'Đăng bài';

                    // Clear and hide modal
                    document.getElementById('post-modal')?.setAttribute('hidden', '');
                    if (contentInput) contentInput.value = '';
                    if (fileInput) fileInput.value = '';
                    this.postMediaFiles = [];
                    this.mediaLayout = 'grid';
                    const mediaPreview = document.getElementById('media-preview');
                    if (mediaPreview) mediaPreview.innerHTML = '';
                    document.getElementById('layout-selector-wrap')?.remove();
                    
                    const tagBtn = document.getElementById('tag-location');
                    if (tagBtn) {
                        tagBtn.querySelector('span').textContent = 'Gắn thẻ';
                        delete tagBtn.dataset.location;
                        tagBtn.classList.remove('active');
                    }
                    const locContainer = document.getElementById('location-input-container');
                    if (locContainer) locContainer.style.display = 'none';
                    const locInput = document.getElementById('post-location-input');
                    if (locInput) locInput.value = '';

                    // If editing, refresh the post in the feed instead of prepending
                    if (data.post) {
                        const existingIdx = this.posts.findIndex(p => p._id === data.post._id);
                        if (existingIdx !== -1) {
                            this.posts[existingIdx] = data.post;
                            this.renderFeed(); // Full re-render for simplicity after edit
                        }
                    }
                }
        } catch (err) {
            console.error(err);
            alert("Lỗi khi xử lý bài viết!");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = this.editingPostId ? "Cập nhật" : "Đăng bài";
            }
        }

    },

    toggleLike: async function (postId, isLiked) {
        try {
            const endpoint = isLiked ? '/api/social/unlike' : '/api/social/like';
            await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ targetId: postId, targetType: 'post' }) });
            await this.fetchFeed();
        } catch (err) { }
    },

    toggleCommentBox: function (postId) {
        const section = document.getElementById(`comments-${postId}`);
        if (section) {
            const isHidden = section.style.display === 'none';
            section.style.display = isHidden ? 'block' : 'none';
            if (isHidden) section.querySelector('input')?.focus();
        }
    },

    sharePost: function (postId) {
        const post = this.posts.find(p => p._id === postId);
        if (!post) return;

        // Close menu
        const menu = document.getElementById(`post-menu-${postId}`);
        if (menu) menu.style.display = 'none';

        this.sharingPostId = postId;
        const modal = document.getElementById('share-modal');
        const preview = document.getElementById('share-preview-post');
        const commentInput = document.getElementById('share-comment');

        if (modal && preview) {
            preview.innerHTML = `📎 Chia sẻ từ @${post.userName}: "${post.content ? post.content.substring(0, 80) + (post.content.length > 80 ? '...' : '') : '(Ảnh/Video)'}"`;
            if (commentInput) commentInput.value = '';
            modal.style.display = 'flex';
        }
    },

    confirmShare: async function () {
        if (!this.sharingPostId) return;

        const comment = document.getElementById('share-comment')?.value || '';
        const btn = document.getElementById('confirm-share-btn');
        const originalBtnText = btn.textContent;

        try {
            btn.disabled = true;
            btn.textContent = 'Đang chia sẻ...';

            const res = await fetch(`/api/social/posts/${this.sharingPostId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': localStorage.getItem('wander_token')
                },
                body: JSON.stringify({ comment })
            });

            const data = await res.json();
            if (data.success) {
                if (window.WanderUI) WanderUI.showToast('Đã chia sẻ bài viết! 🔗', 'success');
                document.getElementById('share-modal').style.display = 'none';
                await this.fetchFeed();
            } else {
                throw new Error(data.message || 'Lỗi khi chia sẻ');
            }
        } catch (err) {
            console.error(err);
            if (window.WanderUI) WanderUI.showToast('Không thể chia sẻ bài viết', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalBtnText;
            this.sharingPostId = null;
        }
    },

    showAllComments: function (postId) {
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

    addComment: async function (postId) {
        const input = document.getElementById(`comment-input-${postId}`);
        const text = input?.value?.trim();
        if (!text) return;
        input.value = '';
        try {
            const res = await fetch(`/api/social/posts/${postId}/comment`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, 
                body: JSON.stringify({ text }) 
            });
            const data = await res.json();
            if (data.success) {
                // The new_comment socket listener will handle the UI update even for the sender,
                // but we can also do it here for extra snappy feel if socket is slow.
                // However, to avoid duplicates, we'll let the socket listener handle it since 
                // the backend now emits it to the sender too.
                
                // Just ensure the comment box stays open
                const s = document.getElementById(`comments-${postId}`);
                if (s) s.style.display = 'block';
            }
        } catch (err) { }
    },

    copyPostLink: async function (postId) {
        // Close menu
        const menu = document.getElementById(`post-menu-${postId}`);
        if (menu) menu.style.display = 'none';

        const postUrl = `${window.location.origin}/social-hub.html?post=${postId}`;
        try {
            await navigator.clipboard.writeText(postUrl);
            if (window.WanderUI) WanderUI.showToast('Đã sao chép liên kết vào bộ nhớ tạm! 📋', 'success');
        } catch (err) {
            if (window.WanderUI) WanderUI.showToast('Không thể sao chép liên kết', 'error');
        }
    },

    hidePost: async function (postId) {
        // Close menu
        const menu = document.getElementById(`post-menu-${postId}`);
        if (menu) menu.style.display = 'none';

        try {
            const res = await fetch('/api/social/not-interested', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-auth-token': localStorage.getItem('wander_token') 
                },
                body: JSON.stringify({ targetId: postId, targetType: 'post' })
            });
            const data = await res.json();
            if (data.success) {
                if (window.WanderUI) WanderUI.showToast('Đã ẩn bài viết. Chúng tôi sẽ hạn chế nội dung tương tự.', 'info');
                // Remove from local feed
                this.posts = this.posts.filter(p => p._id !== postId);
                this.renderFeed();
            }
        } catch (err) { }
    },

    reportPost: function (postId) {
        if (window.WanderUI) WanderUI.showToast('Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét bài viết này.', 'info');
        // Close menu
        const menu = document.getElementById(`post-menu-${postId}`);
        if (menu) menu.style.display = 'none';
    },

    deletePost: async function (postId) {
        // Close menu
        const menu = document.getElementById(`post-menu-${postId}`);
        if (menu) menu.style.display = 'none';

        if (!window.WanderUI || !WanderUI.confirm) {
            if (!confirm("Bạn có chắc muốn xóa bài viết này?")) return;
        } else {
            const ok = await WanderUI.confirm("Xóa bài viết", "Bạn có chắc chắn muốn xóa bài viết này không? Hành động này không thể hoàn tác.");
            if (!ok) return;
        }
        try {
            const token = localStorage.getItem('wander_token');
            const res = await fetch(`/api/social/posts/${postId}`, { 
                method: 'DELETE', 
                headers: { 'x-auth-token': token } 
            });
            const data = await res.json();
            
            if (data.success) {
                if (window.WanderUI) WanderUI.showToast('Đã xóa bài viết', 'success');
                // Instant UI feedback: filter out and re-render
                this.posts = this.posts.filter(p => p._id !== postId);
                this.renderFeed();
                await this.loadUserProfile(); // Update stats in sidebar
            } else {
                throw new Error(data.message || "Không thể xóa bài viết");
            }
        } catch (err) {
            console.error(err);
            if (window.WanderUI) WanderUI.showToast('Lỗi khi xóa bài viết', 'error');
        }
    },

    viewProfile: function (userId) {
        window.location.href = `profile.html?id=${userId}`;
    },

    viewImage: function (url) {
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
    showGuestLanding: function () {
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
    renderTrending: function () {
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

    searchHashtag: function (tag) {
        const input = document.getElementById('user-search-input');
        if (input) {
            input.value = tag;
            this.searchUsers(tag);
        }
    },

    // ========== FRIENDS ==========
    fetchPendingFriends: async function () {
        const container = document.getElementById('friend-suggestions');
        if (!container) return;
        try {
            const res = await fetch('/api/social/friends/pending', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                container.innerHTML = data.data.map(f => `
                    <div class="friend-request-card">
                        <img src="${f.requester?.avatar || 'assets/default-avatar.svg'}" class="avatar-sm" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}" onclick="SocialHub.viewProfile('${f.requester?._id || f.requester?.id}')" style="cursor:pointer">
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
        } catch (err) { }
    },

    respondFriend: async function (id, action) {
        try {
            await fetch('/api/social/friends/respond', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('wander_token') }, body: JSON.stringify({ friendshipId: id, action }) });
            this.fetchPendingFriends();
            this.loadFriendsList();
            this.loadUserProfile(); // Update friend count
        } catch (err) { }
    },

    loadFriendsList: async function () {
        const container = document.getElementById('friends-list-container');
        if (!container) return;
        try {
            const res = await fetch('/api/social/friends', { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                container.innerHTML = data.data.map(f => `
                    <div class="friend-item" onclick="SocialHub.viewProfile('${f._id || f.id}')">
                        <img src="${f.avatar || 'assets/default-avatar.svg'}" class="avatar-sm" alt="" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='assets/default-avatar.svg'}">
                        <div class="friend-info">
                            <strong>${f.displayName || f.name}</strong>
                            <span>Hạng ${f.rank || 'Đồng'}</span>
                        </div>
                        <button class="btn-xs btn--chat" onclick="event.stopPropagation(); SocialHub.openChat('${f._id || f.id}', '${(f.displayName || f.name).replace(/'/g, '')}', '${f.avatar || ''}')">💬</button>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="empty-state-text">Chưa có bạn bè.</p>';
            }
        } catch (err) { }
    },

    // ========== MESSAGING ==========
    loadConversations: async function () {
        const container = document.getElementById('conversations-list');
        if (!container) return;
        try {
            const res = await fetch(`/api/social/conversations?t=${Date.now()}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                container.innerHTML = data.data.map(c => `
                    <div class="convo-item" onclick="SocialHub.openChat('${c.otherUser?._id || c.otherUser?.id || ''}', '${(c.otherUser?.displayName || c.otherUser?.name || '').replace(/'/g, '')}', '${c.otherUser?.avatar || ''}')">
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
        } catch (err) { }
    },

    openChat: async function (userId, name, avatar) {
        this.chatTarget = { userId, name, avatar };
        const drawer = document.getElementById('chat-drawer');
        if (!drawer) return;
        drawer.classList.add('open');
        document.getElementById('chat-target-name').textContent = name;
        document.getElementById('chat-target-avatar').src = avatar || 'assets/default-avatar.svg';
        const body = document.getElementById('chat-messages');
        body.innerHTML = '<div class="chat-loading"><span class="loading-spinner"></span> Đang tải...</div>';
        try {
            const res = await fetch(`/api/social/messages/${userId}?t=${Date.now()}`, { headers: { 'x-auth-token': localStorage.getItem('wander_token') } });
            const data = await res.json();
            if (data.success) {
                if (data.data.length === 0) {
                    body.innerHTML = '<div class="chat-empty">Bắt đầu cuộc trò chuyện với <strong>' + name + '</strong></div>';
                } else {
                    body.innerHTML = data.data.map(m => {
                        const myId = this.user?._id || this.user?.id;
                        const isSent = myId && (m.senderId === myId || m.senderId?.toString() === myId);
                        
                        let storyRefHtml = '';
                        if (m.storyRef && m.storyRef.mediaUrl) {
                            storyRefHtml = `
                                <div class="chat-story-ref" onclick="SocialHub.openStoryViewerByRef('${m.storyRef.id}')">
                                    <div class="story-ref-thumb" style="background-image: url('${m.storyRef.mediaUrl}')">
                                        <div class="story-ref-play"><i class="fas fa-play-circle"></i></div>
                                    </div>
                                    <div class="story-ref-text">Phản hồi thước phim</div>
                                </div>
                            `;
                        }

                        return `
                        <div class="chat-msg ${isSent ? 'sent' : 'received'}">
                            ${storyRefHtml}
                            <p>${m.text}</p>
                            <span class="msg-time">${this.formatTime(m.createdAt)}</span>
                        </div>`;
                    }).join('');
                }
                body.scrollTop = body.scrollHeight;
            }
        } catch (err) { body.innerHTML = '<p class="chat-error">Lỗi tải tin nhắn.</p>'; }

        // Join personal chat room
        if (this.socket) {
            this.socket.emit('join_chat', userId);
        }
    },


    // Polling is deprecated, kept as fallback or removed
    refreshChatMessages: async function () {
        // No longer used in socket mode
    },

    closeChat: function () {
        const drawer = document.getElementById('chat-drawer');
        if (drawer) drawer.classList.remove('open');
        
        if (this.socket && this.chatTarget) {
            this.socket.emit('leave_chat', this.chatTarget.userId);
        }
        this.chatTarget = null;
        if (this.chatPollingInterval) {
            clearInterval(this.chatPollingInterval);
            this.chatPollingInterval = null;
        }
    },

    sendMessage: async function () {
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
            this.loadConversations(); // Update list after sending
        } catch (err) { }
    },

    // ========== FRIEND SUGGESTIONS ==========
    loadFriendSuggestions: async function () {
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

    sendFriendRequest: async function (userId, btn) {
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
    formatTime: function (dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now - date) / 1000;
        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
        if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
        if (diff < 604800) return Math.floor(diff / 86400) + ' ngày trước';
        return date.toLocaleDateString('vi-VN');
    },

    // === GLOBAL SEARCH SYSTEM ===
    performGlobalSearch: async function (query, inputEl) {
        const resultsEl = inputEl ? inputEl.closest('.search-card').querySelector('#search-results, .search-results-overlay') : document.getElementById('search-results');
        if (!resultsEl) return;

        if (!query || query.length < 2) {
            this.showSearchSuggestions(inputEl);
            return;
        }

        resultsEl.style.display = 'block';
        resultsEl.innerHTML = '<div class="search-loading">Đang tìm kiếm...</div>';

        try {
            const res = await fetch(`/api/social/search?q=${encodeURIComponent(query)}`, {
                headers: { 'x-auth-token': localStorage.getItem('wander_token') }
            });
            const data = await res.json();
            if (data.success) {
                this.renderSearchResults(data.data, inputEl);
            } else {
                console.error("Search API Error:", data.message);
                resultsEl.innerHTML = `<div class="search-error">Lỗi tìm kiếm: ${data.message || 'Không xác định'}</div>`;
            }
        } catch (e) {
            console.error("Search Fetch Error:", e);
            resultsEl.innerHTML = '<div class="search-error">Không tìm thấy kết quả hoặc lỗi kết nối</div>';
        }
    },

    saveSearchHistory: function (query) {
        if (!query || query.trim().length < 2) return;
        query = query.trim();
        let history = JSON.parse(localStorage.getItem('wander_search_history') || '[]');
        history = history.filter(q => q.toLowerCase() !== query.toLowerCase()); // Remove duplicates
        history.unshift(query);
        if (history.length > 5) history = history.slice(0, 5); // Keep last 5
        localStorage.setItem('wander_search_history', JSON.stringify(history));
    },

    clearSearchHistory: function (e) {
        if (e) e.stopPropagation();
        localStorage.removeItem('wander_search_history');
        this.showSearchSuggestions();
    },

    showSearchSuggestions: function (inputEl) {
        const resultsEl = inputEl ? inputEl.closest('.search-card').querySelector('#search-results, .search-results-overlay') : document.getElementById('search-results');
        if (!resultsEl) return;

        resultsEl.style.display = 'block';

        let historyHtml = '';
        const history = JSON.parse(localStorage.getItem('wander_search_history') || '[]');
        if (history.length > 0) {
            historyHtml = `
                <div class="search-suggestion-header">
                    <span>Lịch sử tìm kiếm</span>
                    <button class="btn-clear-history" onclick="SocialHub.clearSearchHistory(event)">Xóa</button>
                </div>
            `;
            history.forEach(q => {
                historyHtml += `<div class="search-suggestion-item" onclick="SocialHub.openFullSearch('${q.replace(/'/g, "\\'")}')"><i class="fas fa-history"></i> ${q}</div>`;
            });
        }

        resultsEl.innerHTML = historyHtml + `
            <div class="search-suggestion-header">Gợi ý khám phá</div>
            <div class="search-suggestion-item" onclick="SocialHub.openFullSearch('Đà Lạt')"><i class="fas fa-fire"></i> Đà Lạt</div>
            <div class="search-suggestion-item" onclick="SocialHub.openFullSearch('Hà Giang')"><i class="fas fa-fire"></i> Hà Giang Loop</div>
            <div class="search-suggestion-item" onclick="SocialHub.openFullSearch('Phú Quốc')"><i class="fas fa-fire"></i> Phú Quốc</div>
        `;
    },

    renderSearchResults: function (results, inputEl) {
        const resultsEl = inputEl ? inputEl.closest('.search-card').querySelector('#search-results, .search-results-overlay') : document.getElementById('search-results');
        if (!resultsEl) return;

        if (results.length === 0) {
            resultsEl.innerHTML = '<div class="search-no-results">Không tìm thấy gì phù hợp</div>';
            return;
        }

        const groups = {
            user: { title: 'Người dùng', icon: 'fa-user' },
            post: { title: 'Bài viết & Địa điểm', icon: 'fa-newspaper' },
            community: { title: 'Hội nhóm', icon: 'fa-users' }
        };

        let html = '';
        Object.entries(groups).forEach(([type, info]) => {
            const items = results.filter(r => r.type === type);
            if (items.length > 0) {
                html += `<div class="search-group-title"><i class="fas ${info.icon}"></i> ${info.title}</div>`;
                items.forEach(item => {
                    html += `
                        <div class="search-result-item" onclick="SocialHub.handleSearchResultClick('${item.type}', '${item.id}')">
                            <img src="${item.avatar || 'assets/default-avatar.svg'}" alt="" onerror="this.src='assets/default-avatar.svg'">
                            <div class="result-info">
                                <b>${item.title}</b>
                                <span>${item.subtitle}</span>
                            </div>
                        </div>
                    `;
                });
            }
        });

        resultsEl.innerHTML = html;
    },

    handleSearchResultClick: function (type, id) {
        if (type === 'user') {
            this.viewProfile(id);
        } else if (type === 'post') {
            // logic to open a modal with the post
            if (window.WanderUI) WanderUI.showToast('Đang mở bài viết...', 'info');
        } else if (type === 'community') {
            this.viewCommunity(id);
        } else if (type === 'destination') {
            window.location.href = `destination-detail.html?id=${id}`;
        }
        // Hide all search results overlays
        document.querySelectorAll('#search-results, .search-results-overlay').forEach(el => el.style.display = 'none');
    },

    openFullSearch: async function (query) {
        if (!query || query.length < 2) return;

        // Hide all search results overlays immediately
        document.querySelectorAll('#search-results, .search-results-overlay').forEach(el => el.style.display = 'none');

        this.saveSearchHistory(query);
        this.switchTab('search');
        document.getElementById('search-query-display').textContent = query;
        const container = document.getElementById('full-search-results');
        container.innerHTML = '<div class="search-loading">Đang tìm kiếm chuyên sâu...</div>';

        try {
            const res = await fetch(`/api/social/search?q=${encodeURIComponent(query)}`, {
                headers: { 'x-auth-token': localStorage.getItem('wander_token') }
            });
            const data = await res.json();
            if (data.success) {
                this.renderFullSearchResults(data.data);
            }
        } catch (e) {
            container.innerHTML = '<div class="search-error">Lỗi kết nối</div>';
        }
    },

    renderFullSearchResults: function (results) {
        this.currentFullSearchResults = results || [];
        this.filterSearchResults('all');
    },

    filterSearchResults: function (filterType) {
        const container = document.getElementById('full-search-results');
        if (!container) return;

        // Cập nhật giao diện các nút tab
        document.querySelectorAll('.s-filter-btn').forEach(btn => {
            if (btn.dataset.filter === filterType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const results = this.currentFullSearchResults || [];

        if (results.length === 0) {
            container.innerHTML = '<div class="search-no-results">Không tìm thấy kết quả nào</div>';
            return;
        }

        const sections = [
            { type: 'destination', title: 'Điểm đến du lịch', icon: 'fa-map-marked-alt' },
            { type: 'user', title: 'Mọi người', icon: 'fa-user-friends' },
            { type: 'post', title: 'Bài viết & Địa điểm check-in', icon: 'fa-images' },
            { type: 'community', title: 'Hội nhóm & Cộng đồng', icon: 'fa-users' }
        ];

        let html = '';
        sections.forEach(sec => {
            if (filterType !== 'all' && sec.type !== filterType) return; // Skip if filtered

            const items = results.filter(r => r.type === sec.type);
            if (items.length > 0) {
                html += `
                    <div class="full-search-section">
                        <h3 class="section-title"><i class="fas ${sec.icon}"></i> ${sec.title}</h3>
                        <div class="results-grid ${sec.type === 'post' ? 'posts-col' : ''}">
                            ${items.map(item => `
                                <div class="full-result-card" onclick="SocialHub.handleSearchResultClick('${item.type}', '${item.id}')">
                                    <div class="res-avatar-wrap">
                                        <img src="${item.avatar || 'assets/default-avatar.svg'}" alt="" onerror="this.src='assets/default-avatar.svg'">
                                        ${item.type === 'user' ? '<div class="online-indicator"></div>' : ''}
                                    </div>
                                    <div class="res-content">
                                        <h4>${item.title}</h4>
                                        <p>${item.subtitle}</p>
                                        ${item.type === 'destination' ? '<button class="btn-visit">Xem điểm đến</button>' : ''}
                                        ${item.type === 'community' ? '<button class="btn-join">Tham gia</button>' : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        });

        if (!html) {
            html = '<div class="search-no-results">Không tìm thấy kết quả nào trong mục này</div>';
        }
        container.innerHTML = html;
    }
};

window.SocialHub = SocialHub;
document.addEventListener('DOMContentLoaded', () => SocialHub.init());
