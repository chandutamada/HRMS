import 'dart:ui';
import 'package:flutter/material.dart';
import '../services/tracking_service.dart';

class TrackingControlsWidget extends StatelessWidget {
  final TrackingState state;
  final VoidCallback onStart;
  final VoidCallback onPause;
  final VoidCallback onResume;
  final VoidCallback onStop;
  final Function(String notes) onAddCheckpoint;

  const TrackingControlsWidget({
    super.key,
    required this.state,
    required this.onStart,
    required this.onPause,
    required this.onResume,
    required this.onStop,
    required this.onAddCheckpoint,
  });

  void _showAddCheckpointDialog(BuildContext context) {
    final textController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.pin_drop, color: Color(0xFF2563EB), size: 24),
            SizedBox(width: 8),
            Text('Tag Milestone Stop', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Record a verified checkpoint for client visit, drone landing, or field site review:',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: textController,
              decoration: InputDecoration(
                hintText: 'e.g., Client Site Alpha inspection done',
                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                filled: true,
                fillColor: const Color(0xFFF1F5F9),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              autofocus: true,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              final text = textController.text.trim();
              Navigator.pop(ctx);
              onAddCheckpoint(text);
            },
            child: const Text('Record Checkpoint'),
          ),
        ],
      ),
    );
  }

  void _confirmStopSession(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626), size: 24),
            SizedBox(width: 8),
            Text('End Duty Session?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          'Stopping tracking will finalize all route breadcrumbs, calculate final metrics, and synchronize the complete session with HR.',
          style: TextStyle(fontSize: 13, color: Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Keep Tracking', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              onStop();
            },
            child: const Text('Stop & Sync'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isTracking = state == TrackingState.tracking;
    final isIdle = state == TrackingState.idle;

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: isIdle
              ? SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    onPressed: onStart,
                    icon: const Icon(Icons.play_arrow_rounded, size: 26),
                    label: const Text(
                      'START FIELD TRACKING',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.6),
                    ),
                  ),
                )
              : Row(
                  children: [
                    // Pause or Resume button
                    Expanded(
                      flex: 4,
                      child: SizedBox(
                        height: 50,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isTracking
                                ? const Color(0xFFF59E0B)
                                : const Color(0xFF10B981),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          onPressed: isTracking ? onPause : onResume,
                          icon: Icon(isTracking ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 22),
                          label: Text(
                            isTracking ? 'PAUSE' : 'RESUME',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),

                    // Add Checkpoint button
                    SizedBox(
                      height: 50,
                      width: 50,
                      child: Tooltip(
                        message: 'Record Milestone Checkpoint',
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            padding: EdgeInsets.zero,
                            backgroundColor: const Color(0xFFEEF2FF),
                            foregroundColor: const Color(0xFF4F46E5),
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: const BorderSide(color: Color(0xFFC7D2FE)),
                            ),
                          ),
                          onPressed: () => _showAddCheckpointDialog(context),
                          child: const Icon(Icons.add_location_alt_rounded, size: 22),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),

                    // Stop tracking button
                    Expanded(
                      flex: 4,
                      child: SizedBox(
                        height: 50,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFEF4444),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          onPressed: () => _confirmStopSession(context),
                          icon: const Icon(Icons.stop_rounded, size: 22),
                          label: const Text(
                            'FINISH',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
