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
      this.recognition.onstart = function () {
        _this.isListening = true;
        _this.setStatus('listening');
        _this.playChime(440, 0.1); // Tiếng bíp nhẹ khi mở mic
      };
      this.recognition.onresult = function (event) {
        var interimTranscript = '';
        var finalTranscript = '';
        for (var i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        _this.caption.innerText = finalTranscript || interimTranscript || "Đang nghe...";
        if (finalTranscript) {
          _this.setStatus('thinking');

          // 1. Ưu tiên callback bên ngoài (như trong navigator.js)
          if (typeof _this.onResultCallback === 'function') {
            _this.onResultCallback(finalTranscript);
          }
          // 2. Nếu không có callback, dùng logic mặc định của Companion
          else if (window.ChatBrain) {
            window.ChatBrain.sendMessage(finalTranscript);
          }
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

      // Cập nhật UI
      if (status === 'idle') {
        this.overlay.classList.remove('is-active', 'is-listening', 'is-thinking', 'is-visible');
        this.fab.classList.remove('is-listening');
      } else {
        this.overlay.classList.add('is-visible');
        this.overlay.classList.remove('is-listening', 'is-thinking');
        this.fab.classList.remove('is-listening');
        if (status === 'listening') {
          this.overlay.classList.add('is-listening');
          this.fab.classList.add('is-listening');
        } else if (status === 'thinking') {
          this.overlay.classList.add('is-thinking');
        }
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
    key: "getBestVoice",
    value: function getBestVoice() {
      var voices = this.synth.getVoices();
      // Ưu tiên các giọng đọc chất lượng cao (Natural, Google, Microsoft)
      var viVoices = voices.filter(function (v) {
        return v.lang.includes('vi');
      });
      if (viVoices.length === 0) return null;

      // Tìm giọng "Natural" hoặc "Google" hoặc "Microsoft"
      var premiumVoice = viVoices.find(function (v) {
        return v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft');
      });
      return premiumVoice || viVoices[0];
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
      utterance.lang = 'vi-VN';

      // Chọn giọng đọc tốt nhất
      var bestVoice = this.getBestVoice();
      if (bestVoice) {
        utterance.voice = bestVoice;
        console.log("Using Voice:", bestVoice.name);
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
