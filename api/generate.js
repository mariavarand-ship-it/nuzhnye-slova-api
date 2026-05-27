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
      version: "nuzhnye-slova-v9",
    });
  }

  try {
    const apiKey = process.env.YANDEX_CLOUD_API_KEY;
    const folderId = process.env.YANDEX_CLOUD_FOLDER;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing YANDEX_CLOUD_API_KEY", version: "nuzhnye-slova-v9" });
    }
    if (!folderId) {
      return res.status(500).json({ error: "Missing YANDEX_CLOUD_FOLDER", version: "nuzhnye-slova-v9" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const type = body?.type;

    const rawName = (body?.name || "").toString().trim();
    const name = rawName ? sanitizeName(rawName) : "";
    const hasName = Boolean(name);

    const nameLine = hasName
      ? `Имя человека: ${name}. Обращайся к нему по имени «${name}». Имя должно прозвучать в фразе один раз.
Иногда (примерно в одной фразе из трёх, НЕ каждый раз) можешь добавить рядом одно ласковое слово из списка, каждый раз РАЗНОЕ: лапка, кисуль, зай, радость, золотой котёнок, ёжик, зайчёночек, вкусный человек, рыба, сладость мечты.
Вплетай ласковое слово естественно в живую речь, а не лепи сухо через запятую. Чаще обходись просто именем.`
      : `Имени нет — обратись на «ты», без выдуманных имён.`;

    const prompts = {
      mood: `
Кнопка: «Поднять настроение».
${nameLine}

Напиши одну тёплую фразу с лёгкой чудинкой, чтобы человеку стало легче.
Это маленькая приятная нелепость, а не совет и не похвала.
Придумывай свежие тёплые образы каждый раз, не повторяй
