import React from 'react';

const getToneStyles = (tone) => {
  if (tone === 'error') {
    return {
      borderColor: '#c62828',
      titleColor: '#b71c1c',
      backgroundColor: 'white',
      panelColor: '#ffebee',
    };
  }

  if (tone === 'success') {
    return {
      borderColor: '#2e7d32',
      titleColor: '#1b5e20',
      backgroundColor: 'white',
      panelColor: '#e8f5e9',
    };
  }

  return {
    borderColor: '#ef6c00',
    titleColor: '#e65100',
    backgroundColor: 'white',
    panelColor: '#fff3e0',
  };
};

const ActionDialog = ({
  isOpen,
  title,
  message,
  tone = 'warning',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  showCancel = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) {
    return null;
  }

  const toneStyles = getToneStyles(tone);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: toneStyles.backgroundColor,
          padding: '30px',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          border: `1px solid ${toneStyles.borderColor}`,
        }}
      >
        <h2 style={{ marginBottom: '20px', color: toneStyles.titleColor }}>
          {title}
        </h2>

        <div
          style={{
            padding: '15px',
            marginBottom: '20px',
            border: `1px solid ${toneStyles.borderColor}`,
            backgroundColor: toneStyles.panelColor,
            textAlign: 'left',
            whiteSpace: 'pre-line',
          }}
        >
          {message}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                cursor: 'pointer',
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            style={{
              backgroundColor: tone === 'error' ? '#b71c1c' : tone === 'success' ? '#2e7d32' : '#ef6c00',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              cursor: 'pointer',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionDialog;
