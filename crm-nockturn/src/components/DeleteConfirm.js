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
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>
          Вы уверены, что хотите удалить {getItemTypeText()} "<strong>{getItemName()}</strong>"?
        </p>
        <p className="modal-warning">
          Это действие нельзя будет отменить.
        </p>
        
        <div className="modal-buttons">
          <button 
            onClick={onConfirm}
            className="btn btn-danger mr-10"
          >
            Да, удалить
          </button>
          <button 
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirm;
