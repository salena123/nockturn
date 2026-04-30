# Deploy on `sasmurka.serv.host`

Этот стек поднимает:

- `PostgreSQL`
- `FastAPI backend`
- `CRM frontend`
- `VK bot`
- `Caddy` как reverse proxy и HTTPS

Пока сюда **не включены**:

- `public-site-frontend`
- `nockturn-strapi-project`

Их лучше подключить вторым этапом, когда базовая CRM уже уверенно работает на сервере.

## 1. Подготовить сервер

Подключение:

```bash
ssh root@2.26.8.240
```

Обновление пакетов:

```bash
apt update && apt upgrade -y
```

Установка Docker:

```bash
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
```

Проверка:

```bash
docker --version
docker compose version
```

## 2. Залить проект на сервер

Например, в `/opt/nockturn`:

```bash
mkdir -p /opt/nockturn
cd /opt/nockturn
```

Дальше либо:

```bash
git clone <URL_репозитория> .
```

либо загрузить проект архивом/через SFTP.

## 3. Подготовить production env

В корне проекта:

```bash
cp .env.production.example .env.production
nano .env.production
```

Минимально нужно заполнить:

```env
DOMAIN=sasmurka.serv.host

POSTGRES_DB=nockturn
POSTGRES_USER=nockturn
POSTGRES_PASSWORD=СЛОЖНЫЙ_ПАРОЛЬ_БД

SECRET_KEY=СЛОЖНЫЙ_КЛЮЧ_JWT
BOT_API_TOKEN=ОБЩИЙ_СЕКРЕТ_ДЛЯ_BACKEND_И_BOT

BOT_NAME=Nockturn Messenger Bot
VK_GROUP_ID=
VK_GROUP_TOKEN=
VK_CONFIRMATION_TOKEN=
VK_SECRET=
CRM_API_TOKEN=
```

## 4. Поднять стек

Из корня проекта:

```bash
docker compose --env-file .env.production up -d --build
```

Проверка контейнеров:

```bash
docker compose ps
```

Логи:

```bash
docker compose logs -f backend
docker compose logs -f messenger-bot
docker compose logs -f caddy
```

## 5. Что должно открыться

- CRM: `https://sasmurka.serv.host`
- backend health: `https://sasmurka.serv.host/backend-health`
- bot health: `https://sasmurka.serv.host/bot-health`
- VK webhook: `https://sasmurka.serv.host/vk/webhook`

## 6. Что важно для backend

Backend использует PostgreSQL через переменную:

```env
DATABASE_URL=postgresql+psycopg2://...
```

Она подставляется автоматически из `docker-compose.yml`, отдельно в `.env.production` ее прописывать не нужно.

Файлы документов сотрудников сохраняются в volume:

- `backend_uploads`

поэтому после перезапуска контейнера они не потеряются.

## 7. Первый запуск VK bot

После того как сайт и HTTPS поднялись:

1. Открыть настройки сообщества VK
2. Включить `Callback API`
3. Указать URL:

```text
https://sasmurka.serv.host/vk/webhook
```

4. Заполнить в `.env.production`:

- `VK_GROUP_ID`
- `VK_GROUP_TOKEN`
- `VK_CONFIRMATION_TOKEN`
- `VK_SECRET`

5. Перезапустить только бота:

```bash
docker compose --env-file .env.production up -d --build messenger-bot caddy
```

## 8. Полезные команды

Пересборка всего проекта:

```bash
docker compose --env-file .env.production up -d --build
```

Остановить:

```bash
docker compose down
```

Остановить без удаления данных БД:

```bash
docker compose stop
```

Посмотреть volumes:

```bash
docker volume ls
```

## 9. Что делать следующим этапом

Когда CRM, backend и bot заработают, можно вторым этапом:

1. добавить `public-site-frontend`
2. добавить `Strapi`
3. вынести публичный сайт на отдельный домен или поддомен
4. сделать отдельные backup-задачи для БД
