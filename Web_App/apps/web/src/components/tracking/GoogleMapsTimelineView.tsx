'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { api } from '@/lib/api';
import { reverseGeocode } from '@/lib/geocoding';
import { StompClient } from '@/lib/stomp';
import { fetchRoadGeometry } from './FieldTrackingMap';
import {
  MapPin,
  Calendar,
  Clock,
  Navigation,
  Car,
  Footprints,
  Play,
  Pause,
  RotateCcw,
  Layers,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  User,
  Search,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Zap,
  Battery,
  Radio,
  Building2,
  Crosshair,
  Maximize2,
  Plus,
  Minus,
} from 'lucide-react';

interface StopItem {
  index: number;
  id: string;
  name: string;
  tag: string;
  timestamp?: string;
  timeRange: string;
  durationText: string;
  address: string;
  latitude: number;
  longitude: number;
  isOffice: boolean;
}

interface TransitItem {
  fromStopIndex: number;
  toStopIndex: number;
  mode: 'DRIVING' | 'WALKING';
  distanceKm: number;
  durationText: string;
}

interface DayItem {
  date: string;
  label: string;
  isToday: boolean;
  isSelected?: boolean;
}

interface TimelineResponse {
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    avatarUrl?: string;
    department: string;
    designation: string;
    workLocationType: 'ON_SITE' | 'OFF_SITE';
  };
  date: string;
  availableDays: DayItem[];
  tripSummary: {
    title: string;
    totalPlaces: number;
    totalDistanceKm: number;
    totalDurationText: string;
    startTime: string | null;
    endTime: string | null;
    hasTravelData: boolean;
  };
  stops: StopItem[];
  transits: TransitItem[];
  routePolyline: Array<[number, number]>;
  liveLocation?: {
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
    isOnline: boolean;
  } | null;
  office?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    address: string;
  } | null;
}

interface GoogleMapsTimelineViewProps {
  employees: any[];
  initialEmployeeId?: string;
  onSelectEmployee?: (emp: any) => void;
  onRefreshParent?: () => void;
}

// Free Open-Source Raster Map Tiles: CartoDB Positron primary for Google Maps neutral aesthetic
const TILE_LAYERS = {
  carto: {
    name: 'CartoDB Positron (Neutral Palette)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  osm: {
    name: 'Standard OSM Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  satellite: {
    name: 'Satellite Hybrid (Aerial)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
    maxZoom: 19,
    subdomains: [],
  },
};

