// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { layerBase, layerDepth, useLayer, withDepth } from './useLayer'

describe('useLayer', () => {
  it('keeps the open layer itself when nobody controls it', () => {
    const { result } = renderHook(() => useLayer({}))
    expect(result.current.current).toBeNull()
    act(() => result.current.open('date:Kitchen'))
    expect(result.current.current).toBe('date:Kitchen')
    act(() => result.current.close('date:Kitchen'))
    expect(result.current.current).toBeNull()
  })

  it('does not close a layer that was opened after the one it is asked to close', () => {
    const { result } = renderHook(() => useLayer({}))
    act(() => result.current.open('settle:0_Kitchen'))
    act(() => result.current.open('settle:0_Bathroom'))
    act(() => result.current.close('settle:0_Kitchen'))
    expect(result.current.current).toBe('settle:0_Bathroom')
  })

  it('lets the owner keep it: it reads the layer it is given and asks to open and close', () => {
    const onOpenLayer = vi.fn()
    const onCloseLayer = vi.fn()
    const { result } = renderHook(() =>
      useLayer({ layer: 'expense:new', onOpenLayer, onCloseLayer }),
    )
    expect(result.current.current).toBe('expense:new')
    result.current.open('expense:e1')
    result.current.close('expense:new')
    expect(onOpenLayer).toHaveBeenCalledWith('expense:e1')
    expect(onCloseLayer).toHaveBeenCalledWith('expense:new')
  })
})

describe('layers with steps', () => {
  it('reads the base and the depth of a layer, and builds one', () => {
    expect(layerBase('settle:0_Kitchen#2')).toBe('settle:0_Kitchen')
    expect(layerBase('date:Kitchen')).toBe('date:Kitchen')
    expect(layerBase(null)).toBeNull()
    expect(layerDepth('settle:0_Kitchen#2')).toBe(2)
    expect(layerDepth('settle:0_Kitchen')).toBe(0)
    expect(withDepth('settle:0_Kitchen', 3)).toBe('settle:0_Kitchen#3')
    expect(withDepth('settle:0_Kitchen', 0)).toBe('settle:0_Kitchen')
  })

  it('goes back one step, and closes the layer whatever its step', () => {
    const { result } = renderHook(() => useLayer({}))
    act(() => result.current.open('settle:0_Kitchen'))
    act(() => result.current.open('settle:0_Kitchen#1'))
    act(() => result.current.open('settle:0_Kitchen#2'))
    act(() => result.current.back('settle:0_Kitchen'))
    expect(result.current.current).toBe('settle:0_Kitchen#1')
    act(() => result.current.close('settle:0_Kitchen'))
    expect(result.current.current).toBeNull()
  })

  it('does not go back from the first step', () => {
    const { result } = renderHook(() => useLayer({}))
    act(() => result.current.open('settle:0_Kitchen'))
    act(() => result.current.back('settle:0_Kitchen'))
    expect(result.current.current).toBe('settle:0_Kitchen')
  })
})
