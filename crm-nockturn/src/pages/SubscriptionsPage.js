import React, { useEffect, useMemo, useState } from 'react';
import DeleteConfirm from '../components/DeleteConfirm';
import api from '../api';


const EMPTY_FORM = {
  student_id: '',
  tariff_id: '',
  discount_id: '',
  start_date: '',
  end_date: '',
  status: 'active',
  freeze_start_date: '',
  freeze_end_date: '',
  freeze_reason: '',
};


const formatTariffType = (value) => (value === 'group' ? 'Групповой' : 'Индивидуальный');


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
      setSubscriptions(subscriptionsResponse.data);
      setStudents(studentsResponse.data);
      setTariffs(tariffsResponse.data);
      setDiscounts(discountsResponse.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Не удалось загрузить абонементы');
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      await loadData();
      setLoading(false);
    };

    run();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setError('');
  };

  const selectedTariff = useMemo(
    () => tariffs.find((item) => item.id === Number(formData.tariff_id)),
    [formData.tariff_id, tariffs],
  );

  const selectedDiscount = useMemo(
    () => discounts.find((item) => item.id === Number(formData.discount_id)),
    [discounts, formData.discount_id],
  );

  const pricingPreview = useMemo(() => {
    if (!selectedTariff) {
      return null;
    }

    const lessonsTotal = Math.floor(selectedTariff.lessons_per_week * selectedTariff.duration_months * 4);
    let pricePerLesson = Number(selectedTariff.price_per_lesson || 0);

    if (selectedDiscount) {
      if (selectedDiscount.type === 'percentage') {
        pricePerLesson = pricePerLesson * (1 - Number(selectedDiscount.value) / 100);
      } else {
        pricePerLesson = pricePerLesson - Number(selectedDiscount.value);
      }
    }

    return {
      lessonsTotal,
      pricePerLesson,
      totalPrice: lessonsTotal * pricePerLesson,
    };
  }, [selectedDiscount, selectedTariff]);

  const buildPayload = () => ({
    student_id: Number(formData.student_id),
    tariff_id: Number(formData.tariff_id),
    discount_id: formData.discount_id ? Number(formData.discount_id) : null,
    start_date: formData.start_date || null,
    end_date: formData.end_date || null,
    status: formData.status || 'active',
    freeze_start_date: formData.status === 'frozen' ? formData.freeze_start_date || null : null,
    freeze_end_date: formData.status === 'frozen' ? formData.freeze_end_date || null : null,
    freeze_reason: formData.status === 'frozen' ? formData.freeze_reason.trim() || null : null,
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
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Не удалось сохранить абонемент');
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
      freeze_start_date: subscription.freeze_start_date || '',
      freeze_end_date: subscription.freeze_end_date || '',
      freeze_reason: subscription.freeze_reason || '',
    });
    setError('');
  };

  const handleDelete = async (subscriptionId) => {
    try {
      await api.delete(`/api/subscriptions/${subscriptionId}`);
      setDeletingSubscription(null);
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Не удалось удалить абонемент');
    }
  };

  if (currentUser?.role === 'teacher') {
    return <div>Раздел абонементов доступен только администратору.</div>;
  }

  if (loading) {
    return <div>Загрузка абонементов...</div>;
  }

  return (
    <div>
      <h2>Абонементы</h2>

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
                  {tariff.name} — {formatTariffType(tariff.type)} — {tariff.lessons_per_week} раз(а) в неделю
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            Скидка:
            <br />
            <select name="discount_id" value={formData.discount_id} onChange={handleChange}>
              <option value="">Без скидки</option>
              {discounts.map((discount) => (
                <option key={discount.id} value={discount.id}>
                  {discount.name}
                  {discount.condition ? ` (${discount.condition})` : ''}
                  {discount.type === 'percentage' ? ` — ${discount.value}%` : ` — ${discount.value} ₽`}
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
            Дата окончания:
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

        {formData.status === 'frozen' && (
          <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '15px' }}>
            <h4>Параметры заморозки</h4>
            <div style={{ marginBottom: '10px' }}>
              <label>
                Дата начала заморозки:
                <br />
                <input
                  type="date"
                  name="freeze_start_date"
                  value={formData.freeze_start_date}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>
                Дата окончания заморозки:
                <br />
                <input
                  type="date"
                  name="freeze_end_date"
                  value={formData.freeze_end_date}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>
                Причина заморозки:
                <br />
                <textarea
                  name="freeze_reason"
                  value={formData.freeze_reason}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Например: отпуск семьи"
                />
              </label>
            </div>
            <div>Срок заморозки не должен превышать 30 дней.</div>
          </div>
        )}

        {pricingPreview && (
          <div
            style={{
              border: '1px solid #ccc',
              padding: '15px',
              marginTop: '20px',
              marginBottom: '20px',
              backgroundColor: '#f9f9f9',
            }}
          >
            <h4>Расчет абонемента</h4>
            <p><strong>Всего занятий:</strong> {pricingPreview.lessonsTotal}</p>
            <p><strong>Цена за занятие:</strong> {pricingPreview.pricePerLesson.toFixed(2)}</p>
            <p><strong>Итоговая цена:</strong> {pricingPreview.totalPrice.toFixed(2)}</p>
            {selectedDiscount && <p><strong>Применена скидка:</strong> {selectedDiscount.name}</p>}
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Создать абонемент'}
          </button>{' '}
          <button type="button" onClick={resetForm}>
            Сбросить форму
          </button>
        </div>
      </form>

      <h3>Список абонементов</h3>
      {!subscriptions.length ? (
        <div>Абонементы не найдены.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>№</th>
              <th>Ученик</th>
              <th>Тариф</th>
              <th>Статус</th>
              <th>Всего занятий</th>
              <th>Остаток</th>
              <th>Цена/занятие</th>
              <th>Итоговая цена</th>
              <th>Период</th>
              <th>Заморозка</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((subscription, index) => {
              const student = students.find((item) => item.id === subscription.student_id);
              const tariff = tariffs.find((item) => item.id === subscription.tariff_id);

              return (
                <tr key={subscription.id}>
                  <td>{index + 1}</td>
                  <td>{student?.fio || `Ученик #${subscription.student_id}`}</td>
                  <td>{tariff?.name || `Тариф #${subscription.tariff_id}`}</td>
                  <td>{subscription.status || ''}</td>
                  <td>{subscription.lessons_total ?? ''}</td>
                  <td>{subscription.balance_lessons ?? ''}</td>
                  <td>{subscription.price_per_lesson ?? ''}</td>
                  <td>{subscription.total_price ?? subscription.price ?? ''}</td>
                  <td>{subscription.start_date || ''} — {subscription.end_date || ''}</td>
                  <td>
                    {subscription.freeze_start_date && subscription.freeze_end_date
                      ? `${subscription.freeze_start_date} — ${subscription.freeze_end_date}`
                      : '—'}
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
