import React from 'react';

import {
  DAY_START_HOUR,
  ROW_HEIGHT,
  SLOT_MINUTES,
  TIME_COLUMN_WIDTH,
  formatLocalDate,
  getEventColor,
  getEventDurationMinutes,
  getWeekdayLabel,
} from './calendarGridShared';


const TimedView = ({
  days,
  viewMode,
  timeSlots,
  getTimedEventsForDate,
  onCellClick,
  onEventClick,
  onMoveEvent,
  setDraggedEvent,
  draggedEvent,
  lunchBreaks,
  weekends,
}) => {
  const getEventTop = (eventStart) => {
    const startOfDay = new Date(eventStart);
    startOfDay.setHours(DAY_START_HOUR, 0, 0, 0);
    const diffMinutes = Math.max(0, (eventStart.getTime() - startOfDay.getTime()) / 60000);
    return (diffMinutes / SLOT_MINUTES) * ROW_HEIGHT;
  };

  const getEventHeight = (eventStart, eventEnd) => {
    const durationMinutes = getEventDurationMinutes(eventStart, eventEnd);
    return (durationMinutes / SLOT_MINUTES) * ROW_HEIGHT;
  };

  const handleDrop = async (day, time, droppedEvent) => {
    if (!droppedEvent) {
      return;
    }
    const [hours, minutes] = time.split(':').map(Number);
    const nextDate = new Date(day);
    nextDate.setHours(hours, minutes, 0, 0);
    await onMoveEvent(droppedEvent, nextDate);
  };

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #ddd' }}>
      <div style={{ display: 'flex', minWidth: viewMode === 'day' ? '520px' : '1200px' }}>
        <div style={{ width: `${TIME_COLUMN_WIDTH}px`, flexShrink: 0, borderRight: '1px solid #ddd' }}>
          <div style={{ height: '56px', borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Время
          </div>
          {timeSlots.map((time) => (
            <div
              key={time}
              style={{
                height: `${ROW_HEIGHT}px`,
                borderBottom: '1px solid #eee',
                padding: '4px',
                boxSizing: 'border-box',
                fontSize: '12px',
                backgroundColor: '#f9f9f9',
              }}
            >
              {time}
            </div>
          ))}
        </div>

        {days.map((day, index) => {
          const dayEvents = getTimedEventsForDate(day);
          const isWeekend = weekends.has(day.getDay() === 0 ? 6 : day.getDay() - 1);

          return (
            <div
              key={day.toISOString()}
              style={{
                flex: 1,
                minWidth: viewMode === 'day' ? '420px' : '150px',
                borderRight: index === days.length - 1 ? 'none' : '1px solid #ddd',
              }}
            >
              <div
                style={{
                  height: '56px',
                  borderBottom: '1px solid #ddd',
                  backgroundColor: isWeekend ? '#fff3e0' : '#f5f5f5',
                  padding: '10px',
                  boxSizing: 'border-box',
                }}
              >
                <div>{getWeekdayLabel(day)}</div>
              </div>

              <div style={{ position: 'relative', height: `${timeSlots.length * ROW_HEIGHT}px` }}>
                {lunchBreaks.map((period) => {
                  const [startHour, startMinute] = period.start_time.split(':').map(Number);
                  const [endHour, endMinute] = period.end_time.split(':').map(Number);
                  const top = ((startHour - DAY_START_HOUR) * 60 + startMinute) / SLOT_MINUTES * ROW_HEIGHT;
                  const height = (((endHour - startHour) * 60) + (endMinute - startMinute)) / SLOT_MINUTES * ROW_HEIGHT;
                  return (
                    <div
                      key={`${day.toISOString()}-${period.start_time}`}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: 'rgba(255, 235, 59, 0.18)',
                        zIndex: 0,
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}

                {timeSlots.map((time, slotIndex) => (
                  <div
                    key={`${day.toISOString()}-${time}`}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${slotIndex * ROW_HEIGHT}px`,
                      height: `${ROW_HEIGHT}px`,
                      borderBottom: '1px solid #eee',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      backgroundColor: draggedEvent ? 'rgba(33, 150, 243, 0.02)' : 'transparent',
                    }}
                    onClick={() => onCellClick(new Date(`${formatLocalDate(day)}T${time}:00`))}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async (event) => {
                      event.preventDefault();
                      await handleDrop(day, time, draggedEvent);
                      setDraggedEvent(null);
                    }}
                  />
                ))}

                {dayEvents.map((event) => {
                  const top = getEventTop(event.parsedStart);
                  const height = getEventHeight(event.parsedStart, event.parsedEnd);
                  const widthPercent = 100 / event.laneCount;
                  const leftPercent = event.laneIndex * widthPercent;

                  return (
                    <div
                      key={event.id}
                      draggable
                      onDragStart={() => setDraggedEvent(event)}
                      onDragEnd={() => setDraggedEvent(null)}
                      style={{
                        position: 'absolute',
                        top: `${top}px`,
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        height: `${Math.max(height - 2, ROW_HEIGHT)}px`,
                        backgroundColor: getEventColor(event),
                        color: 'white',
                        borderRadius: '4px',
                        border: event.has_conflict ? '2px solid #ffebee' : 'none',
                        padding: '4px 6px',
                        boxSizing: 'border-box',
                        fontSize: '11px',
                        overflow: 'hidden',
                        zIndex: 2,
                        cursor: 'pointer',
                      }}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      <div><strong>{event.discipline?.name || 'Без дисциплины'}</strong></div>
                      <div>
                        {event.parsedStart.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {event.parsedEnd.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div>{event.room?.name || '—'}</div>
                      {event.lesson?.students?.length > 0 && (
                        <div>{event.lesson.students.map((student) => student.name).join(', ')}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


export default TimedView;
