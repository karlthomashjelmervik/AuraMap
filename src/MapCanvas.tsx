import { useEffect, useRef } from 'react'
import { AURA_COLORS, AURA_TYPES, DOMAIN_COLORS, type AuraSettings, type AuraGrid, type Location } from './types'

export interface MapClick {
  x: number
  y: number
  screenX: number
  screenY: number
  mapScale: number
}

interface Props {
  mapImage: HTMLImageElement | null
  mapWidth: number
  mapHeight: number
  locations: Location[]
  selectedId: string | null
  settings: AuraSettings
  auraGrid: AuraGrid
  addMode: boolean
  checkMode: boolean
  onMapClick: (click: MapClick) => void
}

interface ViewState {
  zoom: number
  panX: number
  panY: number
}

function fieldValue(grid: AuraGrid, pixel: number, displayType: AuraSettings['displayType']): { value: number; typeIndex: number } {
  if (displayType === 'Dominant Aura' || displayType === 'Net Aura') {
    let index = 0
    for (let candidate = 1; candidate < 4; candidate += 1) {
      if (Math.abs(grid.values[candidate][pixel]) > Math.abs(grid.values[index][pixel])) index = candidate
    }
    return { value: Math.abs(grid.values[index][pixel]), typeIndex: index }
  }
  const index = AURA_TYPES.indexOf(displayType)
  return { value: Math.max(0, grid.values[index][pixel]), typeIndex: index }
}

function updateScaleBar(parent: HTMLElement, mapScale: number, metersPerPixel: number) {
  const scaleBar = parent.querySelector<HTMLElement>('.map-scale span')
  const label = parent.querySelector<HTMLElement>('.map-scale b')
  if (!scaleBar || !label) return
  const rawMeters = 64 / (mapScale * metersPerPixel)
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawMeters, 0.001)))
  const normalized = rawMeters / magnitude
  const niceValue = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1
  const meters = niceValue * magnitude
  scaleBar.style.width = `${meters * metersPerPixel * mapScale}px`
  label.textContent = `${Number(meters.toPrecision(3))} m`
}

function drawTerrain(context: CanvasRenderingContext2D, width: number, height: number) {
  context.fillStyle = '#e4ece7'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#edf0e2'
  context.beginPath()
  context.moveTo(0, height * 0.11)
  context.bezierCurveTo(width * 0.19, height * 0.04, width * 0.22, height * 0.23, width * 0.37, height * 0.18)
  context.bezierCurveTo(width * 0.54, height * 0.13, width * 0.53, height * 0.28, width * 0.72, height * 0.22)
  context.bezierCurveTo(width * 0.85, height * 0.18, width * 0.91, height * 0.07, width, height * 0.14)
  context.lineTo(width, height * 0.87)
  context.bezierCurveTo(width * 0.81, height * 0.81, width * 0.77, height * 0.94, width * 0.59, height * 0.88)
  context.bezierCurveTo(width * 0.4, height * 0.81, width * 0.28, height * 0.96, width * 0.14, height * 0.86)
  context.bezierCurveTo(width * 0.04, height * 0.79, width * 0.08, height * 0.68, 0, height * 0.64)
  context.closePath()
  context.fill()
  context.strokeStyle = 'rgba(99, 135, 115, 0.17)'
  context.lineWidth = 1.2
  for (let ring = 0; ring < 10; ring += 1) {
    context.beginPath()
    const offset = ring * 11
    context.ellipse(width * 0.72, height * 0.46, width * 0.14 + offset, height * 0.09 + offset * 0.47, -0.2, 0.2, Math.PI * 1.76)
    context.stroke()
    context.beginPath()
    context.ellipse(width * 0.27, height * 0.72, width * 0.075 + offset, height * 0.045 + offset * 0.4, 0.25, 0.25, Math.PI * 1.85)
    context.stroke()
  }
  context.strokeStyle = 'rgba(63, 123, 146, 0.62)'
  context.lineWidth = Math.max(3, width / 500)
  context.beginPath()
  context.moveTo(width * 0.08, height * 0.34)
  context.bezierCurveTo(width * 0.26, height * 0.28, width * 0.27, height * 0.56, width * 0.47, height * 0.48)
  context.bezierCurveTo(width * 0.67, height * 0.4, width * 0.68, height * 0.7, width * 0.91, height * 0.58)
  context.stroke()
  context.strokeStyle = 'rgba(136, 127, 98, 0.52)'
  context.lineWidth = Math.max(1.5, width / 1000)
  context.setLineDash([7, 5])
  context.beginPath()
  context.moveTo(width * 0.1, height * 0.75)
  context.bezierCurveTo(width * 0.33, height * 0.61, width * 0.41, height * 0.83, width * 0.57, height * 0.62)
  context.bezierCurveTo(width * 0.72, height * 0.42, width * 0.83, height * 0.53, width * 0.95, height * 0.31)
  context.stroke()
  context.setLineDash([])
  context.fillStyle = '#fffefa'
  context.font = `${Math.max(12, width / 90)}px Georgia, serif`
  context.fillText('NORTHWIND', width * 0.69, height * 0.73)
  context.fillStyle = 'rgba(51, 78, 70, 0.54)'
  context.font = `${Math.max(8, width / 145)}px ui-monospace, monospace`
  context.fillText('OLD ROAD', width * 0.42, height * 0.58)
}

