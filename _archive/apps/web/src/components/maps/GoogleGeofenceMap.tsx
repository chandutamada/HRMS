'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { reverseGeocode } from '@/lib/geocoding';
import { MapPin, Navigation, Compass, Layers, ShieldCheck } from 'lucide-react';

interface GoogleGeofenceMapProps {
  initialLat: number;
  initialLng: number;
  radiusMeters: number;
  officeName?: string;
  isEditable?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
  onRadiusChange?: (radius: number) => void;
  height?: string;
}

const GEOFENCE_TILE_LAYERS = {
  osm: {
    name: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  hybrid: {
    name: 'Satellite Hybrid',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps / DigitalGlobe Imagery',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  },
  satellite: {
    name: 'Pure Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics',
    maxZoom: 19,
    subdomains: [],
  },
  carto: {
    name: 'Clean Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c', 'd'],
  },
};

export default function GoogleGeofenceMap({
  initialLat,
  initialLng,
  radiusMeters,
  officeName = 'Office Geofence Zone',
  isEditable = true,
  onLocationChange,
  onRadiusChange,
  height = '420px',
}: GoogleGeofenceMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [radius, setRadius] = useState(radiusMeters);
  const [address, setAddress] = useState<string>('Looking up address...');
  const [mapStyle, setMapStyle] = useState<'osm' | 'hybrid' | 'satellite' | 'carto'>('osm');

  // Sync state when props change
  useEffect(() => {
    setLat(initialLat);
    setLng(initialLng);
    setRadius(radiusMeters);

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      markerRef.current.setLatLng([initialLat, initialLng]);
      circleRef.current.setLatLng([initialLat, initialLng]);
      circleRef.current.setRadius(radiusMeters);
      mapInstanceRef.current.setView([initialLat, initialLng], 17);
    }

    // Lookup address for coordinates
    reverseGeocode(initialLat, initialLng).then((addr) => setAddress(addr));
  }, [initialLat, initialLng, radiusMeters]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 17,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const initialTiles = GEOFENCE_TILE_LAYERS[mapStyle];
    const tiles = L.tileLayer(initialTiles.url, {
      attribution: initialTiles.attribution,
      maxZoom: initialTiles.maxZoom,
      subdomains: initialTiles.subdomains,
    }).addTo(map);
    tileLayerRef.current = tiles;

    // Draggable Office Pin Icon
    const customIcon = L.divIcon({
      className: 'office-geofence-pin',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; cursor: ${isEditable ? 'grab' : 'default'};">
          <div style="background: #dc2626; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.45); border: 2.5px solid white;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div style="background: rgba(15, 23, 42, 0.85); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); border-radius: 12px; padding: 2px 8px; font-size: 10px; font-weight: bold; margin-top: 4px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            Office Center • ${radius}m
          </div>
        </div>
      `,
      iconSize: [120, 60],
      iconAnchor: [60, 18],
    });

    const marker = L.marker([initialLat, initialLng], {
      icon: customIcon,
      draggable: isEditable,
    }).addTo(map);
    markerRef.current = marker;

    // 50m Geofence Circle
    const circle = L.circle([initialLat, initialLng], {
      radius: radiusMeters,
      color: '#16a34a',
      weight: 2,
      fillColor: '#22c55e',
      fillOpacity: 0.18,
    }).addTo(map);
    circleRef.current = circle;

    // Draggable marker handlers
    if (isEditable) {
      marker.on('drag', (e: any) => {
        const newPos = e.latlng;
        circle.setLatLng(newPos);
      });

      marker.on('dragend', async (e: any) => {
        const newPos = e.target.getLatLng();
        setLat(newPos.lat);
        setLng(newPos.lng);
        circle.setLatLng(newPos);
        if (onLocationChange) {
          onLocationChange(newPos.lat, newPos.lng);
        }
        const newAddr = await reverseGeocode(newPos.lat, newPos.lng);
        setAddress(newAddr);
      });

      // Map click also updates office position
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const newPos = e.latlng;
        marker.setLatLng(newPos);
        circle.setLatLng(newPos);
        setLat(newPos.lat);
        setLng(newPos.lng);
        if (onLocationChange) {
          onLocationChange(newPos.lat, newPos.lng);
        }
        const newAddr = await reverseGeocode(newPos.lat, newPos.lng);
        setAddress(newAddr);
      });
    }

    mapInstanceRef.current = map;

    // Lookup initial address
    reverseGeocode(initialLat, initialLng).then((addr) => setAddress(addr));

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Style cleanly
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const config = GEOFENCE_TILE_LAYERS[mapStyle];
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      subdomains: config.subdomains,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current.bringToBack();
  }, [mapStyle]);

  // Handle Radius Change from Slider
  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (circleRef.current) {
      circleRef.current.setRadius(newRadius);
    }
    if (onRadiusChange) {
      onRadiusChange(newRadius);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Geofence Map Top Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5 gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">{officeName}</h4>
            <span className="text-[11px] text-slate-500 font-mono">
              {lat.toFixed(6)}, {lng.toFixed(6)} • <span className="text-emerald-700 font-bold">{radius}m Radius</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Tile Layer Selector */}
          <div className="flex rounded-lg bg-slate-200/70 p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setMapStyle('osm')}
              title="OpenStreetMap Standard Street View"
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                mapStyle === 'osm' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Street
            </button>
            <button
              type="button"
              onClick={() => setMapStyle('hybrid')}
              title="Satellite Hybrid (Aerial + Roads)"
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                mapStyle === 'hybrid' ? 'bg-emerald-600 text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛰️ Hybrid
            </button>
            <button
              type="button"
              onClick={() => setMapStyle('satellite')}
              title="Pure Satellite Imagery"
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                mapStyle === 'satellite' ? 'bg-cyan-600 text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌍 Satellite
            </button>
            <button
              type="button"
              onClick={() => setMapStyle('carto')}
              title="CARTO Clean Light Basemap"
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                mapStyle === 'carto' ? 'bg-white text-slate-800 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Clean Light
            </button>
          </div>

          {/* Interactive Radius Slider */}
          {isEditable && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Geofence Radius:</span>
              <input
                type="range"
                min="20"
                max="200"
                step="5"
                value={radius}
                onChange={(e) => handleRadiusChange(Number(e.target.value))}
                className="h-2 w-28 cursor-pointer accent-emerald-600"
              />
              <span className="w-10 text-right font-mono text-xs font-bold text-emerald-700">
                {radius}m
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Real Interactive Leaflet Map Container */}
      <div className="relative w-full" style={{ height }}>
        <div ref={mapContainerRef} className="h-full w-full z-0" />

        {/* Real-time Reverse Geocoded Street Address Pill at bottom */}
        <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/90 backdrop-blur-md px-3.5 py-2 text-xs text-slate-200 shadow-lg border border-slate-800">
          <div className="flex items-center gap-2 max-w-[80%]">
            <Navigation className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              Address: <strong className="text-white">{address}</strong>
            </span>
          </div>
          <span className="text-[11px] font-medium text-emerald-400 shrink-0">
            ✓ Open-Source Leaflet OSM
          </span>
        </div>
      </div>
    </div>
  );
}
