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
      version: "yandex-short-distinct-no-hedgehog-v2",
    });
  }

  try {
    const apiKey = process.env.YANDEX_CLOUD_API_KEY;
    const folderId = process.env.YANDEX_CLOUD_FOLDER;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_API_KEY",
        details: "Add YANDEX_CLOUD_API_KEY in Vercel Environment Variables",
        version: "yandex-short-distinct-no-hedgehog-v2",
      });
    }

    if (!folderId) {
      return res.status(500).json({
        error: "Missing YANDEX_CLOUD_FOLDER",
        details: "Add YANDEX_CLOUD_FOLDER in Vercel Environment Variables",
        version: "yandex-short-distinct-no-hedgehog-v2",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const type = body?.type;

    const prompts = {
      mood: `
Кнопка: «что с настроением».

Сделай короткую фразу-наблюдение о состоянии человека.
Это НЕ похвала и НЕ совет.

Формат:
смешная сводка о настроении, без слов «внутренний», «ёжик», «диспетчер».

Направление:
настроение помялось, день шуршит, облако сидит боком, лампа моргает, булочка задумалась, носок философствует.
`.trim(),

      wisdom: `
Кнопка: «мудрость».

Сделай короткую мягкую мысль дня.
Это НЕ похвала и НЕ описание настроения.

Формат:
маленькое спокойное наблюдение о жизни, без учительства и без абсурдного персонажа в центре.

Направление:
можно не решать всё сразу, пауза тоже действие, день не требует героизма, тишина иногда умнее спешки.
`.trim(),

      praise: `
Кнопка: «похвали меня».

Сделай короткую прямую похвалу человеку.
Это НЕ настроение и НЕ совет.

Формат:
фраза должна начинаться с «ты...» или «в тебе...».
Конкретно, тепло, без мотивационного плаката.

Направление:
ты замечаешь тонкое, ты не огрубела, в тебе есть живая сила, ты умеешь быть настоящей.
`.trim(),
    };

    if (!type || !prompts[type]) {
      return res.status(400).json({
        error: "Invalid type",
        details: "Use one of: mood, wisdom, praise",
        version: "yandex-short-distinct-no-hedgehog-v2",
      });
    }

    const instructions = `
Ты пишешь для проекта «Нужные слова».

Это маленький авторский оракул поддержки.
Это не чат-бот и не психологическая консультация.

Общие правила:
- русский язык
- одна готовая фраза
- 1 предложение
- максимум 120 символов
- без вариантов
- без пояснений
- без кавычек
- живой, тёплый, немного смешной стиль
- без корпоративного тона
- без токсичного позитива
- без эзотерики
- без диагнозов
- без советов обратиться к специалисту
- без обещаний, что всё точно будет хорошо
- без банальностей вроде «ты всё сможешь», «верь в себя», «будь лучшей версией себя»

Жёстко запрещено:
- не используй слово «диспетчер»
- не используй слово «ёжик»
- не используй слово «ежик»
- не используй слово «внутренний»
- не используй фразы «внутренний диспетчер», «внутренний ёжик», «внутренний ежик»
- не начинай все фразы одинаково
- не пиши длинно
- не смешивай типы кнопок

Различия между кнопками:
1. mood — смешное наблюдение о текущем состоянии. Не хвалить. Не советовать.
2. wisdom — маленькая мысль дня. Не хвалить. Не описывать настроение.
3. praise — прямая похвала человеку. Не давать совет. Не делать сводку настроения.

Для mood можно использовать мягкий абсурд:
лампа, булочка, облако, самовар, носок, чайник, карман, плед, маленькая радость, смешной свет, кривой воротник.

Для wisdom меньше абсурда, больше тихой ясности.

Для praise меньше абсурда, больше прямого тёплого признания ценности человека.
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
        max_output_tokens: 180,
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
        version: "yandex-short-distinct-no-hedgehog-v2",
      });
    }

    if (!yandexResponse.ok) {
      return res.status(yandexResponse.status).json({
        error: "Yandex AI request failed",
        status: yandexResponse.status,
        details: data,
        version: "yandex-short-distinct-no-hedgehog-v2",
      });
    }

    let message = data?.output_text;

    if (!message && Array.isArray(data?.output)) {
      for (const item of data.output) {
        if (Array.isArray(item?.content)) {
          for (const contentItem of item.content) {
            if (contentItem?.text) {
              message = contentItem.text;
              break;
            }
          }
        }

        if (message) {
          break;
        }
      }
    }

    if (!message) {
      return res.status(500).json({
        error: "Empty Yandex AI response",
        status: 500,
        details: data,
        version: "yandex-short-distinct-no-hedgehog-v2",
      });
    }

    message = cleanMessage(message);

    return res.status(200).json({
      message,
      version: "yandex-short-distinct-no-hedgehog-v2",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      status: 500,
      details: err.message,
      version: "yandex-short-distinct-no-hedgehog-v2",
    });
  }
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

  if (cleaned.length > 150) {
    cleaned = cleaned.slice(0, 147).trim();

    const lastSpaceIndex = cleaned.lastIndexOf(" ");
    if (lastSpaceIndex > 70) {
      cleaned = cleaned.slice(0, lastSpaceIndex).trim();
    }

    cleaned = `${cleaned}...`;
  }

  return cleaned;
}
