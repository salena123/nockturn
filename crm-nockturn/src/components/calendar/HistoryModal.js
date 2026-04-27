import React from 'react';

import { formatServerDateTime } from '../../utils/dateTime';
import {
  HISTORY_ACTION_LABELS,
  HISTORY_ENTITY_LABELS,
  HISTORY_FIELD_LABELS,
  formatHistoryValue,
  formatLessonLabel,
} from './calendarGridShared';


const HistoryModal = ({ event, rows, loading, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1150 }}>
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '760px', maxHeight: '80vh', overflowY: 'auto' }}>
      <h3>История изменений</h3>
      <p>{formatLessonLabel(event)}</p>
      {loading ? (
        <div>Загрузка истории...</div>
      ) : rows.length === 0 ? (
        <div>Изменений пока нет.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', marginBottom: '16px' }}>
          <thead>
            <tr>
              <th>Когда</th>
              <th>Кто изменил</th>
              <th>Раздел</th>
              <th>Действие</th>
              <th>Поле</th>
              <th>Было</th>
              <th>Стало</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.changed_at ? formatServerDateTime(row.changed_at) : '—'}</td>
                <td>{row.changed_by?.full_name || row.changed_by?.login || '—'}</td>
                <td>{HISTORY_ENTITY_LABELS[row.entity] || row.entity || '—'}</td>
                <td>{HISTORY_ACTION_LABELS[row.action] || row.action || '—'}</td>
                <td>{HISTORY_FIELD_LABELS[row.field_name] || row.field_name || '—'}</td>
                <td>{formatHistoryValue(row.field_name, row.old_value)}</td>
                <td>{formatHistoryValue(row.field_name, row.new_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  </div>
);


export default HistoryModal;
