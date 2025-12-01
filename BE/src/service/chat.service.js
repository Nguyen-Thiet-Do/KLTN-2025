const dialogflow = require("@google-cloud/dialogflow");
const path = require("path");
const axios = require("axios");

const keyPath = path.join(__dirname, "../config/dialogflowKey.json");
const sessionClient = new dialogflow.SessionsClient({
  keyFilename: keyPath,
});
const projectId = require(keyPath).project_id;

// ==== CACHE THỂ LOẠI ====
let genreCache = null;
let genreCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

// ======================================================
//      LẤY DANH SÁCH THỂ LOẠI TỪ API
// ======================================================
async function getAllGenres() {
  const now = Date.now();

  if (genreCache && now - genreCacheTime < CACHE_TTL) {
    return genreCache;
  }

  try {
    const url = `${process.env.API_INTERNAL_URL}/documents/genres`;
    console.log('📡 Calling genres API:', url);
    
    const res = await axios.get(url);
    console.log('📦 Response:', res.data);

    const data = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data.data)
      ? res.data.data
      : [];

    genreCache = data;
    genreCacheTime = now;

    console.log(`✅ Loaded ${genreCache.length} genres from API`);
    return genreCache;
  } catch (err) {
    console.error("❌ Error fetching genres:", err.message);
    console.error("❌ Error details:", err.response?.data || err);
    return genreCache || [];
  }
}

// === Chuẩn hoá tiếng Việt ===
function normalizeVietnamese(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .trim();
}

// ======================================================
//      CHUYỂN TÊN THỂ LOẠI → ID
// ======================================================
async function genreNameToId(genreName) {
  if (!genreName) return null;

  const genres = await getAllGenres();
  if (!genres.length) return null;

  const normalized = normalizeVietnamese(genreName);

  // Exact match
  let found = genres.find((g) => {
    return normalizeVietnamese(g.name) === normalized;
  });

  // Partial match
  if (!found) {
    found = genres.find((g) => {
      const gN = normalizeVietnamese(g.name);
      return gN.includes(normalized) || normalized.includes(gN);
    });
  }

  return found ? found.genreId : null;
}

// ======================================================
//     GỌI API SÁCH THEO THỂ LOẠI - CHỈ GIỮ 1 HÀM NÀY
// ======================================================
async function getBooksByGenre(genreName) {
  try {
    const genreId = await genreNameToId(genreName);

    if (!genreId) {
      console.log('⚠️ Không tìm thấy genreId cho:', genreName);
      return [];
    }

    // ✅ ĐÚNG - Không có /api vì đã có trong .env
    const url = `${process.env.API_INTERNAL_URL}/documents/reader/by-genre`;
    console.log('📡 Calling books API:', url, 'with genreId:', genreId);

    const res = await axios.get(url, {
      params: {
        limit: 6,
        match: "any",
        genreIds: genreId,
      },
    });

    console.log('📚 Found', res.data.items?.length || 0, 'books');
    return res.data.items || [];
  } catch (err) {
    console.error("❌ Error fetching books:", err.message);
    console.error("❌ Error details:", err.response?.data || err);
    return [];
  }
}

// ======================================================
//             XỬ LÝ CHAT DIALOGFLOW
// ======================================================
async function sendToDialogflow(text, sessionId) {
  try {
    const sessionPath = sessionClient.projectAgentSessionPath(
      projectId,
      sessionId
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: { text, languageCode: "vi" },
      },
    };

    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    const intent = result.intent?.displayName || "";
    const parameters = result.parameters?.fields || {};
    const replyText = result.fulfillmentText || "Xin lỗi, tôi không hiểu.";

    console.log('🎯 Intent detected:', intent);
    console.log('📋 Parameters:', JSON.stringify(parameters, null, 2));

    // Xử lý intent tìm sách theo thể loại
    if (intent === "SearchBookByGenre") {
      let genreName = null;

      if (parameters.genre) {
        if (parameters.genre.stringValue) {
          genreName = parameters.genre.stringValue;
        } else if (parameters.genre.listValue?.values?.length > 0) {
          const values = parameters.genre.listValue.values;
          genreName = values[values.length - 1].stringValue;
        }
      }

      console.log('🏷️ Genre name extracted:', genreName);

      if (!genreName) {
        const allGenres = await getAllGenres();
        const popular = allGenres.slice(0, 8);
        const list = popular.map((g) => `• ${g.name}`).join("\n");

        return {
          reply: `Bạn muốn tìm sách thể loại nào?\n\n📚 Gợi ý:\n${list}`,
        };
      }

      const books = await getBooksByGenre(genreName);

      if (!books.length) {
        const allGenres = await getAllGenres();
        const list = allGenres.slice(0, 8).map((g) => `• ${g.name}`).join("\n");

        return {
          reply: `Hiện chưa có sách thuộc thể loại "${genreName}".\n\n📚 Các thể loại có sẵn:\n${list}`,
        };
      }

      return {
        reply: `Dưới đây là một số sách thuộc thể loại "${genreName}":`,
        books,
      };
    }

    return { reply: replyText };
  } catch (error) {
    console.error("❌ Dialogflow error:", error);
    return {
      reply: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
    };
  }
}

module.exports = { sendToDialogflow };