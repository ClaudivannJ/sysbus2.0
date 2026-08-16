/**
 * MiniMapaPonto.tsx
 * Mini-mapa embarcado com Leaflet.js + OpenStreetMap.
 * Exibe pino vermelho animado sobre as coordenadas exatas do ponto de parada.
 * Gratuito, sem chave de API — usa tiles públicos do OpenStreetMap.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Corrige o path dos ícones padrão do Leaflet quando bundlado com Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Ícone personalizado: pino vermelho
const pinoVermelho = L.divIcon({
  html: `
    <div style="position:relative;width:32px;height:40px;">
      <div style="
        width:20px;height:20px;border-radius:50% 50% 50% 0;
        background:#e53e3e;border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.4);
        transform:rotate(-45deg);position:absolute;top:0;left:6px;
      "></div>
      <div style="
        width:8px;height:8px;background:#fff;border-radius:50%;
        position:absolute;top:6px;left:12px;
      "></div>
    </div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
  className: "",
});

interface Props {
  lat: number;
  lng: number;
  label?: string;
  /** Altura do mapa em pixels. Default: 160 */
  altura?: number;
}

export default function MiniMapaPonto({ lat, lng, label, altura = 160 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const mapa = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(mapa);

    const marker = L.marker([lat, lng], { icon: pinoVermelho }).addTo(mapa);
    if (label) marker.bindPopup(`<strong>${label}</strong>`).openPopup();

    mapRef.current = mapa;

    return () => {
      mapa.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ height: altura, borderRadius: "0.75rem", overflow: "hidden" }}
      className="w-full ring-1 ring-slate-200"
    />
  );
}
