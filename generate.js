const ALLOWED_TYPES = ["mood", "wisdom", "praise"];

function getPrompt(type) {
  const baseRules = `
Ты пишешь фразы для проекта «Нужные слова».

Это не чат-бот и не психологическая консультация.
Это маленький авторский оракул поддержки.

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

Формат:
- только одна готовая фраза
- без вариантов
- без пояснений
- без кавычек
- 1–2 предложения
- до 260 символов
- можно использовать мягкий абсурд: внутренний ёжик, лампа, булочка, диспетчер, облако, самовар, маленькая радость
`;

  if (type === "mood") {
    return `${baseRules}

Кнопка: «что с настроением»
Задача: сгенерируй фразу, которая мягко меняет состояние человека.
Фраза должна быть похожа на маленькое смешное донесение из внутреннего мира.`;
  }

  if (type === "wisdom") {
    return `${baseRules}

Кнопка: «мудрость»
Задача: сгенерируй короткую мысль дня.
Фраза должна быть не нравоучением, а мягким наблюдением, которое помогает выдохнуть.`;
  }

  if (type === "praise") {
    return `${baseRules}

Кнопка: «похвали меня»
Задача: сгенерируй тёплую похвалу человеку.
Фраза должна звучать не как мотивационный плакат, а как точное, нежное, немного странное признание ценности.`;
  }

  return baseRules;
}

function cleanMessage(text) {
  return String(text || "")
    .trim()
    .replace(/^["«]+|["»]+$/g, "")
    .replace(/\s+/g, " ");
}

function extractOutputText(data) {
  if (data?.output_text) {
    return data.output_text;
  }

  const output = data?.output || [];

  for (const item of output) {
    const content = item?.content || [];

    for (const part of content) {
      if (part?.text) {
        return part.text;
      }
    }
  }

  return "";
}

function isGoodMessage(text) {
  if (!text) return false;
  if (text.length < 20) return false;
  if (text.length > 300) return false;

  const forbidden = [
    "обратитесь к специалисту",
    "лучшей версией себя",
    "верь в себя",
    "ты всё сможешь",
    "вселенная",
    "успех неизбежен"
  ];

  const lower = text.toLowerCase();

  return !forbidden.some(word => lower.includes(word));
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    return response.status(200).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { type } = request.body || {};

    if (!ALLOWED_TYPES.includes(type)) {
      return response.status(400).json({
        error: "Unknown generation type",
        receivedType: type
      });
    }

    const apiKey = process.env.YANDEX_CLOUD_API_KEY;
    const folderId = process.env.YANDEX_CLOUD_FOLDER;

    if (!apiKey) {
      return response.status(500).json({
        error: "Missing Yandex Cloud API key"
      });
    }

    if (!folderId) {
      return response.status(500).json({
        error: "Missing Yandex Cloud folder id"
      });
    }

    const yandexResponse = await fetch("https://ai.api.cloud.yandex.net/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: `gpt://${folderId}/deepseek-v32/latest`,
        temperature: 0.7,
        instructions: getPrompt(type),
        input: "Сгенерируй одну фразу.",
        max_output_tokens: 160
      })
    });

    if (!yandexResponse.ok) {
      const errorText = await yandexResponse.text();

      return response.status(502).json({
        error: "Yandex AI request failed",
        status: yandexResponse.status,
        details: errorText
      });
    }

    const data = await yandexResponse.json();
    const message = cleanMessage(extractOutputText(data));

    if (!isGoodMessage(message)) {
      return response.status(422).json({
        error: "Generated message did not pass validation",
        message,
        raw: data
      });
    }

    return response.status(200).json({
      message
    });
  } catch (error) {
    return response.status(500).json({
      error: "Server error",
      details: error?.message || String(error)
    });
  }
}
