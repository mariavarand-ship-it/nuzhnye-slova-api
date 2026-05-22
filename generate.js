export default async function handler(req, res) {
  // CORS: разрешаем запросы с GitHub Pages и вообще из браузера
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Браузер может сначала отправить OPTIONS-запрос — это нормально
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      details: "Use POST request",
    });
  }

  try {
    const apiKey = process.env.YANDEX_CLOUD_API_KEY;
    const folderId = process.env.YANDEX_CLOUD_FOLDER;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_API_KEY",
        details: "Add YANDEX_CLOUD_API_KEY in Vercel Environment Variables",
      });
    }

    if (!folderId) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_FOLDER",
        details: "Add YANDEX_CLOUD_FOLDER in Vercel Environment Variables",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const type = body?.type;

    const prompts = {
      mood: "Сгенерируй маленькое смешное донесение из внутреннего мира человека: что сейчас с настроением.",
      wisdom: "Сгенерируй мягкую мысль дня без нравоучения.",
      praise: "Сгенерируй тёплую похвалу человеку без мотивационного плаката.",
    };

    if (!type || !prompts[type]) {
      return res.status(400).json({
        error: "Invalid type",
        details: "Use one of: mood, wisdom, praise",
      });
    }

    const instructions = `
Ты пишешь для проекта «Нужные слова».

Это маленький авторский оракул поддержки.
Это не чат-бот и не психологическая консультация.

Стиль:
- русский язык
- абсурдно-нежный
- тёплый
- немного смешной
- живой, не корпоративный
- без токсичного позитива
- без эзотерики
- без диагнозов
- без советов обратиться к специалисту
- без обещаний, что всё точно будет хорошо
- без банальностей вроде «ты всё сможешь», «верь в себя», «будь лучшей версией себя»
- 1–2 предложения
- до 260 символов
- только одна готовая фраза
- без вариантов
- без пояснений
- без кавычек

Можно использовать мягкий абсурд:
внутренний ёжик, лампа, булочка, диспетчер, облако, самовар, маленькая радость.
`.trim();

    const yandexResponse = await fetch("https://ai.api.cloud.yandex.net/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "x-folder-id": folderId,
      },
      body: JSON.stringify({
        model: `gpt://${folderId}/deepseek-v32/latest`,
        temperature: 0.7,
        max_output_tokens: 500,
        instructions,
        input: prompts[type],
      }),
    });

    const data = await yandexResponse.json().catch(() => null);

    if (!yandexResponse.ok) {
      return res.status(yandexResponse.status).json({
        error: "Yandex AI request failed",
        status: yandexResponse.status,
        details: data,
      });
    }

    const message =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      data?.output?.[0]?.content?.find?.((item) => item.type === "output_text")?.text;

    if (!message) {
      return res.status(500).json({
        error: "Empty Yandex AI response",
        status: 500,
        details: data,
      });
    }

    return res.status(200).json({
      message: message.trim(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      status: 500,
      details: err.message,
    });
  }
}
