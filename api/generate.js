export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", version: "nuzhnye-slova-v10" });
  }

  try {
    const apiKey = process.env.YANDEX_CLOUD_API_KEY;
    const folderId = process.env.YANDEX_CLOUD_FOLDER;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing YANDEX_CLOUD_API_KEY", version: "nuzhnye-slova-v10" });
    }
    if (!folderId) {
      return res.status(500).json({ error: "Missing YANDEX_CLOUD_FOLDER", version: "nuzhnye-slova-v10" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const type = body?.type;

    const rawName = (body?.name || "").toString().trim();
    const name = rawName ? sanitizeName(rawName) : "";
    const hasName = Boolean(name);

    const nameLine = hasName
      ? "Имя человека: " + name + ". Обращайся к нему по имени. Имя должно прозвучать в фразе один раз. Иногда (примерно в одной фразе из трёх, не каждый раз) можешь добавить рядом одно ласковое слово из списка, каждый раз разное: лапка, кисуль, зай, радость, золотой котёнок, ёжик, зайчёночек, вкусный человек, рыба моя, сладость мечты. Вплетай ласковое слово живо, а не сухо через запятую. Чаще обходись просто именем."
      : "Имени нет — обратись на ты, без выдуманных имён.";

    const prompts = {
      mood: "Кнопка: Поднять настроение.\n" + nameLine + "\n\nНапиши одну тёплую фразу с лёгкой чудинкой, чтобы человеку стало легче. Это маленькая приятная нелепость, а не совет и не похвала. Придумывай свежие тёплые образы каждый раз, не повторяйся. Нежно, чуть смешно, живо.",

      wisdom: "Кнопка: Совет дня.\n" + nameLine + "\n\nНапиши один тихий добрый совет — маленькое действие или мягкий новый взгляд. Без клоунады, без похвалы, без давления. Спокойно и по-человечески. Лёгкая тёплая образность допустима, но смысл — в совете.",

      praise: "Кнопка: Похвалить.\n" + nameLine + "\n\nНапиши зрелую, глубокую похвалу — не игрушечную, а такую, будто говорит мудрый человек, который по-настоящему видит и понимает. Признай в человеке что-то настоящее: внутреннюю силу, способ быть, тихое достоинство. Не начинай со слова ты. Пиши свободно, без шаблонов и без сюсюканья. Допустима лёгкая образность, но главное — искренность и весомость. Это не комплимент внешности, а признание глубины человека.",
    };

    if (!type || !prompts[type]) {
      return res.status(400).json({ error: "Invalid type", version: "nuzhnye-slova-v10" });
    }

    const instructions = "Ты пишешь для проекта Нужные слова — маленького авторского оракула поддержки. Это не чат-бот и не психологическая консультация. Стиль: тёплый абсурд в духе Хармса и Хлебникова, мягкий, среднее количество странности. Для похвалы — больше зрелости и глубины, меньше чудинки. Формат: русский язык, одна готовая фраза, одно предложение, до 130 символов, если дано имя — оно звучит один раз, ласковое слово добавляй редко и разное, без кавычек, без пояснений, без вариантов, без эмодзи. Избегай токсичного позитива, корпоративности, канцелярита, эзотерики, диагнозов, повторов образов и одних и тех же ласковых слов. Не смешивай жанры: настроение — нелепая лёгкость, совет — это совет, похвала — зрелое признание ценности.";

    const yandexResponse = await fetch("https://ai.api.cloud.yandex.net/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
        "x-folder-id": folderId,
      },
      body: JSON.stringify({
        model: "gpt://" + folderId + "/deepseek-v32/latest",
        temperature: type === "mood" ? 0.95 : type === "praise" ? 0.85 : 0.65,
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
      return res.status(500).json({ error: "Yandex AI returned non-JSON response", details: rawText, version: "nuzhnye-slova-v10" });
    }

    if (!yandexResponse.ok) {
      return res.status(yandexResponse.status).json({ error: "Yandex AI request failed", details: data, version: "nuzhnye-slova-v10" });
    }

    let message = extractMessage(data);

    if (!message) {
      return res.status(500).json({ error: "Empty Yandex AI response", details: data, version: "nuzhnye-slova-v10" });
    }

    message = cleanMessage(message, name);

    return res.status(200).json({ message, version: "nuzhnye-slova-v10" });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message, version: "nuzhnye-slova-v10" });
  }
}

function sanitizeName(value) {
  let n = String(value).replace(/[<>{}"'`]/g, "").trim();
  if (n.length > 40) n = n.slice(0, 40).trim();
  return n;
}

function extractMessage(data) {
  if (data && data.output_text) {
    return data.output_text;
  }
  if (Array.isArray(data && data.output)) {
    for (const item of data.output) {
      if (Array.isArray(item && item.content)) {
        for (const contentItem of item.content) {
          if (contentItem && contentItem.text) {
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
  cleaned = cleaned.replace(/\s*,\s*,/g, ",").replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();

  const sentences = cleaned.match(/[^.!?]+[.!?]?/g);
  if (sentences && sentences.length > 0) {
    cleaned = sentences[0].trim();
  }

  if (name && !cleaned.toLowerCase().includes(name.toLowerCase())) {
    cleaned = capitalize(name) + ", " + lowerFirst(cleaned);
  }

  if (cleaned.length > 150) {
    cleaned = cleaned.slice(0, 147).trim();
    const lastSpace = cleaned.lastIndexOf(" ");
    if (lastSpace > 70) cleaned = cleaned.slice(0, lastSpace).trim();
    cleaned = cleaned + "...";
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
