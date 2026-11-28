// Contrast between colors, to keep text readable on the color of each person (WCAG 2).
const parse = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? [...clean].map((char) => char + char).join('') : clean
  const value = Number.parseInt(full, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const luminance = (hex: string): number => {
  const [red, green, blue] = parse(hex).map((channel) => {
    const unit = channel / 255
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export const contrastRatio = (first: string, second: string): number => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

// Black or white, whichever reads better on the given color: never below 4.5:1.
export const readableOn = (background: string): '#000000' | '#ffffff' =>
  contrastRatio(background, '#000000') >= contrastRatio(background, '#ffffff')
    ? '#000000'
    : '#ffffff'
