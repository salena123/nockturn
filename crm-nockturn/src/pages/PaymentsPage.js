import React, { useEffect, useState } from 'react';
import api from '../api';


const EMPTY_FORM = {
  student_id: '',
  subscription_id: '',
  amount: '',
  method: '',
  paid_at: '',
  comment: '',
  status: 'paid',
};


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
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить платежи');
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
    student_id: formData.student_id ? Number(formData.student_id) : null,
    subscription_id: formData.subscription_id ? Number(formData.subscription_id) : null,
    amount: Number(formData.amount),
    method: formData.method || null,
    paid_at: formData.paid_at || null,
    comment: formData.comment || null,
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
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить платеж');
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
      method: payment.method || '',
      paid_at: payment.paid_at ? String(payment.paid_at).slice(0, 16) : '',
      comment: payment.comment || '',
      status: payment.status || 'paid',
    });
  };

  const handleDelete = async (paymentId) => {
    try {
      await api.delete(`/api/payments/${paymentId}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить платеж');
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
      <h2>Калькулятор платежей</h2>

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
            Договор
            <br />
            <select name="subscription_id" value={formData.subscription_id} onChange={handleChange}>
              <option value="">Не выбран</option>
              {subscriptions.map((subscription) => (
                <option key={subscription.id} value={subscription.id}>
                  #{subscription.id} / student {subscription.student_id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Сумма
            <br />
            <input name="amount" value={formData.amount} onChange={handleChange} required />
          </label>
        </div>

        <div>
          <label>
            Способ оплаты
            <br />
            <input name="method" value={formData.method} onChange={handleChange} />
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
            <input name="status" value={formData.status} onChange={handleChange} />
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

      <h3>Список платежей</h3>
      {!payments.length ? (
        <div>Платежи не найдены.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>№</th>
              <th>Ученик</th>
              <th>Договор</th>
              <th>Сумма</th>
              <th>Способ</th>
              <th>Дата</th>
              <th>Статус</th>
              <th>Комментарий</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index ) => (
              <tr key={payment.id}>
                <td>{index + 1}</td>
                <td>{payment.student_id || ''}</td>
                <td>{payment.subscription_id || ''}</td>
                <td>{payment.amount ?? ''}</td>
                <td>{payment.method || ''}</td>
                <td>{payment.paid_at || ''}</td>
                <td>{payment.status || ''}</td>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};


export default PaymentsPage;
