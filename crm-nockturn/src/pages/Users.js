import React, { useEffect, useState } from 'react';

import DeleteConfirm from '../components/DeleteConfirm';
import UserForm from '../components/UserForm';
import UserTable from '../components/UserTable';
import UserSuccessModal from '../components/UserSuccessModal';
import api from '../api';


const EMPTY_DOCUMENT_FORM = {
  document_type: 'employment_contract',
  file_path: '',
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
  const [historyUser, setHistoryUser] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [documentsUser, setDocumentsUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentHistory, setDocumentHistory] = useState([]);
  const [documentForm, setDocumentForm] = useState(EMPTY_DOCUMENT_FORM);
  const [editingDocumentId, setEditingDocumentId] = useState(null);

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

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    await Promise.all([loadUsers(), loadRoles(), loadArchivedUsers()]);
    setLoading(false);
  };

  useEffect(() => {
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

  const handleUserCreated = async () => {
    await loadAllData();
    setEditingUser(null);
  };

  const handleUserUpdated = async () => {
    await loadAllData();
    setEditingUser(null);
  };

  const handleUserSuccess = (userData, generatedPassword, isEdit) => {
    setSuccessUserData(userData);
    setSuccessPassword(generatedPassword);
    setIsEditMode(isEdit);
    setSuccessModalOpen(true);
  };

  const handleToggleBlock = async (user) => {
    try {
      const endpoint = user.is_active
        ? `/api/users/${user.id}/block`
        : `/api/users/${user.id}/unblock`;
      await api.post(endpoint);
      await loadAllData();
      if (historyUser?.id === user.id) {
        await loadUserHistory(user);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка изменения статуса пользователя');
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
      await loadAllData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка удаления пользователя');
    }
  };

  const handleDocumentSubmit = async (event) => {
    event.preventDefault();
    if (!documentsUser) {
      return;
    }

    try {
      const payload = {
        user_id: documentsUser.id,
        document_type: documentForm.document_type,
        file_path: documentForm.file_path,
      };

      if (editingDocumentId) {
        await api.put(`/api/user-documents/${editingDocumentId}`, payload);
      } else {
        await api.post(`/api/users/${documentsUser.id}/documents`, payload);
      }

      setDocumentForm(EMPTY_DOCUMENT_FORM);
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

  if (currentUser?.role === 'teacher') {
    return <div>Раздел сотрудников доступен только администратору.</div>;
  }

  if (loading) {
    return <div>Загрузка сотрудников...</div>;
  }

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
        users={users}
        currentUser={currentUser}
        onEdit={setEditingUser}
        onDelete={setDeletingUser}
        onToggleBlock={handleToggleBlock}
        onOpenHistory={loadUserHistory}
        onOpenDocuments={loadUserDocuments}
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
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at || ''}</td>
                    <td>{item.action || ''}</td>
                    <td>{item.field_name || ''}</td>
                    <td>{item.old_value || ''}</td>
                    <td>{item.new_value || ''}</td>
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
                <input
                  type="text"
                  value={documentForm.document_type}
                  onChange={(event) =>
                    setDocumentForm((prev) => ({ ...prev, document_type: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <div>
              <label>
                Путь к файлу
                <br />
                <input
                  type="text"
                  value={documentForm.file_path}
                  onChange={(event) =>
                    setDocumentForm((prev) => ({ ...prev, file_path: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <button type="submit">
              {editingDocumentId ? 'Сохранить документ' : 'Добавить документ'}
            </button>{' '}
            <button
              type="button"
              onClick={() => {
                setDocumentForm(EMPTY_DOCUMENT_FORM);
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
                  <th>Путь</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>{document.id}</td>
                    <td>{document.document_type}</td>
                    <td>{document.file_path}</td>
                    <td>{document.created_at || ''}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDocumentId(document.id);
                          setDocumentForm({
                            document_type: document.document_type || '',
                            file_path: document.file_path || '',
                          });
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
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {documentHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at || ''}</td>
                    <td>{item.action || ''}</td>
                    <td>{item.field_name || ''}</td>
                    <td>{item.old_value || ''}</td>
                    <td>{item.new_value || ''}</td>
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
                <th>Телефон</th>
                <th>Дата архивации</th>
              </tr>
            </thead>
            <tbody>
              {archivedUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.original_user_id || ''}</td>
                  <td>{user.login}</td>
                  <td>{user.full_name || ''}</td>
                  <td>{user.phone || ''}</td>
                  <td>{user.archived_at || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
        onClose={() => setSuccessModalOpen(false)}
        user={successUserData}
        generatedPassword={successPassword}
        isEdit={isEditMode}
      />
    </div>
  );
};


export default Users;