export default function MapCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const redrawRef = useRef<() => void>(() => undefined)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    const context = canvas?.getContext('2d')
    if (!canvas || !parent || !context) return

    const draw = () => {
      const current = propsRef.current
      const bounds = parent.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(bounds.width * ratio))
      canvas.height = Math.max(1, Math.round(bounds.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, bounds.width, bounds.height)
      const state = viewRef.current
      const fitScale = Math.min(bounds.width / current.mapWidth, bounds.height / current.mapHeight)
      const scale = fitScale * state.zoom
      const left = (bounds.width - current.mapWidth * scale) / 2 + state.panX
      const top = (bounds.height - current.mapHeight * scale) / 2 + state.panY
      updateScaleBar(parent, scale, current.settings.metersPerPixel)

      context.save()
      context.translate(left, top)
      context.scale(scale, scale)
      context.beginPath()
      context.rect(0, 0, current.mapWidth, current.mapHeight)
      context.clip()
      if (current.mapImage) context.drawImage(current.mapImage, 0, 0, current.mapWidth, current.mapHeight)
      else drawTerrain(context, current.mapWidth, current.mapHeight)

      const { auraGrid, settings } = current
      const heatCanvas = document.createElement('canvas')
      heatCanvas.width = auraGrid.width
      heatCanvas.height = auraGrid.height
      const heatContext = heatCanvas.getContext('2d')
      if (heatContext && settings.opacity > 0) {
        const imageData = heatContext.createImageData(auraGrid.width, auraGrid.height)
        for (let pixel = 0; pixel < auraGrid.width * auraGrid.height; pixel += 1) {
          const { value, typeIndex } = fieldValue(auraGrid, pixel, settings.displayType)
          if (value < settings.threshold) continue
          const color = settings.displayType === 'Net Aura'
            ? [63, 133, 111]
            : AURA_COLORS[AURA_TYPES[typeIndex]]
          const intensity = Math.min(1, value / Math.max(1, auraGrid.maxima[typeIndex]))
          const offset = pixel * 4
          imageData.data[offset] = color[0]
          imageData.data[offset + 1] = color[1]
          imageData.data[offset + 2] = color[2]
          imageData.data[offset + 3] = Math.round(255 * (settings.opacity / 100) * intensity)
        }
        heatContext.putImageData(imageData, 0, 0)
        context.imageSmoothingEnabled = true
        context.drawImage(heatCanvas, 0, 0, current.mapWidth, current.mapHeight)
      }

      if (settings.contours) {
        const levels = [1, 3, 5, 7, 10]
        const cellWidth = current.mapWidth / auraGrid.width
        const cellHeight = current.mapHeight / auraGrid.height
        context.lineWidth = 1.2 / scale
        context.strokeStyle = 'rgba(39, 51, 46, 0.55)'
        for (const level of levels) {
          context.beginPath()
          for (let row = 0; row < auraGrid.height - 1; row += 1) {
            for (let column = 0; column < auraGrid.width - 1; column += 1) {
              const points = [
                { x: column, y: row, value: fieldValue(auraGrid, row * auraGrid.width + column, settings.displayType).value },
                { x: column + 1, y: row, value: fieldValue(auraGrid, row * auraGrid.width + column + 1, settings.displayType).value },
                { x: column + 1, y: row + 1, value: fieldValue(auraGrid, (row + 1) * auraGrid.width + column + 1, settings.displayType).value },
                { x: column, y: row + 1, value: fieldValue(auraGrid, (row + 1) * auraGrid.width + column, settings.displayType).value },
              ]
              const crossings: [number, number][] = []
              for (let edge = 0; edge < 4; edge += 1) {
                const first = points[edge]
                const second = points[(edge + 1) % 4]
                if ((first.value < level) === (second.value < level)) continue
                const fraction = (level - first.value) / (second.value - first.value)
                crossings.push([first.x + (second.x - first.x) * fraction, first.y + (second.y - first.y) * fraction])
              }
              for (let index = 0; index + 1 < crossings.length; index += 2) {
                const first = crossings[index]
                const second = crossings[index + 1]
                context.moveTo(first[0] * cellWidth, first[1] * cellHeight)
                context.lineTo(second[0] * cellWidth, second[1] * cellHeight)
              }
            }
          }
          context.stroke()
        }
      }

      for (const location of current.locations) {
        const color = DOMAIN_COLORS[location.domain]
        const radius = Math.max(5, 7 / scale)
        context.beginPath()
        context.arc(location.x, location.y, radius * 1.65, 0, Math.PI * 2)
        context.fillStyle = 'rgba(255, 255, 255, 0.86)'
        context.fill()
        context.beginPath()
        context.arc(location.x, location.y, radius, 0, Math.PI * 2)
        context.fillStyle = color
        context.fill()
        context.lineWidth = 2 / scale
        context.strokeStyle = current.selectedId === location.id ? '#fffefa' : 'rgba(35, 45, 41, 0.7)'
        context.stroke()
        if (current.selectedId === location.id) {
          context.beginPath()
          context.arc(location.x, location.y, radius * 2.2, 0, Math.PI * 2)
          context.strokeStyle = color
          context.lineWidth = 1.5 / scale
          context.stroke()
        }
        if (current.settings.showNames && scale > 0.19) {
          context.font = `600 ${Math.max(11, 12 / scale)}px 'DM Sans', sans-serif`
          context.textBaseline = 'middle'
          context.lineWidth = 3 / scale
          context.strokeStyle = 'rgba(255, 254, 250, 0.94)'
          context.strokeText(location.name, location.x + radius * 1.9, location.y)
          context.fillStyle = '#273b35'
          context.fillText(location.name, location.x + radius * 1.9, location.y)
        }
      }
      context.restore()
      context.fillStyle = 'rgba(53, 71, 65, 0.25)'
      context.strokeStyle = 'rgba(53, 71, 65, 0.26)'
      context.lineWidth = 1
      context.strokeRect(left, top, current.mapWidth * scale, current.mapHeight * scale)
    }
    redrawRef.current = draw
    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(parent)
    draw()

    const onZoom = (event: Event) => {
      const direction = (event as CustomEvent<number>).detail
      viewRef.current.zoom = Math.max(0.3, Math.min(8, viewRef.current.zoom * (direction > 0 ? 1.18 : 1 / 1.18)))
      draw()
    }
    const onFit = () => {
      viewRef.current = { zoom: 1, panX: 0, panY: 0 }
      draw()
    }
    const onWheel = (event: WheelEvent) => handleWheel(event)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('aura-zoom', onZoom)
    window.addEventListener('aura-fit', onFit)
    return () => {
      resizeObserver.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('aura-zoom', onZoom)
      window.removeEventListener('aura-fit', onFit)
    }
  }, [])

  useEffect(() => { redrawRef.current() })

  function handleWheel(event: WheelEvent) {
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const state = viewRef.current
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
    const nextZoom = Math.max(0.3, Math.min(8, state.zoom * factor))
    const centerX = bounds.width / 2 + state.panX
    const centerY = bounds.height / 2 + state.panY
    const ratio = nextZoom / state.zoom
    state.panX = (event.clientX - bounds.left - centerX) * (1 - ratio) + state.panX
    state.panY = (event.clientY - bounds.top - centerY) * (1 - ratio) + state.panY
    state.zoom = nextZoom
    redrawRef.current()
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.startX = String(event.clientX)
    event.currentTarget.dataset.startY = String(event.clientY)
    event.currentTarget.dataset.panX = String(viewRef.current.panX)
    event.currentTarget.dataset.panY = String(viewRef.current.panY)
    event.currentTarget.dataset.dragging = 'false'
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget
    if (!canvas.hasPointerCapture(event.pointerId)) return
    const dx = event.clientX - Number(canvas.dataset.startX)
    const dy = event.clientY - Number(canvas.dataset.startY)
    if (Math.hypot(dx, dy) > 4) canvas.dataset.dragging = 'true'
    if (canvas.dataset.dragging === 'true') {
      viewRef.current.panX = Number(canvas.dataset.panX) + dx
      viewRef.current.panY = Number(canvas.dataset.panY) + dy
      redrawRef.current()
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget
    if (!canvas.hasPointerCapture(event.pointerId)) return
    canvas.releasePointerCapture(event.pointerId)
    if (canvas.dataset.dragging === 'true') return
    const bounds = canvas.getBoundingClientRect()
    const { zoom, panX, panY } = viewRef.current
    const fitScale = Math.min(bounds.width / props.mapWidth, bounds.height / props.mapHeight)
    const mapScale = fitScale * zoom
    const left = (bounds.width - props.mapWidth * mapScale) / 2 + panX
    const top = (bounds.height - props.mapHeight * mapScale) / 2 + panY
    const x = (event.clientX - bounds.left - left) / mapScale
    const y = (event.clientY - bounds.top - top) / mapScale
    if (x < 0 || y < 0 || x > props.mapWidth || y > props.mapHeight) return
    props.onMapClick({ x, y, screenX: event.clientX - bounds.left + 12, screenY: event.clientY - bounds.top + 12, mapScale })
  }

  return <canvas
    ref={canvasRef}
    className={`map-canvas ${props.addMode || props.checkMode ? 'map-canvas-mode' : ''}`}
    aria-label={props.addMode ? 'Click to add a location, drag to pan' : props.checkMode ? 'Click to inspect aura, drag to pan' : 'Interactive map, click a marker to select, drag to pan'}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
  />
}