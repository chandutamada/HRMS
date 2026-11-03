import 'package:flutter/material.dart';
import '../services/tracking_service.dart';

class RouteAnalyticsSheetWidget extends StatelessWidget {
  final TrackingService tracking;
  final VoidCallback? onSyncNow;

  const RouteAnalyticsSheetWidget({
    super.key,
    required this.tracking,
    this.onSyncNow,
  });

  static void show(BuildContext context, TrackingService tracking, {VoidCallback? onSyncNow}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => RouteAnalyticsSheetWidget(
        tracking: tracking,
        onSyncNow: onSyncNow,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final checkpoints = tracking.checkpoints;
    final isWithinOfficeHours = tracking.isWithinOfficeHoursStatus;

    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      minChildSize: 0.35,
      maxChildSize: 0.92,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 25,
                offset: Offset(0, -6),
              ),
            ],
          ),
          child: Column(
            children: [
              // Drag handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),

              // Title bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Route & Duty Analytics',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Live telemetry verified for HR payroll & compliance',
                          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),

              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  children: [
                    // Office Hours Compliance Card
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: isWithinOfficeHours
                            ? const Color(0xFFF0FDF4)
                            : const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isWithinOfficeHours
                              ? const Color(0xFFBBF7D0)
                              : const Color(0xFFFECACA),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isWithinOfficeHours
                                ? Icons.verified_user_rounded
                                : Icons.schedule_rounded,
                            color: isWithinOfficeHours
                                ? const Color(0xFF16A34A)
                                : const Color(0xFFDC2626),
                            size: 24,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isWithinOfficeHours
                                      ? 'OFFICE HOURS COMPLIANT (09:00 - 17:30 IST)'
                                      : 'OUTSIDE STANDARD OFFICE HOURS',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: isWithinOfficeHours
                                        ? const Color(0xFF15803D)
                                        : const Color(0xFFB91C1C),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  isWithinOfficeHours
                                      ? 'Session logged within authorized office hours (09:00 AM – 05:30 PM). Full TA/DA eligible.'
                                      : 'Logged outside standard office hours (09:00 AM – 05:30 PM). May require manager regularization.',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: isWithinOfficeHours
                                        ? const Color(0xFF166534)
                                        : const Color(0xFF991B1B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Metrics Grid (2x3)
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.5,
                      children: [
                        _buildMetricCard(
                          title: 'TOTAL DISTANCE',
                          value: '${tracking.totalDistanceKm.toStringAsFixed(2)} km',
                          icon: Icons.alt_route_rounded,
                          color: const Color(0xFF2563EB),
                        ),
                        _buildMetricCard(
                          title: 'ACTIVE DURATION',
                          value: tracking.formattedDuration,
                          icon: Icons.timer_outlined,
                          color: const Color(0xFF7C3AED),
                        ),
                        _buildMetricCard(
                          title: 'AVERAGE SPEED',
                          value: '${tracking.averageSpeedKmh.toStringAsFixed(1)} km/h',
                          icon: Icons.speed_rounded,
                          color: const Color(0xFF059669),
                        ),
                        _buildMetricCard(
                          title: 'TOP SPEED',
                          value: '${tracking.maxSpeedKmh.toStringAsFixed(1)} km/h',
                          icon: Icons.electric_bolt_rounded,
                          color: const Color(0xFFD97706),
                        ),
                        _buildMetricCard(
                          title: 'CURRENT PACE',
                          value: tracking.formattedPace,
                          icon: Icons.directions_walk_rounded,
                          color: const Color(0xFF0284C7),
                        ),
                        _buildMetricCard(
                          title: 'GPS ACCURACY',
                          value: '±${(tracking.currentAccuracy ?? 0).toStringAsFixed(1)} m',
                          icon: Icons.gps_fixed_rounded,
                          color: const Color(0xFF475569),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Milestone & Checkpoints Timeline
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'CHECKPOINTS & STOPS (${checkpoints.length})',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          '${tracking.pointsCount} GPS Pts',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF94A3B8),
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    if (checkpoints.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Center(
                          child: Column(
                            children: [
                              Icon(Icons.pin_drop_outlined, size: 32, color: Colors.grey.shade400),
                              const SizedBox(height: 6),
                              Text(
                                'No checkpoints tagged yet',
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Tap the pin button on controls to tag milestones or dwell stops',
                                style: TextStyle(fontSize: 10, color: Colors.grey.shade400),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      ...List.generate(checkpoints.length, (idx) {
                        final cp = checkpoints[idx];
                        final timeStr = DateTime.fromMillisecondsSinceEpoch(cp.arrivedAt)
                            .toLocal()
                            .toString()
                            .substring(11, 16);

                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Center(
                                  child: Text(
                                    '#${cp.index ?? idx + 1}',
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
                                      cp.notes ?? 'Stationary Milestone',
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF0F172A),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
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
                                timeStr,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2563EB),
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    const SizedBox(height: 20),

                    // Manual Synchronize button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF2563EB),
                          side: const BorderSide(color: Color(0xFF2563EB)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: onSyncNow ??
                            () async {
                              final res = await tracking.syncSession();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(res
                                        ? 'Session synchronized successfully with HR'
                                        : 'Sync in progress or offline'),
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                              }
                            },
                        icon: const Icon(Icons.sync_rounded),
                        label: const Text('FORCE SYNC TO HR PORTAL'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 5),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF64748B),
                  letterSpacing: 0.4,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: color,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}
