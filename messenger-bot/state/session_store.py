class InMemorySessionStore:
    def __init__(self) -> None:
        self._storage: dict[int, dict] = {}

    def get(self, user_id: int) -> dict | None:
        return self._storage.get(user_id)

    def set(self, user_id: int, value: dict) -> None:
        self._storage[user_id] = value

    def clear(self, user_id: int) -> None:
        self._storage.pop(user_id, None)


session_store = InMemorySessionStore()
