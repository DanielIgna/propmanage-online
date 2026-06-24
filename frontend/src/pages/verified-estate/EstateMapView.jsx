import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";

// Custom icon — lime accent marker
const createIcon = (color = "#d4ff3a") =>
  L.divIcon({
    className: "ve-marker",
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:3px solid #0a0a0b;box-shadow:0 0 0 2px ${color}66;"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const formatPrice = (ron) => {
  if (!ron) return "—";
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(ron) + " RON";
};

export const EstateMapView = ({ items }) => {
  const mapRef = useRef(null);
  const withCoords = items.filter((it) => it.lat && it.lng);

  // Default center: București
  const center = withCoords.length > 0
    ? [withCoords[0].lat, withCoords[0].lng]
    : [44.4268, 26.1025];

  useEffect(() => {
    if (mapRef.current && withCoords.length > 1) {
      const bounds = L.latLngBounds(withCoords.map((it) => [it.lat, it.lng]));
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [withCoords]);

  return (
    <div className="relative" data-testid="estate-map-view">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "70vh", width: "100%", borderRadius: "1.5rem", background: "#0e0e10" }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {withCoords.map((it) => (
          <Marker key={it.id} position={[it.lat, it.lng]} icon={createIcon()}>
            <Popup>
              <div className="text-sm" data-testid={`map-popup-${it.id}`}>
                <div className="font-semibold mb-1">{it.title}</div>
                <div className="text-xs text-stone-500 mb-2">{it.city} {it.address ? `· ${it.address}` : ""}</div>
                <div className="font-mono text-base mb-2" style={{ color: "#0a0a0b" }}>{formatPrice(it.price_ron)}</div>
                <Link to={`/imobile-verificate/${it.id}`} className="inline-block bg-[#0a0a0b] text-white text-xs px-3 py-1.5 rounded-full" data-testid={`map-popup-link-${it.id}`}>
                  Vezi detalii →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {withCoords.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl">
          <p className="text-stone-300 text-sm">Niciun imobil cu coordonate geografice.</p>
        </div>
      )}
    </div>
  );
};

export default EstateMapView;
