'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { reverseGeocode } from '@/lib/geocoding';
import {
  MapPin,
  Navigation,
  Compass,
  Radio,
  Battery,
  Zap,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Plane,
  Eye,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  X,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface EmployeeLocation {
  id: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  department: string;
  designation: string;
  workLocationType: 'ON_SITE' | 'OFF_SITE';
  isOnline: boolean;
  lastSeenAt: string | null;
  office: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
  liveLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    isMoving: boolean;
    batteryLevel?: number;
    isWithinOfficeHours: boolean;
    isWithinGeofence: boolean;
    distanceToOfficeMeters?: number;
    updatedAt: string;
  } | null;
  latestSession?: {
    id: string;
    distanceKm: number;
    areaName?: string;
    pointsCount: number;
    checkpointsCount: number;
  } | null;
}

interface TrackingDashboardMapProps {
  employees: EmployeeLocation[];
  selectedEmployeeId?: string | null;
  onSelectEmployee?: (emp: EmployeeLocation) => void;
  selectedSessionData?: {
    id?: string;
    distanceKm?: number;
    areaName?: string;
    startTime?: string;
    endTime?: string;
    routePoints?: Array<{ latitude: number; longitude: number; speed?: number; timestamp: string }>;
    checkpoints?: Array<{ latitude: number; longitude: number; arrivedAt: string; departedAt?: string; notes?: string; pointIndex: number }>;
  } | null;
  defaultOffice?: {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
  height?: string;
  onCloseSession?: () => void;
}

// Available Free Open-Source & High-Resolution Satellite Tile Layers
const TILE_LAYERS = {
  osm: {
    name: 'OpenStreetMap (Standard)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  hybrid: {
    name: 'Satellite Hybrid (Aerial + Roads)',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps / DigitalGlobe Imagery',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  },
  satellite: {
    name: 'Pure Satellite (Esri Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics',
    maxZoom: 19,
    subdomains: [],
  },
  cartoLight: {
    name: 'CARTO Positron (Clean Light)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  cartoDark: {
    name: 'CARTO Dark Matter (Dark)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c', 'd'],
  },
};

export default function TrackingDashboardMap({
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  selectedSessionData,
  defaultOffice,
  height = '560px',
  onCloseSession,
}: TrackingDashboardMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups for clean management
  const employeeMarkersGroup = useRef<L.LayerGroup | null>(null);
  const officeGroup = useRef<L.LayerGroup | null>(null);
  const routeGroup = useRef<L.LayerGroup | null>(null);
  const playbackMarkerRef = useRef<L.Marker | null>(null);
  const traversedPolylineRef = useRef<L.Polyline | null>(null);
  const basePolylineRef = useRef<L.Polyline | null>(null);

  // Persistent employee marker instances for smooth movement interpolation
  const employeeMarkersMapRef = useRef<Map<string, {
    marker: L.Marker;
    trailPolyline: L.Polyline;
    trailPoints: [number, number][];
    lastLat: number;
    lastLng: number;
    heading: number;
  }>>(new Map());

  // Component UI state
  const [selectedTileStyle, setSelectedTileStyle] = useState<'osm' | 'hybrid' | 'satellite' | 'cartoLight' | 'cartoDark'>('osm');
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'ON_SITE' | 'OFF_SITE'>('ALL');
  const [showGeofence, setShowGeofence] = useState(true);
  const [showTimelineSidebar, setShowTimelineSidebar] = useState(true);

  // Address lookup cache for displayed markers / stops
  const [addresses, setAddresses] = useState<Record<string, string>>({});

  // Timeline Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 100
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const officeLat = defaultOffice?.latitude || 13.04983;
  const officeLng = defaultOffice?.longitude || 77.62024;
  const officeRadius = defaultOffice?.radiusMeters || 50;
  const officeName = defaultOffice?.name || 'Bangalore Drone Testing Campus';

  // Helper: Geodesic Bearing calculation (degrees 0-360)
  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const lat1Rad = lat1 * (Math.PI / 180);
    const lat2Rad = lat2 * (Math.PI / 180);
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
  };

