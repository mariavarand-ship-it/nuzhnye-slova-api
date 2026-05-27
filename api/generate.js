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
      version: "nuzhnye-slova-v7",
    });
  }

  try {
    const apiKey = process.env.YANDEX_CLOUD_API_KEY;
    const folderId = process.env.YANDEX_CLOUD_FOLDER;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_API_KEY",
        details: "Add YANDEX_CLOUD_API_KEY in Vercel Environment Variables",
        version: "nuzhnye-slova-v7",
      });
    }

    if (!folderId) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_FOLDER",
        details: "Add YANDEX_CLOUD_FOLDER in Vercel Environment Variables",
        version: "nuzhnye-slova-v7",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const type = body?.type;

    const rawName = (body?.name || "").toString().trim();
    const name = rawName ? sanitizeName(rawName) : "солнышко";

    const prompts = {
      mood: `
Кнопка: «Поднять настроение».
Имя человека: ${name}.

Напиши одну тёплую фразу с лёгкой чудинкой, чтобы человеку стало легче.
Обязательно обратись к человеку по имени «${name}» внутри фразы — естественно, не обязательно в самом начале.
Это маленькая приятная нелепость, а не совет и не похвала.
Можно придумывать свои тёплые образы (предметы, погода, мелкие домашние чудеса) — фантазируй свободно, не повторяй одно и то же.
Пусть будет нежно, чуть смешно и живо.
`.trim(),

      wisdom: `
Кнопка: «Совет дня».
Имя человека: ${name}.

Напиши один тихий, добрый совет — маленькое действие или мягкий новый взгляд.
Обязательно обратись к человеку по имени «${name}» внутри фразы — естественно, не обязательно в начале.
Без клоунады, без похвалы, без давления. Спокойно и по-человечески.
Лёгкая тёплая образность допустима, но смысл — в совете.
`.trim(),

      praise: `
Кнопка: «Похвалить».
Имя человека: ${name}.

Напиши тёплую нежную похвалу — признай в человеке что-то живое и настоящее.
Обязательно обратись к человеку по имени «${name}» внутри фразы — естественно, не обязательно в начале.
НЕ начинай фразу со слова «ты». Вплети мысль о человеке мягко и по-новому.
Можно добавить лёгкую тёплую образность, но это не шутка, а бережное признание ценности.
`.trim(),
    };

    if (!type || !prompts[type]) {
      return res.status(400).json({
        error: "Invalid type",
        details: "Use one of: mood, wisdom, praise",
        version: "nuzhnye-slova-v7",
      });
    }

    const instructions = `
Ты пишешь для проекта «Нужные слова» — маленького авторского оракула поддержки.
Это не чат-бот и не психологическая консультация.

Стиль: тёплый абсурд в духе Хармса и Хлебникова — но мягкий, среднее количество странности.
Тепло, нежно, живо, по-человечески. Чуть-чуть чудинки, но без перегиба.

Формат ответа:
- русский язык
- одна готовая фраза, одно предложение
- до 130 символов
- внутри фразы обязательно звучит имя человека
- без кавычек, без пояснений, без вариантов, без эмодзи

Категорически избегай:
- токсичного позитива («ты всё сможешь», «верь в себя», «будь лучшей версией себя»)
- корпоративности, канцелярита, эзотерики, диагнозов
- повторов одних и тех же образов от ответа к ответу — каждый раз придумывай свежее

Не смешивай жанры: настроение — это нелепая лёгкость; совет — это совет; похвала — это признание ценности.
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
        temperature: type === "mood" ? 0.9 : type === "praise" ? 0.8 : 0.6,
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
        version: "nuzhnye-slova-v7",
      });
    }

    if (!yandexResponse.ok) {
      return res.status(yandexResponse.status).json({
        error: "Yandex AI request failed",
        status: yandexResponse.status,
        details: data,
        version: "nuzhnye-slova-v7",
      });
    }

    let message = extractMessage(data);

    if (!message) {
      return res.status(500).json({
        error: "Empty Yandex AI response",
        status: 500,
        details: data,
        version: "nuzhnye-slova-v7",
      });
    }

    message = cleanMessage(message, name);

    return res.status(200).json({
      message,
      version: "nuzhnye-slova-v7",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      status: 500,
      details: err.message,
      version: "nuzhnye-slova-v7",
    });
  }
}

function sanitizeName(value) {
  let n = String(value).replace(/[<>{}"'`]/g, "").trim();
  if (n.length > 40) n = n.slice(0, 40).trim();
  return n || "солнышко";
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

function cleanMessage(message, name) {
  let cleaned = String(message || "").trim();

  cleaned = cleaned.replace(/^["«“”]+/, "");
  cleaned = cleaned.replace(/["»“”]+$/, "");
  cleaned = cleaned.replace(/\s+/g, " ");

  cleaned = cleaned.replace(/ёжик/gi, "котёнок");
  cleaned = cleaned.replace(/ежик/gi, "котёнок");
  cleaned = cleaned.replace(/диспетчер/gi, "самовар");

  cleaned = cleaned.replace(/\b(\p{L}+)\s+\1\b/giu, "$1");

  const sentences = cleaned.match(/[^.!?]+[.!?]?/g);
  if (sentences && sentences.length > 0) {
    cleaned = sentences[0].trim();
  }

  if (name && !cleaned.toLowerCase().includes(name.toLowerCase())) {
    cleaned = `${capitalize(name)}, ${lowerFirst(cleaned)}`;
  }

  if (cleaned.length > 150) {
    cleaned = cleaned.slice(0, 147).trim();
    const lastSpace = cleaned.lastIndexOf(" ");
    if (lastSpace > 70) cleaned = cleaned.slice(0, lastSpace).trim();
    cleaned = `${cleaned}...`;
  }

  return cleaned;
}

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase("ru-RU") + text.slice(1);
}

function lowerFirst(text) {
  if (!text) return text;
  return text.charAt(0).toLocaleLowerCase("ru-RU") + text.slice(1);
}
