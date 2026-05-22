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
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type } = request.body || {};

    if (!ALLOWED_TYPES.includes(type)) {
      return response.status(400).json({ error: "Unknown generation type" });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return response.status(500).json({ error: "Missing DeepSeek API key" });
    }

    const deepseekResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: getPrompt(type)
          },
          {
            role: "user",
            content: "Сгенерируй одну фразу."
          }
        ],
        temperature: 1.1,
        max_tokens: 120
      })
    });

  if (!deepseekResponse.ok) {
  const errorText = await deepseekResponse.text();

  return response.status(502).json({
    error: "DeepSeek request failed",
    status: deepseekResponse.status,
    details: errorText
  });
}

    const data = await deepseekResponse.json();
    const message = cleanMessage(data?.choices?.[0]?.message?.content);

    if (!isGoodMessage(message)) {
      return response.status(422).json({ error: "Generated message did not pass validation" });
    }

    return response.status(200).json({ message });
  } catch (error) {
    return response.status(500).json({ error: "Server error" });
  }
}
