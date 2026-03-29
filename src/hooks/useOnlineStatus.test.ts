import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from './useOnlineStatus'

describe('useOnlineStatus', () => {
  beforeEach(() => {
    // Mock do navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deve retornar true quando online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('deve retornar false quando offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('deve atualizar para true ao receber evento online', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(false)

    // Simula evento online
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
  })

  it('deve atualizar para false ao receber evento offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(true)

    // Simula evento offline
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })
})
