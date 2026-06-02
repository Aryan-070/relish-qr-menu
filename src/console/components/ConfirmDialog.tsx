import { useTheme } from '../../theme/ThemeContext'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { tokens: t } = useTheme()
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={380}
      footer={
        <>
          <Button variant="subtle" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[14px] leading-relaxed" style={{ fontFamily: t.descFont, color: t.inkSoft }}>
        {message}
      </p>
    </Modal>
  )
}
