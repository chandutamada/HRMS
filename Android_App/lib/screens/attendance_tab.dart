import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../services/tracking_service.dart';
import '../widgets/face_capture_dialog.dart';

class AttendanceTab extends StatefulWidget {
  final Map<String, dynamic> userData;
  const AttendanceTab({super.key, required this.userData});

  @override
  State<AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<AttendanceTab> {
  Map<String, dynamic>? _todayStatus;
  List<dynamic> _history = [];
  bool _isLoading = true;
  bool _isPunching = false;

  final _correctionReasonController = TextEditingController();
  final DateTime _correctionDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _fetchAttendance();
  }

  Future<void> _fetchAttendance() async {
    setState(() => _isLoading = true);
    try {
      final statusRes = await ApiService()
          .dio
          .get('/attendance/today')
          .timeout(const Duration(seconds: 3));
      final historyRes = await ApiService()
          .dio
          .get('/attendance/history')
          .timeout(const Duration(seconds: 3));

      if (mounted) {
        setState(() {
          _todayStatus = statusRes.data['data'];
          _history = historyRes.data['data']?['items'] ?? [];
        });
      }
    } catch (e) {
      // Handle gracefully
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handlePunch(String eventType) async {
    setState(() => _isPunching = true);

    final locResult = await LocationService.getCurrentLocation();
    if (!locResult.success) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(locResult.errorMessage ?? 'GPS unavailable'),
            backgroundColor: Colors.red.shade700,
          ),
        );
        setState(() => _isPunching = false);
      }
      return;
    }

    final pos = locResult.position!;
    final employee = widget.userData['employee'] as Map<String, dynamic>? ?? {};
    final workLocationType = employee['workLocationType']?.toString() ?? 'ON_SITE';
    final isOffice = workLocationType == 'ON_SITE';
    final office = _todayStatus?['office'] as Map<String, dynamic>?;

    // Strict local geofence guard for office employees on both Punch-In and Punch-Out
    if (isOffice && office != null && office['latitude'] != null && office['longitude'] != null) {
      final offLat = (office['latitude'] as num).toDouble();
      final offLng = (office['longitude'] as num).toDouble();
      final offRadius = (office['radiusMeters'] as num?)?.toDouble() ?? 50.0;
      final dist = Geolocator.distanceBetween(
        pos.latitude,
        pos.longitude,
        offLat,
        offLng,
      );

      if (dist > offRadius) {
        if (mounted) {
          final action = eventType == 'CHECK_IN' ? 'punch in' : 'punch out';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Punch rejected: You are ${dist.round()}m away from ${office['name'] ?? 'office'} (Radius: ${offRadius.round()}m). Office employees must $action inside the office geofence.',
              ),
              backgroundColor: Colors.red.shade700,
              duration: const Duration(seconds: 4),
            ),
          );
          setState(() => _isPunching = false);
        }
        return;
      }
    }

    String? facePhotoUrl;

    if (eventType == 'CHECK_IN') {
      final firstName = employee['firstName'] ?? employee['fullName'] ?? 'Employee';
      final empCode = employee['employeeCode'] ?? widget.userData['employeeCode'] ?? 'SB-001';

      if (!mounted) return;
      facePhotoUrl = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (_) => FaceCaptureDialog(
          employeeName: firstName.toString(),
          employeeCode: empCode.toString(),
          officeName: _todayStatus?['office']?['name']?.toString() ?? 'Office HQ',
        ),
      );

      if (facePhotoUrl == null) {
        setState(() => _isPunching = false);
        return;
      }
    }

    // Fetch device battery level to send live telemetry to HR
    int? batteryLevel;
    try {
      batteryLevel = await Battery().batteryLevel;
    } catch (_) {}

    try {
      final res = await ApiService().dio.post(
        '/attendance/event',
        data: {
          'eventType': eventType,
          'latitude': pos.latitude,
          'longitude': pos.longitude,
          'accuracyMeters': pos.accuracy,
          'batteryPercentage': batteryLevel,
          'isMocked': pos.isMocked,
          'remarks': facePhotoUrl != null ? 'Face ID Verified Check-In' : 'Attendance Tab Punch',
          'photoUrl': facePhotoUrl,
        },
      );

      final rawData = res.data;
      final Map<String, dynamic> data = (rawData is Map<String, dynamic>)
          ? (rawData['data'] is Map<String, dynamic> ? rawData['data'] as Map<String, dynamic> : rawData)
          : {};
      if (mounted) {
        _fetchAttendance();

        // Field employee tracking starts strictly from Punch-In and stops upon Punch-Out
        // OFFICE employees do not run continuous background tracking
        final empType = (data['employmentType'] ?? (workLocationType == 'OFF_SITE' ? 'FIELD' : 'OFFICE')).toString().toUpperCase();
        if (eventType == 'CHECK_IN') {
          if (empType == 'FIELD') {
            TrackingService().startTracking(workType: 'FIELD', employmentType: 'FIELD');
          }
        } else if (eventType == 'CHECK_OUT') {
          TrackingService().stopTracking();
        }

        _showPunchFeedbackDialog(data, eventType, batteryLevel);
      }
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Validation failed';
      if (mounted) {
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Punch Out-Of-Bounds', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            content: Text(msg, style: const TextStyle(fontSize: 13)),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Dismiss')),
            ],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isPunching = false);
    }
  }

  void _showPunchFeedbackDialog(
    Map<String, dynamic> result,
    String eventType,
    int? batteryLevel,
  ) {
    final bool isCheckIn = eventType == 'CHECK_IN';
    final bool isLate = result['isLate'] == true;
    final String timeStr = result['time']?.toString() ?? DateFormat('hh:mm a').format(DateTime.now());
    final String officeName = result['officeName']?.toString() ?? 'Office Geofence';
    final String timingMsg = result['timingMessage']?.toString() ??
        (isLate ? 'Punched in after grace period.' : 'Punched in on time within office hours (09:00 AM - 05:30 PM).');
    final String totalWorkStr = result['totalWorkingHoursFormatted']?.toString() ??
        (result['totalWorkMinutes'] != null
            ? '${(result['totalWorkMinutes'] as int) ~/ 60} hrs ${(result['totalWorkMinutes'] as int) % 60} mins'
            : 'Recorded');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        contentPadding: const EdgeInsets.all(24),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: isCheckIn
                    ? (isLate ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7))
                    : const Color(0xFFE0F2FE),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isCheckIn
                    ? (isLate ? Icons.timer_outlined : Icons.check_circle_rounded)
                    : Icons.check_circle_outline_rounded,
                size: 36,
                color: isCheckIn
                    ? (isLate ? const Color(0xFFD97706) : const Color(0xFF16A34A))
                    : const Color(0xFF0284C7),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              isCheckIn ? 'Punch In Confirmed' : 'Punch Out Completed',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 6),
            if (isCheckIn) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isLate ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isLate ? const Color(0xFFF59E0B) : const Color(0xFF22C55E),
                  ),
                ),
                child: Text(
                  isLate ? 'LATE ARRIVAL' : 'ON TIME',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isLate ? const Color(0xFFB45309) : const Color(0xFF15803D),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                timingMsg,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.4),
              ),
            ] else ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF86EFAC)),
                ),
                child: Column(
                  children: [
                    const Text(
                      "TODAY'S TOTAL WORKING HOURS",
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.8,
                        color: Color(0xFF16A34A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      totalWorkStr,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF15803D),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Your working hours (09:00 AM - 05:30 PM) have been successfully recorded and synced with the HR dashboard.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
              ),
            ],
            const SizedBox(height: 16),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Column(
                  children: [
                    const Icon(Icons.access_time_rounded, size: 18, color: Color(0xFF64748B)),
                    const SizedBox(height: 2),
                    Text(timeStr, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                    const Text('Timestamp', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                  ],
                ),
                if (batteryLevel != null)
                  Column(
                    children: [
                      const Icon(Icons.battery_charging_full_rounded, size: 18, color: Color(0xFF16A34A)),
                      const SizedBox(height: 2),
                      Text('$batteryLevel%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                      const Text('Phone Battery', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                    ],
                  ),
                Column(
                  children: [
                    const Icon(Icons.pin_drop_rounded, size: 18, color: Color(0xFF0284C7)),
                    const SizedBox(height: 2),
                    Text(
                      officeName.length > 12 ? '${officeName.substring(0, 10)}...' : officeName,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                    ),
                    const Text('Live Geofence', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F172A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('OK, Got It', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCorrectionDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          top: 20,
          left: 20,
          right: 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Request Attendance Correction',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'Submit a request for missing punches or eligible late-arrival exceptions.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _correctionReasonController,
              maxLines: 3,
              style: const TextStyle(fontSize: 13),
              decoration: InputDecoration(
                labelText: 'Reason for correction',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () async {
                  if (_correctionReasonController.text.trim().isEmpty) return;
                  final messenger = ScaffoldMessenger.of(context);
                  try {
                    await ApiService().dio.post(
                      '/attendance/corrections/request',
                      data: {
                        'requestDate': DateFormat('yyyy-MM-dd').format(_correctionDate),
                        'reason': _correctionReasonController.text.trim(),
                      },
                    );
                    if (ctx.mounted) Navigator.pop(ctx);
                    _correctionReasonController.clear();
                    messenger.showSnackBar(
                      const SnackBar(content: Text('Correction request submitted for HR review')),
                    );
                  } catch (e) {
                    messenger.showSnackBar(
                      const SnackBar(content: Text('Failed to submit request')),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Submit to HR'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isCheckedIn = _todayStatus?['isCheckedIn'] == true;
    final isCheckedOut = _todayStatus?['isCheckedOut'] == true;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Attendance', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_calendar, color: Color(0xFF16A34A)),
            tooltip: 'Request Correction',
            onPressed: _showCorrectionDialog,
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchAttendance,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_isLoading)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 12),
                    child: ClipRRect(
                      borderRadius: BorderRadius.all(Radius.circular(4)),
                      child: LinearProgressIndicator(color: Color(0xFF16A34A)),
                    ),
                  ),
                // Quick Punch Card
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _todayStatus?['office']?['name'] ?? 'Office Geofence',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '${_todayStatus?['office']?['radiusMeters'] ?? 50}m Radius',
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: (_isPunching || isCheckedIn)
                                  ? null
                                  : () => _handlePunch('CHECK_IN'),
                              icon: const Icon(Icons.login, size: 18),
                              label: const Text('Check In'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF16A34A),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: (_isPunching || !isCheckedIn || isCheckedOut)
                                  ? null
                                  : () => _handlePunch('CHECK_OUT'),
                              icon: const Icon(Icons.logout, size: 18),
                              label: const Text('Check Out'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF0F172A),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // History Section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Attendance History', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                    TextButton.icon(
                      onPressed: _showCorrectionDialog,
                      icon: const Icon(Icons.edit, size: 14),
                      label: const Text('Request Correction', style: TextStyle(fontSize: 11)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                if (_history.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Center(
                      child: Text('No attendance history found', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                    ),
                  )
                else
                  ..._history.map((rec) {
                    final dateStr = DateFormat('EEE, d MMM').format(DateTime.parse(rec['date']));
                    final status = rec['status'] ?? 'ABSENT';
                    final isPresent = status == 'PRESENT';

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(dateStr, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Text(
                                    rec['firstCheckIn'] != null
                                        ? 'In: ${DateFormat('hh:mm a').format(DateTime.parse(rec['firstCheckIn']).toLocal())}'
                                        : 'In: —',
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    rec['lastCheckOut'] != null
                                        ? 'Out: ${DateFormat('hh:mm a').format(DateTime.parse(rec['lastCheckOut']).toLocal())}'
                                        : 'Out: —',
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: isPresent ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              status,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: isPresent ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
