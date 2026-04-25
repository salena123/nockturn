import React, { useCallback, useMemo, useRef, useState } from 'react';
import ActionDialog from './ActionDialog';

const useActionDialog = () => {
  const resolverRef = useRef(null);
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    tone: 'warning',
    confirmText: 'ОК',
    cancelText: 'Отмена',
    showCancel: false,
  });

  const openDialog = useCallback((config) => new Promise((resolve) => {
    resolverRef.current = resolve;
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

  const showError = useCallback(
    (message, title = 'Ошибка') =>
      openDialog({
        title,
        message,
        tone: 'error',
        confirmText: 'Понятно',
      }),
    [openDialog]
  );

  const showSuccess = useCallback(
    (message, title = 'Готово') =>
      openDialog({
        title,
        message,
        tone: 'success',
        confirmText: 'ОК',
      }),
    [openDialog]
  );

  const showConfirm = useCallback(
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

  const handleConfirm = useCallback(() => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolve) {
      resolve(true);
    }
  }, []);

  const handleCancel = useCallback(() => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolve) {
      resolve(false);
    }
  }, []);

  const dialog = useMemo(
    () => (
      <ActionDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        tone={dialogState.tone}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        showCancel={dialogState.showCancel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [dialogState, handleCancel, handleConfirm]
  );

  return {
    dialog,
    showError,
    showSuccess,
    showConfirm,
  };
};

export default useActionDialog;
