import React, { useState, useEffect } from 'react';
import api from '../api';
import DeleteConfirm from '../components/DeleteConfirm';

const TariffsPage = () => {
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTariff, setEditingTariff] = useState(null);
  const [deletingTariff, setDeletingTariff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'individual',
    lessons_per_week: 1,
    price_per_lesson: '',
    duration_months: 1
  });

  useEffect(() => {
    fetchTariffs();
  }, []);

  const fetchTariffs = async () => {
    try {
      const response = await api.get('/api/tariffs');
      setTariffs(response.data);
    } catch (error) {
      console.error('Error loading tariffs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTariff) {
        await api.put(`/api/tariffs/${editingTariff.id}`, formData);
      } else {
        await api.post('/api/tariffs', formData);
      }
      
      fetchTariffs();
      resetForm();
    } catch (error) {
      console.error('Ошибка сохранения тарифа:', error);
    }
  };

  const handleEdit = (tariff) => {
    setEditingTariff(tariff);
    setFormData({
      name: tariff.name,
      type: tariff.type,
      lessons_per_week: tariff.lessons_per_week,
      price_per_lesson: tariff.price_per_lesson,
      duration_months: tariff.duration_months
    });
    setShowForm(true);
  };

  const handleDelete = async (tariffId) => {
    try {
      await api.delete(`/api/tariffs/${tariffId}`);
      setDeletingTariff(null);
      fetchTariffs();
    } catch (error) {
      console.error('Ошибка удаления тарифа', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'individual',
      lessons_per_week: 1,
      price_per_lesson: '',
      duration_months: 1
    });
    setEditingTariff(null);
    setShowForm(false);
  };

  if (loading) {
    return <div>Загрузка тарифов...</div>;
  }

  return (
    <div>
      <h2>Тарифы</h2>
      
      <button onClick={() => setShowForm(true)}>
        Добавить тариф
      </button>

      {showForm && (
        <div style={{ border: '1px solid #ccc', padding: '20px', margin: '20px 0' }}>
          <h3>{editingTariff ? 'Редактировать тариф' : 'Новый тариф'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '10px' }}>
              <label>Название:</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Тип:</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
              >
                <option value="individual">Индивидуальный</option>
                <option value="group">Групповой</option>
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Занятий в неделю:</label>
              <select
                value={formData.lessons_per_week}
                onChange={(e) => setFormData({...formData, lessons_per_week: parseInt(e.target.value)})}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Цена за занятие:</label>
              <input
                type="number"
                step="0.01"
                value={formData.price_per_lesson}
                onChange={(e) => setFormData({...formData, price_per_lesson: parseFloat(e.target.value)})}
                required
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Длительность (месяцев):</label>
              <input
                type="number"
                value={formData.duration_months}
                onChange={(e) => setFormData({...formData, duration_months: parseInt(e.target.value)})}
                min="1"
              />
            </div>

            <button type="submit">
              {editingTariff ? 'Сохранить' : 'Создать'}
            </button>
            <button type="button" onClick={resetForm}>
              Отмена
            </button>
          </form>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <h3>Список тарифов</h3>
        <table border="1" cellPadding="8" cellSpacing="0">
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th>Занятий в неделю</th>
              <th>Цена за занятие</th>
              <th>Длительность</th>
              <th>Всего занятий</th>
              <th>Итоговая цена</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {tariffs.map(tariff => (
              <tr key={tariff.id}>
                <td>{tariff.name}</td>
                <td>{tariff.type === 'individual' ? 'индивидуальный' : 'групповой'}</td>
                <td>{tariff.lessons_per_week}</td>
                <td>{tariff.price_per_lesson}</td>
                <td>{tariff.duration_months} months</td>
                <td>{Math.floor(tariff.duration_months * 4 * tariff.lessons_per_week)}</td>
                <td>{(Math.floor(tariff.duration_months * 4 * tariff.lessons_per_week) * tariff.price_per_lesson).toFixed(2)}</td>
                <td>
                  <button onClick={() => handleEdit(tariff)}>
                    Редактировать
                  </button>
                  <button onClick={() => setDeletingTariff(tariff)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deletingTariff && (
        <DeleteConfirm
          item={deletingTariff}
          itemType="tariff"
          onConfirm={() => handleDelete(deletingTariff.id)}
          onCancel={() => setDeletingTariff(null)}
        />
      )}
    </div>
  );
};

export default TariffsPage;