  // 1. Initialize Leaflet Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [officeLat, officeLng],
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const initialTiles = TILE_LAYERS[selectedTileStyle];
    tileLayerRef.current = L.tileLayer(initialTiles.url, {
      attribution: initialTiles.attribution,
      maxZoom: initialTiles.maxZoom,
      subdomains: initialTiles.subdomains,
    }).addTo(map);

    if (!employeeMarkersGroup.current) employeeMarkersGroup.current = L.layerGroup();
    if (!officeGroup.current) officeGroup.current = L.layerGroup();
    if (!routeGroup.current) routeGroup.current = L.layerGroup();

    employeeMarkersGroup.current.addTo(map);
    officeGroup.current.addTo(map);
    routeGroup.current.addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Change Tile Layer (removes old layer and attaches new layer at the base)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const config = TILE_LAYERS[selectedTileStyle];
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      subdomains: config.subdomains,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current.bringToBack();
  }, [selectedTileStyle]);

  // 3. Render Office Geofence Circle
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const oGroup = officeGroup.current;
    if (!oGroup) return;
    oGroup.clearLayers();

    if (!showGeofence) return;

    // Office 50m radius circle
    const circle = L.circle([officeLat, officeLng], {
      radius: officeRadius,
      color: '#059669',
      weight: 2,
      fillColor: '#10B981',
      fillOpacity: 0.16,
      dashArray: '4, 4',
    });

    circle.bindTooltip(`<b>${officeName}</b><br/>${officeRadius}m Attendance Geofence`, {
      permanent: false,
      direction: 'top',
    });

    // Office Center Icon
    const officeIcon = L.divIcon({
      className: 'custom-office-pin',
      html: `
        <div style="background: #047857; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid white;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
            <path d="M10 6h4"/>
            <path d="M10 10h4"/>
            <path d="M10 14h4"/>
            <path d="M10 18h4"/>
          </svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const officeMarker = L.marker([officeLat, officeLng], { icon: officeIcon });
    officeMarker.bindPopup(`
      <div style="font-family: system-ui, sans-serif; min-width: 200px;">
        <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold; color: #047857;">🏢 ${officeName}</h4>
        <div style="font-size: 12px; color: #475569;">Radius: <b>${officeRadius} metres</b></div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Lat: ${officeLat}, Lng: ${officeLng}</div>
      </div>
    `);

    oGroup.addLayer(circle);
    oGroup.addLayer(officeMarker);
  }, [officeLat, officeLng, officeRadius, officeName, showGeofence]);

  // Helper: Build animated employee icon with heading pointer & status aura
  const createEmployeeMarkerIcon = (
    emp: EmployeeLocation,
    isSelected: boolean,
    heading: number = 0
  ) => {
    const live = emp.liveLocation;
    const isOnSite = emp.workLocationType === 'ON_SITE';
    const isWithinGeofence = live?.isWithinGeofence ?? false;
    const isMoving = live?.isMoving ?? false;
    const initial = emp.fullName ? emp.fullName[0].toUpperCase() : 'E';

    // Badge color: emerald for on-site geofence-verified, amber for outside geofence, indigo for field duty
    const badgeColor = isOnSite
      ? isWithinGeofence
        ? '#10b981'
        : '#f59e0b'
      : '#6366f1';

    return L.divIcon({
      className: 'custom-employee-marker leaflet-smooth-marker',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <!-- Moving Pulse Wave Aura -->
          ${
            isMoving
              ? `<div style="position: absolute; width: 46px; height: 46px; border-radius: 50%; background: ${badgeColor}; opacity: 0.35; animation: pulseWave 1.8s infinite cubic-bezier(0, 0, 0.2, 1);"></div>`
              : ''
          }
          <!-- Heading Direction Arrow Pointer (Rotates with Bearing) -->
          ${
            isMoving && heading !== 0
              ? `<div style="
                  position: absolute;
                  top: -8px;
                  width: 0;
                  height: 0;
                  border-left: 6px solid transparent;
                  border-right: 6px solid transparent;
                  border-bottom: 9px solid ${badgeColor};
                  transform: rotate(${heading}deg);
                  transform-origin: 50% 24px;
                  transition: transform 0.4s ease;
                  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
                "></div>`
              : ''
          }
          <!-- Central Avatar Pin -->
          <div style="
            width: ${isSelected ? '40px' : '34px'};
            height: ${isSelected ? '40px' : '34px'};
            border-radius: 50%;
            background: ${badgeColor};
            border: ${isSelected ? '3px solid #ffffff' : '2px solid #ffffff'};
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 800;
            font-size: 13px;
            transition: all 0.25s ease;
          ">
            ${initial}
          </div>
          <!-- Online/Offline Status Dot -->
          <div style="
            position: absolute;
            bottom: -3px;
            right: -3px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${emp.isOnline ? '#22c55e' : '#94a3b8'};
            border: 2px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          "></div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  };

  // Helper: Build popup HTML for employee marker
  const buildEmployeePopupContent = (
    emp: EmployeeLocation,
    currentAddress: string
  ) => {
    const live = emp.liveLocation;
    const initial = emp.fullName ? emp.fullName[0].toUpperCase() : 'E';
    const isOnSite = emp.workLocationType === 'ON_SITE';
    const isWithinGeofence = live?.isWithinGeofence ?? false;
    const speed = live?.speed ?? 0;
    const batteryLevel = live?.batteryLevel;

    return `
      <div style="font-family: system-ui, sans-serif; min-width: 230px; padding: 4px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="width: 34px; height: 34px; border-radius: 50%; background: #6366f1; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
            ${initial}
          </div>
          <div>
            <div style="font-weight: bold; font-size: 13px; color: #0f172a;">${emp.fullName}</div>
            <div style="font-size: 11px; color: #64748b;">${emp.employeeCode} • ${emp.designation}</div>
          </div>
        </div>
        <div style="background: #f8fafc; border-radius: 8px; padding: 8px; margin-bottom: 8px; border: 1px solid #e2e8f0; font-size: 11px;">
          <div style="font-weight: 600; color: #334155; margin-bottom: 2px;">📍 Current Street Address:</div>
          <div style="color: #0f172a; line-height: 1.4;">${currentAddress}</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; color: #475569;">
          <div>Duty: <b style="color: ${isOnSite ? '#059669' : '#6366f1'};">${emp.workLocationType}</b></div>
          <div>Geofence: <b style="color: ${isWithinGeofence ? '#059669' : '#d97706'};">${isWithinGeofence ? 'Verified Inside' : 'Outside Perimeter'}</b></div>
          <div>Speed: <b>${(speed * 3.6).toFixed(1)} km/h</b></div>
          <div>Battery: <b>${batteryLevel != null ? `${batteryLevel}%` : 'N/A'}</b></div>
        </div>
      </div>
    `;
  };

  // 4. Render & Smoothly Interpolate Employee Live Markers & Live Trails
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (selectedSessionData) {
      // Clear live markers while inspecting specific historical session
      employeeMarkersGroup.current?.clearLayers();
      employeeMarkersMapRef.current.clear();
      return;
    }

    const mGroup = employeeMarkersGroup.current;
    if (!mGroup) return;

    const filtered = employees.filter((emp) => {
      if (activeTabFilter === 'ON_SITE') return emp.workLocationType === 'ON_SITE';
      if (activeTabFilter === 'OFF_SITE') return emp.workLocationType === 'OFF_SITE';
      return true;
    });

    const activeEmpIds = new Set(filtered.map((e) => e.id));

    // Remove markers for employees who are no longer visible
    employeeMarkersMapRef.current.forEach((cached, empId) => {
      if (!activeEmpIds.has(empId)) {
        mGroup.removeLayer(cached.marker);
        mGroup.removeLayer(cached.trailPolyline);
        employeeMarkersMapRef.current.delete(empId);
      }
    });

    filtered.forEach((emp) => {
      if (!emp.liveLocation) return;
      const { latitude, longitude, heading = 0 } = emp.liveLocation;
      const isSelected = emp.id === selectedEmployeeId;

      const cached = employeeMarkersMapRef.current.get(emp.id);

      if (cached) {
        // Calculate bearing if moved
        let effectiveHeading = heading;
        const dist = Math.hypot(latitude - cached.lastLat, longitude - cached.lastLng);
        if (dist > 0.00005) {
          effectiveHeading = calculateBearing(cached.lastLat, cached.lastLng, latitude, longitude);
        }

        // Smoothly glide marker to new coordinates via hardware-accelerated CSS transition
        cached.marker.setLatLng([latitude, longitude]);
        cached.marker.setIcon(createEmployeeMarkerIcon(emp, isSelected, effectiveHeading));

        // Update live trailing breadcrumb line (keep last 20 coordinates)
        cached.trailPoints.push([latitude, longitude]);
        if (cached.trailPoints.length > 20) {
          cached.trailPoints.shift();
        }
        cached.trailPolyline.setLatLngs(cached.trailPoints);

        // Update cached values
        cached.lastLat = latitude;
        cached.lastLng = longitude;
        cached.heading = effectiveHeading;

        // Update popup dynamically if address is already known
        const addressKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
        if (addresses[addressKey]) {
          cached.marker.setPopupContent(buildEmployeePopupContent(emp, addresses[addressKey]));
        }
      } else {
        // Create new marker with smooth transition class
        const markerIcon = createEmployeeMarkerIcon(emp, isSelected, heading);
        const marker = L.marker([latitude, longitude], {
          icon: markerIcon,
          zIndexOffset: isSelected ? 1000 : 500,
        });

        // Initialize live breadcrumb trail
        const trailPoints: [number, number][] = [[latitude, longitude]];
        const trailPolyline = L.polyline(trailPoints, {
          color: emp.workLocationType === 'ON_SITE' ? '#10b981' : '#6366f1',
          weight: 3,
          opacity: 0.6,
          dashArray: '3, 6',
          lineCap: 'round',
        });

        marker.on('click', async () => {
          if (onSelectEmployee) onSelectEmployee(emp);

          const addressKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
          let currentAddress = addresses[addressKey];
          if (!currentAddress) {
            currentAddress = await reverseGeocode(latitude, longitude);
            setAddresses((prev) => ({ ...prev, [addressKey]: currentAddress }));
          }

          marker.bindPopup(buildEmployeePopupContent(emp, currentAddress)).openPopup();
        });

        mGroup.addLayer(trailPolyline);
        mGroup.addLayer(marker);

        employeeMarkersMapRef.current.set(emp.id, {
          marker,
          trailPolyline,
          trailPoints,
          lastLat: latitude,
          lastLng: longitude,
          heading,
        });
      }
    });

    // Smoothly pan to selected employee
    if (selectedEmployeeId) {
      const selected = employees.find((e) => e.id === selectedEmployeeId);
      if (selected?.liveLocation && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo(
          [selected.liveLocation.latitude, selected.liveLocation.longitude],
          17,
          { duration: 1.0 }
        );
      }
    }
  }, [employees, selectedEmployeeId, activeTabFilter, selectedSessionData]);

  // 5. Render Clear Path, Start/End Milestones & Checkpoints (Inspection Mode)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const rGroup = routeGroup.current;
    if (!rGroup) return;
    rGroup.clearLayers();
    traversedPolylineRef.current = null;
    basePolylineRef.current = null;
    playbackMarkerRef.current = null;

    if (!selectedSessionData) return;

    const points = selectedSessionData.routePoints || [];
    const checkpoints = selectedSessionData.checkpoints || [];

    if (points.length === 0 && checkpoints.length === 0) return;

    // A. Draw High-Contrast Route Polylines
    if (points.length >= 2) {
      const latlngs: [number, number][] = points.map((p) => [p.latitude, p.longitude]);

      // 1. Base route outline (full path)
      const basePoly = L.polyline(latlngs, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
      });
      rGroup.addLayer(basePoly);
      basePolylineRef.current = basePoly;

      // 2. Traversed progress line (highlights up to current playback position)
      const traversedPoly = L.polyline([], {
        color: '#10b981',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });
      rGroup.addLayer(traversedPoly);
      traversedPolylineRef.current = traversedPoly;

      // 3. Start Milestone Marker (Origin)
      const startPoint = points[0];
      const startIcon = L.divIcon({
        className: 'start-milestone-marker',
        html: `
          <div style="
            background: #16a34a;
            color: white;
            border: 3px solid #ffffff;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(22, 163, 74, 0.45);
            font-weight: 800;
            font-size: 13px;
          ">
            🏁
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const startMarker = L.marker([startPoint.latitude, startPoint.longitude], {
        icon: startIcon,
        zIndexOffset: 800,
      });
      startMarker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px;">
          <b style="color: #16a34a;">🟢 Journey Origin / Start Point</b><br/>
          Time: <b>${new Date(startPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>
        </div>
      `);
      rGroup.addLayer(startMarker);

      // 4. End Milestone Marker (Destination / Latest Point)
      const endPoint = points[points.length - 1];
      const endIcon = L.divIcon({
        className: 'end-milestone-marker',
        html: `
          <div style="
            background: #dc2626;
            color: white;
            border: 3px solid #ffffff;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.45);
            font-weight: 800;
            font-size: 13px;
          ">
            📍
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const endMarker = L.marker([endPoint.latitude, endPoint.longitude], {
        icon: endIcon,
        zIndexOffset: 800,
      });
      endMarker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px;">
          <b style="color: #dc2626;">🔴 Journey Destination / Latest Position</b><br/>
          Time: <b>${new Date(endPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>
        </div>
      `);
      rGroup.addLayer(endMarker);

      // Fit map bounds with padding
      mapInstanceRef.current.fitBounds(basePoly.getBounds(), { padding: [50, 50] });
    }

    // B. Draw Checkpoints / Stationary Dwell Stops
    checkpoints.forEach((cp, idx) => {
      const stopNumber = idx + 1;
      const cpIcon = L.divIcon({
        className: 'checkpoint-stop-marker',
        html: `
          <div style="
            background: #f59e0b;
            color: #78350f;
            border: 2px solid white;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
            border-radius: 14px;
            padding: 3px 8px;
            font-size: 11px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 3px;
            cursor: pointer;
            white-space: nowrap;
          ">
            <span>Stop ${stopNumber}</span>
          </div>
        `,
        iconSize: [54, 26],
        iconAnchor: [27, 13],
      });

      const marker = L.marker([cp.latitude, cp.longitude], { icon: cpIcon, zIndexOffset: 700 });

      marker.on('click', async () => {
        const key = `${cp.latitude.toFixed(4)},${cp.longitude.toFixed(4)}`;
        let addr = addresses[key];
        if (!addr) {
          addr = await reverseGeocode(cp.latitude, cp.longitude);
          setAddresses((prev) => ({ ...prev, [key]: addr }));
        }

        const arrived = new Date(cp.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const departed = cp.departedAt
          ? new Date(cp.departedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Present';

        marker
          .bindPopup(`
            <div style="font-family: system-ui, sans-serif; min-width: 220px;">
              <div style="font-weight: bold; color: #b45309; font-size: 13px; margin-bottom: 4px;">📍 Stop ${stopNumber}</div>
              <div style="font-size: 12px; color: #0f172a; margin-bottom: 6px; line-height: 1.4;">${addr}</div>
              <div style="font-size: 11px; color: #64748b;">
                Stay: <b>${arrived}</b> – <b>${departed}</b>
              </div>
              ${cp.notes ? `<div style="font-size: 11px; color: #475569; margin-top: 4px; font-style: italic;">"${cp.notes}"</div>` : ''}
            </div>
          `)
          .openPopup();
      });

      rGroup.addLayer(marker);
    });

    // Reverse geocode all stops for sidebar
    checkpoints.forEach(async (cp) => {
      const key = `${cp.latitude.toFixed(4)},${cp.longitude.toFixed(4)}`;
      if (!addresses[key]) {
        const addr = await reverseGeocode(cp.latitude, cp.longitude);
        setAddresses((prev) => ({ ...prev, [key]: addr }));
      }
    });
  }, [selectedSessionData]);

  // 6. Timeline Playback Logic with Smooth Movement Interpolation
  const points = selectedSessionData?.routePoints || [];

  const handleTogglePlay = () => {
    if (points.length < 2) return;
    setIsPlaying((prev) => !prev);
  };

  const handleResetPlayback = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
    if (points.length > 0 && mapInstanceRef.current) {
      updatePlaybackMarker(0);
    }
  };

  const updatePlaybackMarker = (progressPercent: number) => {
    const rGroup = routeGroup.current;
    if (points.length === 0 || !mapInstanceRef.current || !rGroup) return;

    const totalSegments = points.length - 1;
    const floatIndex = (progressPercent / 100) * totalSegments;
    const index = Math.min(Math.floor(floatIndex), totalSegments - 1);
    const ratio = floatIndex - index;

    const p1 = points[index];
    const p2 = points[Math.min(index + 1, totalSegments)];

    // Exact linear interpolation between coordinates
    const curLat = p1.latitude + (p2.latitude - p1.latitude) * ratio;
    const curLng = p1.longitude + (p2.longitude - p1.longitude) * ratio;
    const heading = calculateBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);

    // Update dynamically traversed green polyline
    if (traversedPolylineRef.current) {
      const traversedPoints: [number, number][] = points.slice(0, index + 1).map((p) => [p.latitude, p.longitude]);
      traversedPoints.push([curLat, curLng]);
      traversedPolylineRef.current.setLatLngs(traversedPoints);
    }

    if (!playbackMarkerRef.current) {
      const movingIcon = L.divIcon({
        className: 'playback-runner-marker leaflet-smooth-marker',
        html: `
          <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
            <!-- Direction Indicator Cone -->
            <div style="
              position: absolute;
              top: -6px;
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-bottom: 8px solid #7c3aed;
              transform: rotate(${heading}deg);
              transform-origin: 50% 21px;
            "></div>
            <!-- Runner Core Icon -->
            <div style="
              background: #7c3aed;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              border: 3px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 14px rgba(124, 58, 237, 0.6);
              color: white;
              font-size: 14px;
            ">
              🏃
            </div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      const marker = L.marker([curLat, curLng], { icon: movingIcon, zIndexOffset: 1200 });
      playbackMarkerRef.current = marker;
      rGroup.addLayer(marker);
    } else {
      playbackMarkerRef.current.setLatLng([curLat, curLng]);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      return;
    }

    const intervalMs = Math.max(50, Math.floor(300 / playbackSpeed));
    playbackTimerRef.current = setInterval(() => {
      setPlaybackProgress((prev) => {
        if (prev >= 100) {
          setIsPlaying(false);
          return 100;
        }
        const next = Math.min(prev + 1, 100);
        updatePlaybackMarker(next);
        return next;
      });
    }, intervalMs);

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, points]);

  // Current playback point info
  const currentPlaybackIndex = Math.min(
    Math.floor((playbackProgress / 100) * (points.length - 1)),
    points.length - 1
  );
  const currentPlaybackPoint = points.length > 0 ? points[currentPlaybackIndex] : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-md">
      {/* Top Map Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <Radio className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-white">OpenStreetMap & Satellite Telemetry</span>
            <span className="ml-2 text-[11px] text-slate-400">100% Free • Street & Aerial Satellite Layers</span>
          </div>
        </div>

        {/* Filter and Layer Switcher */}
        <div className="flex items-center gap-2">
          {/* Work Location Filter (only when not inspecting session) */}
          {!selectedSessionData && (
            <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                onClick={() => setActiveTabFilter('ALL')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeTabFilter === 'ALL' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({employees.length})
              </button>
              <button
                onClick={() => setActiveTabFilter('ON_SITE')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeTabFilter === 'ON_SITE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                On-Site
              </button>
              <button
                onClick={() => setActiveTabFilter('OFF_SITE')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeTabFilter === 'OFF_SITE' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Off-Site
              </button>
            </div>
          )}

          {/* Tile Layer Selector */}
          <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
            <button
              onClick={() => setSelectedTileStyle('osm')}
              title="OpenStreetMap Standard Street View"
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                selectedTileStyle === 'osm' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🗺️ Street
            </button>
            <button
              onClick={() => setSelectedTileStyle('hybrid')}
              title="Satellite Hybrid (Photographic Aerial + Streets & Landmarks)"
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                selectedTileStyle === 'hybrid' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🛰️ Satellite Hybrid
            </button>
            <button
              onClick={() => setSelectedTileStyle('satellite')}
              title="Pure High-Resolution Satellite Imagery (Esri World Imagery)"
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                selectedTileStyle === 'satellite' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🌍 Satellite
            </button>
            <button
              onClick={() => setSelectedTileStyle('cartoLight')}
              title="CARTO Positron Clean Light"
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                selectedTileStyle === 'cartoLight' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setSelectedTileStyle('cartoDark')}
              title="CARTO Dark Matter"
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                selectedTileStyle === 'cartoDark' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dark
            </button>
          </div>

          {/* Toggle Geofence Circle */}
          <button
            onClick={() => setShowGeofence(!showGeofence)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              showGeofence
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            50m Geofence
          </button>
        </div>
      </div>

      {/* Main Map View + Sidebar Container */}
      <div className="relative flex" style={{ height }}>
        {/* Leaflet Map Div */}
        <div ref={mapContainerRef} className="flex-1 w-full h-full z-0" />

        {/* Timeline Stops Sidebar (Google Timeline Style) */}
        {selectedSessionData && showTimelineSidebar && (
          <div className="w-80 border-l border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-col z-10 shadow-2xl">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Employee Timeline Stops
                </h4>
                <div className="text-[11px] text-slate-400">
                  {selectedSessionData.checkpoints?.length || 0} stops recorded
                </div>
              </div>
              <button
                onClick={() => setShowTimelineSidebar(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stops List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
              {(!selectedSessionData.checkpoints || selectedSessionData.checkpoints.length === 0) ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No stationary stops recorded for this session. Continuous transit movement.
                </div>
              ) : (
                selectedSessionData.checkpoints.map((cp, idx) => {
                  const key = `${cp.latitude.toFixed(4)},${cp.longitude.toFixed(4)}`;
                  const addr = addresses[key] || 'Looking up street address...';
                  const arrived = new Date(cp.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.setView([cp.latitude, cp.longitude], 18, { animate: true });
                        }
                      }}
                      className="cursor-pointer rounded-xl border border-slate-800 bg-slate-800/60 p-3 hover:border-amber-500/50 hover:bg-slate-800 transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px]">
                            {idx + 1}
                          </span>
                          Stop {idx + 1}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{arrived}</span>
                      </div>
                      <div className="text-white font-medium line-clamp-2 my-1 leading-snug">
                        {addr}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between mt-2 pt-1 border-t border-slate-700/50">
                        <span>Lat: {cp.latitude.toFixed(4)}, Lng: {cp.longitude.toFixed(4)}</span>
                        {cp.notes && <span className="text-amber-300 font-medium">{cp.notes}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Close Session Button */}
            {onCloseSession && (
              <div className="p-3 border-t border-slate-800 bg-slate-900">
                <button
                  onClick={onCloseSession}
                  className="w-full rounded-xl bg-slate-800 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
                >
                  Exit Route Inspection
                </button>
              </div>
            )}
          </div>
        )}

        {/* Toggle Sidebar Icon Button (if hidden) */}
        {selectedSessionData && !showTimelineSidebar && (
          <button
            onClick={() => setShowTimelineSidebar(true)}
            className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-white shadow-xl hover:bg-slate-800"
          >
            <Clock className="h-4 w-4 text-amber-400" />
            Show Stops Timeline
          </button>
        )}
      </div>

      {/* Bottom Timeline Playback Bar (Visible when reviewing route session) */}
      {selectedSessionData && points.length > 0 && (
        <div className="border-t border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Play/Pause & Reset */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white ml-0.5" />}
              </button>
              <button
                onClick={handleResetPlayback}
                title="Reset to Start"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* Speed Multiplier */}
              <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
                {[1, 2, 5, 10].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                      playbackSpeed === speed ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Playback Progress Slider */}
            <div className="flex-1 min-w-[200px] flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={playbackProgress}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPlaybackProgress(val);
                  updatePlaybackMarker(val);
                }}
                className="w-full h-1.5 rounded-lg appearance-none bg-slate-800 accent-purple-500 cursor-pointer"
              />
              <span className="font-mono text-xs text-slate-400 min-w-[40px] text-right">
                {playbackProgress}%
              </span>
            </div>

            {/* Current Point Telemetry Readout */}
            {currentPlaybackPoint && (
              <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-purple-400" />
                  <span>{new Date(currentPlaybackPoint.timestamp).toLocaleTimeString()}</span>
                </div>
                {currentPlaybackPoint.speed != null && (
                  <div className="flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{(currentPlaybackPoint.speed * 3.6).toFixed(1)} km/h</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
