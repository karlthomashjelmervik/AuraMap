import { AURA_TYPES, type AuraGrid, type AuraType, type Location } from './types'

const domainIndex = new Map<string, number>(AURA_TYPES.map((type, index) => [type, index]))

export function calculateAuraAt(
  x: number,
  y: number,
  locations: Location[],
  r0: number,
  metersPerPixel: number,
): number[] {
  const values = [0, 0, 0, 0]
  const scaleSquared = Math.max(r0, 0.001) ** 2
  for (const location of locations) {
    const sourceIndex = domainIndex.get(location.domain)
    if (sourceIndex === undefined) continue
    const dx = (x - location.x) * metersPerPixel
    const dy = (y - location.y) * metersPerPixel
    const contribution = location.strength / ((dx * dx + dy * dy) / scaleSquared + 1)
    for (let index = 0; index < values.length; index += 1) {
      values[index] += index === sourceIndex ? contribution : -contribution
    }
  }
  return values
}

export function calculateAuraGrid(
  mapWidth: number,
  mapHeight: number,
  locations: Location[],
  r0: number,
  metersPerPixel: number,
): AuraGrid {
  const maxGridWidth = 420
  const scale = Math.min(1, maxGridWidth / mapWidth, 300 / mapHeight)
  const width = Math.max(1, Math.ceil(mapWidth * scale))
  const height = Math.max(1, Math.ceil(mapHeight * scale))
  const values = AURA_TYPES.map(() => new Float32Array(width * height))
  const maxima = [0, 0, 0, 0]
  const activeLocations = locations.filter((location) => domainIndex.has(location.domain))
  const scaleSquared = Math.max(r0, 0.001) ** 2

  for (let row = 0; row < height; row += 1) {
    const y = ((row + 0.5) * mapHeight) / height
    for (let column = 0; column < width; column += 1) {
      const x = ((column + 0.5) * mapWidth) / width
      const pixel = row * width + column
      for (const location of activeLocations) {
        const sourceIndex = domainIndex.get(location.domain)!
        const dx = (x - location.x) * metersPerPixel
        const dy = (y - location.y) * metersPerPixel
        const contribution = location.strength / ((dx * dx + dy * dy) / scaleSquared + 1)
        for (let index = 0; index < 4; index += 1) {
          const value = values[index][pixel] + (index === sourceIndex ? contribution : -contribution)
          values[index][pixel] = value
          maxima[index] = Math.max(maxima[index], Math.abs(value))
        }
      }
    }
  }
  return { width, height, values, maxima }
}

export function strongestAura(values: number[]): { type: AuraType; value: number } {
  let index = 0
  for (let candidate = 1; candidate < values.length; candidate += 1) {
    if (values[candidate] > values[index]) index = candidate
  }
  return { type: AURA_TYPES[index], value: values[index] }
}