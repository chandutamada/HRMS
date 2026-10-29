'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface LocationUpdatePayload {
  employeeId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isMoving: boolean;
  isWithinGeofence: boolean;
  isWithinOfficeHours: boolean;
  distanceToOfficeMeters?: number;
  timestamp: string;
}

export interface TrackingStatsPayload {
  onlineEmployees: number;
  timestamp: string;
}

export interface UseTrackingSocketOptions {
  /** JWT token for authentication */
  token: string | null;
  /** Called each time an employee location is updated */
  onLocationUpdate?: (payload: LocationUpdatePayload) => void;
  /** Called when an employee comes online */
  onEmployeeOnline?: (payload: { employeeId: string; fullName: string }) => void;
  /** Called when an employee goes offline */
  onEmployeeOffline?: (payload: { employeeId: string }) => void;
  /** Called on geofence breach event */
  onGeofenceBreach?: (payload: { employeeId: string; distanceMeters: number; officeName: string }) => void;
  /** Called with updated aggregate stats */
  onStatsUpdate?: (payload: TrackingStatsPayload) => void;
  /** API base URL — defaults to NEXT_PUBLIC_API_URL or localhost:4000 */
  apiBaseUrl?: string;
}

/**
 * useTrackingSocket
 *
 * Connects to the NestJS /tracking WebSocket namespace and keeps employee
 * location state in sync in real time without any HTTP polling.
 *
 * Usage:
 *   const { status, wsOnlineCount } = useTrackingSocket({
 *     token,
 *     onLocationUpdate: (p) => updateEmployeeInList(p),
 *   });
 */
export function useTrackingSocket({
  token,
  onLocationUpdate,
  onEmployeeOnline,
  onEmployeeOffline,
  onGeofenceBreach,
  onStatsUpdate,
  apiBaseUrl,
}: UseTrackingSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [wsOnlineCount, setWsOnlineCount] = useState<number>(0);

  // Stable callback refs so socket listeners don't re-subscribe on every render
  const onLocationUpdateRef = useRef(onLocationUpdate);
  const onEmployeeOnlineRef = useRef(onEmployeeOnline);
  const onEmployeeOfflineRef = useRef(onEmployeeOffline);
  const onGeofenceBreachRef = useRef(onGeofenceBreach);
  const onStatsUpdateRef = useRef(onStatsUpdate);

  useEffect(() => { onLocationUpdateRef.current = onLocationUpdate; }, [onLocationUpdate]);
  useEffect(() => { onEmployeeOnlineRef.current = onEmployeeOnline; }, [onEmployeeOnline]);
  useEffect(() => { onEmployeeOfflineRef.current = onEmployeeOffline; }, [onEmployeeOffline]);
  useEffect(() => { onGeofenceBreachRef.current = onGeofenceBreach; }, [onGeofenceBreach]);
  useEffect(() => { onStatsUpdateRef.current = onStatsUpdate; }, [onStatsUpdate]);

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      return;
    }

    const baseUrl = apiBaseUrl ||
      process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ||
      'http://localhost:4000';

    setStatus('connecting');

    const socket = io(`${baseUrl}/tracking`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      timeout: 8000,
    });

    socketRef.current = socket;

    // ── Connection lifecycle ────────────────────────────────────────────────
    socket.on('connect', () => {
      setStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      setStatus(reason === 'io client disconnect' ? 'disconnected' : 'connecting');
    });

    socket.on('connect_error', (err) => {
      console.warn('[TrackingSocket] connect_error:', err.message);
      setStatus('error');
    });

    socket.on('auth_error', (data) => {
      console.error('[TrackingSocket] auth_error:', data.message);
      setStatus('error');
      socket.disconnect();
    });

    // ── Location events ─────────────────────────────────────────────────────
    socket.on('employee_location_updated', (payload: LocationUpdatePayload) => {
      onLocationUpdateRef.current?.(payload);
    });

    socket.on('track:location_update', (payload: LocationUpdatePayload) => {
      onLocationUpdateRef.current?.(payload);
    });

    socket.on('employee_online', (payload: any) => {
      onEmployeeOnlineRef.current?.(payload);
    });

    socket.on('employee_offline', (payload: any) => {
      onEmployeeOfflineRef.current?.(payload);
    });

    socket.on('geofence_breach', (payload: any) => {
      onGeofenceBreachRef.current?.(payload);
    });

    socket.on('tracking_stats', (payload: TrackingStatsPayload) => {
      setWsOnlineCount(payload.onlineEmployees);
      onStatsUpdateRef.current?.(payload);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setStatus('disconnected');
    };
  }, [token]); // Only reconnect when token changes

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  return { status, wsOnlineCount, disconnect };
}
