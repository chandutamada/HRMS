import { Controller, Post, Get, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TrackingGateway } from './tracking.gateway';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Traccar GPS Integration')
@Controller('tracking')
export class TrackingTraccarController {
  private readonly logger = new Logger(TrackingTraccarController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: TrackingGateway,
  ) {}

  /**
   * 1. Ingest Webhook forwarded from Traccar
   */
  @Post('traccar-webhook')
  @ApiOperation({ summary: 'Ingest real-time GPS telemetry forwarded from Traccar engine' })
  async handleTraccarWebhook(@Query() query: any, @Body() body: any) {
    const payload = Object.keys(query).length > 0 ? query : body;
    const deviceId = payload.deviceId || payload.device?.uniqueId || payload.uniqueId || payload.id;
    if (!deviceId) return { status: 'ignored_no_device_id' };

    // Resolve employee in database
    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [
          { employeeCode: deviceId.toString() },
          { id: deviceId.toString() },
        ],
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        companyId: true,
        officeLocation: true,
      },
    });

    if (!employee) return { status: 'employee_not_found', deviceId };

    const lat = Number(payload.lat || payload.latitude);
    const lon = Number(payload.lon || payload.longitude);
    const speedKmh = Number(payload.speed || 0) * 1.852; // knots to km/h
    const bearing = Number(payload.bearing || payload.course || 0);
    const battery = payload.batt ? Number(payload.batt) : null;
    const timestampStr = payload.time ? new Date(payload.time).toISOString() : new Date().toISOString();

    const telemetry = {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeCode: employee.employeeCode,
      latitude: lat,
      longitude: lon,
      speedKmh: Math.round(speedKmh * 10) / 10,
      bearing,
      battery,
      timestamp: timestampStr,
    };

    // Update real-time LiveLocation table
    try {
      await this.prisma.liveLocation.upsert({
        where: { employeeId: employee.id },
        create: {
          employeeId: employee.id,
          userId: employee.userId,
          latitude: lat,
          longitude: lon,
          accuracy: 5.0,
          batteryLevel: battery ?? undefined,
          isWithinGeofence: true,
          updatedAt: new Date(),
        },
        update: {
          latitude: lat,
          longitude: lon,
          accuracy: 5.0,
          batteryLevel: battery ?? undefined,
          updatedAt: new Date(),
        },
      });
    } catch (_) {}

    // Broadcast over WebSocket (field-tracking and employee_location_updated)
    try {
      if (this.gateway?.server) {
        if (employee.companyId) {
          this.gateway.server.to(`company_${employee.companyId}`).emit('field-tracking', telemetry);
          this.gateway.server.to(`company_${employee.companyId}`).emit('employee_location_updated', {
            employeeId: employee.id,
            latitude: lat,
            longitude: lon,
            speed: speedKmh,
            heading: bearing,
            batteryLevel: battery,
            timestamp: timestampStr,
          });
        }
        // Also emit to default namespace for compatibility
        this.gateway.server.emit('field-tracking', telemetry);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to broadcast Traccar telemetry: ${err.message}`);
    }

    return { status: 'broadcasted', telemetry };
  }

  /**
   * 2. Proxy Traccar History & Reports (/api/reports/stops & /api/positions)
   */
  @Get('history')
  @ApiOperation({ summary: 'Fetch road waypoints, polylines and stop timeline for an employee' })
  async getTrackingHistory(
    @Query('employeeCode') employeeCode: string,
    @Query('date') dateStr?: string, // YYYY-MM-DD
  ) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const traccarHost = process.env.TRACCAR_HOST || 'http://127.0.0.1:8082';
    const authHeader = {
      Authorization:
        'Basic ' +
        Buffer.from(
          `${process.env.TRACCAR_USER || 'admin'}:${process.env.TRACCAR_PASS || 'admin'}`,
        ).toString('base64'),
    };

    const fromIso = `${targetDate}T00:00:00Z`;
    const toIso = `${targetDate}T23:59:59Z`;

    try {
      // 1. Resolve Device in Traccar
      const deviceRes = await fetch(
        `${traccarHost}/api/devices?uniqueId=${encodeURIComponent(employeeCode)}`,
        { headers: authHeader },
      );

      if (deviceRes.ok) {
        const devices = await deviceRes.json();
        const device = Array.isArray(devices) && devices.length > 0 ? devices[0] : null;

        if (device) {
          // 2. Fetch positions from Traccar
          const [posRes, stopsRes] = await Promise.all([
            fetch(`${traccarHost}/api/positions?deviceId=${device.id}&from=${fromIso}&to=${toIso}`, {
              headers: authHeader,
            }),
            fetch(`${traccarHost}/api/reports/stops?deviceId=${device.id}&from=${fromIso}&to=${toIso}`, {
              headers: authHeader,
            }),
          ]);

          const positions = posRes.ok ? await posRes.json() : [];
          const rawStops = stopsRes.ok ? await stopsRes.json() : [];

          const waypoints = (positions || []).map((p: any) => ({
            lat: p.latitude,
            lng: p.longitude,
            speed: Math.round((p.speed || 0) * 1.852),
            time: p.fixTime,
          }));

          const stops = (rawStops || []).map((s: any, idx: number) => {
            const arr = new Date(s.startTime);
            const dep = new Date(s.endTime);
            const durationMins = Math.round((s.duration || 0) / 60000);

            return {
              index: idx + 1,
              lat: s.latitude,
              lng: s.longitude,
              address: s.address || `Mission Stop #${idx + 1}`,
              arrivalIst: arr.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
              }),
              departureIst: dep.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
              }),
              durationFormatted: `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`,
            };
          });

          return { success: true, waypoints, stops, source: 'traccar' };
        }
      }
    } catch (_) {
      // Fallback to internal database breadcrumbs if Traccar is offline or not installed
    }

    // Fallback: Query internal Database AttendanceEvents / Checkpoints
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { employeeCode },
        select: { id: true },
      });

      if (!employee) return { success: false, waypoints: [], stops: [] };

      const startDay = new Date(`${targetDate}T00:00:00.000Z`);
      const endDay = new Date(`${targetDate}T23:59:59.999Z`);

      const events = await this.prisma.attendanceEvent.findMany({
        where: {
          employeeId: employee.id,
          timestamp: { gte: startDay, lte: endDay },
        },
        orderBy: { timestamp: 'asc' },
      });

      const waypoints = events.map((e) => ({
        lat: Number(e.latitude),
        lng: Number(e.longitude),
        speed: 0,
        time: e.timestamp.toISOString(),
      }));

      const stops = events.map((e, idx) => ({
        index: idx + 1,
        lat: Number(e.latitude),
        lng: Number(e.longitude),
        address: e.remarks || `Checkpoint #${idx + 1}`,
        arrivalIst: e.timestamp.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
        }),
        departureIst: e.timestamp.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
        }),
        durationFormatted: 'Recorded',
      }));

      return { success: true, waypoints, stops, source: 'database' };
    } catch (err: any) {
      return { success: false, waypoints: [], stops: [], error: err.message };
    }
  }
}
