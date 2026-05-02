import React, { useEffect, useState } from 'react';
import api from '../api';
import DeleteConfirm from '../components/DeleteConfirm';


const EMPTY_FORM = {
  name: '',
  type: 'fixed',
  value: '',
  condition: '',
};


const formatDiscountType = (value) => (value === 'percentage' ? 'Процентная' : 'Фиксированная');


const DiscountsPage = () => {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [deletingDiscount, setDeletingDiscount] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const fetchDiscounts = async () => {
    try {
      const response = await api.get('/api/discounts');
      setDiscounts(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Не удалось загрузить скидки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'value' ? value : value,
    }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingDiscount(null);
    setShowForm(false);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const payload = {
      ...formData,
      value: Number(formData.value),
      condition: formData.condition.trim() || null,
    };

    try {
      if (editingDiscount) {
        await api.put(`/api/discounts/${editingDiscount.id}`, payload);
      } else {
        await api.post('/api/discounts', payload);
      }

      await fetchDiscounts();
      resetForm();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Не удалось сохранить скидку');
    }
  };

  const handleEdit = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      name: discount.name,
      type: discount.type,
      value: String(discount.value ?? ''),
      condition: discount.condition || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (discountId) => {
    try {
      await api.delete(`/api/discounts/${discountId}`);
      setDeletingDiscount(null);
      await fetchDiscounts();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Не удалось удалить скидку');
    }
  };

  if (loading) {
    return <div>Загрузка скидок...</div>;
  }

  return (
    <div>
      <h2>Скидки</h2>

      {error && <div>{error}</div>}

      <button type="button" onClick={() => setShowForm(true)}>
        Добавить скидку
      </button>

      {showForm && (
        <div style={{ border: '1px solid #ccc', padding: '20px', margin: '20px 0' }}>
          <h3>{editingDiscount ? 'Редактировать скидку' : 'Новая скидка'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '10px' }}>
              <label>
                Название:
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>
                Тип:
                <select name="type" value={formData.type} onChange={handleChange}>
                  <option value="fixed">Фиксированная</option>
                  <option value="percentage">Процентная</option>
                </select>
              </label>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>
                Значение:
                <input
                  type="number"
                  name="value"
                  step="0.01"
                  min="0"
                  value={formData.value}
                  onChange={handleChange}
                  required
                />
                {formData.type === 'percentage' ? ' %' : ' ₽'}
              </label>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>
                Условие применения:
                <textarea
                  name="condition"
                  value={formData.condition}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Например: ребенок военного"
                />
              </label>
            </div>

            <button type="submit">
              {editingDiscount ? 'Сохранить' : 'Создать'}
            </button>{' '}
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
              <th>Условие</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map((discount) => (
              <tr key={discount.id}>
                <td>{discount.name}</td>
                <td>{formatDiscountType(discount.type)}</td>
                <td>{discount.type === 'percentage' ? `${discount.value}%` : `${discount.value} ₽`}</td>
                <td>{discount.condition || '—'}</td>
                <td>
                  <button type="button" onClick={() => handleEdit(discount)}>
                    Редактировать
                  </button>{' '}
                  <button type="button" onClick={() => setDeletingDiscount(discount)}>
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
