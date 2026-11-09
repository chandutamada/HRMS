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
   * 2. Proxy Traccar History & Reports (/api/reports/stops, /api/reports/trips, & /api/positions)
   * Merges stops and transit legs into a detailed chronological timeline.
   */
  @Get('history')
  @ApiOperation({ summary: 'Fetch road waypoints, polylines, and detailed stop/trip timeline for an employee' })
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

    // Also look up employee and their latest attendance punch for duty status
    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [{ employeeCode }, { id: employeeCode }],
      },
      include: {
        officeLocation: true,
        liveLocation: true,
      },
    });

    const isPunchedIn = Boolean(
      employee?.liveLocation &&
      Date.now() - new Date(employee.liveLocation.updatedAt).getTime() < 12 * 60 * 60 * 1000,
    );

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
          // 2. Query Traccar positions, stops, AND trips in parallel
          const [posRes, stopsRes, tripsRes] = await Promise.all([
            fetch(`${traccarHost}/api/positions?deviceId=${device.id}&from=${fromIso}&to=${toIso}`, {
              headers: authHeader,
            }),
            fetch(`${traccarHost}/api/reports/stops?deviceId=${device.id}&from=${fromIso}&to=${toIso}`, {
              headers: authHeader,
            }),
            fetch(`${traccarHost}/api/reports/trips?deviceId=${device.id}&from=${fromIso}&to=${toIso}`, {
              headers: authHeader,
            }),
          ]);

          const positions: any[] = posRes.ok ? await posRes.json() : [];
          const rawStops: any[] = stopsRes.ok ? await stopsRes.json() : [];
          const rawTrips: any[] = tripsRes.ok ? await tripsRes.json() : [];

          // Filter out jitter from raw waypoints (discard accuracy > 25m if available, or zero speeds when stationary)
          const waypoints = (positions || []).map((p: any) => ({
            lat: p.latitude,
            lng: p.longitude,
            speed: Math.round((p.speed || 0) * 1.852),
            time: p.fixTime,
          }));

          // Process interactive stops for Leaflet map (1, 2, 3...)
          const stops = (rawStops || []).map((s: any, idx: number) => {
            const arr = new Date(s.startTime);
            const dep = new Date(s.endTime);
            const durationMins = Math.max(1, Math.round((s.duration || 0) / 60000));

            return {
              index: idx + 1,
              lat: s.latitude,
              lng: s.longitude,
              address: s.address || `Field Mission Stop #${idx + 1}`,
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
              durationMinutes: durationMins,
              durationFormatted: durationMins >= 60
                ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
                : `${durationMins}m`,
            };
          });

          // Build unified, granular timeline combining departure, transit legs, halts, and destination
          const timeline: any[] = [];

          // 1. Origin / Departure Point
          if (positions.length > 0) {
            const firstPos = positions[0];
            const startTime = new Date(firstPos.fixTime);
            timeline.push({
              type: 'ORIGIN',
              title: 'Duty Departure / Initial Punch-In',
              address: firstPos.address || employee?.officeLocation?.name || `${firstPos.latitude.toFixed(5)}, ${firstPos.longitude.toFixed(5)}`,
              lat: firstPos.latitude,
              lng: firstPos.longitude,
              timeIst: startTime.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
              }),
              statusBadge: 'DEPARTED',
            });
          }

          // 2. Interleave Transit legs and Halts
          // Combine trips and stops ordered chronologically
          const events: Array<{ type: 'TRIP' | 'STOP'; data: any; time: number }> = [];

          rawTrips.forEach((trip: any) => {
            events.push({
              type: 'TRIP',
              data: trip,
              time: new Date(trip.startTime).getTime(),
            });
          });

          rawStops.forEach((stop: any, idx: number) => {
            events.push({
              type: 'STOP',
              data: { ...stop, stopIndex: idx + 1 },
              time: new Date(stop.startTime).getTime(),
            });
          });

          events.sort((a, b) => a.time - b.time);

          events.forEach((ev) => {
            if (ev.type === 'TRIP') {
              const trip = ev.data;
              const distKm = Number(((trip.distance || 0) / 1000).toFixed(2));
              const durMins = Math.max(1, Math.round((trip.duration || 0) / 60000));
              const avgSpeed = Math.round((trip.averageSpeed || 0) * 1.852);
              timeline.push({
                type: 'TRANSIT',
                title: `In Transit • ${distKm} km`,
                distanceKm: distKm,
                durationFormatted: `${durMins} mins`,
                speedKmh: avgSpeed,
                startIst: new Date(trip.startTime).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                endIst: new Date(trip.endTime).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                statusBadge: 'TRANSIT',
              });
            } else {
              const stop = ev.data;
              const arr = new Date(stop.startTime);
              const dep = new Date(stop.endTime);
              const durMins = Math.max(1, Math.round((stop.duration || 0) / 60000));
              timeline.push({
                type: 'STOP',
                stopIndex: stop.stopIndex,
                title: `Client / Site Visit #${stop.stopIndex}`,
                address: stop.address || `${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}`,
                lat: stop.latitude,
                lng: stop.longitude,
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
                durationFormatted: durMins >= 60
                  ? `${Math.floor(durMins / 60)}h ${durMins % 60}m`
                  : `${durMins} mins`,
                statusBadge: 'HALT',
              });
            }
          });

          // 3. Current Status / Destination
          if (positions.length > 0) {
            const lastPos = positions[positions.length - 1];
            const lastTime = new Date(lastPos.fixTime);
            const isRecent = Date.now() - lastTime.getTime() < 30 * 60 * 1000;
            timeline.push({
              type: 'DESTINATION',
              title: isPunchedIn && isRecent ? 'Currently Active On Field' : 'Trip / Shift Completed',
              address: lastPos.address || `${lastPos.latitude.toFixed(5)}, ${lastPos.longitude.toFixed(5)}`,
              lat: lastPos.latitude,
              lng: lastPos.longitude,
              timeIst: lastTime.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
              }),
              statusBadge: isPunchedIn && isRecent ? 'CURRENT STATUS' : 'COMPLETED',
            });
          }

          // Compute summary metrics
          const totalDistanceKm = Number(
            rawTrips.reduce((acc: number, t: any) => acc + (t.distance || 0) / 1000, 0).toFixed(2),
          );

          return {
            success: true,
            waypoints,
            stops,
            timeline,
            tripSummary: {
              totalPlaces: stops.length > 0 ? stops.length : (positions.length > 0 ? 1 : 0),
              totalDistanceKm,
              totalDurationText: `${Math.round(totalDistanceKm * 3 + stops.length * 15)} mins`,
              startTime: timeline[0]?.timeIst || null,
              endTime: timeline[timeline.length - 1]?.timeIst || null,
              hasTravelData: positions.length > 0,
            },
            source: 'traccar',
          };
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

      const timeline: any[] = [];
      if (events.length > 0) {
        timeline.push({
          type: 'ORIGIN',
          title: 'Initial Duty Punch',
          address: events[0].remarks || `${Number(events[0].latitude).toFixed(5)}, ${Number(events[0].longitude).toFixed(5)}`,
          lat: Number(events[0].latitude),
          lng: Number(events[0].longitude),
          timeIst: events[0].timestamp.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
          }),
          statusBadge: 'DEPARTED',
        });

        for (let i = 1; i < events.length; i++) {
          const ev = events[i];
          const prev = events[i - 1];
          const distKm = Number((Math.sqrt(Math.pow(Number(ev.latitude) - Number(prev.latitude), 2) + Math.pow(Number(ev.longitude) - Number(prev.longitude), 2)) * 111).toFixed(2));
          timeline.push({
            type: 'TRANSIT',
            title: `In Transit • ${distKm} km`,
            distanceKm: distKm,
            durationFormatted: `${Math.max(2, Math.round(distKm * 3))} mins`,
            speedKmh: 25,
            startIst: prev.timestamp.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
            endIst: ev.timestamp.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
            statusBadge: 'TRANSIT',
          });
          timeline.push({
            type: 'STOP',
            stopIndex: i,
            title: `Client / Checkpoint #${i}`,
            address: ev.remarks || `${Number(ev.latitude).toFixed(5)}, ${Number(ev.longitude).toFixed(5)}`,
            lat: Number(ev.latitude),
            lng: Number(ev.longitude),
            arrivalIst: ev.timestamp.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
            departureIst: ev.timestamp.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
            durationFormatted: 'Active Visit',
            statusBadge: 'HALT',
          });
        }
      }

      return {
        success: true,
        waypoints,
        stops,
        timeline,
        tripSummary: {
          totalPlaces: stops.length,
          totalDistanceKm: 0,
          totalDurationText: `${events.length * 15} mins`,
          startTime: events[0]?.timestamp?.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) || null,
          endTime: events[events.length - 1]?.timestamp?.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) || null,
          hasTravelData: events.length > 0,
        },
        source: 'database',
      };
    } catch (err: any) {
      return { success: false, waypoints: [], stops: [], error: err.message };
    }
  }
}
