import React, { useEffect, useState } from 'react';

import api from '../api';
import DeleteConfirm from '../components/DeleteConfirm';
import UserForm from '../components/UserForm';
import UserSuccessModal from '../components/UserSuccessModal';
import UserTable from '../components/UserTable';
import { formatServerDate, formatServerDateTime } from '../utils/dateTime';


const EMPTY_DOCUMENT_FORM = {
  document_type: 'employment_contract',
};

const ROLE_LABELS = {
  admin: 'Администратор',
  teacher: 'Преподаватель',
  superadmin: 'Суперадминистратор',
};

const DOCUMENT_TYPE_LABELS = {
  employment_contract: 'Договор найма',
  contract_scan: 'Скан договора',
  passport_scan: 'Скан паспорта',
  other: 'Другой документ',
};

const ACTION_LABELS = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  reset_password: 'Сброс пароля',
  block: 'Блокировка',
  unblock: 'Разблокировка',
  restore: 'Восстановление',
};

const ARCHIVED_CONTEXT_LABELS = {
  performed_action: 'Действия сотрудника',
  account_history: 'История учетной записи',
  document_history: 'История документов',
};

const FIELD_LABELS = {
  id: 'ID',
  login: 'Логин',
  full_name: 'ФИО',
  phone: 'Телефон',
  role_id: 'Роль',
  is_active: 'Активность',
  hire_date: 'Дата начала работы',
  password: 'Пароль',
  document_type: 'Тип документа',
  file_path: 'Файл',
  consent_received: 'Согласие на обработку ПДн',
  consent_received_at: 'Дата получения согласия',
  created_at: 'Дата создания',
  updated_at: 'Дата обновления',
  archived_context: 'Раздел архива',
  teacher_profile: 'Профиль преподавателя',
  documents: 'Документы',
};

const getRoleLabel = (roleName) => ROLE_LABELS[roleName] || roleName || '—';
const getDocumentTypeLabel = (documentType) =>
  DOCUMENT_TYPE_LABELS[documentType] || documentType || '—';
const getActionLabel = (action) => ACTION_LABELS[action] || action || '—';
const getFieldLabel = (fieldName) => FIELD_LABELS[fieldName] || fieldName || '—';
const getArchivedContextLabel = (value) => ARCHIVED_CONTEXT_LABELS[value] || value || '—';
const getActorLabel = (item) => item?.actor_user_name || 'Система';

const getDocumentName = (filePath) => {
  if (!filePath) {
    return 'Файл не указан';
  }
  const normalizedPath = String(filePath).replaceAll('\\', '/');
  return normalizedPath.split('/').pop() || normalizedPath;
};

const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const tryParseJson = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const formatHistoryValue = (value, fieldName, roles) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const parsedValue = tryParseJson(value);

  if (Array.isArray(parsedValue)) {
    return parsedValue
      .map((item) => formatHistoryValue(item, fieldName, roles))
      .join('; ');
  }

  if (typeof parsedValue === 'object' && parsedValue !== null) {
    return Object.entries(parsedValue)
      .map(([key, nestedValue]) => `${getFieldLabel(key)}: ${formatHistoryValue(nestedValue, key, roles)}`)
      .join('; ');
  }

  if (fieldName === 'role_id') {
    const role = roles.find((item) => item.id === Number(parsedValue));
    return getRoleLabel(role?.name || parsedValue);
  }

  if (fieldName === 'is_active') {
    if (parsedValue === true || parsedValue === 'true') {
      return 'Активна';
    }
    if (parsedValue === false || parsedValue === 'false') {
      return 'Заблокирована';
    }
  }

  if (fieldName === 'consent_received') {
    if (parsedValue === true || parsedValue === 'true') {
      return 'Да';
    }
    if (parsedValue === false || parsedValue === 'false') {
      return 'Нет';
    }
  }

  if (fieldName === 'document_type') {
    return getDocumentTypeLabel(parsedValue);
  }

  if (fieldName === 'file_path') {
    return getDocumentName(String(parsedValue));
  }

  if (fieldName === 'archived_context') {
    return getArchivedContextLabel(parsedValue);
  }

  if (fieldName === 'password') {
    return 'Скрыто';
  }

  if (fieldName === 'hire_date') {
    return formatServerDate(parsedValue);
  }

  if (fieldName === 'consent_received_at' || fieldName === 'created_at' || fieldName === 'updated_at') {
    return formatServerDateTime(parsedValue);
  }

  if (typeof parsedValue === 'boolean') {
    return parsedValue ? 'Да' : 'Нет';
  }

  return String(parsedValue);
};

