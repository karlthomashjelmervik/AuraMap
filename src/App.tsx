import { useMemo, useRef, useState } from 'react'
import {
  Activity, ChevronDown, CircleHelp, Download, FileImage, FolderOpen, LocateFixed,
  Map as MapIcon, MapPin, Minus, Plus, RefreshCw, Save, Scan, Search, Trash2, Upload,
  X,
} from 'lucide-react'
import { calculateAuraAt, calculateAuraGrid, strongestAura } from './aura'
import MapCanvas, { type MapClick } from './MapCanvas'
import {
  AURA_TYPES, DOMAIN_COLORS, DOMAINS, type AuraSettings, type Domain,
  type DisplayType, type Location, type ProjectFile,
} from './types'

const INITIAL_SETTINGS: AuraSettings = {
  r0: 250,
  threshold: 0.5,
  opacity: 62,
  metersPerPixel: 1,
  displayType: 'Divine',
  contours: true,
  showNames: true,
}

const INITIAL_LOCATIONS: Location[] = [
  { id: 'origin-north', name: 'Northwatch Shrine', description: 'A weathered sanctuary above the old road.', domain: 'Divine', strength: 8, x: 490, y: 330 },
  { id: 'origin-market', name: 'Whispering Market', description: 'A hidden faerie crossing.', domain: 'Faerie', strength: 5, x: 1080, y: 610 },
  { id: 'origin-gate', name: 'Ashen Gate', description: 'An infernal scar beneath the city.', domain: 'Infernal', strength: 7, x: 920, y: 1030 },
]

const DEFAULT_MAP_WIDTH = 1600
const DEFAULT_MAP_HEIGHT = 1200

function newLocation(name: string, domain: Domain, strength: number, x: number, y: number): Location {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || 'Unnamed location',
    description: '',
    domain,
    strength: Math.max(0, strength),
    x,
    y,
  }
}

