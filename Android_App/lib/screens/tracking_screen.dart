import 'package:flutter/material.dart';
import 'live_tracking_screen.dart';
import '../services/tracking_service.dart';

class TrackingScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const TrackingScreen({super.key, required this.userData});

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  final TrackingService _tracking = TrackingService();

  @override
  void initState() {
    super.initState();
    final uid = widget.userData['user']?['id'] ?? widget.userData['id'];
    if (uid != null) {
      _tracking.setUserId(uid.toString());
    }
    _tracking.addListener(_onTrackingUpdate);
  }

  @override
  void dispose() {
    _tracking.removeListener(_onTrackingUpdate);
    super.dispose();
  }

  void _onTrackingUpdate() {
    if (mounted) setState(() {});
  }

  Future<void> _toggleTracking() async {
    if (_tracking.isTracking) {
      await _tracking.stopTracking();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Field tracking stopped & route session synchronized with HR'),
            backgroundColor: Color(0xFF1E293B),
          ),
        );
      }
    } else {
      final success = await _tracking.startTracking(workType: 'OFF_SITE');
      if (!success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to start tracking. Please ensure GPS is enabled.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final employeeName = widget.userData['user']?['email'] ?? 'Employee';
    final isWithinOfficeHours = _tracking.isWithinOfficeHoursStatus;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Field Duty & Live Tracking', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.map_rounded, color: Color(0xFF2563EB)),
            tooltip: 'Open Live Interactive Map',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => LiveTrackingScreen(userData: widget.userData),
                ),
              );
            },
          ),
          if (_tracking.isTracking)
            IconButton(
              icon: const Icon(Icons.sync, color: Color(0xFF2563EB)),
              onPressed: () async {
                final synced = await _tracking.syncSession();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(synced ? 'Route breadcrumbs synced successfully' : 'Sync in progress...'),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              },
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Office Hours Compliance Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.schedule, color: Color(0xFF10B981), size: 16),
                            SizedBox(width: 6),
                            Text(
                              'OFFICE HOURS WINDOW',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF94A3B8),
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isWithinOfficeHours
                                ? const Color(0xFF064E3B)
                                : const Color(0xFF451A03),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isWithinOfficeHours
                                  ? const Color(0xFF059669)
                                  : const Color(0xFFB45309),
                            ),
                          ),
                          child: Text(
                            isWithinOfficeHours ? 'ACTIVE (TRACKING)' : 'OUTSIDE HOURS',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: isWithinOfficeHours
                                  ? const Color(0xFF34D399)
                                  : const Color(0xFFFBBF24),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '09:00 AM – 05:30 PM (IST)',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontFamily: 'monospace',
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Monitored strictly within office hours (09:00 AM – 05:30 PM). Logged for: $employeeName',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Tracking Live Status Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: _tracking.isTracking
                        ? const Color(0xFF6366F1)
                        : const Color(0xFFE2E8F0),
                    width: _tracking.isTracking ? 1.5 : 1,
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: _tracking.isTracking
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFF94A3B8),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _tracking.isTracking
                                  ? 'RECORDING FIELD MISSION'
                                  : 'TRACKING INACTIVE',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: _tracking.isTracking
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF2FF),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'Off-Site (Field / Drone)',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF4F46E5),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Metrics Grid (Distance, Speed, Points, Stops)
                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricTile(
                            title: 'DISTANCE',
                            value: '${_tracking.totalDistanceKm.toStringAsFixed(2)} km',
                            icon: Icons.alt_route,
                            color: const Color(0xFF4F46E5),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildMetricTile(
                            title: 'SPEED',
                            value: '${_tracking.currentSpeedKmh.toStringAsFixed(1)} km/h',
                            icon: Icons.speed,
                            color: const Color(0xFF059669),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricTile(
                            title: 'GPS POINTS',
                            value: '${_tracking.pointsCount}',
                            icon: Icons.gps_fixed,
                            color: const Color(0xFF2563EB),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildMetricTile(
                            title: 'DWELL STOPS',
                            value: '${_tracking.checkpointsCount}',
                            icon: Icons.room,
                            color: const Color(0xFFD97706),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Action Button (Start / Stop)
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _tracking.isTracking
                              ? const Color(0xFFEF4444)
                              : const Color(0xFF4F46E5),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 2,
                        ),
                        onPressed: _toggleTracking,
                        icon: Icon(
                          _tracking.isTracking ? Icons.stop : Icons.play_arrow,
                          color: Colors.white,
                        ),
                        label: Text(
                          _tracking.isTracking
                              ? 'STOP FIELD MISSION'
                              : 'START FIELD TRACKING',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Recorded Checkpoints / Stationary Stops Section
              const Text(
                'RECORDED CHECKPOINTS & STOPS',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF64748B),
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 8),

              if (_tracking.checkpoints.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.pin_drop_outlined, size: 36, color: Colors.grey.shade400),
                      const SizedBox(height: 8),
                      Text(
                        'No stationary stops recorded yet',
                        style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Stops are auto-detected when stationary within 15m for \u2265 2 mins',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              else
                ..._tracking.checkpoints.map(
                  (cp) => Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Center(
                            child: Text(
                              '#${cp.index ?? 1}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFB45309),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                cp.notes ?? 'Stationary Checkpoint',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              Text(
                                'Lat: ${cp.lat.toStringAsFixed(4)}, Lng: ${cp.lng.toStringAsFixed(4)}',
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: Color(0xFF64748B),
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          DateTime.fromMillisecondsSinceEpoch(cp.arrivedAt)
                              .toLocal()
                              .toString()
                              .substring(11, 16),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F172A),
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
