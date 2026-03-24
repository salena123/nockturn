import React from 'react';

const DeleteConfirm = ({ item, itemType, onConfirm, onCancel }) => {
  const getItemName = () => {
    if (itemType === 'user') {
      return item.email;
    } else if (itemType === 'student') {
      return item.fio;
    }
    return '';
  };

  const getItemTypeText = () => {
    if (itemType === 'user') {
      return 'пользователя';
    } else if (itemType === 'student') {
      return 'ученика';
    }
    return '';
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      padding: '20px',
      backgroundColor: 'white',
      border: '2px solid #ccc',
      borderRadius: '8px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
      zIndex: 1000
    }}>
      <h3>Подтверждение удаления</h3>
      <p>
        Вы уверены, что хотите удалить {getItemTypeText()} "<strong>{getItemName()}</strong>"?
      </p>
      <p style={{ color: 'red', fontSize: '14px' }}>
        Это действие нельзя будет отменить.
      </p>
      
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={onConfirm}
          style={{
            marginRight: '10px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Удалить
        </button>
        <button 
          onClick={onCancel}
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
};

export default DeleteConfirm;
