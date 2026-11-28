import { useState } from 'react'

// A form or dialog that is opened on top of a screen is a "layer". A screen can let its owner keep the
// open layer (so the back button can close it) or, without props, keep it itself.
//
// A layer can have steps (a wizard): its name is the base, and the step is a depth at the end, `base#2`.
// Every step is a place in the history, so the back button of the phone goes back one step, and closing
// the layer leaves all of them at once.
export interface LayerProps {
  // The layer that is open, or null. Leave it out to let the component keep it.
  layer?: string | null
  onOpenLayer?: (layer: string) => void
  // Closes the layer of that base if it is still the one open: a slow save must not close what was
  // opened after it
  onCloseLayer?: (layer: string) => void
  // Goes back one step of that layer (like the back button of the phone)
  onBackLayer?: (layer: string) => void
}

// The name of the layer without its step
export const layerBase = (layer: string | null): string | null =>
  layer === null ? null : layer.split('#')[0]

// How many steps deep the layer is: 0 for the first one
export const layerDepth = (layer: string | null): number => {
  const match = layer?.match(/#(\d+)$/)
  return match ? Number(match[1]) : 0
}

export const withDepth = (base: string, depth: number): string =>
  depth > 0 ? `${base}#${depth}` : base

export const useLayer = ({ layer, onOpenLayer, onCloseLayer, onBackLayer }: LayerProps) => {
  const [own, setOwn] = useState<string | null>(null)
  const controlled = layer !== undefined
  return {
    current: controlled ? layer : own,
    open: (next: string) => (controlled ? onOpenLayer?.(next) : setOwn(next)),
    close: (id: string) =>
      controlled
        ? onCloseLayer?.(id)
        : setOwn((open) => (layerBase(open) === layerBase(id) ? null : open)),
    back: (id: string) =>
      controlled
        ? onBackLayer?.(id)
        : setOwn((open) =>
            layerBase(open) === layerBase(id) && layerDepth(open) > 0
              ? withDepth(layerBase(open) as string, layerDepth(open) - 1)
              : open,
          ),
  }
}
