import React, { useEffect, useState } from 'react';

import DeleteConfirm from '../components/DeleteConfirm';
import UserForm from '../components/UserForm';
import UserSuccessModal from '../components/UserSuccessModal';
import UserTable from '../components/UserTable';
import api from '../api';
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
  created_at: 'Дата создания',
  updated_at: 'Дата обновления',
};

const getRoleLabel = (roleName) => ROLE_LABELS[roleName] || roleName || '—';

const getDocumentTypeLabel = (documentType) =>
  DOCUMENT_TYPE_LABELS[documentType] || documentType || '—';

const getActionLabel = (action) => ACTION_LABELS[action] || action || '—';

const getFieldLabel = (fieldName) => FIELD_LABELS[fieldName] || fieldName || '—';

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

  if (typeof parsedValue === 'object' && parsedValue !== null && !Array.isArray(parsedValue)) {
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

  if (fieldName === 'document_type') {
    return getDocumentTypeLabel(parsedValue);
  }

  if (fieldName === 'file_path') {
    return getDocumentName(String(parsedValue));
  }

  if (fieldName === 'password') {
    return 'Скрыто';
  }

  if (fieldName === 'hire_date') {
    return formatServerDate(parsedValue);
  }

  if (fieldName === 'created_at' || fieldName === 'updated_at') {
    return formatServerDateTime(parsedValue);
  }

  if (typeof parsedValue === 'boolean') {
    return parsedValue ? 'Да' : 'Нет';
  }

  return String(parsedValue);
};

const Users = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
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
  const [archivePreviewUser, setArchivePreviewUser] = useState(null);

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
      setError(err.response?.data?.detail || 'Не удалось загрузить историю');
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

  const refreshDocuments = async (userId) => {
    const [documentsResponse, historyResponse] = await Promise.all([
      api.get(`/api/users/${userId}/documents`),
      api.get(`/api/users/${userId}/documents/history`),
    ]);
    setDocuments(documentsResponse.data);
    setDocumentHistory(historyResponse.data);
  };

  const refreshAll = async () => {
    await Promise.all([loadUsers(), loadRoles(), loadArchivedUsers()]);
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
      if (archivePreviewUser?.id === archivedUser.id) {
        setArchivePreviewUser(null);
      }
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось восстановить сотрудника из архива');
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
      if (archivePreviewUser?.original_user_id === deletingUser.id) {
        setArchivePreviewUser(null);
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

  const archiveSnapshot =
    archivePreviewUser && typeof tryParseJson(archivePreviewUser.snapshot_json) === 'object'
      ? tryParseJson(archivePreviewUser.snapshot_json)
      : null;

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
        onEdit={setEditingUser}
        onDelete={setDeletingUser}
        onToggleBlock={handleToggleBlock}
        onOpenHistory={loadUserHistory}
        onOpenDocuments={loadUserDocuments}
        onExport={handleExportUser}
      />

      {historyUser && (
        <div>
          <h3>История сотрудника: {historyUser.full_name || historyUser.login}</h3>
          {!historyItems.length ? (
            <div>История изменений пока пуста.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Кто изменил</th>
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item) => (
                  <tr key={item.id}>
                    <td>{formatServerDateTime(item.created_at)}</td>
                    <td>{getActorLabel(item)}</td>
                    <td>{getActionLabel(item.action)}</td>
                    <td>{getFieldLabel(item.field_name)}</td>
                    <td>{formatHistoryValue(item.old_value, item.field_name, roles)}</td>
                    <td>{formatHistoryValue(item.new_value, item.field_name, roles)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <th>ID</th>
                  <th>Тип</th>
                  <th>Файл</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>{document.id}</td>
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
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Кто изменил</th>
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {documentHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{formatServerDateTime(item.created_at)}</td>
                    <td>{getActorLabel(item)}</td>
                    <td>{getActionLabel(item.action)}</td>
                    <td>{getFieldLabel(item.field_name)}</td>
                    <td>{formatHistoryValue(item.old_value, item.field_name, roles)}</td>
                    <td>{formatHistoryValue(item.new_value, item.field_name, roles)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <th>ID</th>
                <th>Исходный ID</th>
                <th>Логин</th>
                <th>ФИО</th>
                <th>Роль</th>
                <th>Телефон</th>
                <th>Дата начала работы</th>
                <th>Кто архивировал</th>
                <th>Дата архивации</th>
                <th>Восстановление</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {archivedUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.original_user_id || '—'}</td>
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
                    </button>
                  </td>
                  <td>
                    <button type="button" onClick={() => setArchivePreviewUser(user)}>
                      Просмотреть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {archivePreviewUser && (
        <div>
          <h3>Архивная карточка сотрудника: {archivePreviewUser.full_name || archivePreviewUser.login}</h3>
          {!archiveSnapshot ? (
            <div>Снимок данных недоступен.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>Поле</th>
                  <th>Значение</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(archiveSnapshot).map(([key, value]) => (
                  <tr key={key}>
                    <td>{getFieldLabel(key)}</td>
                    <td>{formatHistoryValue(value, key, roles)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" onClick={() => setArchivePreviewUser(null)}>
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
