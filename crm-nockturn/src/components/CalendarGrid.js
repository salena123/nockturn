import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import AttendanceModal from './calendar/AttendanceModal';
import CalendarMonthView from './calendar/MonthView';
import CalendarTimedView from './calendar/TimedView';
import EventDetailsModal from './calendar/EventDetailsModal';
import FieldSelect from './calendar/FieldSelect';
import HistoryModal from './calendar/HistoryModal';
import ActionDialog from './ui/ActionDialog';
import {
  EVENT_TYPE_OPTIONS,
  LESSON_TYPE_OPTIONS,
  RECURRENCE_OPTIONS,
  WEEKDAY_OPTIONS,
  VIEW_OPTIONS,
  formatApiError,
  formatLocalDate,
  formatLocalDateTime,
  formatLocalMonth,
  getMonthGridDays,
  getRangeLabel,
  getTimeSlots,
  getWeekDays,
  pad,
  parseServerDateTime,
  startOfMonth,
  startOfWeek,
  triggerDownload,
} from './calendar/calendarGridShared';

const CalendarGrid = ({ currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [studentSearchFilter, setStudentSearchFilter] = useState('');
  const [events, setEvents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [nonWorkingPeriods, setNonWorkingPeriods] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [attendanceEvent, setAttendanceEvent] = useState(null);
  const [historyEvent, setHistoryEvent] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    tone: 'warning',
    confirmText: 'ОК',
    cancelText: 'Отмена',
    showCancel: false,
  });
  const dialogResolverRef = useRef(null);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const monthDays = useMemo(() => getMonthGridDays(currentDate), [currentDate]);
  const timeSlots = useMemo(() => getTimeSlots(), []);
  const visibleDays = viewMode === 'day' ? [currentDate] : weekDays;
  const isTeacherUser = currentUser?.role === 'teacher';
  const filteredCalendarEvents = useMemo(() => {
    const query = studentSearchFilter.trim().toLowerCase();
    if (!query) {
      return events;
    }

    return events.filter((event) =>
      (event.lesson?.students || []).some((student) =>
        String(student.name || student.fio || '')
          .toLowerCase()
          .includes(query)
      )
    );
  }, [events, studentSearchFilter]);
  const currentTeacher = useMemo(
    () => teachers.find((teacher) => teacher.user_id === currentUser?.id) || null,
    [teachers, currentUser]
  );

  const openDialog = useCallback((config) => new Promise((resolve) => {
    dialogResolverRef.current = resolve;
    setDialogState({
      isOpen: true,
      title: config.title,
      message: config.message,
      tone: config.tone || 'warning',
      confirmText: config.confirmText || 'ОК',
      cancelText: config.cancelText || 'Отмена',
      showCancel: Boolean(config.showCancel),
    });
  }), []);

  const showErrorDialog = useCallback(
    async (message, title = 'Ошибка') => {
      await openDialog({
        title,
        message,
        tone: 'error',
        confirmText: 'Понятно',
      });
    },
    [openDialog]
  );

  const showSuccessDialog = useCallback(
    async (message, title = 'Готово') => {
      await openDialog({
        title,
        message,
        tone: 'success',
        confirmText: 'ОК',
      });
    },
    [openDialog]
  );

  const showConfirmDialog = useCallback(
    (message, title = 'Подтверждение', confirmText = 'Подтвердить') =>
      openDialog({
        title,
        message,
        tone: 'warning',
        confirmText,
        cancelText: 'Отмена',
        showCancel: true,
      }),
    [openDialog]
  );

  const handleDialogConfirm = useCallback(() => {
    const resolve = dialogResolverRef.current;
    dialogResolverRef.current = null;
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolve) {
      resolve(true);
    }
  }, []);

  const handleDialogCancel = useCallback(() => {
    const resolve = dialogResolverRef.current;
    dialogResolverRef.current = null;
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolve) {
      resolve(false);
    }
  }, []);

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate =
        viewMode === 'day'
          ? formatLocalDate(currentDate)
          : viewMode === 'month'
            ? formatLocalDate(startOfMonth(currentDate))
            : formatLocalDate(weekDays[0]);

      const params = new URLSearchParams({
        start_date: startDate,
        view: viewMode,
      });
      if (teacherFilter) {
        params.append('teacher_id', teacherFilter);
      }
      if (roomFilter) {
        params.append('room_id', roomFilter);
      }

      const [eventsRes, teachersRes, disciplinesRes, roomsRes, studentsRes, periodsRes] = await Promise.all([
        api.get(`/api/schedule/calendar?${params.toString()}`),
        api.get('/api/teachers'),
        api.get('/api/disciplines'),
        api.get('/api/rooms'),
        api.get('/api/students'),
        api.get('/api/schedule/non-working-periods'),
      ]);

      setEvents(eventsRes.data || []);
      setTeachers(teachersRes.data || []);
      setDisciplines(disciplinesRes.data || []);
      setRooms(roomsRes.data || []);
      setStudents(studentsRes.data || []);
      setNonWorkingPeriods(periodsRes.data || null);
    } catch (error) {
      console.error('Ошибка загрузки календаря:', error);
      await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    } finally {
      setLoading(false);
    }
  }, [currentDate, showErrorDialog, teacherFilter, viewMode, weekDays, roomFilter]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const handleNavigate = (direction) => {
    setCurrentDate((prev) => {
      const nextDate = new Date(prev);
      if (viewMode === 'day') {
        nextDate.setDate(nextDate.getDate() + direction);
        return nextDate;
      }
      if (viewMode === 'month') {
        nextDate.setMonth(nextDate.getMonth() + direction);
        return nextDate;
      }
      nextDate.setDate(nextDate.getDate() + direction * 7);
      return nextDate;
    });
  };

  const handleCellClick = (date) => {
    setSelectedSlot({ date });
    setShowLessonModal(true);
  };

  const getEventsForDate = (date) =>
    filteredCalendarEvents
      .map((event) => ({
        ...event,
        parsedStart: parseServerDateTime(event.start_time),
        parsedEnd: parseServerDateTime(event.end_time),
      }))
      .filter(
        (event) =>
          event.parsedStart &&
          event.parsedEnd &&
          event.parsedStart.toDateString() === date.toDateString()
      )
      .sort((left, right) => left.parsedStart - right.parsedStart);

  const getTimedEventsForDate = (date) => {
    const dayEvents = getEventsForDate(date);
    const clusters = [];
    const positionedEvents = [];
    let activeEvents = [];
    let currentCluster = null;

    dayEvents.forEach((event) => {
      activeEvents = activeEvents.filter((activeEvent) => activeEvent.parsedEnd > event.parsedStart);

      if (activeEvents.length === 0) {
        currentCluster = { id: clusters.length, laneCount: 0 };
        clusters.push(currentCluster);
      }

      const usedLanes = new Set(activeEvents.map((activeEvent) => activeEvent.laneIndex));
      let laneIndex = 0;
      while (usedLanes.has(laneIndex)) {
        laneIndex += 1;
      }

      const positionedEvent = { ...event, laneIndex, clusterId: currentCluster.id };
      currentCluster.laneCount = Math.max(currentCluster.laneCount, laneIndex + 1);
      activeEvents.push(positionedEvent);
      positionedEvents.push(positionedEvent);
    });

    return positionedEvents.map((event) => {
      const cluster = clusters[event.clusterId];
      return { ...event, laneCount: cluster?.laneCount || 1 };
    });
  };

  const handleHistoryOpen = async (event) => {
    setHistoryEvent(event);
    setHistoryLoading(true);
    try {
      const response = await api.get(`/api/schedule/history?event_id=${event.id}`);
      setHistoryRows(response.data || []);
    } catch (error) {
      await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
      setHistoryEvent(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveWithConflictHandling = async (requestFn, confirmationText) => {
    try {
      await requestFn(false);
      return true;
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (error.response?.status === 409) {
        const shouldIgnore = await showConfirmDialog(
          `${formatApiError(detail)}\n\n${confirmationText}`,
          'Обнаружен конфликт',
          'Сохранить всё равно'
        );
        if (!shouldIgnore) {
          return false;
        }
        await requestFn(true);
        return true;
      }
      throw error;
    }
  };

  const handleMoveEvent = async (event, targetDate) => {
    const eventStart = parseServerDateTime(event.start_time);
    const eventEnd = parseServerDateTime(event.end_time);
    if (!eventStart || !eventEnd) {
      return;
    }

    const duration = eventEnd.getTime() - eventStart.getTime();
    const nextEnd = new Date(targetDate.getTime() + duration);

    try {
      const saved = await saveWithConflictHandling(
        (ignoreConflicts) =>
          api.put(`/api/schedule/events/${event.id}`, {
            start_time: formatLocalDateTime(targetDate),
            end_time: formatLocalDateTime(nextEnd),
            ignore_conflicts: ignoreConflicts,
          }),
        'Сохранить перенос несмотря на конфликты?'
      );

      if (saved) {
        await fetchCalendarData();
        await showSuccessDialog('Занятие успешно перенесено.');
      }
    } catch (error) {
      await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    }
  };

  const handleExport = async (type) => {
    try {
      const startDate =
        viewMode === 'day'
          ? formatLocalDate(currentDate)
          : viewMode === 'month'
            ? formatLocalDate(startOfMonth(currentDate))
            : formatLocalDate(weekDays[0]);

      const params = new URLSearchParams({
        start_date: startDate,
        view: viewMode,
      });
      if (teacherFilter) {
        params.append('teacher_id', teacherFilter);
      }
      if (roomFilter) {
        params.append('room_id', roomFilter);
      }

      const response = await api.get(`/api/schedule/export/${type}?${params.toString()}`, {
        responseType: 'blob',
      });
      triggerDownload(response.data, `schedule.${type}`);
    } catch (error) {
      await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    }
  };

  const lunchBreaks = nonWorkingPeriods?.lunch_breaks || [];
  const weekends = new Set(nonWorkingPeriods?.weekends || []);

  if (loading) {
    return <div>Загрузка расписания...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Расписание</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setSelectedSlot(null); setShowLessonModal(true); }}>
            Добавить занятие
          </button>
          <button type="button" onClick={() => handleExport('xlsx')}>
            Экспорт .xlsx
          </button>
          <button type="button" onClick={() => handleExport('ics')}>
            Экспорт .ics
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button type="button" onClick={() => handleNavigate(-1)}>
          Назад
        </button>
        <div style={{ minWidth: '220px' }}>{getRangeLabel(viewMode, currentDate)}</div>
        <button type="button" onClick={() => handleNavigate(1)}>
          Вперед
        </button>
        <button type="button" onClick={() => setCurrentDate(new Date())}>
          Сегодня
        </button>
        <button type="button" onClick={() => setCurrentDate(startOfWeek(new Date()))}>
          Эта неделя
        </button>
        <button type="button" onClick={() => setCurrentDate(startOfMonth(new Date()))}>
          Этот месяц
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Перейти к дате:</span>
          <input
            type="date"
            value={formatLocalDate(currentDate)}
            onChange={(event) => {
              const [year, month, day] = event.target.value.split('-').map(Number);
              if (!year || !month || !day) {
                return;
              }
              setCurrentDate(new Date(year, month - 1, day, 9, 0, 0));
            }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Выбрать месяц:</span>
          <input
            type="month"
            value={formatLocalMonth(currentDate)}
            onChange={(event) => {
              const [year, month] = event.target.value.split('-').map(Number);
              if (!year || !month) {
                return;
              }
              setCurrentDate(new Date(year, month - 1, 1, 9, 0, 0));
            }}
          />
        </label>
        <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
          {VIEW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {!isTeacherUser && <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
          <option value="">Все преподаватели</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.user?.full_name || 'Без имени'}
            </option>
          ))}
        </select>}
        <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
          <option value="">Все кабинеты</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={studentSearchFilter}
          onChange={(e) => setStudentSearchFilter(e.target.value)}
          placeholder="Поиск по ученику"
        />
      </div>

      <div style={{ marginBottom: '16px', padding: '10px', border: '1px solid #ddd' }}>
        <div>Нерабочие периоды:</div>
        <div>Перерыв: {lunchBreaks.map((period) => `${period.start_time}-${period.end_time}`).join(', ') || 'не задан'}</div>
        <div>Выходные: {[...weekends].map((dayIndex) => WEEKDAY_OPTIONS.find((item) => item.value === dayIndex)?.label).filter(Boolean).join(', ') || 'не заданы'}</div>
        <div>Праздничные дни: рабочий день начинается с {nonWorkingPeriods?.holiday_start_hour || 11}:00</div>
      </div>

      {viewMode === 'month' ? (
        <CalendarMonthView
          days={monthDays}
          currentDate={currentDate}
          getEventsForDate={getEventsForDate}
          onCellClick={handleCellClick}
          onEventClick={setSelectedEvent}
          weekends={weekends}
        />
      ) : (
        <CalendarTimedView
          days={visibleDays}
          viewMode={viewMode}
          timeSlots={timeSlots}
          getTimedEventsForDate={getTimedEventsForDate}
          onCellClick={handleCellClick}
          onEventClick={setSelectedEvent}
          onMoveEvent={handleMoveEvent}
          setDraggedEvent={setDraggedEvent}
          draggedEvent={draggedEvent}
          lunchBreaks={lunchBreaks}
          weekends={weekends}
        />
      )}

      {showLessonModal && (
        <LessonModal
          showModal={showLessonModal}
          onClose={() => {
            setShowLessonModal(false);
            setEditingEvent(null);
          }}
          selectedSlot={selectedSlot}
          editingEvent={editingEvent}
          teachers={teachers}
          disciplines={disciplines}
          rooms={rooms}
          students={students}
          onLessonCreated={fetchCalendarData}
          onConflictSave={saveWithConflictHandling}
          onShowError={showErrorDialog}
          onShowSuccess={showSuccessDialog}
          currentUser={currentUser}
          currentTeacher={currentTeacher}
        />
      )}

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={async (eventId) => {
            const shouldDelete = await showConfirmDialog(
              'Удалить это занятие из расписания?',
              'Подтверждение удаления',
              'Удалить'
            );
            if (!shouldDelete) {
              return;
            }
            try {
              await api.delete(`/api/schedule/events/${eventId}`);
              setSelectedEvent(null);
              await fetchCalendarData();
              await showSuccessDialog('Занятие удалено из расписания.');
            } catch (error) {
              await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
            }
          }}
          onOpenAttendance={(event) => {
            setSelectedEvent(null);
            setAttendanceEvent(event);
          }}
          onEdit={(event) => {
            setSelectedEvent(null);
            setSelectedSlot({ date: parseServerDateTime(event.start_time) || new Date() });
            setEditingEvent(event);
            setShowLessonModal(true);
          }}
          onOpenHistory={handleHistoryOpen}
        />
      )}

      {historyEvent && (
        <HistoryModal
          event={historyEvent}
          rows={historyRows}
          loading={historyLoading}
          onClose={() => setHistoryEvent(null)}
        />
      )}

      {attendanceEvent && (
        <AttendanceModal
          event={attendanceEvent}
          onClose={() => setAttendanceEvent(null)}
          onSaved={async () => {
            setAttendanceEvent(null);
            await fetchCalendarData();
            await showSuccessDialog('Посещаемость успешно сохранена.');
          }}
        />
      )}

      <ActionDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        tone={dialogState.tone}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        showCancel={dialogState.showCancel}
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
      />
    </div>
  );
};

