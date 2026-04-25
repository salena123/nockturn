import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import useActionDialog from '../components/ui/useActionDialog';

const RoomsPage = () => {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { dialog, showError, showSuccess } = useActionDialog();

  const loadRooms = useCallback(async () => {
    try {
      const response = await api.get('/api/rooms/');
      setRooms(response.data);
    } catch (error) {
      console.error('Ошибка загрузки кабинетов:', error);
      await showError(error.response?.data?.detail || 'Не удалось загрузить кабинеты');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/api/rooms/', null, { params: { name: trimmedName } });
      setName('');
      await loadRooms();
      await showSuccess('Кабинет успешно создан.');
    } catch (error) {
      console.error('Ошибка создания кабинета:', error);
      await showError(error.response?.data?.detail || 'Не удалось создать кабинет');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Кабинеты</h2>

      <form onSubmit={handleSubmit}>
        <label>
          Название кабинета:
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Кабинет 1"
          />
        </label>
        <button type="submit" disabled={submitting || !name.trim()}>
          Добавить
        </button>
      </form>

      {loading ? (
        <div>Загрузка кабинетов...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <td>{room.id}</td>
                <td>{room.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialog}
    </div>
  );
};

export default RoomsPage;
