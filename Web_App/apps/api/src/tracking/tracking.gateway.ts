import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * TrackingGateway — Socket.io WebSocket gateway for real-time employee tracking.
 *
 * Events from Flutter mobile (client → server):
 *   location_ping   : Employee sends a GPS coordinate update
 *   session_start   : Employee starts a tracking session
 *   session_end     : Employee ends a tracking session
 *
 * Events broadcast to HR dashboard (server → client):
 *   employee_location_updated : Single employee location changed
 *   employee_online           : Employee just connected
 *   employee_offline          : Employee disconnected
 *   geofence_breach           : Employee left office boundary during work hours
 *   tracking_stats            : Aggregate stats update (online count etc.)
 */
@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:4000',
      /http:\/\/10\.\d+\.\d+\.\d+.*/,  // Local LAN (Android emulator / real device)
    ],
    credentials: true,
  },
  namespace: '/tracking',
  transports: ['websocket', 'polling'],
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  // Maps socketId → { userId, employeeId, companyId, role }
  private connectedClients = new Map<
    string,
    { userId: string; employeeId?: string; companyId?: string; role: 'EMPLOYEE' | 'HR' }
  >();

  constructor(
    private readonly trackingService: TrackingService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    this.trackingService.setGateway(this);
    this.logger.log('✅ TrackingGateway WebSocket server initialised on /tracking');
  }

  // ─── Connection lifecycle ────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      // Authenticate via JWT token passed as handshake auth or query param
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string) ||
        '';

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token — disconnecting`);
        client.emit('auth_error', { message: 'JWT token required' });
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const userId: string = payload.sub || payload.userId || payload.id;

      // Look up the user role
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: { include: { role: true } },
          employee: true,
        },
      });

      if (!user) {
        client.emit('auth_error', { message: 'User not found' });
        client.disconnect(true);
        return;
      }

      const roleNames = user.roles.map((r) => r.role.name);
      const isHr =
        user.isSuperAdmin ||
        roleNames.includes('HR_ADMIN') ||
        roleNames.includes('HR_MANAGER') ||
        roleNames.includes('SUPER_ADMIN');

      const clientInfo = {
        userId,
        employeeId: user.employee?.id,
        companyId: user.companyId || undefined,
        role: (isHr ? 'HR' : 'EMPLOYEE') as 'HR' | 'EMPLOYEE',
      };

      this.connectedClients.set(client.id, clientInfo);

      // HR clients join a dedicated room so we can broadcast stats to them
      if (isHr) {
        client.join(`hr:${user.companyId}`);
        client.join('hr:live_tracking');
        this.logger.log(
          `HR client connected: ${user.email} [${client.id}] (joined hr:${user.companyId} and hr:live_tracking)`,
        );
      } else {
        // Employee joins their personal room
        client.join(`employee:${userId}`);
        this.logger.log(
          `Employee connected: ${user.email} [${client.id}]`,
        );

        // Notify HR that this employee is now online
        if (user.employee) {
          this.server.to(`hr:${user.companyId}`).emit('employee_online', {
            employeeId: user.employee.id,
            userId,
            fullName: `${user.employee.firstName} ${user.employee.lastName}`,
            employeeCode: user.employee.employeeCode,
            timestamp: new Date().toISOString(),
          });
        }
      }

      client.emit('connected', {
        message: 'WebSocket connection established',
        role: clientInfo.role,
        socketId: client.id,
      });

      // Push current online count to all HR clients
      this._broadcastStats(user.companyId || '');
    } catch (err) {
      this.logger.error(`Auth failed for ${client.id}: ${err.message}`);
      client.emit('auth_error', { message: 'Invalid or expired JWT token' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const info = this.connectedClients.get(client.id);
    if (info) {
      this.connectedClients.delete(client.id);

      if (info.role === 'EMPLOYEE' && info.employeeId) {
        // Notify HR that employee went offline
        this.server.to(`hr:${info.companyId}`).emit('employee_offline', {
          employeeId: info.employeeId,
          userId: info.userId,
          timestamp: new Date().toISOString(),
        });

        this._broadcastStats(info.companyId || '');
      }

      this.logger.log(
        `Client disconnected: ${client.id} (${info.role})`,
      );
    }
  }

  // ─── Events from Flutter mobile ─────────────────────────────────────────────

  /**
   * location_ping — Employee sends GPS coordinate.
   *
   * Payload: {
   *   latitude: number,
   *   longitude: number,
   *   accuracy?: number,
   *   altitude?: number,
   *   speed?: number,
   *   heading?: number,
   *   batteryLevel?: number,
   *   isMoving?: boolean,
   *   timestamp?: number  // epoch ms
   * }
   */
  @SubscribeMessage('location_ping')
  @SubscribeMessage('track:location')
  async handleLocationPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const info = this.connectedClients.get(client.id);
    if (!info || info.role !== 'EMPLOYEE') return;

    try {
      const dto = {
        latitude: Number(data.latitude ?? data.lat),
        longitude: Number(data.longitude ?? data.lng),
        accuracy: data.accuracy != null ? Number(data.accuracy) : undefined,
        altitude: data.altitude != null ? Number(data.altitude) : undefined,
        speed: data.speed != null ? Number(data.speed) : undefined,
        heading: data.heading != null ? Number(data.heading) : undefined,
        batteryLevel: data.batteryLevel != null ? Number(data.batteryLevel) : (data.battery != null ? Number(data.battery) : undefined),
        isMoving: data.isMoving,
      };

      // Run geofence + DB upsert via existing TrackingService
      const result = await this.trackingService.updateLiveLocation(dto, {
        id: info.userId,
        employeeId: info.employeeId,
        companyId: info.companyId,
        email: '',
        roles: [],
        isSuperAdmin: false,
      } as any);

      const locationPayload = {
        employeeId: info.employeeId,
        userId: info.userId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        speed: dto.speed,
        heading: dto.heading,
        batteryLevel: dto.batteryLevel,
        isMoving: dto.isMoving ?? false,
        isWithinGeofence: result.meta?.isWithinGeofence ?? false,
        isWithinOfficeHours: result.meta?.isWithinOfficeHours ?? false,
        distanceToOfficeMeters: result.meta?.distanceToOfficeMeters ?? null,
        timestamp: new Date().toISOString(),
      };

      // Immediately broadcast updated location to all HR clients in company & hr:live_tracking room
      this.server.to(`hr:${info.companyId}`).to('hr:live_tracking').emit('employee_location_updated', locationPayload);
      this.server.to(`hr:${info.companyId}`).to('hr:live_tracking').emit('track:location_update', locationPayload);

      // Emit field-tracking event via Socket.io containing: { employeeId, latitude, longitude, speed, battery, timestamp }
      const fieldTrackingPayload = {
        employeeId: info.employeeId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        speed: dto.speed ?? 0,
        battery: dto.batteryLevel ?? 100,
        timestamp: new Date().toISOString(),
      };
      this.server.emit('field-tracking', fieldTrackingPayload);
      if (info.companyId) {
        this.server.to(`hr:${info.companyId}`).emit('field-tracking', fieldTrackingPayload);
      }
      this.server.to('hr:live_tracking').emit('field-tracking', fieldTrackingPayload);

      // If breach detected, fire dedicated event
      if (
        result.meta?.isWithinOfficeHours &&
        !result.meta?.isWithinGeofence &&
        (result.meta?.distanceToOfficeMeters ?? 0) > 50
      ) {
        this.server.to(`hr:${info.companyId}`).emit('geofence_breach', {
          employeeId: info.employeeId,
          userId: info.userId,
          distanceMeters: result.meta?.distanceToOfficeMeters,
          officeName: result.meta?.officeName,
          timestamp: new Date().toISOString(),
        });
      }

      // Acknowledge back to the mobile app
      client.emit('location_ack', {
        success: true,
        isWithinGeofence: result.meta?.isWithinGeofence,
        distanceToOfficeMeters: result.meta?.distanceToOfficeMeters,
      });
    } catch (err) {
      this.logger.error(`location_ping error for ${client.id}: ${err.message}`);
      client.emit('location_ack', { success: false, error: err.message });
    }
  }

  /**
   * session_start — Employee starts a field tracking session.
   */
  @SubscribeMessage('session_start')
  handleSessionStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const info = this.connectedClients.get(client.id);
    if (!info) return;

    this.server.to(`hr:${info.companyId}`).emit('employee_session_started', {
      employeeId: info.employeeId,
      sessionId: data?.sessionId,
      timestamp: new Date().toISOString(),
    });

    client.emit('session_start_ack', { success: true });
  }

  /**
   * session_end — Employee ends their session.
   */
  @SubscribeMessage('session_end')
  handleSessionEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const info = this.connectedClients.get(client.id);
    if (!info) return;

    this.server.to(`hr:${info.companyId}`).emit('employee_session_ended', {
      employeeId: info.employeeId,
      sessionId: data?.sessionId,
      distanceKm: data?.distanceKm,
      timestamp: new Date().toISOString(),
    });

    client.emit('session_end_ack', { success: true });
  }

  // ─── Server-initiated broadcasts (called from TrackingService if needed) ────

  /**
   * Push a field tracking ping to connected clients.
   * Emits field-tracking event with { employeeId, latitude, longitude, speed, battery, timestamp }.
   */
  broadcastFieldTracking(payload: {
    employeeId?: string;
    latitude: number;
    longitude: number;
    speed?: number;
    battery?: number;
    timestamp?: string;
  }) {
    if (!this.server) return;
    this.server.emit('field-tracking', payload);
    this.server.to('hr:live_tracking').emit('field-tracking', payload);
  }

  /**
   * Push a location update from outside the gateway (e.g. HTTP fallback POST).
   * Called by TrackingService after updateLiveLocation completes.
   */
  broadcastLocationUpdate(companyId: string, payload: object) {
    if (!this.server) return;
    this.server.to(`hr:${companyId}`).to('hr:live_tracking').emit('employee_location_updated', payload);
    this.server.to(`hr:${companyId}`).to('hr:live_tracking').emit('track:location_update', payload);
    this.server.to(`hr:${companyId}`).to('hr:live_tracking').emit('attendance:update', payload);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _broadcastStats(companyId: string) {
    if (!companyId) return;
    const onlineEmployees = [...this.connectedClients.values()].filter(
      (c) => c.role === 'EMPLOYEE' && c.companyId === companyId,
    ).length;

    this.server.to(`hr:${companyId}`).emit('tracking_stats', {
      onlineEmployees,
      timestamp: new Date().toISOString(),
    });
  }

  /** Expose online employee count for a company (used by REST endpoints) */
  getOnlineCount(companyId: string): number {
    return [...this.connectedClients.values()].filter(
      (c) => c.role === 'EMPLOYEE' && c.companyId === companyId,
    ).length;
  }
}