export default function App() {
  const [locations, setLocations] = useState<Location[]>(INITIAL_LOCATIONS)
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_LOCATIONS[0].id)
  const [draft, setDraft] = useState<Location>(INITIAL_LOCATIONS[0])
  const [settings, setSettings] = useState<AuraSettings>(INITIAL_SETTINGS)
  const [addMode, setAddMode] = useState(false)
  const [checkMode, setCheckMode] = useState(false)
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null)
  const [mapDataUrl, setMapDataUrl] = useState<string | null>(null)
  const [mapName, setMapName] = useState('Field survey · 01')
  const [mapWidth, setMapWidth] = useState(DEFAULT_MAP_WIDTH)
  const [mapHeight, setMapHeight] = useState(DEFAULT_MAP_HEIGHT)
  const [popup, setPopup] = useState<(MapClick & { values: number[] }) | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All changes are local')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)

  const auraGrid = useMemo(
    () => calculateAuraGrid(mapWidth, mapHeight, locations, settings.r0, settings.metersPerPixel),
    [mapWidth, mapHeight, locations, settings.r0, settings.metersPerPixel],
  )
  const filteredLocations = locations.filter((location) =>
    `${location.name} ${location.domain}`.toLowerCase().includes(search.toLowerCase()),
  )
  const selectedLocation = locations.find((location) => location.id === selectedId)

  function updateSettings<K extends keyof AuraSettings>(key: K, value: AuraSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function selectLocation(location: Location) {
    setSelectedId(location.id)
    setDraft({ ...location })
    setPopup(null)
  }

  function updateSelected() {
    if (!selectedId) return
    const updated = { ...draft, strength: Math.max(0, Number(draft.strength) || 0) }
    setLocations((current) => current.map((location) => location.id === selectedId ? updated : location))
    setDraft(updated)
    setStatus('Location updated')
  }

  function updateLocation(id: string, changes: Partial<Location>) {
    setLocations((current) => current.map((location) => location.id === id ? { ...location, ...changes } : location))
    if (selectedId === id) setDraft((current) => ({ ...current, ...changes }))
  }

  function deleteSelected() {
    if (!selectedId) return
    setLocations((current) => current.filter((location) => location.id !== selectedId))
    setSelectedId(null)
    setDraft({ ...newLocation('', 'Divine', 5, 0, 0), description: '' })
    setStatus('Location removed')
  }

  function onMapClick(click: MapClick) {
    if (addMode) {
      const location = { ...newLocation(draft.name, draft.domain, Number(draft.strength), click.x, click.y), description: draft.description }
      setLocations((current) => [...current, location])
      selectLocation(location)
      setStatus('Location added')
      return
    }
    if (checkMode) {
      const point = calculateAuraAt(click.x, click.y, locations, settings.r0, settings.metersPerPixel)
      setPopup({ ...click, values: point })
      return
    }
    const nearest = locations.reduce<{ location: Location | null; distance: number }>((result, location) => {
      const distance = Math.hypot(location.x - click.x, location.y - click.y)
      return distance < result.distance ? { location, distance } : result
    }, { location: null, distance: 36 / Math.max(click.mapScale, 0.01) })
    if (nearest.location) selectLocation(nearest.location)
    else setPopup(null)
  }

  function importMap(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        setMapImage(image)
        setMapDataUrl(String(reader.result))
        setMapWidth(image.naturalWidth)
        setMapHeight(image.naturalHeight)
        setMapName(file.name.replace(/\.[^.]+$/, ''))
        setPopup(null)
        setStatus(`Map loaded · ${image.naturalWidth} × ${image.naturalHeight} px`)
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  async function saveProject() {
    const project: ProjectFile = {
      version: 1,
      mapImage: mapDataUrl,
      mapName,
      mapWidth,
      mapHeight,
      locations,
      settings,
    }
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${mapName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'aura-project'}.json`
    link.click()
    URL.revokeObjectURL(url)
    setStatus('Project saved as JSON')
  }

  function loadProject(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const project = JSON.parse(String(reader.result)) as ProjectFile
        if (project.version !== 1 || !Array.isArray(project.locations) || !project.settings) throw new Error('Unsupported project format')
        setLocations(project.locations)
        setSelectedId(null)
        setDraft({ ...newLocation('', 'Divine', 5, 0, 0) })
        setSettings(project.settings)
        setMapName(project.mapName || 'Untitled map')
        setMapWidth(project.mapWidth || DEFAULT_MAP_WIDTH)
        setMapHeight(project.mapHeight || DEFAULT_MAP_HEIGHT)
        setMapDataUrl(project.mapImage)
        if (project.mapImage) {
          const image = new Image()
          image.onload = () => setMapImage(image)
          image.src = project.mapImage
        } else setMapImage(null)
        setPopup(null)
        setStatus('Project restored')
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not load project')
      }
    }
    reader.readAsText(file)
  }

  function refreshAura() {
    setSettings((current) => ({ ...current }))
    setStatus('Aura field recalculated')
  }

  const dominant = popup ? strongestAura(popup.values) : null

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Aura Map Designer home">
          <span className="brand-mark"><Activity size={19} strokeWidth={2.5} /></span>
          <span className="brand-name">aura<span>map</span></span>
        </a>
        <div className="project-title">
          <span className="project-kicker">WORKSPACE / FIELD STUDIES</span>
          <span className="project-name">{mapName}<ChevronDown size={14} /></span>
        </div>
        <div className="top-actions">
          <span className="saved-indicator"><i /> Local project</span>
          <button className="button button-quiet" onClick={() => projectInputRef.current?.click()}><FolderOpen size={15} /> Open</button>
          <button className="button button-primary" onClick={saveProject}><Save size={15} /> Save project</button>
        </div>
        <input ref={projectInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => { loadProject(event.target.files?.[0]); event.currentTarget.value = '' }} />
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="side-heading">
            <div><span className="eyebrow">FIELD WORKSPACE</span><h1>Location editor</h1></div>
            <button className="icon-button" title="Location editor information" aria-label="Location editor information"><CircleHelp size={16} /></button>
          </div>

          <section className="editor-section">
            <div className="section-label"><span>LOCATION DETAILS</span><span className="section-rule" /></div>
            <label className="field-label">Name
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Old stone circle" />
            </label>
            <label className="field-label">Description
              <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Optional field notes" rows={2} />
            </label>
            <div className="field-row">
              <label className="field-label">Domain
                <select value={draft.domain} onChange={(event) => setDraft({ ...draft, domain: event.target.value as Domain })}>
                  {DOMAINS.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
                </select>
              </label>
              <label className="field-label">Strength
                <input type="number" min="0" step="0.5" value={draft.strength} onChange={(event) => setDraft({ ...draft, strength: Number(event.target.value) })} />
              </label>
            </div>
            <div className="editor-actions">
              <button className="button button-primary button-wide" disabled={!selectedId} onClick={updateSelected}>Update selected</button>
              <button className="icon-button danger-icon" disabled={!selectedId} title="Delete selected location" aria-label="Delete selected location" onClick={deleteSelected}><Trash2 size={16} /></button>
            </div>
          </section>

          <section className="mode-section">
            <div className="section-label"><span>MAP INTERACTION</span><span className="section-rule" /></div>
            <button className={`mode-option ${addMode ? 'active' : ''}`} onClick={() => { setAddMode(!addMode); setCheckMode(false); setPopup(null) }}>
              <span className="mode-icon add"><MapPin size={16} /></span><span><b>Add location</b><small>Place editor values on the map</small></span>
              <span className={`switch ${addMode ? 'on' : ''}`} />
            </button>
            <button className={`mode-option ${checkMode ? 'active' : ''}`} onClick={() => { setCheckMode(!checkMode); setAddMode(false); setPopup(null) }}>
              <span className="mode-icon inspect"><LocateFixed size={16} /></span><span><b>Check aura</b><small>Inspect field strength at a point</small></span>
              <span className={`switch ${checkMode ? 'on' : ''}`} />
            </button>
          </section>

          <section className="locations-section">
            <div className="locations-head"><div className="section-label"><span>LOCATIONS</span><span className="count-pill">{locations.length}</span></div>
              <button className="icon-button small" title="Import map image" aria-label="Import map image" onClick={() => imageInputRef.current?.click()}><FileImage size={15} /></button>
            </div>
            <div className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a location" /><kbd>/</kbd></div>
            <div className="location-list" role="listbox" aria-label="Locations">
              {filteredLocations.map((location) => (
                <button key={location.id} className={`location-item ${selectedId === location.id ? 'selected' : ''}`} onClick={() => selectLocation(location)} role="option" aria-selected={selectedId === location.id}>
                  <span className="location-dot" style={{ backgroundColor: DOMAIN_COLORS[location.domain] }} />
                  <span className="location-item-text"><b>{location.name || 'Unnamed location'}</b><small>{location.domain}<span>·</span>{location.strength.toFixed(1)} strength</small></span>
                  <span className="location-coord">{Math.round(location.x * settings.metersPerPixel)} m</span>
                </button>
              ))}
              {filteredLocations.length === 0 && <div className="empty-list">No matching locations</div>}
            </div>
            <button className="import-map-button" onClick={() => imageInputRef.current?.click()}><Upload size={14} /> Import map image</button>
            <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { importMap(event.target.files?.[0]); event.currentTarget.value = '' }} />
          </section>
          <div className="sidebar-foot"><span className="online-dot" />{status}</div>
        </aside>

        <section className="map-workspace" aria-label="Map workspace">
          <div className="map-toolbar">
            <div className="map-heading"><span className="map-heading-icon"><MapIcon size={17} /></span><div><b>{mapName}</b><small>{mapWidth} × {mapHeight} px <span>·</span> {locations.length} locations</small></div></div>
            <div className="map-toolbar-actions">
              <label className="toolbar-toggle"><input type="checkbox" checked={settings.showNames} onChange={(event) => updateSettings('showNames', event.target.checked)} /><span>Names</span></label>
              <span className="toolbar-divider" />
              <button className="icon-button" title="Zoom out" aria-label="Zoom out" onClick={() => window.dispatchEvent(new CustomEvent('aura-zoom', { detail: -1 }))}><Minus size={16} /></button>
              <button className="icon-button" title="Zoom in" aria-label="Zoom in" onClick={() => window.dispatchEvent(new CustomEvent('aura-zoom', { detail: 1 }))}><Plus size={16} /></button>
              <button className="icon-button" title="Fit map" aria-label="Fit map" onClick={() => window.dispatchEvent(new Event('aura-fit'))}><Scan size={15} /></button>
            </div>
          </div>

          <div className="map-stage">
            <MapCanvas
              mapImage={mapImage} mapWidth={mapWidth} mapHeight={mapHeight} locations={locations}
              selectedId={selectedId} settings={settings} auraGrid={auraGrid}
              addMode={addMode} checkMode={checkMode} onMapClick={onMapClick}
            />
            {popup && dominant && <div className="aura-popup" style={{ left: popup.screenX, top: popup.screenY }}>
              <button className="popup-close" aria-label="Close aura details" onClick={() => setPopup(null)}><X size={14} /></button>
              <div className="popup-title"><span className="popup-crosshair"><LocateFixed size={14} /></span><span>FIELD READOUT<small>Point analysis</small></span></div>
              <div className="popup-position"><span>X <b>{(popup.x * settings.metersPerPixel).toFixed(1)} m</b></span><span>Y <b>{(popup.y * settings.metersPerPixel).toFixed(1)} m</b></span></div>
              <div className="popup-values">{AURA_TYPES.map((type, index) => <div key={type}><span><i style={{ backgroundColor: DOMAIN_COLORS[type] }} />{type}</span><b className={popup.values[index] < 0 ? 'negative' : ''}>{popup.values[index].toFixed(2)}</b></div>)}</div>
              <div className="dominant-readout"><span>Dominant aura</span><b><i style={{ backgroundColor: DOMAIN_COLORS[dominant.type] }} />{dominant.type}</b><strong>{dominant.value.toFixed(2)}</strong></div>
            </div>}
            <div className="map-scale"><span /><b>{Math.round(200 / settings.metersPerPixel)} m</b></div>
            <div className="coordinate-readout">CRS <b>LOCAL GRID</b><span /> {Math.round(mapWidth * settings.metersPerPixel)} m × {Math.round(mapHeight * settings.metersPerPixel)} m</div>
            {locations.length === 0 && !mapImage && <div className="map-hint"><MapPin size={15} /> Import a map or add your first location</div>}
          </div>

          <div className="table-panel">
            <div className="table-heading"><div><span className="eyebrow">DATA LAYER</span><h2>Locations <span>{locations.length}</span></h2></div><div className="table-tools"><span className="table-note">{selectedLocation ? `Selected · ${selectedLocation.name}` : 'Select a row to edit'}</span><button className="icon-button small" title="Export location data as JSON" aria-label="Export location data as JSON" onClick={saveProject}><Download size={15} /></button></div></div>
            <div className="table-scroll"><table><thead><tr><th>NAME</th><th>DOMAIN</th><th>STRENGTH</th><th>X (M)</th><th>Y (M)</th></tr></thead><tbody>
              {filteredLocations.map((location) => <tr key={location.id} className={selectedId === location.id ? 'row-selected' : ''} onClick={() => selectLocation(location)}>
                <td><span className="table-name"><i style={{ backgroundColor: DOMAIN_COLORS[location.domain] }} /><input className="table-input table-name-input" aria-label={`Name of ${location.name || 'location'}`} value={location.name} onChange={(event) => updateLocation(location.id, { name: event.target.value })} /></span></td>
                <td><span className="domain-cell"><i style={{ backgroundColor: DOMAIN_COLORS[location.domain] }} /><select className="table-input table-domain-input" aria-label={`Domain of ${location.name || 'location'}`} value={location.domain} onChange={(event) => updateLocation(location.id, { domain: event.target.value as Domain })}>{DOMAINS.map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select></span></td>
                <td><input className="table-input table-number-input" aria-label={`Strength of ${location.name || 'location'}`} type="number" min="0" step="0.5" value={location.strength} onChange={(event) => updateLocation(location.id, { strength: Math.max(0, Number(event.target.value) || 0) })} /></td>
                <td><input className="table-input table-number-input" aria-label={`X coordinate of ${location.name || 'location'} in meters`} type="number" step="0.1" value={(location.x * settings.metersPerPixel).toFixed(1)} onChange={(event) => updateLocation(location.id, { x: (Number(event.target.value) || 0) / settings.metersPerPixel })} /></td>
                <td><input className="table-input table-number-input" aria-label={`Y coordinate of ${location.name || 'location'} in meters`} type="number" step="0.1" value={(location.y * settings.metersPerPixel).toFixed(1)} onChange={(event) => updateLocation(location.id, { y: (Number(event.target.value) || 0) / settings.metersPerPixel })} /></td>
              </tr>)}
              {filteredLocations.length === 0 && <tr><td colSpan={5} className="table-empty">No locations to display</td></tr>}
            </tbody></table></div>
          </div>

          <div className="visualization-bar">
            <div className="visualization-title"><Activity size={16} /><span>FIELD VISUALIZATION</span></div>
            <label className="viz-control"><span>R0</span><input type="number" min="1" value={settings.r0} onChange={(event) => updateSettings('r0', Math.max(1, Number(event.target.value)))} /><small>m</small></label>
            <label className="viz-control"><span>Threshold</span><input type="number" min="0" step="0.1" value={settings.threshold} onChange={(event) => updateSettings('threshold', Math.max(0, Number(event.target.value)))} /></label>
            <label className="viz-control slider-control"><span>Opacity</span><input type="range" min="0" max="100" value={settings.opacity} onChange={(event) => updateSettings('opacity', Number(event.target.value))} /><small>{settings.opacity}%</small></label>
            <label className="viz-control"><span>m / px</span><input type="number" min="0.01" step="0.1" value={settings.metersPerPixel} onChange={(event) => updateSettings('metersPerPixel', Math.max(0.01, Number(event.target.value)))} /></label>
            <label className="viz-control aura-select"><span>Aura type</span><select value={settings.displayType} onChange={(event) => updateSettings('displayType', event.target.value as DisplayType)}>{[...AURA_TYPES, 'Net Aura', 'Dominant Aura'].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="contour-toggle"><input type="checkbox" checked={settings.contours} onChange={(event) => updateSettings('contours', event.target.checked)} /><span>Contours</span></label>
            <button className="button refresh-button" onClick={refreshAura}><RefreshCw size={14} /> Refresh</button>
          </div>
        </section>
      </main>
      <div className="sr-only" aria-live="polite">{status}</div>
    </div>
  )
}