const renderKeyValueTable = (entries, roles) => (
  <table border="1" cellPadding="6" cellSpacing="0">
    <thead>
      <tr>
        <th>Поле</th>
        <th>Значение</th>
      </tr>
    </thead>
    <tbody>
      {entries.map(([key, value]) => (
        <tr key={key}>
          <td>{getFieldLabel(key)}</td>
          <td>{formatHistoryValue(value, key, roles)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const renderHistoryTable = (items, roles, withContext = false) => (
  <table border="1" cellPadding="6" cellSpacing="0">
    <thead>
      <tr>
        <th>Дата</th>
        <th>Кто изменил</th>
        {withContext && <th>Раздел</th>}
        <th>Действие</th>
        <th>Поле</th>
        <th>Было</th>
        <th>Стало</th>
        <th>IP</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item) => (
        <tr key={`${item.id}-${item.created_at}`}>
          <td>{formatServerDateTime(item.created_at)}</td>
          <td>{getActorLabel(item)}</td>
          {withContext && <td>{getArchivedContextLabel(item.archived_context)}</td>}
          <td>{getActionLabel(item.action)}</td>
          <td>{getFieldLabel(item.field_name)}</td>
          <td>{formatHistoryValue(item.old_value, item.field_name, roles)}</td>
          <td>{formatHistoryValue(item.new_value, item.field_name, roles)}</td>
          <td>{item.ip_address || '—'}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const Users = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [archiveDeletingUser, setArchiveDeletingUser] = useState(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successUserData, setSuccessUserData] = useState(null);
  const [successPassword, setSuccessPassword] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [successTitle, setSuccessTitle] = useState('');
  const [historyUser, setHistoryUser] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [documentsUser, setDocumentsUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentHistory, setDocumentHistory] = useState([]);
  const [documentForm, setDocumentForm] = useState(EMPTY_DOCUMENT_FORM);
  const [documentFile, setDocumentFile] = useState(null);
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [archivePreview, setArchivePreview] = useState(null);
  const [userCard, setUserCard] = useState(null);

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить сотрудников');
    }
  };

  const loadRoles = async () => {
    try {
      const response = await api.get('/api/roles');
      setRoles(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить роли');
    }
  };

  const loadArchivedUsers = async () => {
    try {
      const response = await api.get('/api/archived-users');
      setArchivedUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить архив сотрудников');
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadUsers(), loadRoles(), loadArchivedUsers()]);
  };

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      setError('');
      await Promise.all([loadUsers(), loadRoles(), loadArchivedUsers()]);
      setLoading(false);
    };

    loadAllData();
  }, []);

  const loadUserHistory = async (user) => {
    try {
      const response = await api.get(`/api/users/${user.id}/history`);
      setHistoryUser(user);
      setHistoryItems(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить историю сотрудника');
    }
  };

  const loadUserDocuments = async (user) => {
    try {
      const [documentsResponse, historyResponse] = await Promise.all([
        api.get(`/api/users/${user.id}/documents`),
        api.get(`/api/users/${user.id}/documents/history`),
      ]);
      setDocumentsUser(user);
      setDocuments(documentsResponse.data);
      setDocumentHistory(historyResponse.data);
      setDocumentForm(EMPTY_DOCUMENT_FORM);
      setDocumentFile(null);
      setEditingDocumentId(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить документы сотрудника');
    }
  };

  const loadUserCard = async (user) => {
    try {
      const response = await api.get(`/api/users/${user.id}/card`);
      setUserCard(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить карточку сотрудника');
    }
  };

  const loadArchivedUserDetail = async (archivedUser) => {
    try {
      const response = await api.get(`/api/archived-users/${archivedUser.id}`);
      setArchivePreview(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить архивную карточку сотрудника');
    }
  };

  const refreshDocuments = async (userId) => {
    const [documentsResponse, historyResponse] = await Promise.all([
      api.get(`/api/users/${userId}/documents`),
      api.get(`/api/users/${userId}/documents/history`),
    ]);
    setDocuments(documentsResponse.data);
    setDocumentHistory(historyResponse.data);
  };

  const handleUserCreated = async () => {
    await refreshAll();
    setEditingUser(null);
  };

  const handleUserUpdated = async () => {
    await refreshAll();
    setEditingUser(null);
  };

  const handleUserSuccess = (userData, generatedPassword, isEdit) => {
    setSuccessUserData(userData);
    setSuccessPassword(generatedPassword);
    setIsEditMode(isEdit);
    setSuccessTitle('');
    setSuccessModalOpen(true);
  };

  const handleRestoreArchivedUser = async (archivedUser) => {
    try {
      const response = await api.post(`/api/archived-users/${archivedUser.id}/restore`);
      const restoredUser = response.data.user;
      setSuccessUserData({
        login: restoredUser.login,
        full_name: restoredUser.full_name,
        phone: restoredUser.phone,
        role: getRoleLabel(restoredUser.role),
        is_active: restoredUser.is_active,
      });
      setSuccessPassword(response.data.generated_password || '');
      setIsEditMode(false);
      setSuccessTitle('Сотрудник успешно восстановлен!');
      setSuccessModalOpen(true);
      if (archivePreview?.archive?.id === archivedUser.id) {
        setArchivePreview(null);
      }
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось восстановить сотрудника из архива');
    }
  };

  const handlePermanentArchiveDelete = async () => {
    if (!archiveDeletingUser) {
      return;
    }

    try {
      await api.delete(`/api/archived-users/${archiveDeletingUser.id}`);
      if (archivePreview?.archive?.id === archiveDeletingUser.id) {
        setArchivePreview(null);
      }
      setArchiveDeletingUser(null);
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить архивную запись сотрудника');
    }
  };

  const handleToggleBlock = async (user) => {
    try {
      const endpoint = user.is_active
        ? `/api/users/${user.id}/block`
        : `/api/users/${user.id}/unblock`;
      await api.post(endpoint);
      await refreshAll();
      if (historyUser?.id === user.id) {
        await loadUserHistory(user);
      }
      if (documentsUser?.id === user.id) {
        await loadUserDocuments(user);
      }
      if (userCard?.user?.id === user.id) {
        await loadUserCard(user);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка изменения статуса сотрудника');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/users/${deletingUser.id}`);
      setDeletingUser(null);
      if (historyUser?.id === deletingUser.id) {
        setHistoryUser(null);
        setHistoryItems([]);
      }
      if (documentsUser?.id === deletingUser.id) {
        setDocumentsUser(null);
        setDocuments([]);
        setDocumentHistory([]);
      }
      if (userCard?.user?.id === deletingUser.id) {
        setUserCard(null);
      }
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка удаления сотрудника');
    }
  };

  const handleExportUser = async (user) => {
    try {
      const response = await api.get(`/api/users/${user.id}/export/xlsx`, {
        responseType: 'blob',
      });
      triggerDownload(response.data, `employee_${user.id}.xlsx`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось экспортировать сотрудника');
    }
  };

  const handleDocumentSubmit = async (event) => {
    event.preventDefault();
    if (!documentsUser) {
      return;
    }

    try {
      if (editingDocumentId) {
        if (documentFile) {
          const formData = new FormData();
          formData.append('document_type', documentForm.document_type);
          formData.append('file', documentFile);
          await api.put(`/api/user-documents/${editingDocumentId}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else {
          await api.put(`/api/user-documents/${editingDocumentId}`, {
            document_type: documentForm.document_type,
          });
        }
      } else {
        if (!documentFile) {
          setError('Для нового документа нужно выбрать файл');
          return;
        }
        const formData = new FormData();
        formData.append('document_type', documentForm.document_type);
        formData.append('file', documentFile);
        await api.post(`/api/users/${documentsUser.id}/documents/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setDocumentForm(EMPTY_DOCUMENT_FORM);
      setDocumentFile(null);
      setEditingDocumentId(null);
      await refreshDocuments(documentsUser.id);
      if (userCard?.user?.id === documentsUser.id) {
        await loadUserCard(documentsUser);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить документ');
    }
  };

  const handleDocumentDelete = async (documentId) => {
    if (!documentsUser) {
      return;
    }

    try {
      await api.delete(`/api/user-documents/${documentId}`);
      await refreshDocuments(documentsUser.id);
      if (userCard?.user?.id === documentsUser.id) {
        await loadUserCard(documentsUser);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить документ');
    }
  };

  const handleDocumentDownload = async (document) => {
    try {
      const response = await api.get(`/api/user-documents/${document.id}/download`, {
        responseType: 'blob',
      });
      triggerDownload(response.data, getDocumentName(document.file_path));
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось скачать документ');
    }
  };

  if (currentUser?.role === 'teacher') {
    return <div>Раздел сотрудников доступен только администратору.</div>;
  }

  if (loading) {
    return <div>Загрузка сотрудников...</div>;
  }

  const usersForDisplay = users.map((user) => ({
    ...user,
    role_label: getRoleLabel(user.role),
  }));

  const archiveSnapshot = archivePreview?.snapshot || null;
  const archiveActions = archivePreview?.actions || [];

  return (
    <div>
      <h2>Сотрудники</h2>

      {error && <div>{error}</div>}

      <button type="button" onClick={() => setEditingUser({})}>
        Добавить сотрудника
      </button>

      {editingUser !== null && (
        <UserForm
          user={editingUser}
          roles={roles}
          currentUser={currentUser}
          onUserCreated={handleUserCreated}
          onUserUpdated={handleUserUpdated}
          onUserSuccess={handleUserSuccess}
          onCancel={() => setEditingUser(null)}
        />
      )}

      <UserTable
        users={usersForDisplay}
        currentUser={currentUser}
        onOpenCard={loadUserCard}
        onEdit={setEditingUser}
        onDelete={setDeletingUser}
        onToggleBlock={handleToggleBlock}
        onOpenHistory={loadUserHistory}
        onOpenDocuments={loadUserDocuments}
        onExport={handleExportUser}
      />

      {userCard && (
        <div>
          <h3>Карточка сотрудника: {userCard.user.full_name || userCard.user.login}</h3>
          {renderKeyValueTable(
            Object.entries({
              id: userCard.user.id,
              login: userCard.user.login,
              full_name: userCard.user.full_name,
              phone: userCard.user.phone,
              role_id: userCard.user.role_id,
              is_active: userCard.user.is_active,
              hire_date: userCard.user.hire_date,
              consent_received: userCard.user.consent_received,
              consent_received_at: userCard.user.consent_received_at,
              created_at: userCard.user.created_at,
              updated_at: userCard.user.updated_at,
            }),
            roles,
          )}

          {userCard.teacher_profile && (
            <div>
              <h4>Профиль преподавателя</h4>
              {renderKeyValueTable(Object.entries(userCard.teacher_profile), roles)}
            </div>
          )}

          <h4>Документы сотрудника</h4>
          {!userCard.documents.length ? (
            <div>Документы пока не добавлены.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Тип</th>
                  <th>Файл</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {userCard.documents.map((document, index) => (
                  <tr key={document.id}>
                    <td>{index + 1}</td>
                    <td>{getDocumentTypeLabel(document.document_type)}</td>
                    <td>{getDocumentName(document.file_path)}</td>
                    <td>{formatServerDateTime(document.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4>История учетной записи</h4>
          {!userCard.history.length ? (
            <div>История изменений пока пуста.</div>
          ) : (
            renderHistoryTable(userCard.history, roles)
          )}

          <h4>История документов</h4>
          {!userCard.document_history.length ? (
            <div>История документов пока пуста.</div>
          ) : (
            renderHistoryTable(userCard.document_history, roles)
          )}

          <h4>Действия сотрудника по системе</h4>
          {!userCard.activity.length ? (
            <div>Действия сотрудника пока не зафиксированы.</div>
          ) : (
            renderHistoryTable(userCard.activity, roles)
          )}

          <button type="button" onClick={() => setUserCard(null)}>
            Закрыть карточку
          </button>
        </div>
      )}

      {historyUser && (
        <div>
          <h3>История сотрудника: {historyUser.full_name || historyUser.login}</h3>
          {!historyItems.length ? (
            <div>История изменений пока пуста.</div>
          ) : (
            renderHistoryTable(historyItems, roles)
          )}
          <button type="button" onClick={() => setHistoryUser(null)}>
            Закрыть историю
          </button>
        </div>
      )}

      {documentsUser && (
        <div>
          <h3>Документы сотрудника: {documentsUser.full_name || documentsUser.login}</h3>

          <form onSubmit={handleDocumentSubmit}>
            <div>
              <label>
                Тип документа
                <br />
                <select
                  value={documentForm.document_type}
                  onChange={(event) =>
                    setDocumentForm((prev) => ({ ...prev, document_type: event.target.value }))
                  }
                >
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                Файл договора или скана
                <br />
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
                />
              </label>
              {editingDocumentId && !documentFile && (
                <div>Если файл менять не нужно, можно сохранить только тип документа.</div>
              )}
            </div>

            <button type="submit">
              {editingDocumentId ? 'Сохранить документ' : 'Добавить документ'}
            </button>{' '}
            <button
              type="button"
              onClick={() => {
                setDocumentForm(EMPTY_DOCUMENT_FORM);
                setDocumentFile(null);
                setEditingDocumentId(null);
              }}
            >
              Сбросить
            </button>
          </form>

          {!documents.length ? (
            <div>Документы пока не добавлены.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Тип</th>
                  <th>Файл</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document, index) => (
                  <tr key={document.id}>
                    <td>{index + 1}</td>
                    <td>{getDocumentTypeLabel(document.document_type)}</td>
                    <td>{getDocumentName(document.file_path)}</td>
                    <td>{formatServerDateTime(document.created_at)}</td>
                    <td>
                      <button type="button" onClick={() => handleDocumentDownload(document)}>
                        Скачать
                      </button>{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDocumentId(document.id);
                          setDocumentForm({
                            document_type: document.document_type || EMPTY_DOCUMENT_FORM.document_type,
                          });
                          setDocumentFile(null);
                        }}
                      >
                        Редактировать
                      </button>{' '}
                      <button type="button" onClick={() => handleDocumentDelete(document.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4>История документов</h4>
          {!documentHistory.length ? (
            <div>История документов пока пуста.</div>
          ) : (
            renderHistoryTable(documentHistory, roles)
          )}

          <button type="button" onClick={() => setDocumentsUser(null)}>
            Закрыть документы
          </button>
        </div>
      )}

      <div>
        <h3>Архив сотрудников</h3>
        {!archivedUsers.length ? (
          <div>Архив пока пуст.</div>
        ) : (
          <table border="1" cellPadding="6" cellSpacing="0">
            <thead>
              <tr>
                <th>№</th>
                <th>Логин</th>
                <th>ФИО</th>
                <th>Роль</th>
                <th>Телефон</th>
                <th>Дата начала работы</th>
                <th>Кто архивировал</th>
                <th>Дата архивации</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {archivedUsers.map((user, index) => (
                <tr key={user.id}>
                  <td>{index + 1}</td>
                  <td>{user.login}</td>
                  <td>{user.full_name || '—'}</td>
                  <td>{getRoleLabel(user.role_name)}</td>
                  <td>{user.phone || '—'}</td>
                  <td>{formatServerDate(user.hire_date)}</td>
                  <td>{user.archived_by_name || 'Система'}</td>
                  <td>{formatServerDateTime(user.archived_at)}</td>
                  <td>
                    <button type="button" onClick={() => handleRestoreArchivedUser(user)}>
                      Восстановить
                    </button>{' '}
                    <button type="button" onClick={() => loadArchivedUserDetail(user)}>
                      Просмотреть
                    </button>{' '}
                    <button type="button" onClick={() => setArchiveDeletingUser(user)}>
                      Удалить навсегда
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {archivePreview && (
        <div>
          <h3>
            Архивная карточка сотрудника:{' '}
            {archivePreview.archive.full_name || archivePreview.archive.login}
          </h3>

          {!archiveSnapshot ? (
            <div>Снимок данных недоступен.</div>
          ) : (
            renderKeyValueTable(Object.entries(archiveSnapshot), roles)
          )}

          <h4>Архив действий сотрудника</h4>
          {!archiveActions.length ? (
            <div>Архив действий пока пуст.</div>
          ) : (
            renderHistoryTable(archiveActions, roles, true)
          )}

          <button type="button" onClick={() => setArchivePreview(null)}>
            Закрыть архивную карточку
          </button>
        </div>
      )}

      {deletingUser && (
        <DeleteConfirm
          item={deletingUser}
          itemType="user"
          onConfirm={handleDelete}
          onCancel={() => setDeletingUser(null)}
        />
      )}

      {archiveDeletingUser && (
        <DeleteConfirm
          item={archiveDeletingUser}
          itemType="user"
          title="Безвозвратное удаление из архива"
          message={
            <>
              Вы уверены, что хотите безвозвратно удалить архивную запись сотрудника{' '}
              <strong>{archiveDeletingUser.login}</strong> вместе с архивом его действий?
            </>
          }
          confirmLabel="Да, удалить навсегда"
          onConfirm={handlePermanentArchiveDelete}
          onCancel={() => setArchiveDeletingUser(null)}
        />
      )}

      <UserSuccessModal
        isOpen={successModalOpen}
        onClose={() => {
          setSuccessModalOpen(false);
          setSuccessTitle('');
        }}
        user={successUserData}
        generatedPassword={successPassword}
        isEdit={isEditMode}
        title={successTitle}
      />
    </div>
  );
};


export default Users;
