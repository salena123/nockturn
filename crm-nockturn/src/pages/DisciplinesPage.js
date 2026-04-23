import React, { useEffect, useState } from 'react';
import api from '../api';

const DisciplinesPage = () => {
  const [disciplines, setDisciplines] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadDisciplines = async () => {
    try {
      const response = await api.get('/api/disciplines/');
      setDisciplines(response.data);
    } catch (error) {
      console.error('Ошибка загрузки дисциплин:', error);
      alert(error.response?.data?.detail || 'Не удалось загрузить дисциплины');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisciplines();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      setSubmitting(true);
      await api.post('/api/disciplines/', null, { params: { name: trimmedName } });
      setName('');
      await loadDisciplines();
    } catch (error) {
      console.error('Ошибка создания дисциплины:', error);
      alert(error.response?.data?.detail || 'Не удалось создать дисциплину');
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
            onChange={(e) => setName(e.target.value)}
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
              <th>ID</th>
              <th>Название</th>
            </tr>
          </thead>
          <tbody>
            {disciplines.map((discipline) => (
              <tr key={discipline.id}>
                <td>{discipline.id}</td>
                <td>{discipline.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DisciplinesPage;
