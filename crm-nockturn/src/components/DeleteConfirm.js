import React from 'react';


const DeleteConfirm = ({ item, itemType, onConfirm, onCancel }) => {
  const getItemName = () => {
    switch (itemType) {
      case 'user':
        return item.login;
      case 'student':
        return item.fio;
      case 'tariff':
        return item.name;
      case 'discount':
        return item.name;
      case 'subscription':
        return `с учеником ${item.student_name || item.id}`;
      default:
        return item.name || item.fio || item.login || 'item';
    }
  };

  const getItemTypeText = () => {
    switch (itemType) {
      case 'user':
        return 'сотрудника';
      case 'student':
        return 'ученика';
      case 'tariff':
        return 'тариф';
      case 'discount':
        return 'скидку';
      case 'subscription':
        return 'договор';
      default:
        return 'item';
    }
  };

  const itemName = getItemName();
  const itemTypeText = getItemTypeText();

  return (
    <div>
      <h3>Подтверждение удаления</h3>
      <p>
        Вы уверены, что хотите удалить {itemTypeText} <strong>{itemName}</strong>?
      </p>

      <button type="button" onClick={onConfirm}>
        Да, удалить
      </button>{' '}
      <button type="button" onClick={onCancel}>
        Отмена
      </button>
    </div>
  );
};


export default DeleteConfirm;
