import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmModal } from './ConfirmModal'

describe('ConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Confirmação',
    message: 'Deseja confirmar esta ação?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('não deve renderizar quando isOpen é false', () => {
    const { container } = render(
      <ConfirmModal {...defaultProps} isOpen={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('deve renderizar título e mensagem', () => {
    render(<ConfirmModal {...defaultProps} />)
    expect(screen.getByText('Confirmação')).toBeInTheDocument()
    expect(screen.getByText('Deseja confirmar esta ação?')).toBeInTheDocument()
  })

  it('deve chamar onCancel ao clicar em Cancelar', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Cancelar'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('deve chamar onConfirm ao clicar em Confirmar', () => {
    const onConfirm = vi.fn()
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByText('Confirmar'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('deve chamar onCancel ao clicar no X', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />)

    const closeButton = screen.getByRole('button', { name: '' })
    fireEvent.click(closeButton)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('deve mostrar labels customizados', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        confirmLabel="Sim, excluir"
        cancelLabel="Não, manter"
      />
    )
    expect(screen.getByText('Sim, excluir')).toBeInTheDocument()
    expect(screen.getByText('Não, manter')).toBeInTheDocument()
  })

  it('deve mostrar estado de loading', () => {
    render(<ConfirmModal {...defaultProps} loading={true} />)
    expect(screen.getByText('Processando...')).toBeInTheDocument()
    expect(screen.getByText('Processando...')).toBeDisabled()
    expect(screen.getByText('Cancelar')).toBeDisabled()
  })

  it('deve aplicar variantes de cor corretamente', () => {
    const { rerender } = render(<ConfirmModal {...defaultProps} confirmVariant="danger" />)
    expect(screen.getByText('Confirmar')).toHaveClass('bg-red-600')

    rerender(<ConfirmModal {...defaultProps} confirmVariant="warning" />)
    expect(screen.getByText('Confirmar')).toHaveClass('bg-orange-600')

    rerender(<ConfirmModal {...defaultProps} confirmVariant="primary" />)
    expect(screen.getByText('Confirmar')).toHaveClass('bg-blue-600')
  })
})
