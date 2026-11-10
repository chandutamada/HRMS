import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../services/tracking_service.dart';
import '../widgets/glass_stat_chip_widget.dart';
import '../widgets/live_map_layers_widget.dart';
import '../widgets/tracking_controls_widget.dart';
import '../widgets/route_analytics_sheet_widget.dart';

class LiveTrackingScreen extends StatefulWidget {
  final Map<String, dynamic> userData;

  const LiveTrackingScreen({
    super.key,
    required this.userData,
  });

  @override
  State<LiveTrackingScreen> createState() => _LiveTrackingScreenState();
}

class _LiveTrackingScreenState extends State<LiveTrackingScreen> {
  final TrackingService _tracking = TrackingService();

  // Office location anchor (dynamic or campus default)
  LatLng _officeLoc = const LatLng(18.18955, 83.38711);
  final double _officeRadius = 50.0;

  @override
  void initState() {
    super.initState();
    final uid = widget.userData['user']?['id'] ?? widget.userData['id'];
    if (uid != null) {
      _tracking.setUserId(uid.toString());
    }
    _tracking.addListener(_onTrackingUpdate);
    _extractOfficeCoords();
  }

  @override
  void dispose() {
    _tracking.removeListener(_onTrackingUpdate);
    super.dispose();
  }

  void _onTrackingUpdate() {
    if (mounted) setState(() {});
  }

  void _extractOfficeCoords() {
    final office = widget.userData['employee']?['officeLocation'] as Map<String, dynamic>? ??
        widget.userData['office'] as Map<String, dynamic>?;
    if (office != null && office['latitude'] != null && office['longitude'] != null) {
      final lat = double.tryParse('${office['latitude']}');
      final lng = double.tryParse('${office['longitude']}');
      if (lat != null && lng != null) {
        _officeLoc = LatLng(lat, lng);
        return;
      }
    }

    final company = widget.userData['company'] as Map<String, dynamic>?;
    final code = company?['code']?.toString().toUpperCase() ?? 'SUPERBEE';

    if (code == 'GTIDS') {
      _officeLoc = const LatLng(18.18955, 83.38711);
    } else if (code == 'GTIB' || code == 'CUTMAP') {
      _officeLoc = const LatLng(18.18955, 83.38711);
    } else {
      _officeLoc = const LatLng(18.18955, 83.38711);
    }
  }

