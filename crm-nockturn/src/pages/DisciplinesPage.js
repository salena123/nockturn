import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import useActionDialog from '../components/ui/useActionDialog';

const DisciplinesPage = () => {
  const [disciplines, setDisciplines] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { dialog, showError, showSuccess } = useActionDialog();

  const loadDisciplines = useCallback(async () => {
    try {
      const response = await api.get('/api/disciplines/');
      setDisciplines(response.data);
    } catch (error) {
      console.error('Ошибка загрузки дисциплин:', error);
      await showError(error.response?.data?.detail || 'Не удалось загрузить дисциплины');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadDisciplines();
  }, [loadDisciplines]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/api/disciplines/', null, { params: { name: trimmedName } });
      setName('');
      await loadDisciplines();
      await showSuccess('Дисциплина успешно создана.');
    } catch (error) {
      console.error('Ошибка создания дисциплины:', error);
      await showError(error.response?.data?.detail || 'Не удалось создать дисциплину');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Дисциплины</h2>

      <form onSubmit={handleSubmit}>
        <label>
          Название дисциплины:
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, вокал"
          />
        </label>
        <button type="submit" disabled={submitting || !name.trim()}>
          Добавить
        </button>
      </form>

      {loading ? (
        <div>Загрузка дисциплин...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Название</th>
            </tr>
          </thead>
          <tbody>
            {disciplines.map((discipline, index) => (
              <tr key={discipline.id}>
                <td>{index + 1}</td>
                <td>{discipline.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialog}
    </div>
  );
};

export default DisciplinesPage;