const LessonModal = ({
  showModal,
  onClose,
  selectedSlot,
  editingEvent,
  teachers,
  disciplines,
  rooms,
  students,
  onLessonCreated,
  onConflictSave,
  onShowError,
  onShowSuccess,
  currentUser,
  currentTeacher,
}) => {
  const initialDate = selectedSlot?.date || new Date();
  const isEditMode = Boolean(editingEvent?.id && editingEvent?.lesson?.id);
  const isTeacherUser = currentUser?.role === 'teacher';
  const [formData, setFormData] = useState({
    teacher_id: '',
    discipline_id: '',
    room_id: '',
    type: 'lesson',
    lesson_type: 'individual',
    max_students: 1,
    student_id: '',
    student_ids: [],
    duration: 45,
    recurrence_type: 'none',
    repeat_until: '',
    weekdays: [],
  });
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(initialDate));
  const [selectedTime, setSelectedTime] = useState(`${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}`);
  const [studentSearch, setStudentSearch] = useState('');
  const [showDisciplineCreate, setShowDisciplineCreate] = useState(false);
  const [showRoomCreate, setShowRoomCreate] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [localDisciplines, setLocalDisciplines] = useState(disciplines);
  const [localRooms, setLocalRooms] = useState(rooms);
  const availableStudents = useMemo(
    () =>
      students.filter((student) => {
        const normalizedStatus = String(student.status || '').trim().toLowerCase();
        return normalizedStatus !== 'заморожен' && normalizedStatus !== 'отказался';
      }),
    [students]
  );

  const durations = useMemo(() => {
    const list = [];
    for (let minute = 30; minute <= 180; minute += 15) {
      list.push(minute);
    }
    return list;
  }, []);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) {
      return availableStudents;
    }
    return availableStudents.filter(
      (student) =>
        student.fio?.toLowerCase().includes(query) ||
        student.phone?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query)
    );
  }, [availableStudents, studentSearch]);

  useEffect(() => {
    setLocalDisciplines(disciplines);
  }, [disciplines]);

  useEffect(() => {
    setLocalRooms(rooms);
  }, [rooms]);

  useEffect(() => {
    const nextDate = selectedSlot?.date || new Date();
    setSelectedDate(formatLocalDate(nextDate));
    setSelectedTime(`${pad(nextDate.getHours())}:${pad(nextDate.getMinutes())}`);
  }, [selectedSlot, showModal]);

  useEffect(() => {
    if (!showModal) {
      return;
    }

    if (!isEditMode) {
      setFormData({
        teacher_id: isTeacherUser ? currentTeacher?.id || '' : '',
        discipline_id: '',
        room_id: '',
        type: 'lesson',
        lesson_type: 'individual',
        max_students: 1,
        student_id: '',
        student_ids: [],
        duration: 45,
        recurrence_type: 'none',
        repeat_until: '',
        weekdays: [],
      });
      return;
    }

    const startTime = parseServerDateTime(editingEvent.start_time);
    const endTime = parseServerDateTime(editingEvent.end_time);
    const duration = startTime && endTime
      ? Math.max(15, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
      : 45;
    const studentIds = (editingEvent.lesson?.students || []).map((student) => student.id);

    setSelectedDate(startTime ? formatLocalDate(startTime) : formatLocalDate(new Date()));
    setSelectedTime(startTime ? `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}` : '09:00');
    setFormData({
      teacher_id: editingEvent.teacher_id || '',
      discipline_id: editingEvent.discipline_id || '',
      room_id: editingEvent.room_id || '',
      type: editingEvent.type || 'lesson',
      lesson_type: editingEvent.lesson?.lesson_type || 'individual',
      max_students: editingEvent.lesson?.max_students || 1,
      student_id:
        editingEvent.lesson?.lesson_type === 'individual' && studentIds.length
          ? studentIds[0]
          : '',
      student_ids: editingEvent.lesson?.lesson_type === 'group' ? studentIds : [],
      duration,
      recurrence_type: editingEvent.recurring?.repeat_type || 'none',
      repeat_until: editingEvent.recurring?.repeat_until || '',
      weekdays: [],
    });
  }, [currentTeacher, editingEvent, isEditMode, isTeacherUser, showModal]);

  const handleCreateDiscipline = async () => {
    const trimmedName = newDisciplineName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const response = await api.post('/api/disciplines/', null, {
        params: { name: trimmedName },
      });
      setLocalDisciplines((prev) => [...prev, response.data]);
      setFormData((prev) => ({ ...prev, discipline_id: response.data.id }));
      setNewDisciplineName('');
      setShowDisciplineCreate(false);
    } catch (error) {
      await onShowError(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    }
  };

  const handleCreateRoom = async () => {
    const trimmedName = newRoomName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const response = await api.post('/api/rooms/', null, {
        params: { name: trimmedName },
      });
      setLocalRooms((prev) => [...prev, response.data]);
      setFormData((prev) => ({ ...prev, room_id: response.data.id }));
      setNewRoomName('');
      setShowRoomCreate(false);
    } catch (error) {
      await onShowError(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (isTeacherUser && !currentTeacher) {
        await onShowError('Не удалось определить преподавателя для текущего пользователя.');
        return;
      }

      const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + formData.duration);
      const teacherId = isTeacherUser ? currentTeacher.id : Number(formData.teacher_id);

      const basePayload = {
        teacher_id: teacherId,
        discipline_id: Number(formData.discipline_id),
        room_id: Number(formData.room_id),
        start_time: formatLocalDateTime(startTime),
        end_time: formatLocalDateTime(endTime),
        type: formData.type,
        lesson_type: formData.lesson_type,
        max_students: Number(formData.max_students),
        student_ids:
          formData.lesson_type === 'group'
            ? formData.student_ids
            : formData.student_id
              ? [Number(formData.student_id)]
              : [],
        recurrence: {
          repeat_type: formData.recurrence_type,
          repeat_until: formData.recurrence_type === 'none' ? null : formData.repeat_until || null,
          weekdays: formData.recurrence_type === 'weekdays' ? formData.weekdays : [],
        },
      };

      const saved = await onConflictSave(
        (ignoreConflicts) => {
          if (isEditMode) {
            return api.put(`/api/schedule/events/${editingEvent.id}`, {
              teacher_id: basePayload.teacher_id,
              discipline_id: basePayload.discipline_id,
              room_id: basePayload.room_id,
              start_time: basePayload.start_time,
              end_time: basePayload.end_time,
              type: basePayload.type,
              ignore_conflicts: ignoreConflicts,
            });
          }

          return api.post('/api/schedule/entries', {
            ...basePayload,
            ignore_conflicts: ignoreConflicts,
          });
        },
        isEditMode
          ? 'Сохранить изменения несмотря на конфликты?'
          : 'Сохранить серию занятий несмотря на конфликты?'
      );

      if (saved) {
        if (isEditMode) {
          await api.put(`/api/schedule/lessons/${editingEvent.lesson.id}`, {
            lesson_type: basePayload.lesson_type,
            max_students: basePayload.max_students,
            student_ids: basePayload.student_ids,
          });
        }
        await onLessonCreated();
        await onShowSuccess(isEditMode ? 'Занятие успешно изменено.' : 'Занятие успешно создано.');
        onClose();
      }
    } catch (error) {
      await onShowError(
        formatApiError(
          error.response?.data?.detail ||
            error.response?.data?.message ||
            (isEditMode ? 'Не удалось изменить занятие' : 'Не удалось создать занятие')
        )
      );
    }
  };

  if (!showModal) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '640px', maxHeight: '84vh', overflowY: 'auto' }}>
        <h3>{isEditMode ? 'Редактирование занятия' : 'Создание занятия'}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label>Дата:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Время начала:</label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              required
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            />
          </div>

          {isTeacherUser && (
            <div style={{ marginBottom: '15px' }}>
              <label>Преподаватель:</label>
              <div
                style={{
                  width: '100%',
                  padding: '8px',
                  marginTop: '5px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              >
                {currentTeacher
                  ? `${currentTeacher.user?.full_name || 'Без имени'}${
                      currentTeacher.specialization ? ` (${currentTeacher.specialization})` : ''
                    }`
                  : 'Преподаватель не найден'}
              </div>
            </div>
          )}

          <FieldSelect
            label="Тип"
            value={formData.type}
            onChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
            options={EVENT_TYPE_OPTIONS}
          />

          <FieldSelect
            label="Формат занятия"
            value={formData.lesson_type}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                lesson_type: value,
                max_students: value === 'group' ? Math.max(prev.max_students, 2) : 1,
                student_id: '',
                student_ids: [],
              }))
            }
            options={LESSON_TYPE_OPTIONS}
          />

          {formData.lesson_type === 'individual' && (
            <FieldSelect
              label="Ученик"
              value={formData.student_id}
              onChange={(value) => setFormData((prev) => ({ ...prev, student_id: value ? Number(value) : '' }))}
              options={[
                { value: '', label: 'Выберите ученика' },
                ...availableStudents.map((student) => ({ value: student.id, label: student.fio })),
              ]}
              required
            />
          )}

          {formData.lesson_type === 'group' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label>Количество учеников:</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={formData.max_students}
                  onChange={(e) => setFormData((prev) => ({ ...prev, max_students: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Поиск учеников:</label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Введите ФИО, телефон или email"
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Ученики:</label>
                <div style={{ border: '1px solid #ccc', marginTop: '5px', padding: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {!filteredStudents.length && (
                    <div>Нет доступных учеников для добавления в занятие.</div>
                  )}
                  {filteredStudents.map((student) => {
                    const checked = formData.student_ids.includes(student.id);
                    return (
                      <label key={student.id} style={{ display: 'block', marginBottom: '6px' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              student_ids: e.target.checked
                                ? [...prev.student_ids, student.id]
                                : prev.student_ids.filter((id) => id !== student.id),
                            }))
                          }
                        />{' '}
                        {student.fio}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {!isTeacherUser && <FieldSelect
            label="Преподаватель"
            value={formData.teacher_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, teacher_id: Number(value) }))}
            options={[
              { value: '', label: 'Выберите преподавателя' },
              ...teachers.map((teacher) => ({
                value: teacher.id,
                label: `${teacher.user?.full_name || 'Без имени'} (${teacher.specialization || '—'})`,
              })),
            ]}
            required
          />}

          <FieldSelect
            label="Дисциплина"
            value={formData.discipline_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, discipline_id: Number(value) }))}
            options={[
              { value: '', label: 'Выберите дисциплину' },
              ...localDisciplines.map((discipline) => ({ value: discipline.id, label: discipline.name })),
            ]}
            required
          />
          <button type="button" onClick={() => setShowDisciplineCreate((prev) => !prev)}>
            {showDisciplineCreate ? 'Отменить' : 'Добавить дисциплину'}
          </button>
          {showDisciplineCreate && (
            <div style={{ marginTop: '8px', marginBottom: '15px' }}>
              <input
                type="text"
                value={newDisciplineName}
                onChange={(e) => setNewDisciplineName(e.target.value)}
                placeholder="Название дисциплины"
                style={{ width: '100%', padding: '5px' }}
              />
              <button type="button" onClick={handleCreateDiscipline} style={{ marginTop: '5px' }}>
                Сохранить дисциплину
              </button>
            </div>
          )}

          <FieldSelect
            label="Кабинет"
            value={formData.room_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, room_id: Number(value) }))}
            options={[
              { value: '', label: 'Выберите кабинет' },
              ...localRooms.map((room) => ({ value: room.id, label: room.name })),
            ]}
            required
          />
          <button type="button" onClick={() => setShowRoomCreate((prev) => !prev)}>
            {showRoomCreate ? 'Отменить' : 'Добавить кабинет'}
          </button>
          {showRoomCreate && (
            <div style={{ marginTop: '8px', marginBottom: '15px' }}>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Название кабинета"
                style={{ width: '100%', padding: '5px' }}
              />
              <button type="button" onClick={handleCreateRoom} style={{ marginTop: '5px' }}>
                Сохранить кабинет
              </button>
            </div>
          )}

          <FieldSelect
            label="Длительность"
            value={formData.duration}
            onChange={(value) => setFormData((prev) => ({ ...prev, duration: Number(value) }))}
            options={durations.map((duration) => ({ value: duration, label: `${duration} мин` }))}
          />

          {!isEditMode && (
            <>
              <FieldSelect
                label="Повторяемость"
                value={formData.recurrence_type}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    recurrence_type: value,
                    repeat_until: value === 'none' ? '' : prev.repeat_until || selectedDate,
                    weekdays: value === 'weekdays' ? (prev.weekdays.length ? prev.weekdays : [new Date(`${selectedDate}T00:00:00`).getDay() === 0 ? 6 : new Date(`${selectedDate}T00:00:00`).getDay() - 1]) : [],
                  }))
                }
                options={RECURRENCE_OPTIONS}
              />

              {formData.recurrence_type !== 'none' && (
                <div style={{ marginBottom: '15px' }}>
                  <label>Повторять до:</label>
                  <input
                    type="date"
                    value={formData.repeat_until}
                    min={selectedDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, repeat_until: e.target.value }))}
                    style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                    required
                  />
                </div>
              )}

              {formData.recurrence_type === 'weekdays' && (
                <div style={{ marginBottom: '15px' }}>
                  <label>Дни недели:</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {WEEKDAY_OPTIONS.map((weekday) => (
                      <label key={weekday.value}>
                        <input
                          type="checkbox"
                          checked={formData.weekdays.includes(weekday.value)}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              weekdays: e.target.checked
                                ? [...prev.weekdays, weekday.value].sort((left, right) => left - right)
                                : prev.weekdays.filter((value) => value !== weekday.value),
                            }))
                          }
                        />{' '}
                        {weekday.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {isEditMode && editingEvent?.recurring?.repeat_type && editingEvent.recurring.repeat_type !== 'none' && (
            <div style={{ marginBottom: '15px', color: '#555' }}>
              Повторяемость серии здесь не меняется. Изменяется только выбранное занятие.
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Отмена</button>
            <button type="submit" style={{ backgroundColor: '#4CAF50', color: 'white', border: 'none', padding: '8px 16px' }}>
              {isEditMode ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalendarGrid;



