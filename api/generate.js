export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      details: "Use POST request",
      version: "yandex-short-no-hedgehog-v3",
    });
  }

  try {
    const apiKey = process.env.YANDEX_CLOUD_API_KEY;
    const folderId = process.env.YANDEX_CLOUD_FOLDER;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_API_KEY",
        details: "Add YANDEX_CLOUD_API_KEY in Vercel Environment Variables",
        version: "yandex-short-no-hedgehog-v3",
      });
    }

    if (!folderId) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_FOLDER",
        details: "Add YANDEX_CLOUD_FOLDER in Vercel Environment Variables",
        version: "yandex-short-no-hedgehog-v3",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const type = body?.type;

    const prompts = {
      mood:
        "Кнопка «что с настроением». Напиши одну короткую смешную фразу про состояние/настроение. Не хвали. Не советуй. Без слов: внутренний, ёжик, ежик, диспетчер.",

      wisdom:
        "Кнопка «мудрость». Напиши одну короткую мягкую мысль дня. Не хвали. Не описывай настроение. Без нравоучения. Без слов: внутренний, ёжик, ежик, диспетчер.",

      praise:
        "Кнопка «похвали меня». Напиши одну короткую прямую похвалу человеку. Начни с «ты» или «в тебе». Не советуй. Без слов: внутренний, ёжик, ежик, диспетчер.",
    };

    if (!type || !prompts[type]) {
      return res.status(400).json({
        error: "Invalid type",
        details: "Use one of: mood, wisdom, praise",
        version: "yandex-short-no-hedgehog-v3",
      });
    }

    const instructions = `
Пиши для проекта «Нужные слова».

Требования:
- русский язык
- только одна готовая фраза
- 1 предложение
- до 110 символов
- без кавычек
- без пояснений
- тёпло, живо, немного смешно
- не корпоративно
- без токсичного позитива
- без эзотерики
- без диагнозов
- без «ты всё сможешь», «верь в себя», «будь лучшей версией себя»

Запрещённые слова:
внутренний, ёжик, ежик, диспетчер.

Различай типы:
mood — смешное наблюдение о настроении.
wisdom — тихая мысль дня.
praise — прямая похвала человеку.

Для mood можно: лампа, булочка, облако, самовар, носок, чайник, карман, плед.
Для wisdom — меньше абсурда, больше ясности.
Для praise — без абсурда, тепло и прямо.
`.trim();

    const yandexResponse = await fetch("https://ai.api.cloud.yandex.net/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-folder-id": folderId,
      },
      body: JSON.stringify({
        model: `gpt://${folderId}/deepseek-v32/latest`,
        temperature: 0.55,
        max_output_tokens: 600,
        instructions,
        input: prompts[type],
      }),
    });

    const rawText = await yandexResponse.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      return res.status(500).json({
        error: "Yandex AI returned non-JSON response",
        status: 500,
        details: rawText,
        version: "yandex-short-no-hedgehog-v3",
      });
    }

    if (!yandexResponse.ok) {
      return res.status(yandexResponse.status).json({
        error: "Yandex AI request failed",
        status: yandexResponse.status,
        details: data,
        version: "yandex-short-no-hedgehog-v3",
      });
    }

    let message = extractMessage(data);

    if (!message) {
      return res.status(500).json({
        error: "Empty Yandex AI response",
        status: 500,
        details: data,
        version: "yandex-short-no-hedgehog-v3",
      });
    }

    message = cleanMessage(message);

    return res.status(200).json({
      message,
      version: "yandex-short-no-hedgehog-v3",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      status: 500,
      details: err.message,
      version: "yandex-short-no-hedgehog-v3",
    });
  }
}

function extractMessage(data) {
  if (data?.output_text) {
    return data.output_text;
  }

  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (Array.isArray(item?.content)) {
        for (const contentItem of item.content) {
          if (contentItem?.text) {
            return contentItem.text;
          }
        }
      }
    }
  }

  return "";
}

function cleanMessage(message) {
  let cleaned = String(message || "").trim();

  cleaned = cleaned.replace(/^["«“”]+/, "");
  cleaned = cleaned.replace(/["»“”]+$/, "");
  cleaned = cleaned.replace(/\s+/g, " ");

  cleaned = cleaned.replace(/внутренний диспетчер/gi, "маленький самовар");
  cleaned = cleaned.replace(/внутренний ёжик/gi, "маленький самовар");
  cleaned = cleaned.replace(/внутренний ежик/gi, "маленький самовар");
  cleaned = cleaned.replace(/диспетчер/gi, "самовар");
  cleaned = cleaned.replace(/ёжик/gi, "самовар");
  cleaned = cleaned.replace(/ежик/gi, "самовар");
  cleaned = cleaned.replace(/внутренний/gi, "маленький");

  const sentences = cleaned.match(/[^.!?]+[.!?]?/g);
  if (sentences && sentences.length > 0) {
    cleaned = sentences[0].trim();
  }

  if (cleaned.length > 130) {
    cleaned = cleaned.slice(0, 127).trim();

    const lastSpaceIndex = cleaned.lastIndexOf(" ");
    if (lastSpaceIndex > 70) {
      cleaned = cleaned.slice(0, lastSpaceIndex).trim();
    }

    cleaned = `${cleaned}...`;
  }

  return cleaned;
}
