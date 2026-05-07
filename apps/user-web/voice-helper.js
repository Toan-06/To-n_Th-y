"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * VoiceGuide: Trợ lý giọng nói thông minh WanderViệt
 * Hỗ trợ: STT (Nhận diện), TTS (Nói), và Vòng lặp hội thoại rảnh tay.
 */
var VoiceGuide = /*#__PURE__*/function () {
  function VoiceGuide() {
    _classCallCheck(this, VoiceGuide);
    this.recognition = null;
    this.synth = window.speechSynthesis;
    this.isListening = false;
    this.companionMode = false;
    this.currentStatus = 'idle';
    this.overlay = document.getElementById('voice-overlay');
    this.caption = document.getElementById('live-caption');
    this._fab = null;
    this.onResultCallback = null;
    this.onStatusChange = null;
    this.lastSpoken = "";
    this.lastSpokenTime = 0;
    this.globalSpeakCooldown = 0; // Thời gian giữa các câu nói bất kỳ
    this.init();
  }
  return _createClass(VoiceGuide, [{
    key: "fab",
    get: function get() {
      if (!this._fab) this._fab = document.getElementById('companion-toggle');
      return this._fab;
    }
  }, {
    key: "init",
    value: function init() {
      var _this = this;
      var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error("Trình duyệt không hỗ trợ Web Speech API.");
        if (window.SharedUI && window.SharedUI.showToast) {
            window.SharedUI.showToast("Trình duyệt của bạn không hỗ trợ tính năng nhận diện giọng nói.", "error");
        }
        return;
      }
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'vi-VN';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 5;
      this.recognition.onstart = function () {
        _this.isListening = true;
        _this.setStatus('listening');
        _this.playChime(440, 0.1); // Tiếng bíp nhẹ khi mở mic
      };
      this.recognition.onresult = function (event) {
        var interimTranscript = '';
        var finalTranscript = '';
        for (var i = event.resultIndex; i < event.results.length; ++i) {
          var result = event.results[i];
          if (result.isFinal) {
            // Lấy kết quả tốt nhất
            var best = result[0].transcript;
            
            // Nếu kết quả đầu có vẻ bị lọc (chứa dấu *) hoặc quá ngắn, kiểm tra các phương án thay thế
            if (result.length > 1 && (best.includes('*') || best.length < 2)) {
                for (var j = 1; j < result.length; j++) {
                    if (!result[j].transcript.includes('*')) {
                        best = result[j].transcript;
                        break;
                    }
                }
            }
            finalTranscript += best;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        _this.caption.innerText = finalTranscript || interimTranscript || "Đang nghe...";
        
        if (finalTranscript) {
           var textToSend = _this.cleanupTranscript(finalTranscript);
           if (!textToSend) return; 

           _this.setStatus('thinking');
           
           clearTimeout(_this.sendTimeout);
           _this.sendTimeout = setTimeout(function() {
              if (typeof _this.onResultCallback === 'function') {
                _this.onResultCallback(textToSend);
              } else if (window.WanderChat && window.WanderChat.sendMessage) {
                window.WanderChat.sendMessage(textToSend);
              } else if (window.ChatBrain) {
                window.ChatBrain.sendMessage(textToSend);
              }
           }, 500);
        }
      };
      this.recognition.onerror = function (event) {
        console.error("Lỗi Mic:", event.error);
        _this.isListening = false;
        if (_this.companionMode && event.error !== 'not-allowed') {
          setTimeout(function () {
            return _this.start();
          }, 1000);
        } else {
          _this.setStatus('error', event.error);
        }
      };
      this.recognition.onend = function () {
        _this.isListening = false;
        // Nếu không phải đang nghĩ hay đang nói, thì về idle
        if (_this.currentStatus === 'listening') {
          _this.setStatus('idle');
        }

        // Tự động bật lại nếu đang ở chế độ đồng hành và AI không nói
        if (_this.companionMode && !_this.synth.speaking && _this.currentStatus === 'idle') {
          setTimeout(function () {
            return _this.start();
          }, 500);
        }
      };
    }
  }, {
    key: "setStatus",
    value: function setStatus(status) {
      var error = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      this.currentStatus = status;
      console.log("State:", status);

      // Re-find elements if they were missing (lazy init)
      if (!this.overlay) this.overlay = document.getElementById('voice-overlay');
      if (!this.caption) this.caption = document.getElementById('live-caption');

      // Cập nhật UI
      if (this.overlay) {
        if (status === 'idle') {
          this.overlay.classList.remove('is-active', 'is-listening', 'is-thinking', 'is-visible');
        } else {
          this.overlay.classList.add('is-visible');
          this.overlay.classList.remove('is-listening', 'is-thinking');
          if (status === 'listening') {
            this.overlay.classList.add('is-listening');
          } else if (status === 'thinking') {
            this.overlay.classList.add('is-thinking');
          }
        }
      }

      if (this.fab) {
          if (status === 'listening') this.fab.classList.add('is-listening');
          else if (status === 'idle') this.fab.classList.remove('is-listening');
      }

      // Gọi callback bên ngoài nếu có (đồng bộ UI cho Navigator)
      if (typeof this.onStatusChange === 'function') {
        this.onStatusChange(status, error);
      }
    }
  }, {
    key: "start",
    value: function start() {
      // Nếu đang nói (TTS), đừng bật Mic (tránh vọng)
      if (this.synth.speaking) return;
      
      if (!this.isListening) {
        try {
          // Tự động đồng bộ ngôn ngữ nhận diện (STT) theo cài đặt của người dùng
          var userLang = localStorage.getItem('wander_chat_lang');
          var map = { 'vi': 'vi-VN', 'en': 'en-US', 'jp': 'ja-JP', 'kr': 'ko-KR', 'fr': 'fr-FR' };
          this.recognition.lang = (userLang && map[userLang]) ? map[userLang] : 'vi-VN';
          
          this.recognition.start();
          console.log("🎙️ VoiceGuide: Mic started.");
        } catch (e) {
          // Thường do mic đã chạy ngầm hoặc đang đóng, ignore lỗi InvalidState
          if (e.name !== 'InvalidStateError') {
            console.warn("Nỗ lực khởi động Mic thất bại:", e);
          }
        }
      }
    }
  }, {
    key: "stop",
    value: function stop() {
      if (this.recognition && this.isListening) {
        try {
          this.recognition.stop();
          console.log("🎙️ VoiceGuide: Mic stopped.");
        } catch (e) {}
      }
      this.isListening = false;
      this.setStatus('idle');
    }
  }, {
    key: "cancel",
    value: function cancel() {
      if (this.synth) this.synth.cancel();
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch (e) {}
      }
      this.isListening = false;
      this.companionMode = false;
      this.setStatus('idle');
      console.log("🔊 VoiceGuide: Cancelled all speech and recognition.");
    }
  }, {
    key: "forceInterrupt",
    value: function forceInterrupt() {
      // 1. Dừng AI nói ngay lập tức
      if (this.synth && this.synth.speaking) {
        this.synth.cancel();
      }
      // 2. Dừng mic cũ (nếu có) để reset
      if (this.isListening) {
        try { this.recognition.abort(); } catch(e) {}
      }
      // 3. Bắt đầu nghe mới
      setTimeout(() => this.start(), 100);
    }
  }, {
    key: "cancelAll",
    value: function cancelAll() {
      if (this.synth) this.synth.cancel();
      if (this.recognition) {
        try { this.recognition.abort(); } catch(e) {}
      }
      this.isListening = false;
      this.companionMode = false;
      this.setStatus('idle');
    }
  }, {
    key: "setCompanionMode",
    value: function setCompanionMode(active) {
      this.companionMode = active;
      if (active) {
        this.start();
      } else {
        this.stop();
      }
    }
  }, {
    key: "cleanupTranscript",
    value: function cleanupTranscript(text) {
      if (!text) return '';
      
      // Correction map for common Vietnamese misrecognitions
      var corrections = {
        'đ***': 'đần', // Handle profanity filter for harmless words
        'dần': 'đần',  // Phonetic similarity
        'đèn': 'đần',
        'tìm đường': 'Chỉ đường',
        'về nhà': 'Về trang chủ'
      };

      var cleaned = text.trim();
      
      // Apply corrections
      Object.keys(corrections).forEach(function(key) {
        // Use a simpler regex without \b because asterisks often break word boundaries in many engines
        var escapedKey = key.replace(/\*/g, '\\*');
        var regex = new RegExp(escapedKey, 'gi');
        cleaned = cleaned.replace(regex, corrections[key]);
      });

      // Remove trailing punctuation
      cleaned = cleaned.replace(/[.?!,]+$/, "");
      
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      return cleaned;
    }
  }, {
    key: "detectLanguage",
    value: function detectLanguage(text) {
      var userLang = localStorage.getItem('wander_chat_lang');
      if (userLang && userLang !== 'auto') {
        var map = { 'vi': 'vi-VN', 'en': 'en-US', 'jp': 'ja-JP', 'kr': 'ko-KR', 'fr': 'fr-FR' };
        if (map[userLang]) return map[userLang];
      }
      
      if (/[\u3131-\uD79D]/.test(text)) return 'ko-KR';
      if (/[\u3040-\u30ff]/.test(text)) return 'ja-JP';
      
      var viRegex = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
      if (viRegex.test(text)) return 'vi-VN';
      
      return 'en-US';
    }
  }, {
    key: "getBestVoice",
    value: function getBestVoice(langCode) {
      var voices = this.synth.getVoices();
      var targetLang = langCode || 'vi-VN';
      var prefix = targetLang.split('-')[0];
      
      var filteredVoices = voices.filter(function (v) {
        return v.lang.includes(prefix) || v.lang.includes(prefix.toUpperCase());
      });
      if (filteredVoices.length === 0) return null;

      var premiumVoice = filteredVoices.find(function (v) {
        return v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft');
      });
      return premiumVoice || filteredVoices[0];
    }
  }, {
    key: "speak",
    value: function speak(text) {
      var _this2 = this;
      if (!text) return;
      
      var now = Date.now();
      
      // 1. Chặn lặp lại câu cũ trong vòng 15 giây (tăng lên để tránh lặp lại phiền phức)
      if (text === this.lastSpoken && (now - this.lastSpokenTime < 15000)) {
        console.warn("🔊 VoiceGuide: Chặn lặp lại câu:", text);
        return;
      }

      // 2. Chặn nói quá nhanh (khoảng cách giữa các câu bất kỳ tối thiểu 3 giây để tạo cảm giác hài hòa)
      if (now - this.globalSpeakCooldown < 3000) {
        console.warn("🔊 VoiceGuide: Chặn nói quá nhanh để giữ sự hài hòa.");
        return;
      }

      this.lastSpoken = text;
      this.lastSpokenTime = now;
      this.globalSpeakCooldown = now;

      if (this.synth.speaking) this.synth.cancel(); // Ngắt câu cũ để ưu tiên câu mới
      this.stop(); // Tắt mic khi nói để tránh Echo
      this.setStatus('speaking');
      var utterance = new SpeechSynthesisUtterance(text);
      
      var langCode = this.detectLanguage(text);
      utterance.lang = langCode;

      // Chọn giọng đọc tốt nhất theo ngôn ngữ
      var bestVoice = this.getBestVoice(langCode);
      if (bestVoice) {
        utterance.voice = bestVoice;
        console.log("Using Voice:", bestVoice.name, "Lang:", langCode);
      } else {
        console.warn("No suitable voice found for", langCode, "falling back to default.");
      }
      utterance.rate = 1.1;
      utterance.onend = function () {
        _this2.setStatus('idle');
        if (_this2.companionMode) {
          setTimeout(function () {
            return _this2.start();
          }, 600); // Nghe lại sau khi nói xong
        }
      };
      this.synth.speak(utterance);
    }

    // Tạo âm thanh bíp nhẹ bằng code (không cần file mp3)
  }, {
    key: "playChime",
    value: function playChime(freq, duration) {
      try {
        var context = new (window.AudioContext || window.webkitAudioContext)();
        var osc = context.createOscillator();
        var gain = context.createGain();
        osc.connect(gain);
        gain.connect(context.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
        osc.start(context.currentTime);
        osc.stop(context.currentTime + duration);
      } catch (e) {}
    }
  }]);
}(); // Khởi tạo toàn cục
window.voiceGuide = new VoiceGuide();
