def build_main_menu() -> dict:
    return {
        "inline": False,
        "buttons": [
            [{"action": {"type": "text", "label": "Мой абонемент"}, "color": "primary"}],
            [{"action": {"type": "text", "label": "Моё расписание"}, "color": "primary"}],
            [{"action": {"type": "text", "label": "Сообщить о пропуске"}, "color": "secondary"}],
            [{"action": {"type": "text", "label": "Документы"}, "color": "secondary"}],
            [{"action": {"type": "text", "label": "Связь с администратором"}, "color": "negative"}],
        ],
    }
