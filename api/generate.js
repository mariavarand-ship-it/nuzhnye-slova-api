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
      version: "yandex-distinct-buttons-v6",
    });
  }

  try {
    const apiKey = process.env.YANDEX_CLOUD_API_KEY;
    const folderId = process.env.YANDEX_CLOUD_FOLDER;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_API_KEY",
        details: "Add YANDEX_CLOUD_API_KEY in Vercel Environment Variables",
        version: "yandex-distinct-buttons-v6",
      });
    }

    if (!folderId) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_FOLDER",
        details: "Add YANDEX_CLOUD_FOLDER in Vercel Environment Variables",
        version: "yandex-distinct-buttons-v6",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const type = body?.type;

    const prompts = {
      mood: `
Кнопка: «Поднять настроение».

Жанр: маленькая приятная глупость.
Нужно: смешная, тёплая, немного абсурдная фраза, чтобы человеку стало легче.
Не нужно: совет, мудрость, похвала, анализ состояния.

Пиши как милый нелепый оракул.
Можно: булочка, облако, самовар, носок, чайник, лампа, плед, карман, смешной свет.
Фраза должна быть весёлой или нежно-дурацкой.
`.trim(),

      wisdom: `
Кнопка: «Совет дня».

Жанр: мягкий практический совет.
Нужно: предложить человеку маленькое действие или другой взгляд на ситуацию.
Не нужно: похвала, абсурд ради абсурда, просто описание настроения.

Фраза должна звучать как спокойный умный совет без давления.
Можно начинать с: «попробуй», «сегодня можно», «посмотри», «оставь», «не решай».
`.trim(),

      praise: `
Кнопка: «Похвалить».

Жанр: тёплая нежная похвала.
Нужно: признать в человеке что-то хорошее, живое, настоящее.
Добавь немного мудрости и очень лёгкий абсурд, но не превращай в шутку.
Не нужно: совет, описание настроения, мотивационный плакат.

Фраза должна начинаться с «ты» или «в тебе».
Пусть звучит как бережное признание ценности.
`.trim(),
    };

    if (!type || !prompts[type]) {
      return res.status(400).json({
        error: "Invalid type",
        details: "Use one of: mood, wisdom, praise",
        version: "yandex-distinct-buttons-v6",
      });
    }

    const instructions = `
Ты пишешь для проекта «Нужные слова».

Это не чат-бот и не психологическая консультация.
Это маленький авторский оракул поддержки.

Формат:
- русский язык
- одна готовая фраза
- 1 предложение
- до 130 символов
- без кавычек
- без пояснений
- без вариантов

Общий стиль:
- живо
- тепло
- нежно
- не корпоративно
- без токсичного позитива
- без эзотерики
- без диагнозов
- без «ты всё сможешь»
- без «верь в себя»
- без «будь лучшей версией себя»

Жёстко запрещённые слова:
внутренний, ёжик, ежик, диспетчер.

Кнопки должны сильно отличаться:

1. mood / «Поднять настроение»
Это НЕ совет и НЕ похвала.
Это приятная глупость, маленький абсурд, смешной образ.
Должно быть легче, теплее, чуть веселее.
Пример направления: «облако принесло булочку и делает вид, что так и надо».

2. wisdom / «Совет дня»
Это именно совет.
Дай маленькое действие или новый взгляд.
Без клоунады.
Без похвалы.
Пример направления: «сегодня можно не решать всё, а выбрать один тихий следующий шаг».

3. praise / «Похвалить»
Это именно похвала человеку.
Тёплая, нежная, мудрая.
Можно чуть-чуть абсурда, но смысл должен быть в признании ценности.
Начинай с «ты» или «в тебе».
Пример направления: «ты умеешь оставаться живой даже там, где день просит стать камнем».

Не смешивай жанры.
Если type = mood — не советуй.
Если type = wisdom — дай совет.
Если type = praise — хвали человека.
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
        temperature: type === "mood" ? 0.85 : type === "praise" ? 0.75 : 0.55,
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
        version: "yandex-distinct-buttons-v6",
      });
    }

    if (!yandexResponse.ok) {
      return res.status(yandexResponse.status).json({
        error: "Yandex AI request failed",
        status: yandexResponse.status,
        details: data,
        version: "yandex-distinct-buttons-v6",
      });
    }

    let message = extractMessage(data);

    if (!message) {
      return res.status(500).json({
        error: "Empty Yandex AI response",
        status: 500,
        details: data,
        version: "yandex-distinct-buttons-v6",
      });
    }

    message = cleanMessage(message, type);

    return res.status(200).json({
      message,
      version: "yandex-distinct-buttons-v6",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      status: 500,
      details: err.message,
      version: "yandex-distinct-buttons-v6",
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

function cleanMessage(message, type) {
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

  cleaned = cleaned.replace(/тусклая лампа/gi, "лампа, которая всё-таки греет");
  cleaned = cleaned.replace(/плохим контактом/gi, "с нежным мерцанием");

  if (type === "mood") {
    cleaned = cleaned.replace(/^моё настроение/gi, "настроение");
    cleaned = cleaned.replace(/^твоё настроение/gi, "настроение");
  }

  if (type === "praise") {
    cleaned = cleaned.replace(/^ты молодец[.!]?/i, "ты умеешь оставаться живой и настоящей");
    cleaned = cleaned.replace(/^ты умница[.!]?/i, "ты бережно несёшь в себе много настоящего");

    if (!/^ты\b/i.test(cleaned) && !/^в тебе\b/i.test(cleaned)) {
      cleaned = `ты ${cleaned.charAt(0).toLocaleLowerCase("ru-RU") + cleaned.slice(1)}`;
    }
  }

  if (type === "wisdom") {
    const startsLikeAdvice =
      /^(попробуй|сегодня можно|можно|посмотри|оставь|не решай|выбери|дай|сделай|позволь)/i.test(cleaned);

    if (!startsLikeAdvice) {
      cleaned = `сегодня можно ${cleaned.charAt(0).toLocaleLowerCase("ru-RU") + cleaned.slice(1)}`;
    }
  }

  const sentences = cleaned.match(/[^.!?]+[.!?]?/g);
  if (sentences && sentences.length > 0) {
    cleaned = sentences[0].trim();
  }

  if (cleaned.length > 145) {
    cleaned = cleaned.slice(0, 142).trim();

    const lastSpaceIndex = cleaned.lastIndexOf(" ");
    if (lastSpaceIndex > 70) {
      cleaned = cleaned.slice(0, lastSpaceIndex).trim();
    }

    cleaned = `${cleaned}...`;
  }

  return cleaned;
}
