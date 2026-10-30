import { LayersControl, TileLayer } from 'react-leaflet'

// Calles (OpenStreetMap) y satélite (Esri): en pueblos pequeños el satélite ayuda a ubicar casas
export function CapasMapa() {
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="Calles">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Satélite">
        <TileLayer
          attribution="Imágenes &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  )
}
