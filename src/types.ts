export const DOMAINS = ['Divine', 'Infernal', 'Faerie', 'Magic', 'Mundane'] as const
export const AURA_TYPES = ['Divine', 'Infernal', 'Faerie', 'Magic'] as const

export type Domain = (typeof DOMAINS)[number]
export type AuraType = (typeof AURA_TYPES)[number]
export type DisplayType = AuraType | 'Net Aura' | 'Dominant Aura'

export interface Location {
  id: string
  name: string
  description: string
  domain: Domain
  strength: number
  x: number
  y: number
}

export interface AuraSettings {
  r0: number
  threshold: number
  opacity: number
  metersPerPixel: number
  displayType: DisplayType
  contours: boolean
  showNames: boolean
}

export interface AuraGrid {
  width: number
  height: number
  values: Float32Array[]
  maxima: number[]
}

export interface ProjectFile {
  version: 1
  mapImage: string | null
  mapName: string
  mapWidth: number
  mapHeight: number
  locations: Location[]
  settings: AuraSettings
}

export const DOMAIN_COLORS: Record<Domain, string> = {
  Divine: '#3978c5',
  Infernal: '#e4514d',
  Faerie: '#38a77b',
  Magic: '#c34eae',
  Mundane: '#87918e',
}

export const AURA_COLORS: Record<AuraType, [number, number, number]> = {
  Divine: [55, 120, 197],
  Infernal: [228, 81, 77],
  Faerie: [56, 167, 123],
  Magic: [195, 78, 174],
}