import React from 'react';

import {
  WEEKDAY_OPTIONS,
  formatLocalDate,
  getEventColor,
  parseServerDateTime,
} from './calendarGridShared';


const MonthView = ({ days, currentDate, getEventsForDate, onCellClick, onEventClick, weekends }) => {
  const monthNumber = currentDate.getMonth();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
      {WEEKDAY_OPTIONS.map((weekday) => (
        <div key={weekday.value} style={{ fontWeight: 'bold', padding: '8px 0' }}>
          {weekday.label}
        </div>
      ))}

      {days.map((day) => {
        const dayEvents = getEventsForDate(day);
        const isCurrentMonth = day.getMonth() === monthNumber;
        const weekdayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1;
        const isWeekend = weekends.has(weekdayIndex);

        return (
          <div
            key={day.toISOString()}
            style={{
              minHeight: '120px',
              border: '1px solid #ddd',
              padding: '8px',
              boxSizing: 'border-box',
              backgroundColor: isWeekend ? '#fff8e1' : isCurrentMonth ? 'white' : '#fafafa',
              cursor: 'pointer',
            }}
            onClick={() => onCellClick(new Date(`${formatLocalDate(day)}T09:00:00`))}
          >
            <div style={{ marginBottom: '8px', color: isCurrentMonth ? '#111' : '#9e9e9e' }}>
              {day.getDate()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  style={{
                    textAlign: 'left',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: getEventColor(event),
                    color: 'white',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onEventClick(event);
                  }}
                >
                  {parseServerDateTime(event.start_time)?.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  {event.discipline?.name || 'Занятие'}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};


export default MonthView;
