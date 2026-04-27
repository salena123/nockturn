import json

import httpx
from fastapi import Request

from keyboards.main_menu import build_main_menu
from schemas.vk import VkCallbackPayload
from services.backend_client import CRMBackendClient
from services.linking import LinkingService
from services.vk_api import VKApiClient
from state import session_store


def build_keyboard_json() -> str:
    return json.dumps(build_main_menu(), ensure_ascii=False)


def format_subscription_message(data: dict) -> str:
    if not data.get("subscription_id"):
        return "Сейчас у вас нет активного абонемента."

    end_date = data.get("end_date") or "не указана"
    return (
        f"Абонемент ученика {data.get('student_name')}:\n"
        f"Осталось занятий: {data.get('balance_lessons')}\n"
        f"Дата окончания: {end_date}"
    )


def format_schedule_message(data: dict) -> str:
    items = data.get("items") or []
    if not items:
        return "Ближайших занятий пока нет."

    lines = [f"Ближайшее расписание ученика {data.get('student_name')}:"]
    for item in items[:5]:
        start_time = str(item.get("start_time") or "").replace("T", " ")[:16]
        end_time = str(item.get("end_time") or "").replace("T", " ")[:16]
        teacher_name = item.get("teacher_name") or "Преподаватель не указан"
        discipline_name = item.get("discipline_name") or "Дисциплина не указана"
        room_name = item.get("room_name") or "—"
        lines.append(
            f"- {start_time} - {end_time}, {discipline_name}, {teacher_name}, кабинет {room_name}"
        )

    return "\n".join(lines)


async def send_main_menu(vk_client: VKApiClient, user_id: int, message: str) -> None:
    await vk_client.send_message(user_id, message, keyboard=build_keyboard_json())


async def handle_unlinked_user(
    vk_client: VKApiClient,
    backend_client: CRMBackendClient,
    user_id: int,
    text: str,
) -> bool:
    session = session_store.get(user_id)

    if text.lower() == "/start":
        linker = LinkingService()
        await linker.start_linking(user_id)
        session_store.set(user_id, {"state": "awaiting_phone"})
        await vk_client.send_message(
            user_id,
            "Здравствуйте! Для привязки к ученику отправьте номер телефона в сообщении.",
            keyboard=build_keyboard_json(),
        )
        return True

    if session and session.get("state") == "awaiting_phone":
        try:
            resolved = await backend_client.resolve_vk_phone(text)
        except httpx.HTTPStatusError as error:
            detail = error.response.json().get("detail", "Не удалось проверить номер телефона.")
            await vk_client.send_message(user_id, detail, keyboard=build_keyboard_json())
            return True

        matches = resolved.get("matches") or []
        if not matches:
            await vk_client.send_message(
                user_id,
                "По этому номеру ученик или ответственное лицо не найдены. Попробуйте еще раз.",
                keyboard=build_keyboard_json(),
            )
            return True

        if len(matches) == 1:
            match = matches[0]
            await backend_client.create_vk_link(
                vk_user_id=user_id,
                student_id=match["student_id"],
                parent_id=match.get("parent_id"),
                phone=text,
            )
            session_store.clear(user_id)
            await send_main_menu(
                vk_client,
                user_id,
                f"Привязка выполнена. Ученик: {match['fio']}. Теперь можно пользоваться ботом.",
            )
            return True

        session_store.set(
            user_id,
            {
                "state": "awaiting_student_choice",
                "phone": text,
                "matches": matches,
            },
        )
        options = ["По вашему номеру найдено несколько учеников. Ответьте номером нужного варианта:"]
        for index, match in enumerate(matches, start=1):
            parent_part = f", ответственное лицо: {match.get('parent_name')}" if match.get("parent_name") else ""
            options.append(f"{index}. {match['fio']}{parent_part}")
        await vk_client.send_message(user_id, "\n".join(options), keyboard=build_keyboard_json())
        return True

    if session and session.get("state") == "awaiting_student_choice":
        if not text.isdigit():
            await vk_client.send_message(
                user_id,
                "Отправьте номер варианта из списка.",
                keyboard=build_keyboard_json(),
            )
            return True

        index = int(text) - 1
        matches = session.get("matches") or []
        if index < 0 or index >= len(matches):
            await vk_client.send_message(
                user_id,
                "Такого варианта нет. Попробуйте еще раз.",
                keyboard=build_keyboard_json(),
            )
            return True

        match = matches[index]
        await backend_client.create_vk_link(
            vk_user_id=user_id,
            student_id=match["student_id"],
            parent_id=match.get("parent_id"),
            phone=session.get("phone"),
        )
        session_store.clear(user_id)
        await send_main_menu(
            vk_client,
            user_id,
            f"Привязка выполнена. Ученик: {match['fio']}. Теперь можно пользоваться ботом.",
        )
        return True

    await vk_client.send_message(
        user_id,
        "Сначала напишите /start, чтобы привязать номер телефона к карточке ученика.",
        keyboard=build_keyboard_json(),
    )
    return True


async def handle_linked_user(
    vk_client: VKApiClient,
    backend_client: CRMBackendClient,
    user_id: int,
    text: str,
) -> None:
    if text.lower() == "/start":
        await send_main_menu(
            vk_client,
            user_id,
            "Вы уже привязаны к ученику. Выберите нужный раздел в меню.",
        )
        return

    if text == "Мой абонемент":
        subscription = await backend_client.get_vk_subscription(user_id)
        await send_main_menu(vk_client, user_id, format_subscription_message(subscription))
        return

    if text == "Моё расписание":
        schedule = await backend_client.get_vk_schedule(user_id)
        await send_main_menu(vk_client, user_id, format_schedule_message(schedule))
        return

    if text == "Сообщить о пропуске":
        await send_main_menu(
            vk_client,
            user_id,
            "Сценарий сообщения о пропуске будет следующим шагом. Основа привязки уже готова.",
        )
        return

    await send_main_menu(
        vk_client,
        user_id,
        "Команда пока в разработке. Уже скоро здесь появятся документы, пропуски и настройки уведомлений.",
    )


async def handle_vk_callback(payload: VkCallbackPayload, request: Request) -> None:
    if payload.type != "message_new":
        return

    message = {}
    if isinstance(payload.object, dict):
        message = payload.object.get("message") or {}
    elif payload.object and payload.object.message:
        message = payload.object.message

    user_id = message.get("from_id")
    text = (message.get("text") or "").strip()
    if not user_id:
        return

    vk_client = VKApiClient()
    backend_client = CRMBackendClient()

    try:
        await backend_client.get_vk_profile(user_id)
        await handle_linked_user(vk_client, backend_client, user_id, text)
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 404:
            await handle_unlinked_user(vk_client, backend_client, user_id, text)
            return
        detail = error.response.json().get("detail", "Ошибка обращения к CRM.")
        await vk_client.send_message(user_id, detail, keyboard=build_keyboard_json())
