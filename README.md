# ДворКонтроль ПТЗ

Мобильное веб-приложение для карты городских проблем и подготовки обращений по Петрозаводску. API реализовано на Supabase Edge Functions и принимает авторизацию Telegram Mini App `initData`.

## Запуск приложения

Требуется Node.js 20.19+ или 22.12+.

```sh
npm ci
npm run dev
```

Production-сборка и локальный просмотр:

```sh
npm run build
npm run preview
```

## Развёртывание Supabase

Нужны проект Supabase и токен Telegram-бота от [@BotFather](https://t.me/BotFather). В корне проекта:

```sh
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
npx supabase secrets set TELEGRAM_BOT_TOKEN='<BOT_TOKEN_FROM_BOTFATHER>'
npx supabase functions deploy list-reports
npx supabase functions deploy upload-photo
npx supabase functions deploy create-report
```

Миграция создаёт `public.reports`, индексы и публичный bucket `report-photos` (JPEG/PNG/WebP, до 10 МБ). Клиентам запрещён прямой доступ к таблице; Edge Functions используют стандартный `SUPABASE_SERVICE_ROLE_KEY` Supabase и проверяют подпись и срок действия Telegram `initData`. `supabase/config.toml` отключает проверку Supabase JWT на этих трёх функциях, потому что они проверяют Telegram-подпись самостоятельно.

Для локального сайта создайте `.env` из `.env.example` и задайте адрес:

```env
VITE_EDGE_BASE=https://<PROJECT_REF>.supabase.co/functions/v1
```

Для GitHub Pages добавьте тот же адрес как GitHub Actions secret `VITE_EDGE_BASE`. Функции требуют запуск приложения через Telegram; обычный браузер без Telegram `initData` получит ответ 401. Bot token и service-role key нельзя помещать в `.env` фронтенда или переменные `VITE_*`. Фотографии в публичном bucket доступны по публичным URL.

## Контракты API

- `GET /list-reports` → `{ "reports": [...] }`
- `POST /upload-photo` — `multipart/form-data`, поле `file` → `{ "path": "<telegram-user-id>/<uuid>.png" }`
- `POST /create-report` — JSON с `districtId`, `category`, `address`, `lat`, `lng`, `accuracy?`, `complaintText`, `photoPath?` → `{ "report": {...} }`

Все функции отвечают на CORS preflight (`OPTIONS`). Публичная форма `report` использует camelCase и соответствует типу `Report` в `src/types.ts`.

## Публикация фронтенда

GitHub Actions собирает проект и выкладывает `dist/` в GitHub Pages при push в `main`. Перед публикацией задайте secret `VITE_EDGE_BASE` в настройках репозитория.
