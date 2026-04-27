import React, { useEffect, useState } from 'react';

import api from '../../api';
import {
  ATTENDANCE_STATUS_OPTIONS,
  formatApiError,
  formatLessonLabel,
  parseServerDateTime,
  pickSubscriptionForLessonDate,
} from './calendarGridShared';


const AttendanceModal = ({ event, onClose, onSaved }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const eventStart = parseServerDateTime(event.start_time);
  const canMarkAttendance = Boolean(eventStart && new Date() >= eventStart);

  useEffect(() => {
    const loadAttendance = async () => {
      setLoading(true);
      setError('');

      try {
        const [response, subscriptionsResponses] = await Promise.all([
          api.get(`/api/attendance?lesson_id=${event.lesson.id}`),
          Promise.all(
            (event.lesson.students || []).map((student) =>
              api.get(`/api/students/${student.id}/subscriptions`)
            )
          ),
        ]);

        const recordsByStudentId = {};
        (response.data || []).forEach((record) => {
          recordsByStudentId[record.student_id] = record;
        });

        const subscriptionsByStudentId = {};
        (event.lesson.students || []).forEach((student, index) => {
          subscriptionsByStudentId[student.id] = subscriptionsResponses[index]?.data || [];
        });

        setRows(
          (event.lesson.students || []).map((student) => {
            const existing = recordsByStudentId[student.id];
            const matchingSubscription = pickSubscriptionForLessonDate(
              subscriptionsByStudentId[student.id],
              event.lesson.lesson_date
            );
            const hasMatchingSubscription = Boolean(matchingSubscription);
            const canCharge =
              hasMatchingSubscription &&
              matchingSubscription.price_per_lesson !== null &&
              matchingSubscription.price_per_lesson !== undefined;

            return {
              student_id: student.id,
              student_name: student.name,
              attendance_id: existing?.id || null,
              status: existing?.status || (canCharge ? 'done' : 'miss_valid'),
              comment: existing?.comment || '',
              subscription_id: hasMatchingSubscription ? matchingSubscription.id : null,
              subscription_price_per_lesson: hasMatchingSubscription
                ? matchingSubscription.price_per_lesson
                : null,
              subscription_balance_lessons: hasMatchingSubscription
                ? matchingSubscription.balance_lessons
                : null,
              can_charge: canCharge,
              charge_block_reason: hasMatchingSubscription
                ? (canCharge ? '' : 'В абонементе не указана стоимость занятия')
                : 'На дату урока нет подходящего абонемента',
            };
          })
        );
      } catch (loadError) {
        setError(formatApiError(loadError.response?.data?.detail || loadError.response?.data?.message));
      } finally {
        setLoading(false);
      }
    };

    loadAttendance();
  }, [event]);

  const handleChange = (studentId, field, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.student_id !== studentId) {
          return row;
        }

        if (
          field === 'status' &&
          !row.can_charge &&
          (value === 'done' || value === 'miss_invalid')
        ) {
          return { ...row, status: 'miss_valid' };
        }

        return { ...row, [field]: value };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const blockedRows = rows.filter(
        (row) => !row.can_charge && (row.status === 'done' || row.status === 'miss_invalid')
      );

      if (blockedRows.length) {
        setError(
          blockedRows
            .map((row) => `${row.student_name}: ${row.charge_block_reason}`)
            .join('\n')
        );
        setSaving(false);
        return;
      }

      await Promise.all(
        rows.map((row) => {
          const payload = {
            lesson_id: event.lesson.id,
            student_id: row.student_id,
            status: row.status,
            comment: row.comment || null,
          };

          if (row.attendance_id) {
            return api.put(`/api/attendance/${row.attendance_id}`, payload);
          }

          return api.post('/api/attendance', payload);
        })
      );

      await onSaved();
    } catch (saveError) {
      setError(formatApiError(saveError.response?.data?.detail || saveError.response?.data?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '760px', maxHeight: '85vh', overflowY: 'auto' }}>
        <h3>Отметка посещаемости</h3>
        <p>{formatLessonLabel(event)}</p>
        {error && <div style={{ marginBottom: '12px', color: '#b71c1c', whiteSpace: 'pre-line' }}>{typeof error === 'string' ? error : JSON.stringify(error)}</div>}

        {loading ? (
          <div>Загрузка данных...</div>
        ) : !rows.length ? (
          <div>У этого урока нет привязанных учеников.</div>
        ) : (
          <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Статус</th>
                <th>Абонемент</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student_id}>
                  <td>{row.student_name}</td>
                  <td>
                    <select
                      value={row.status}
                      onChange={(e) => handleChange(row.student_id, 'status', e.target.value)}
                      disabled={!canMarkAttendance || saving}
                    >
                      {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                        <option
                          key={`${row.student_id}-${option.value}`}
                          value={option.value}
                          disabled={!row.can_charge && (option.value === 'done' || option.value === 'miss_invalid')}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {row.subscription_id ? (
                      <div>
                        <div>#{row.subscription_id}</div>
                        <div>Цена: {row.subscription_price_per_lesson ?? 'не указана'}</div>
                        <div>Остаток: {row.subscription_balance_lessons ?? 'не указан'}</div>
                      </div>
                    ) : (
                      <div style={{ color: '#b71c1c' }}>{row.charge_block_reason}</div>
                    )}
                  </td>
                  <td>
                    <textarea
                      rows="2"
                      value={row.comment}
                      onChange={(e) => handleChange(row.student_id, 'comment', e.target.value)}
                      disabled={!canMarkAttendance || saving}
                      style={{ width: '100%' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}>Отмена</button>
          <button type="button" onClick={handleSave} disabled={saving || loading || !rows.length || !canMarkAttendance}>
            {saving ? 'Сохранение...' : 'Сохранить посещаемость'}
          </button>
        </div>
      </div>
    </div>
  );
};


export default AttendanceModal;