export default function GoogleMapsTimelineView({
  employees,
  initialEmployeeId,
  onSelectEmployee,
  onRefreshParent,
}: GoogleMapsTimelineViewProps) {
  // Current Selected Employee & Date
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialEmployeeId || employees[0]?.id || ''
  );

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Date Picker Dropdowns (Year, Month, Day)
  const currentDateObj = useMemo(() => new Date(selectedDate), [selectedDate]);
  const [selectedYear, setSelectedYear] = useState<number>(currentDateObj.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDateObj.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number>(currentDateObj.getDate());

  // Collapsible stop history toggle in left card
  const [isStopsCollapsed, setIsStopsCollapsed] = useState(false);

  // Timeline Data State
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null);

  // Real-Time Street Address for Current Live Position
  const [liveStreetAddress, setLiveStreetAddress] = useState<string>('Resolving landmark address...');

  // Active Tile Layer: Default CartoDB Positron
  const [activeLayerKey, setActiveLayerKey] = useState<keyof typeof TILE_LAYERS>('carto');

  // Playback Animation State (1x, 2x, 5x)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 100%
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 5x
  const animFrameRef = useRef<number | null>(null);

  // Map & Layer Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const animMarkerRef = useRef<L.Marker | null>(null);
  const liveMarkerRef = useRef<L.Marker | null>(null);

  // STOMP WebSocket Client Ref
  const stompClientRef = useRef<StompClient | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Sync date picker dropdowns when selectedDate changes
  useEffect(() => {
    const d = new Date(selectedDate);
    if (!isNaN(d.getTime())) {
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth() + 1);
      setSelectedDay(d.getDate());
    }
  }, [selectedDate]);

  // Handle dropdown change (Year, Month, Day)
  const handleDropdownDateChange = (y: number, m: number, d: number) => {
    setSelectedYear(y);
    setSelectedMonth(m);
    setSelectedDay(d);
    const mStr = String(m).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    setSelectedDate(`${y}-${mStr}-${dStr}`);
  };

  // Synchronize initialEmployeeId when changed from parent
  useEffect(() => {
    if (initialEmployeeId) {
      setSelectedEmpId(initialEmployeeId);
    }
  }, [initialEmployeeId]);

  // Fetch Timeline Data from Backend
  const fetchTimeline = useCallback(
    async (empId: string, date: string, quiet = false) => {
      if (!empId) return;
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        // Try NestJS API first, fallback to Spring Boot microservice if standalone
        let data: TimelineResponse;
        try {
          data = await api.get<TimelineResponse>('/tracking/timeline', {
            employeeId: empId,
            date,
          });
        } catch {
          // Fallback to Spring Boot port 8080 endpoint
          const res = await fetch(`http://localhost:8080/api/timeline?userId=${empId}&date=${date}`);
          data = await res.json();
        }

        // Secondary fallback to Traccar / Attendance history proxy if no session points exist
        if ((!data?.stops || data.stops.length === 0) && (!data?.routePolyline || data.routePolyline.length === 0)) {
          try {
            const histRes = await fetch(`/api/tracking/history?employeeCode=${encodeURIComponent(empId)}&date=${date}`);
            if (histRes.ok) {
              const hist = await histRes.json();
              if (hist.waypoints && hist.waypoints.length > 0) {
                const waypoints = hist.waypoints.map((w: any) => [w.lat, w.lng] as [number, number]);
                const histStops = (hist.stops || []).map((s: any) => ({
                  index: s.index,
                  id: `stop-${s.index}`,
                  name: s.address || `Stop #${s.index}`,
                  tag: 'MISSION STOP',
                  timestamp: new Date().toISOString(),
                  timeRange: `${s.arrivalIst} - ${s.departureIst}`,
                  durationText: s.durationFormatted || 'Stationary',
                  address: s.address,
                  latitude: s.lat,
                  longitude: s.lng,
                  isOffice: false,
                }));

                const histTransits = [];
                for (let i = 0; i < histStops.length - 1; i++) {
                  histTransits.push({
                    fromStopIndex: histStops[i].index,
                    toStopIndex: histStops[i + 1].index,
                    mode: 'DRIVING' as const,
                    distanceKm: Number(((hist.tripSummary?.totalDistanceKm || 5) / Math.max(1, histStops.length - 1)).toFixed(1)),
                    durationText: '15 mins',
                  });
                }

                data = {
                  ...data,
                  routePolyline: waypoints,
                  stops: histStops,
                  transits: histTransits,
                  tripSummary: {
                    ...data.tripSummary,
                    totalPlaces: histStops.length > 0 ? histStops.length : 1,
                    totalDistanceKm: hist.tripSummary?.totalDistanceKm || data.tripSummary.totalDistanceKm,
                    totalDurationText: hist.tripSummary?.totalDurationText || data.tripSummary.totalDurationText,
                    hasTravelData: true,
                  },
                };
              }
            }
          } catch (_) {}
        }

        setTimelineData(data);

        // Reverse-geocode all timeline stops to display real street/locality address
        if (data.stops && data.stops.length > 0) {
          Promise.all(
            data.stops.map(async (stop) => {
              try {
                const realAddr = await reverseGeocode(stop.latitude, stop.longitude);
                return {
                  ...stop,
                  address: realAddr,
                  name: stop.name && !stop.name.includes('Bangalore') && !stop.name.includes('Departure Point') && !stop.name.includes('Field Waypoint')
                    ? stop.name
                    : realAddr,
                };
              } catch {
                return stop;
              }
            })
          ).then((updatedStops) => {
            setTimelineData((prev) => (prev ? { ...prev, stops: updatedStops } : prev));
          });
        }

        // Reverse-geocode current real live location if present
        if (data.liveLocation) {
          reverseGeocode(data.liveLocation.latitude, data.liveLocation.longitude)
            .then((addr) => setLiveStreetAddress(addr))
            .catch(() => setLiveStreetAddress(`${data.liveLocation!.latitude.toFixed(5)}, ${data.liveLocation!.longitude.toFixed(5)}`));
        } else {
          setLiveStreetAddress('Awaiting GPS broadcast');
        }

        if (!quiet) {
          setPlaybackProgress(0);
          setIsPlaying(false);
        }
      } catch (err) {
        console.error('Failed to fetch timeline data:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedEmpId) {
      fetchTimeline(selectedEmpId, selectedDate);
    }
  }, [selectedEmpId, selectedDate, fetchTimeline]);

  // C. Live Tracking via STOMP: Subscribe to /topic/employee/{userId}
  useEffect(() => {
    if (!selectedEmpId) return;

    // Connect to Spring Boot WebSocket STOMP broker
    const wsUrl = process.env.NEXT_PUBLIC_TRACKING_WS_URL || 'ws://localhost:8080/ws-tracking';
    const client = new StompClient(
      wsUrl,
      () => {
        setIsWsConnected(true);
      },
      () => {
        setIsWsConnected(false);
      }
    );

    client.connect();
    stompClientRef.current = client;

    // Subscribe to employee channel
    const unsubscribe = client.subscribe(`/topic/employee/${selectedEmpId}`, (packet: any) => {
      if (!packet || typeof packet.latitude !== 'number' || typeof packet.longitude !== 'number') {
        return;
      }

      const newLat = packet.latitude;
      const newLng = packet.longitude;

      // 1. Smoothly update live marker position with pulse animation
      if (liveMarkerRef.current && mapInstanceRef.current) {
        liveMarkerRef.current.setLatLng([newLat, newLng]);
      }

      // 2. Append new coordinate to polyline without re-rendering the whole map
      if (routeLayerRef.current) {
        routeLayerRef.current.addLatLng([newLat, newLng]);
      }

      // 3. Update state telemetry info
      setTimelineData((prev) => {
        if (!prev) return prev;
        const updatedLive = {
          latitude: newLat,
          longitude: newLng,
          speed: packet.speed || 0,
          heading: packet.heading || 0,
          accuracy: packet.accuracy || 5,
          isMoving: !packet.isStationary,
          batteryLevel: packet.batteryLevel || 95,
          isWithinOfficeHours: true,
          isWithinGeofence: true,
          updatedAt: packet.timestamp || new Date().toISOString(),
          isOnline: true,
        };

        const updatedPolyline: Array<[number, number]> = [...(prev.routePolyline || []), [newLat, newLng]];

        return {
          ...prev,
          liveLocation: updatedLive,
          routePolyline: updatedPolyline,
        };
      });

      // Quick reverse-geocode
      reverseGeocode(newLat, newLng)
        .then((addr) => setLiveStreetAddress(addr))
        .catch(() => {});
    });

    return () => {
      unsubscribe();
      client.disconnect();
      stompClientRef.current = null;
    };
  }, [selectedEmpId]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default CartoDB Positron Map
    const map = L.map(mapContainerRef.current, {
      center: [13.0498, 77.6202],
      zoom: 14,
      zoomControl: false, // Customized bottom-right controls
    });

    const activeLayer = TILE_LAYERS[activeLayerKey];
    const tl = L.tileLayer(activeLayer.url, {
      attribution: activeLayer.attribution,
      maxZoom: activeLayer.maxZoom,
      subdomains: activeLayer.subdomains,
    }).addTo(map);

    tileLayerRef.current = tl;
    markersGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const layer = TILE_LAYERS[activeLayerKey];
    tileLayerRef.current = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      maxZoom: layer.maxZoom,
      subdomains: layer.subdomains,
    }).addTo(mapInstanceRef.current);
  }, [activeLayerKey]);

  // Render Real Route Polyline, Stop Waypoint Markers & Live Pin on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !timelineData) return;

    // Clear previous markers
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    if (animMarkerRef.current) {
      map.removeLayer(animMarkerRef.current);
      animMarkerRef.current = null;
    }
    liveMarkerRef.current = null;

    const { stops, routePolyline, liveLocation, office } = timelineData;
    const hasStops = stops && stops.length > 0;
    const hasRoute = routePolyline && routePolyline.length > 1;

    // 1. Office Geofence Circle Visualization
    if (office && office.latitude && office.longitude) {
      const officeCircle = L.circle([office.latitude, office.longitude], {
        radius: office.radiusMeters || 50,
        color: '#059669',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.16,
        dashArray: '5, 5',
      });
      officeCircle.bindTooltip(
        `<b>🏢 ${office.name}</b><br/>${office.radiusMeters || 50}m Office Attendance Geofence`,
        { direction: 'top' }
      );
      markersGroupRef.current?.addLayer(officeCircle);
    }

    // 2. Custom cyan/blue polyline (#0288d1, width: 4px) with Start & End Milestones
    // Uses OSRM road-snapping engine so polyline hugs real streets instead of straight lines
    const pointsToDraw = hasRoute
      ? routePolyline
      : (hasStops && stops.length > 1 ? stops.map((s) => [s.latitude, s.longitude] as [number, number]) : []);

    if (pointsToDraw.length > 1) {
      const polyline = L.polyline(pointsToDraw, {
        color: '#0288d1',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      });
      polyline.addTo(map);
      routeLayerRef.current = polyline;

      // Asynchronously fetch road-snapped geometry from OSRM
      fetchRoadGeometry(pointsToDraw).then((snapped) => {
        if (routeLayerRef.current && snapped && snapped.length > 0) {
          routeLayerRef.current.setLatLngs(snapped);
        }
      });

      // Start / Origin Milestone Marker (Green)
      const startCoord = pointsToDraw[0];
      const startIcon = L.divIcon({
        className: 'start-milestone-marker',
        html: `
          <div style="
            background: #16a34a;
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            font-size: 12px;
          ">
            🏁
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const startMarker = L.marker(startCoord, { icon: startIcon, zIndexOffset: 950 });
      startMarker.bindTooltip('<b>🟢 Journey Start / Origin</b>', { direction: 'top' });
      markersGroupRef.current?.addLayer(startMarker);

      // Destination / Latest Milestone Marker (Red)
      const endCoord = pointsToDraw[pointsToDraw.length - 1];
      const endIcon = L.divIcon({
        className: 'end-milestone-marker',
        html: `
          <div style="
            background: #dc2626;
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            font-size: 12px;
          ">
            📍
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const endMarker = L.marker(endCoord, { icon: endIcon, zIndexOffset: 950 });
      endMarker.bindTooltip('<b>🔴 Journey Destination / Latest Stop</b>', { direction: 'top' });
      markersGroupRef.current?.addLayer(endMarker);

      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }

    // 2. Circular waypoint icons with clean hover tooltips
    if (hasStops) {
      stops.forEach((stop) => {
        const isSelected = activeStopIndex === stop.index;

        const waypointHtml = `
          <div class="waypoint-pin" style="
            width: 30px;
            height: 30px;
            background: ${stop.isOffice ? '#059669' : '#0288d1'};
            color: #ffffff;
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 12px;
            font-family: ui-sans-serif, system-ui;
            transform: ${isSelected ? 'scale(1.25)' : 'scale(1.0)'};
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
          ">
            ${stop.index}
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-stop-marker',
          html: waypointHtml,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const marker = L.marker([stop.latitude, stop.longitude], { icon: customIcon });

        // Clean hover tooltip showing: stop time, stay duration, and landmark address
        const tooltipHtml = `
          <div style="font-family: ui-sans-serif, system-ui; padding: 4px 6px; font-size: 11px; line-height: 1.4;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px;">
              Stop #${stop.index}: ${stop.name}
            </div>
            <div style="color: #0288d1; font-weight: 700; margin-bottom: 2px;">
              🕒 ${stop.timeRange} (${stop.durationText})
            </div>
            <div style="color: #64748b; font-size: 10px; max-width: 220px;">
              📍 ${stop.address}
            </div>
          </div>
        `;

        marker.bindTooltip(tooltipHtml, {
          direction: 'top',
          offset: [0, -12],
          className: 'clean-waypoint-tooltip',
        });

        marker.on('click', () => {
          setActiveStopIndex(stop.index);
        });

        markersGroupRef.current?.addLayer(marker);
      });
    }

    // 3. Live Location Pin with Smooth Pulse Animation
    if (liveLocation) {
      const livePulseHtml = `
        <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
          <div style="
            position: absolute;
            width: 40px;
            height: 40px;
            background: rgba(2, 136, 209, 0.35);
            border-radius: 50%;
            animation: pulseWave 1.8s infinite ease-out;
          "></div>
          <div style="
            width: 26px;
            height: 26px;
            background: #0288d1;
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(2, 136, 209, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 13px;
          ">
            📍
          </div>
        </div>
      `;

      const liveIcon = L.divIcon({
        className: 'live-pulse-marker leaflet-smooth-marker',
        html: livePulseHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const liveMarker = L.marker([liveLocation.latitude, liveLocation.longitude], {
        icon: liveIcon,
        zIndexOffset: 1000,
      });

      liveMarker.bindPopup(`
        <div style="font-family: ui-sans-serif, system-ui; font-size: 12px; padding: 2px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px;">
            ${timelineData.employee.fullName} (Live Pin)
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">
            ${liveStreetAddress}
          </div>
          <div style="background: #f8fafc; border-radius: 6px; padding: 4px 6px; font-size: 10px; color: #334155; font-family: monospace;">
            Speed: ${liveLocation.speed ? `${(liveLocation.speed * 3.6).toFixed(1)} km/h` : '0 km/h'} • Accuracy: ${liveLocation.accuracy || 5}m
          </div>
        </div>
      `);

      markersGroupRef.current?.addLayer(liveMarker);
      liveMarkerRef.current = liveMarker;
    }

    // 4. Playback Animation Pin
    if (hasRoute) {
      const animIconHtml = `
        <div style="
          width: 32px;
          height: 32px;
          background: #f59e0b;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 15px;
        ">
          🏃
        </div>
      `;
      const animIcon = L.divIcon({
        className: 'playback-anim-marker',
        html: animIconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const animMarker = L.marker(routePolyline[0], {
        icon: animIcon,
        zIndexOffset: 1200,
      });
      markersGroupRef.current?.addLayer(animMarker);
      animMarkerRef.current = animMarker;
    }
  }, [timelineData, activeStopIndex, liveStreetAddress]);

  // C. Historical Playback Mode: Scrubber bar animation with 1x, 2x, 5x speed
  useEffect(() => {
    if (!isPlaying || !timelineData?.routePolyline?.length || timelineData.routePolyline.length < 2) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const poly = timelineData.routePolyline;
    let startTime: number | null = null;
    const baseDurationMs = Math.max(10000, poly.length * 400); // Base duration proportional to points
    const duration = baseDurationMs / playbackSpeed;
    const startProgress = playbackProgress / 100;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, startProgress + elapsed / duration);
      const percent = progress * 100;

      setPlaybackProgress(percent);

      // Interpolate coordinate along polyline
      const floatIndex = progress * (poly.length - 1);
      const index = Math.floor(floatIndex);
      const nextIndex = Math.min(poly.length - 1, index + 1);
      const ratio = floatIndex - index;

      const lat = poly[index][0] + (poly[nextIndex][0] - poly[index][0]) * ratio;
      const lng = poly[index][1] + (poly[nextIndex][1] - poly[index][1]) * ratio;

      if (animMarkerRef.current) {
        animMarkerRef.current.setLatLng([lat, lng]);
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        setPlaybackProgress(100);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, timelineData?.routePolyline]);

  // Interactive focus: Clicking any stop smoothly pans and zooms
  const handleFlyToStop = (stop: StopItem) => {
    setActiveStopIndex(stop.index);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([stop.latitude, stop.longitude], 17, {
        duration: 1.2,
      });
    }
  };

  // Center on Live User Pin
  const handleCenterOnLiveLocation = () => {
    if (mapInstanceRef.current && timelineData?.liveLocation) {
      mapInstanceRef.current.flyTo(
        [timelineData.liveLocation.latitude, timelineData.liveLocation.longitude],
        17,
        { duration: 1.2 }
      );
    }
  };

  // Fit Route Bounds
  const handleFitBounds = () => {
    if (!mapInstanceRef.current) return;
    if (routeLayerRef.current) {
      mapInstanceRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });
    } else if (timelineData?.stops?.length) {
      const bounds = L.latLngBounds(timelineData.stops.map((s) => [s.latitude, s.longitude]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const live = timelineData?.liveLocation;

  return (
    <div className="space-y-4 font-sans text-slate-800">
      <style jsx global>{`
        @keyframes pulseWave {
          0% {
            transform: scale(0.6);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
        .clean-waypoint-tooltip {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
          color: #0f172a !important;
        }
        .clean-waypoint-tooltip:before {
          border-top-color: #ffffff !important;
        }
      `}</style>

      {/* 1. Header Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Header with App Icon & Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0288d1] text-white shadow-md">
              <Navigation className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {isWsConnected ? 'STOMP Telemetry Live' : 'Polling Sync Mode'}
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Timeline</h1>
            </div>

            {/* Employee Selector */}
            <select
              value={selectedEmpId}
              onChange={(e) => {
                setSelectedEmpId(e.target.value);
                const found = employees.find((x) => x.id === e.target.value);
                if (found && onSelectEmployee) onSelectEmployee(found);
              }}
              className="ml-2 h-10 rounded-xl border border-slate-300 bg-slate-50 px-3 pr-8 text-xs font-bold text-slate-800 shadow-xs hover:border-[#0288d1] focus:border-[#0288d1] focus:bg-white focus:outline-none transition cursor-pointer"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker Controls: Dropdowns (Year, Month, Day) & TODAY button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
              <Calendar className="ml-1 h-3.5 w-3.5 text-slate-500" />
              {/* Year Dropdown */}
              <select
                value={selectedYear}
                onChange={(e) => handleDropdownDateChange(Number(e.target.value), selectedMonth, selectedDay)}
                className="bg-transparent px-1.5 py-1 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* Month Dropdown */}
              <select
                value={selectedMonth}
                onChange={(e) => handleDropdownDateChange(selectedYear, Number(e.target.value), selectedDay)}
                className="bg-transparent px-1.5 py-1 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>

              {/* Day Dropdown */}
              <select
                value={selectedDay}
                onChange={(e) => handleDropdownDateChange(selectedYear, selectedMonth, Number(e.target.value))}
                className="bg-transparent px-1.5 py-1 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* TODAY Shortcut */}
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer ${
                selectedDate === todayStr
                  ? 'bg-[#0288d1] text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              TODAY
            </button>

            {/* Manual Sync Button */}
            <button
              type="button"
              onClick={() => fetchTimeline(selectedEmpId, selectedDate, true)}
              disabled={isRefreshing}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition shadow-xs cursor-pointer"
              title="Sync latest route points and stops"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#0288d1]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Google Timeline Workspace: Left Floating Timeline Card + Right Leaflet Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start relative">
        {/* B. Left Floating Timeline Card (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden flex flex-col h-[680px] z-10">
          {/* Trip Summary Header */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/40 p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Daily Trip Summary
              </span>
              <button
                type="button"
                onClick={() => setIsStopsCollapsed(!isStopsCollapsed)}
                className="flex items-center gap-1 text-[11px] font-bold text-[#0288d1] hover:underline cursor-pointer"
              >
                <span>{isStopsCollapsed ? 'Expand Stops' : 'Collapse'}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isStopsCollapsed ? '-rotate-90' : ''}`} />
              </button>
            </div>

            <h2 className="text-base font-extrabold text-slate-900">
              {timelineData?.tripSummary.title || 'Recorded Operational Journey'}
            </h2>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              {selectedDate} • {timelineData?.employee?.fullName}
            </div>

            {/* Summary Stat Chips */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white border border-slate-200 p-2 shadow-2xs">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Visited</span>
                <strong className="text-xs font-black text-slate-800">
                  {timelineData?.tripSummary.totalPlaces ?? 0} places
                </strong>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-2 shadow-2xs">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Distance</span>
                <strong className="text-xs font-black text-[#0288d1]">
                  {timelineData?.tripSummary.totalDistanceKm ?? 0} km
                </strong>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-2 shadow-2xs">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Duration</span>
                <strong className="text-xs font-black text-slate-800">
                  {timelineData?.tripSummary.totalDurationText ?? 'Active'}
                </strong>
              </div>
            </div>
          </div>

          {/* Vertical Chronological Step-Timeline */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#0288d1] border-t-transparent" />
                <span className="text-xs font-semibold">Loading recorded landmark route...</span>
              </div>
            ) : timelineData?.stops && timelineData.stops.length > 0 ? (
              !isStopsCollapsed && (
                timelineData.stops.map((stop, idx) => {
                  const isSelected = activeStopIndex === stop.index;
                  const transit = timelineData.transits?.[idx];
                  const exactTime = stop.timestamp
                    ? new Date(stop.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                    : (stop.timeRange.split(' – ')[0] || stop.timeRange.split(' - ')[0] || stop.timeRange);

                  return (
                    <div key={stop.id} className="relative">
                      {/* Step Card with Visual Node & Connecting Line */}
                      <div
                        onClick={() => handleFlyToStop(stop)}
                        className={`group rounded-2xl border p-3.5 transition cursor-pointer ${
                          isSelected
                            ? 'border-[#0288d1] bg-blue-50/70 shadow-md ring-2 ring-blue-200'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Distinct Visual Node & Dotted/Solid Line */}
                          <div className="flex flex-col items-center self-stretch pt-0.5">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white shadow-xs ${
                                stop.isOffice ? 'bg-emerald-600' : 'bg-[#0288d1]'
                              }`}
                            >
                              {stop.index}
                            </div>
                            {idx < timelineData.stops.length - 1 && (
                              <div className="w-0.5 flex-1 bg-slate-200 my-1 border-l-2 border-dotted border-slate-300" />
                            )}
                          </div>

                          {/* Exact Time & User Location Address beside the time */}
                          <div className="flex-1 min-w-0">
                            {/* Time & Tag */}
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-900 font-mono border border-slate-200">
                                  <Clock className="h-3 w-3 text-[#0288d1]" />
                                  {exactTime}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
                                    stop.isOffice
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {stop.tag}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {stop.durationText}
                              </span>
                            </div>

                            {/* Location Address right beside / with the time */}
                            <div className="mt-1.5 flex items-start gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                              <p className="text-xs font-bold text-slate-800 leading-snug group-hover:text-[#0288d1] transition">
                                {stop.address || stop.name}
                              </p>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span>
                                {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                              </span>
                              <span className="text-[#0288d1] font-bold opacity-0 group-hover:opacity-100 transition">
                                Zoom to stop →
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Transit connecting segment between stops */}
                      {transit && (
                        <div className="my-2 ml-10 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[#0288d1]">
                            <Car className="h-3.5 w-3.5" />
                          </div>
                          <span>
                            {transit.mode === 'DRIVING' ? 'Driving' : 'Walking'} • {transit.distanceKm} km • {transit.durationText}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-slate-500 space-y-2">
                <Radio className="mx-auto h-8 w-8 text-[#0288d1] animate-pulse" />
                <h4 className="text-xs font-bold text-slate-800">Awaiting Movement Breadcrumbs</h4>
                <p className="text-[11px] text-slate-400">
                  No stationary stops logged yet for {selectedDate}. Live coordinates stream in real time as the employee conducts field duties.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Interactive Leaflet Map View & Controls (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-[680px] rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden relative">
          {/* Leaflet Map Target */}
          <div ref={mapContainerRef} className="w-full flex-1 z-0" />

          {/* C. Historical Playback Scrubber Bar (Top-Right Overlay) */}
          {timelineData?.routePolyline && timelineData.routePolyline.length > 1 && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 p-2 shadow-lg text-xs font-bold text-slate-700">
              {/* Play / Pause */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0288d1] text-white hover:bg-blue-600 transition shadow-sm cursor-pointer"
                title={isPlaying ? 'Pause Playback' : 'Play Timeline Route'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>

              {/* Reset */}
              <button
                type="button"
                onClick={() => {
                  setPlaybackProgress(0);
                  setIsPlaying(false);
                  if (timelineData?.routePolyline?.[0] && animMarkerRef.current) {
                    animMarkerRef.current.setLatLng(timelineData.routePolyline[0]);
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                title="Rewind to start"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {/* Speed Multipliers: 1x, 2x, 5x */}
              <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-[11px] font-mono">
                {[1, 2, 5].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                      playbackSpeed === speed ? 'bg-white text-[#0288d1] shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              {/* Scrubber Time Slider */}
              <div className="w-32 flex items-center px-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={playbackProgress}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPlaybackProgress(val);
                    if (!isPlaying && timelineData?.routePolyline?.length) {
                      const poly = timelineData.routePolyline;
                      const idx = Math.min(
                        Math.floor((val / 100) * poly.length),
                        poly.length - 1
                      );
                      animMarkerRef.current?.setLatLng(poly[idx]);
                    }
                  }}
                  className="w-full accent-[#0288d1] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Live Status Overlay (Top-Left) */}
          {live && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 px-3 py-1.5 shadow-md text-xs font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${live.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="text-slate-800">
                {live.isOnline ? 'Streaming Live' : 'Standby'}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {live.latitude.toFixed(4)}, {live.longitude.toFixed(4)}
              </span>
            </div>
          )}

          {/* Bottom-Right Floating Controls (Layer toggle, Center user, Zoom controls, Fit-bounds) */}
          <div className="absolute bottom-16 right-3 z-10 flex flex-col items-center gap-1.5">
            {/* Map Layers Dropdown/Toggle */}
            <button
              type="button"
              onClick={() => {
                setActiveLayerKey((prev) =>
                  prev === 'carto' ? 'osm' : prev === 'osm' ? 'satellite' : 'carto'
                );
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 transition cursor-pointer"
              title={`Switch layer (Current: ${TILE_LAYERS[activeLayerKey].name})`}
            >
              <Layers className="h-4 w-4" />
            </button>

            {/* Center on Live User Pin */}
            <button
              type="button"
              onClick={handleCenterOnLiveLocation}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-[#0288d1] shadow-md hover:bg-slate-50 transition cursor-pointer"
              title="Center on Live Employee Pin"
            >
              <Crosshair className="h-4 w-4" />
            </button>

            {/* Fit-Bounds View */}
            <button
              type="button"
              onClick={handleFitBounds}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 transition cursor-pointer"
              title="Fit Entire Daily Route"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            {/* Zoom In */}
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 transition cursor-pointer"
              title="Zoom In"
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Zoom Out */}
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 transition cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* B. Bottom Multi-Day Calendar Strip (Horizontal bar featuring day tiles) */}
          <div className="border-t border-slate-200 bg-white p-2.5 z-10 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 shrink-0">
                Timeline History
              </div>

              {/* Day Tiles: Day number, Day name, Month */}
              {timelineData?.availableDays?.map((d) => {
                const isDaySelected = d.date === selectedDate;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSelectedDate(d.date)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer ${
                      isDaySelected
                        ? 'bg-[#0288d1] text-white shadow-md ring-2 ring-blue-300'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <span>{d.label}</span>
                    {d.isToday && (
                      <span
                        className={`ml-1.5 text-[9px] uppercase font-black ${
                          isDaySelected ? 'text-blue-100' : 'text-[#0288d1]'
                        }`}
                      >
                        Today
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
