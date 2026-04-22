import React from 'react';

const UserSuccessModal = ({ isOpen, onClose, user, generatedPassword, isEdit }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        textAlign: 'center',
        border: '1px solid #ccc'
      }}>
        <h2 style={{ marginBottom: '20px' }}>
          {isEdit ? 'Пользователь успешно обновлен!' : 'Пользователь успешно создан!'}
        </h2>
        
        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <p><strong>Логин:</strong> {user.login}</p>
          <p><strong>ФИО:</strong> {user.full_name || 'Не указано'}</p>
          <p><strong>Роль:</strong> {user.role}</p>
          <p><strong>Статус:</strong> {user.is_active ? 'Активный' : 'Заблокирован'}</p>
          <p><strong>Телефон:</strong> {user.phone ? `${user.phone}` : "Не указан"}</p>
        </div>

        {generatedPassword && (
          <div style={{
            padding: '15px',
            marginBottom: '20px',
            border: '1px solid #ccc'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>
              Сгенерированный пароль:
            </h3>
            <div style={{
              padding: '10px',
              wordBreak: 'break-all',
              border: '1px solid #ccc'
            }}>
              {generatedPassword}
            </div>
            <small style={{ display: 'block', marginTop: '8px' }}>
              Пароль показан единожды! Пожалуйста, сохраните пароль! 
            </small>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              cursor: 'pointer'
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSuccessModal;