  Future<void> _handleStart() async {
    final success = await _tracking.startTracking(workType: 'OFF_SITE');
    if (!mounted) return;
    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Field duty tracking activated. GPS route recording in progress.'),
          backgroundColor: Color(0xFF10B981),
          duration: Duration(seconds: 2),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to initialize GPS. Please ensure Location is enabled in settings.'),
          backgroundColor: Color(0xFFDC2626),
        ),
      );
    }
  }

  void _handlePause() {
    _tracking.pauseTracking();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Tracking paused. Distance and duration accumulation suspended.'),
        backgroundColor: Color(0xFFF59E0B),
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _handleResume() {
    _tracking.resumeTracking();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Tracking resumed. GPS points recording active.'),
        backgroundColor: Color(0xFF10B981),
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> _handleStop() async {
    await _tracking.stopTracking();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Field duty session completed & fully synced to HRMS portal.'),
        backgroundColor: Color(0xFF1E293B),
        duration: Duration(seconds: 3),
      ),
    );
    // Show summary analytics
    RouteAnalyticsSheetWidget.show(context, _tracking);
  }

  void _handleAddCheckpoint(String notes) {
    _tracking.addCheckpoint(notes: notes);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Milestone recorded: "$notes"'),
        backgroundColor: const Color(0xFF2563EB),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final employeeName = widget.userData['user']?['email'] ??
        widget.userData['email'] ??
        widget.userData['employee']?['fullName'] ??
        'Field Employee';
    final isWithinOfficeHours = _tracking.isWithinOfficeHoursStatus;

    final currPos = _tracking.currentPosition;
    final currentLatLng = currPos != null ? LatLng(currPos.latitude, currPos.longitude) : null;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Field Duty Live Tracking',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              '$employeeName • Superbee Operations',
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          // Office hours badge
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isWithinOfficeHours ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isWithinOfficeHours ? const Color(0xFF86EFAC) : const Color(0xFFFCD34D),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.circle,
                  size: 8,
                  color: isWithinOfficeHours ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                ),
                const SizedBox(width: 5),
                Text(
                  isWithinOfficeHours ? '09:00 - 17:30 IST' : 'OUTSIDE HOURS',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: isWithinOfficeHours ? const Color(0xFF15803D) : const Color(0xFFB45309),
                  ),
                ),
              ],
            ),
          ),

          // Analytics sheet launcher
          IconButton(
            icon: const Icon(Icons.analytics_outlined, color: Color(0xFF2563EB)),
            tooltip: 'View Route Analytics',
            onPressed: () => RouteAnalyticsSheetWidget.show(context, _tracking),
          ),
        ],
      ),
      body: Stack(
        children: [
          // 1. Interactive Google Map Layer
          Positioned.fill(
            child: LiveMapLayersWidget(
              currentLocation: currentLatLng,
              accuracy: _tracking.currentAccuracy,
              heading: _tracking.currentHeading,
              routePoints: _tracking.routePoints,
              checkpoints: _tracking.checkpoints,
              officeLocation: _officeLoc,
              officeRadiusMeters: _officeRadius,
              isTracking: _tracking.isTracking,
            ),
          ),

          // 2. Top Frosted Glass Stats Row
          Positioned(
            top: 14,
            left: 14,
            right: 80, // leave space for layer controls
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  GlassStatChipWidget(
                    icon: Icons.alt_route_rounded,
                    label: 'Distance',
                    value: _tracking.totalDistanceKm.toStringAsFixed(2),
                    unit: 'km',
                    accentColor: const Color(0xFF2563EB),
                  ),
                  const SizedBox(width: 8),
                  GlassStatChipWidget(
                    icon: Icons.timer_outlined,
                    label: 'Duration',
                    value: _tracking.formattedDuration,
                    accentColor: const Color(0xFF7C3AED),
                  ),
                  const SizedBox(width: 8),
                  GlassStatChipWidget(
                    icon: Icons.speed_rounded,
                    label: 'Speed',
                    value: _tracking.currentSpeedKmh.toStringAsFixed(1),
                    unit: 'km/h',
                    accentColor: const Color(0xFF059669),
                  ),
                  const SizedBox(width: 8),
                  GlassStatChipWidget(
                    icon: Icons.directions_walk_rounded,
                    label: 'Pace',
                    value: _tracking.formattedPace,
                    unit: '/km',
                    accentColor: const Color(0xFFD97706),
                  ),
                ],
              ),
            ),
          ),

          // 3. Geofence / Status floating chip
          if (_tracking.isTracking)
            Positioned(
              top: 92,
              left: 14,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white24),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Color(0xFF10B981),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _tracking.isWithinGeofence
                          ? 'ON-SITE (HQ Geofence 50m)'
                          : 'OFF-SITE (Field / Drone Ops)',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    if (_tracking.distanceToOfficeMeters != null) ...[
                      const SizedBox(width: 6),
                      Text(
                        '(${_tracking.distanceToOfficeMeters!.toStringAsFixed(0)}m from HQ)',
                        style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ],
                ),
              ),
            ),

          // 4. Bottom Controls Widget
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: TrackingControlsWidget(
              state: _tracking.state,
              onStart: _handleStart,
              onPause: _handlePause,
              onResume: _handleResume,
              onStop: _handleStop,
              onAddCheckpoint: _handleAddCheckpoint,
            ),
          ),
        ],
      ),
    );
  }
}
