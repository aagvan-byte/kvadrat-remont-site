// Принимает заявку с сайта и пересылает её в Telegram.
// Работает на сервере (Vercel Functions), поэтому токен бота не виден посетителям.
import type { APIRoute } from 'astro';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from 'astro:env/server';

export const prerender = false;

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Telegram разбирает HTML, поэтому экранируем всё, что ввёл пользователь
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export const POST: APIRoute = async ({ request }) => {
  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return json(400, { error: 'bad_request' });
  }

  // Бот заполнил скрытое поле — делаем вид, что всё хорошо, но ничего не отправляем
  if (clean(data.website, 100)) return json(200, { ok: true });

  const name = clean(data.name, 60);
  const phone = clean(data.phone, 30);
  const type = clean(data.type, 40);
  const area = clean(data.area, 6);
  const comment = clean(data.comment, 1000);
  const source = clean(data.source, 40);

  if (!name || phone.replace(/\D/g, '').length < 10 || data.consent !== 'on') {
    return json(422, { error: 'validation' });
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы');
    return json(500, { error: 'not_configured' });
  }

  const text = [
    '<b>Новая заявка с сайта</b>',
    '',
    `<b>Имя:</b> ${escape(name)}`,
    `<b>Телефон:</b> ${escape(phone)}`,
    type ? `<b>Ремонт:</b> ${escape(type)}` : null,
    area ? `<b>Площадь:</b> ${escape(area)} м²` : null,
    comment ? `<b>Комментарий:</b> ${escape(comment)}` : null,
    '',
    `<i>Страница: ${escape(source || 'неизвестно')}</i>`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
  });

  if (!res.ok) {
    // Логируем только код ответа — без токена и данных клиента
    console.error('Telegram API error', res.status);
    return json(502, { error: 'telegram' });
  }

  return json(200, { ok: true });
};
