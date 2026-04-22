import React, { useEffect, useState } from 'react';
import DeleteConfirm from '../components/DeleteConfirm';
import api from '../api';


const EMPTY_FORM = {
  student_id: '',
  tariff_id: '',
  discount_id: '',
  start_date: '',
  end_date: '',
  status: 'active',
};


const SubscriptionsPage = ({ currentUser }) => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [students, setStudents] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deletingSubscription, setDeletingSubscription] = useState(null);

  const loadData = async () => {
    try {
      const [subscriptionsResponse, studentsResponse, tariffsResponse, discountsResponse] = await Promise.all([
        api.get('/api/subscriptions'),
        api.get('/api/students'),
        api.get('/api/tariffs'),
        api.get('/api/discounts'),
      ]);
      const subscriptionsWithStudentNames = subscriptionsResponse.data.map(subscription => {
        const student = studentsResponse.data.find(s => s.id === subscription.student_id);
        return {
          ...subscription,
          student_name: student ? student.fio : `#${subscription.id}`
        };
      });
      setSubscriptions(subscriptionsWithStudentNames);
      setStudents(studentsResponse.data);
      setTariffs(tariffsResponse.data);
      setDiscounts(discountsResponse.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить абонементы');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      await loadData();
      setLoading(false);
    };

    load();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
  };

  const buildPayload = () => ({
    student_id: Number(formData.student_id),
    tariff_id: Number(formData.tariff_id),
    discount_id: formData.discount_id ? Number(formData.discount_id) : null,
    start_date: formData.start_date || null,
    end_date: formData.end_date || null,
    status: formData.status || 'active',
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (editingId) {
        await api.put(`/api/subscriptions/${editingId}`, buildPayload());
      } else {
        await api.post('/api/subscriptions', buildPayload());
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить договор');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (subscription) => {
    setEditingId(subscription.id);
    setFormData({
      student_id: subscription.student_id ? String(subscription.student_id) : '',
      tariff_id: subscription.tariff_id ? String(subscription.tariff_id) : '',
      discount_id: subscription.discount_id ? String(subscription.discount_id) : '',
      start_date: subscription.start_date || '',
      end_date: subscription.end_date || '',
      status: subscription.status || 'active',
    });
  };

  const handleDelete = async (subscriptionId) => {
    try {
      await api.delete(`/api/subscriptions/${subscriptionId}`);
      setDeletingSubscription(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить абонемент');
    }
  };

  if (currentUser?.role === 'teacher') {
    return <div>Раздел договоров доступен только администратору.</div>;
  }

  if (loading) {
    return <div>Загрузка договоров...</div>;
  }

  return (
    <div>
      <h2>Заключенные договоры</h2>

      {error && <div>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>
            Ученик:
            <br />
            <select name="student_id" value={formData.student_id} onChange={handleChange} required>
              <option value="">Выберите ученика</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fio}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            Тариф:
            <br />
            <select name="tariff_id" value={formData.tariff_id} onChange={handleChange} required>
              <option value="">Выберите тариф</option>
              {tariffs.map((tariff) => (
                <option key={tariff.id} value={tariff.id}>
                  {tariff.name} - {tariff.type === 'individual' ? 'индивидуальный' : 'групповой'} - {tariff.lessons_per_week} раз(а) в неделю - {tariff.price_per_lesson} за занятие - {tariff.duration_months} месяц(а)
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            Скидка (необязательно):
            <br />
            <select name="discount_id" value={formData.discount_id} onChange={handleChange}>
              <option value="">Без скидки</option>
              {discounts.map((discount) => (
                <option key={discount.id} value={discount.id}>
                  {discount.name} - {discount.type === 'percentage' ? `${discount.value}%` : `${discount.value}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            Дата начала:
            <br />
            <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            Дата окончания (необязательно):
            <br />
            <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            Статус:
            <br />
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="active">Активный</option>
              <option value="frozen">Заморожен</option>
              <option value="expired">Истек</option>
            </select>
          </label>
        </div>

        {formData.tariff_id && (
          <div style={{ 
            border: '1px solid #ccc', 
            padding: '15px', 
            marginTop: '20px',
            backgroundColor: '#f9f9f9'
          }}>
            <h4>Предпросмотр цен:</h4>
            {(() => {
              const selectedTariff = tariffs.find(t => t.id === parseInt(formData.tariff_id));
              const selectedDiscount = formData.discount_id ? discounts.find(d => d.id === parseInt(formData.discount_id)) : null;
              
              if (!selectedTariff) return <div>Выберите тариф для просмотра цен</div>;
              
              const weeksInDuration = selectedTariff.duration_months * 4;
              const lessonsTotal = Math.floor(selectedTariff.lessons_per_week * weeksInDuration);
              let pricePerLesson = selectedTariff.price_per_lesson;
              
              if (selectedDiscount) {
                if (selectedDiscount.type === 'percentage') {
                  pricePerLesson = pricePerLesson * (1 - selectedDiscount.value / 100);
                } else {
                  pricePerLesson = pricePerLesson - selectedDiscount.value;
                }
              }
              
              const totalPrice = lessonsTotal * pricePerLesson;
              
              return (
                <div>
                  <p><strong>Всего занятий:</strong> {lessonsTotal}</p>
                  <p><strong>Цена за занятие:</strong> {pricePerLesson.toFixed(2)}</p>
                  <p><strong>Итоговая цена:</strong> {totalPrice.toFixed(2)}</p>
                  {selectedDiscount && (
                    <p><strong>Применена скидка:</strong> {selectedDiscount.name}</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Создать договор'}
          </button>{' '}
          <button type="button" onClick={resetForm}>
            Сбросить форму
          </button>
        </div>
      </form>

      <h3>Список договоров</h3>
      {!subscriptions.length ? (
        <div>Договоры не найдены.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ученик</th>
              <th>Тариф</th>
              <th>Статус</th>
              <th>Всего занятий</th>
              <th>Остаток</th>
              <th>Цена/занятие</th>
              <th>Итоговая цена</th>
              <th>Период</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((subscription) => {
              const student = students.find(s => s.id === subscription.student_id);
              const tariff = tariffs.find(t => t.id === subscription.tariff_id);
              const discount = subscription.discount_id ? discounts.find(d => d.id === subscription.discount_id) : null;
              
              return (
                <tr key={subscription.id}>
                  <td>{subscription.id}</td>
                  <td>{student?.fio || `Ученик #${subscription.student_id}`}</td>
                  <td>{tariff?.name || `Тариф #${subscription.tariff_id}`}</td>
                  <td>{subscription.status || ''}</td>
                  <td>{subscription.lessons_total ?? ''}</td>
                  <td>{subscription.balance_lessons ?? ''}</td>
                  <td>{subscription.price_per_lesson ?? ''}</td>
                  <td>{subscription.total_price ?? subscription.price ?? ''}</td>
                  <td>
                    {subscription.start_date || ''} - {subscription.end_date || ''}
                  </td>
                  <td>
                    <button type="button" onClick={() => handleEdit(subscription)}>
                      Редактировать
                    </button>{' '}
                    <button type="button" onClick={() => setDeletingSubscription(subscription)}>
                    Удалить
                  </button>
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {deletingSubscription && (
        <DeleteConfirm
          item={deletingSubscription}
          itemType="subscription"
          onConfirm={() => handleDelete(deletingSubscription.id)}
          onCancel={() => setDeletingSubscription(null)}
        />
      )}
    </div>
  );
};

export default SubscriptionsPage;
