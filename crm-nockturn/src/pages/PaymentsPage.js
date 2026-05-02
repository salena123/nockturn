import React, { useEffect, useState } from 'react';
import api from '../api';


const EMPTY_FORM = {
  student_id: '',
  subscription_id: '',
  amount: '',
  method: 'cash',
  paid_at: '',
  comment: '',
  status: 'paid',
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'qr', label: 'QR' },
  { value: 'cash', label: 'Наличные' },
  { value: 'card_transfer', label: 'Перевод на карту' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'paid', label: 'Оплачен' },
  { value: 'pending', label: 'Ожидает оплаты' },
  { value: 'cancelled', label: 'Отменен' },
];


const PaymentsPage = ({ currentUser }) => {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [paymentsResponse, studentsResponse, subscriptionsResponse] = await Promise.all([
        api.get('/api/payments'),
        api.get('/api/students'),
        api.get('/api/subscriptions'),
      ]);
      setPayments(paymentsResponse.data);
      setStudents(studentsResponse.data);
      setSubscriptions(subscriptionsResponse.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Не удалось загрузить платежи');
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

  const buildPayload = () => ({
    student_id: formData.student_id ? Number(formData.student_id) : null,
    subscription_id: formData.subscription_id ? Number(formData.subscription_id) : null,
    amount: Number(formData.amount),
    method: formData.method || null,
    paid_at: formData.paid_at || null,
    comment: formData.comment.trim() || null,
    status: formData.status || null,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (editingId) {
        await api.put(`/api/payments/${editingId}`, buildPayload());
      } else {
        await api.post('/api/payments', buildPayload());
      }

      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Не удалось сохранить платеж');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (payment) => {
    setEditingId(payment.id);
    setFormData({
      student_id: payment.student_id ? String(payment.student_id) : '',
      subscription_id: payment.subscription_id ? String(payment.subscription_id) : '',
      amount: payment.amount ?? '',
      method: payment.method || 'cash',
      paid_at: payment.paid_at ? String(payment.paid_at).slice(0, 16) : '',
      comment: payment.comment || '',
      status: payment.status || 'paid',
    });
    setError('');
  };

  const handleDelete = async (paymentId) => {
    try {
      await api.delete(`/api/payments/${paymentId}`);
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Не удалось удалить платеж');
    }
  };

  if (currentUser?.role === 'teacher') {
    return <div>Раздел платежей доступен только администратору.</div>;
  }

  if (loading) {
    return <div>Загрузка платежей...</div>;
  }

  return (
    <div>
      <h2>Платежи</h2>

      {error && <div>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Ученик
            <br />
            <select name="student_id" value={formData.student_id} onChange={handleChange}>
              <option value="">Не выбран</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fio}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Абонемент
            <br />
            <select name="subscription_id" value={formData.subscription_id} onChange={handleChange}>
              <option value="">Не выбран</option>
              {subscriptions.map((subscription) => (
                <option key={subscription.id} value={subscription.id}>
                  #{subscription.id} / ученик {subscription.student_id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Сумма
            <br />
            <input name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} required />
          </label>
        </div>

        <div>
          <label>
            Способ оплаты
            <br />
            <select name="method" value={formData.method} onChange={handleChange}>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Дата оплаты
            <br />
            <input type="datetime-local" name="paid_at" value={formData.paid_at} onChange={handleChange} />
          </label>
        </div>

        <div>
          <label>
            Статус
            <br />
            <select name="status" value={formData.status} onChange={handleChange}>
              {PAYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Комментарий
            <br />
            <textarea name="comment" value={formData.comment} onChange={handleChange} rows="3" />
          </label>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Создать платеж'}
        </button>{' '}
        <button type="button" onClick={resetForm}>
          Сбросить форму
        </button>
      </form>

      <h3>История платежей</h3>
      {!payments.length ? (
        <div>Платежи не найдены.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>№</th>
              <th>Ученик</th>
              <th>Абонемент</th>
              <th>Сумма</th>
              <th>Способ</th>
              <th>Дата</th>
              <th>Статус</th>
              <th>Остаток занятий</th>
              <th>Комментарий</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index) => {
              const student = students.find((item) => item.id === payment.student_id);
              const methodLabel =
                PAYMENT_METHOD_OPTIONS.find((option) => option.value === payment.method)?.label || payment.method || '';
              const statusLabel =
                PAYMENT_STATUS_OPTIONS.find((option) => option.value === payment.status)?.label || payment.status || '';

              return (
                <tr key={payment.id}>
                  <td>{index + 1}</td>
                  <td>{student?.fio || payment.student_id || ''}</td>
                  <td>{payment.subscription_id || ''}</td>
                  <td>{payment.amount ?? ''}</td>
                  <td>{methodLabel}</td>
                  <td>{payment.paid_at || ''}</td>
                  <td>{statusLabel}</td>
                  <td>{payment.subscription_balance_snapshot ?? '—'}</td>
                  <td>{payment.comment || ''}</td>
                  <td>
                    <button type="button" onClick={() => handleEdit(payment)}>
                      Редактировать
                    </button>{' '}
                    <button type="button" onClick={() => handleDelete(payment.id)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};


export default PaymentsPage;
