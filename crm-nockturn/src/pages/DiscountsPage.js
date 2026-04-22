import React, { useState, useEffect } from 'react';
import api from '../api';
import DeleteConfirm from '../components/DeleteConfirm';

const DiscountsPage = () => {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [deletingDiscount, setDeletingDiscount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'fixed',
    value: ''
  });

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      const response = await api.get('/api/discounts');
      setDiscounts(response.data);
    } catch (error) {
      console.error('Ошибка получения скидки:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDiscount) {
        await api.put(`/api/discounts/${editingDiscount.id}`, formData);
      } else {
        await api.post('/api/discounts', formData);
      }
      
      fetchDiscounts();
      resetForm();
    } catch (error) {
      console.error('Ошибка сохранения скидки:', error);
    }
  };

  const handleEdit = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      name: discount.name,
      type: discount.type,
      value: discount.value
    });
    setShowForm(true);
  };

  const handleDelete = async (discountId) => {
    try {
      await api.delete(`/api/discounts/${discountId}`);
      setDeletingDiscount(null);
      fetchDiscounts();
    } catch (error) {
      console.error('Ошибка удаления скидки:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'fixed',
      value: ''
    });
    setEditingDiscount(null);
    setShowForm(false);
  };

  if (loading) {
    return <div>Загрузка скидок...</div>;
  }

  return (
    <div>
      <h2>Скидки</h2>
      
      <button onClick={() => setShowForm(true)}>
        Добавить скидку
      </button>

      {showForm && (
        <div style={{ border: '1px solid #ccc', padding: '20px', margin: '20px 0' }}>
          <h3>{editingDiscount ? 'Редактировать скидку' : 'Новая скидка'}</h3>
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
                <option value="fixed">Фиксированная</option>
                <option value="percentage">Процент</option>
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Значение:</label>
              <input
                type="number"
                step="0.01"
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value)})}
                required
              />
              {formData.type === 'percentage' ? '%' : ' рублей'}
            </div>

            <button type="submit">
              {editingDiscount ? 'Сохранить' : 'Создать'}
            </button>
            <button type="button" onClick={resetForm}>
              Отмена
            </button>
          </form>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <h3>Список скидок</h3>
        <table border="1" cellPadding="8" cellSpacing="0">
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th>Значение</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map(discount => (
              <tr key={discount.id}>
                <td>{discount.name}</td>
                <td>{discount.type === 'percentage' ? 'процент' : 'фиксированная'}</td>
                <td>
                  {discount.type === 'percentage' 
                    ? `${discount.value}%` 
                    : `${discount.value}`
                  }
                </td>
                <td>
                  <button onClick={() => handleEdit(discount)}>
                    Редактировать
                  </button>
                  <button onClick={() => setDeletingDiscount(discount)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deletingDiscount && (
        <DeleteConfirm
          item={deletingDiscount}
          itemType="discount"
          onConfirm={() => handleDelete(deletingDiscount.id)}
          onCancel={() => setDeletingDiscount(null)}
        />
      )}
    </div>
  );
};

export default DiscountsPage;
