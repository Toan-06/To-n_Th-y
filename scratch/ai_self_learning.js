require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Groq = require('groq-sdk');

// Kết nối DB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wanderviet')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Script này quét các hội thoại gần đây của người dùng và dùng LLM
 * để trích xuất sở thích (ví dụ: thích biển, ăn chay, đi xe máy)
 * và lưu vào User.preferenceProfile.aiInsights.
 */
async function runSelfLearning() {
  console.log("🔄 Bắt đầu chạy tiến trình AI Self-Learning (Memory Extraction)...");

  try {
    // 1. Tìm những user có tương tác trong 24h qua (Ví dụ lấy 10 user)
    // Để test, lấy tất cả user có role 'user'
    const users = await User.find({ role: 'user' }).limit(10);

    for (let user of users) {
      console.log(`\nPhân tích User: ${user.name} (${user._id})`);

      // 2. Lấy 30 tin nhắn gần nhất của user này
      const recentChats = await Conversation.find({ userId: user._id.toString(), role: 'user' })
        .sort({ timestamp: -1 })
        .limit(30);

      if (recentChats.length < 3) {
        console.log("   -> Chưa đủ dữ liệu chat (Cần ít nhất 3 tin nhắn), bỏ qua.");
        continue;
      }

      const chatTexts = recentChats.map(c => c.text).join('\n- ');

      // 3. Dùng LLM để phân tích
      const prompt = `
Bạn là một AI phân tích hành vi người dùng. 
Dưới đây là các câu hỏi/tin nhắn gần đây của một người dùng trên ứng dụng du lịch WanderViệt:
- ${chatTexts}

NHIỆM VỤ:
Trích xuất tối đa 3 sở thích du lịch, phong cách hoặc thói quen nổi bật của người này. 
Chỉ trả về các gạch đầu dòng ngắn gọn (dưới 10 chữ mỗi dòng), không giải thích thêm.
Ví dụ:
- Thích du lịch biển
- Quan tâm đến giá cả (Tiết kiệm)
- Hay đi cùng gia đình
      `;

      const completion = await groq.chat.completions.create({
        messages: [{ role: "system", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.2,
        max_tokens: 100
      });

      const responseText = completion.choices[0]?.message?.content || "";
      const insights = responseText.split('\n')
        .map(i => i.replace(/^- /, '').trim())
        .filter(i => i.length > 0 && i.length < 50);

      if (insights.length > 0) {
        console.log("   🧠 AI Insights tìm thấy:", insights);

        // 4. Cập nhật vào DB
        if (!user.preferenceProfile) {
          user.preferenceProfile = { aiInsights: [], lastAnalyzed: new Date() };
        }

        // Ghi đè (hoặc merge) insights mới
        user.preferenceProfile.aiInsights = insights;
        user.preferenceProfile.lastAnalyzed = new Date();

        await user.save();
        console.log("   ✅ Đã cập nhật vào hồ sơ User!");
      }
    }

    console.log("\n🎉 Hoàn thành tiến trình Self-Learning!");
  } catch (error) {
    console.error("❌ Lỗi:", error);
  } finally {
    process.exit(0);
  }
}

runSelfLearning();
