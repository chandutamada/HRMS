import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../services/tracking_service.dart';
import '../widgets/app_drawer.dart';
import '../widgets/face_capture_dialog.dart';
import 'my_calendar_screen.dart';
import 'leave_attendance_hub_screen.dart';
import 'field_duty_screen.dart';
import 'profile_screen.dart';
import 'attendance_regularisation_screen.dart';
import 'leave_tab.dart';
import 'circulars_screen.dart';
import 'notifications_screen.dart';

class HomeTab extends StatefulWidget {
  final Map<String, dynamic> userData;
  const HomeTab({super.key, required this.userData});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  Map<String, dynamic>? _todayStatus;
  int _unreadNotifsCount = 0;
  int _leaveCount = 0;
  int _circularsCount = 0;
  List<Map<String, dynamic>> _celebrations = [];
  bool _isLoadingCelebrations = true;
  bool _isPunching = false;
  Timer? _clockTimer;

  @override
  void initState() {
    super.initState();
    _fetchHomeData();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchHomeData() async {
    try {
      final statusRes = await ApiService()
          .dio
          .get('/attendance/today');

      if (mounted) {
        setState(() {
          _todayStatus = statusRes.data['data'];
        });

        // Auto-resume active tracking / geofence monitoring if employee is already punched in today
        final hasCheckedIn = (_todayStatus?['hasCheckedIn'] == true) ||
            (_todayStatus?['isCheckedIn'] == true) ||
            (_todayStatus?['firstCheckIn'] != null);
        final hasCheckedOut = (_todayStatus?['hasCheckedOut'] == true) ||
            (_todayStatus?['lastCheckOut'] != null);

        if (hasCheckedIn && !hasCheckedOut) {
          final rawWork = _todayStatus?['workLocationType']?.toString() ?? widget.userData['employee']?['workLocationType']?.toString();
          final rawEmp = _todayStatus?['employmentType']?.toString() ?? widget.userData['employee']?['employmentType']?.toString();
          final isField = rawWork == 'OFF_SITE' || rawEmp == 'FIELD';
          final office = _todayStatus?['office'] as Map<String, dynamic>? ?? widget.userData['employee']?['officeLocation'] as Map<String, dynamic>?;
          if (isField) {
            if (!TrackingService().isTracking) {
              TrackingService().startTracking(workType: 'FIELD', employmentType: 'FIELD');
            }
          } else {
            if (!TrackingService().isOfficeGeofenceMonitoring) {
              TrackingService().startOfficeGeofenceMonitor(office);
            }
          }
        }
      }
    } catch (_) {
      // Graceful fallback
    }

    // Fetch unread notifications count
    try {
      final notifRes = await ApiService().dio.get('/notifications/unread-count');
      if (mounted) {
        final count = (notifRes.data['data'] is Map ? notifRes.data['data']['count'] : notifRes.data['data'] ?? notifRes.data) as int? ?? 0;
        setState(() {
          _unreadNotifsCount = count;
        });
      }
    } catch (_) {}

    // Fetch real leave count
    try {
      final leaveRes = await ApiService().dio.get('/leave/applications/my');
      if (mounted) {
        final list = (leaveRes.data['data'] ?? leaveRes.data) as List<dynamic>? ?? [];
        setState(() {
          _leaveCount = list.length;
        });
      }
    } catch (_) {}

    // Fetch real circulars count
    try {
      final circRes = await ApiService().dio.get('/circulars');
      if (mounted) {
        final list = (circRes.data['data'] ?? circRes.data) as List<dynamic>? ?? [];
        setState(() {
          _circularsCount = list.length;
        });
      }
    } catch (_) {}

    // Fetch dynamic celebrations (real HR posts & birthdays)
    _fetchCelebrations();

    // Ping real phone GPS to backend so HR webpage receives accurate live location immediately
    try {
      final loc = await LocationService.getCurrentLocation();
      if (loc.success && loc.position != null) {
        final pos = loc.position!;
        await ApiService().dio.post(
          '/tracking/live',
          data: {
            'latitude': pos.latitude,
            'longitude': pos.longitude,
            'accuracy': pos.accuracy,
            'altitude': pos.altitude,
            'speed': pos.speed >= 0 ? pos.speed * 3.6 : 0.0,
            'heading': pos.heading,
            'isMoving': pos.speed > 0.5,
          },
        );
      }
    } catch (_) {}
  }

  Future<void> _fetchCelebrations() async {
    try {
      final results = await Future.wait([
        ApiService().dio.get('/notifications/feed').catchError((_) => null as dynamic),
        ApiService().dio.get('/notifications/birthdays').catchError((_) => null as dynamic),
      ]);

      final List<Map<String, dynamic>> list = [];

      // 1. Process feed celebrations from HR (e.g. "Happy Birthday RAM")
      final feedRes = results[0];
      if (feedRes.data != null) {
        final feedItems = (feedRes.data['data'] ?? feedRes.data) as List<dynamic>? ?? [];
        for (var f in feedItems) {
          final title = (f['title'] ?? '').toString();
          final message = (f['message'] ?? '').toString();
          final type = (f['type'] ?? '').toString().toLowerCase();

          final isBirthday = type == 'birthday' || title.toLowerCase().contains('birthday');
          final isCelebration = isBirthday || title.toLowerCase().contains('celebration') || message.toLowerCase().contains('celebration');

          if (isCelebration) {
            String name = title;
            if (title.toLowerCase().contains('happy birthday')) {
              name = title.replaceAll(RegExp(r'happy birthday', caseSensitive: false), '').trim();
              if (name.isEmpty) name = 'Team Member';
            }
            list.add({
              'name': name,
              'fullTitle': title,
              'location': 'Superbee Aeronautics',
              'tag': isBirthday ? 'Birthday' : 'Celebration',
              'icon': isBirthday ? Icons.cake_rounded : Icons.celebration_rounded,
              'iconColor': const Color(0xFFF43F5E),
              'message': message,
            });
          }
        }
      }

      // 2. Process upcoming birthdays from /notifications/birthdays
      final bdayRes = results[1];
      if (bdayRes.data != null) {
        final bdays = (bdayRes.data['data'] ?? bdayRes.data) as List<dynamic>? ?? [];
        for (var b in bdays) {
          final empName = b['employee_name'] ?? 'Colleague';
          final isToday = b['is_today'] == true;
          final days = b['days_until'] ?? 0;
          final tag = isToday ? 'Birthday Today!' : 'Birthday in ${days}d';

          final alreadyExists = list.any((item) => item['name'].toString().toLowerCase().contains(empName.toString().toLowerCase()));
          if (!alreadyExists) {
            list.add({
              'name': empName,
              'fullTitle': 'Birthday of $empName',
              'location': 'Superbee Aeronautics',
              'tag': tag,
              'icon': Icons.cake_rounded,
              'iconColor': const Color(0xFFF43F5E),
              'message': isToday ? 'Wishing $empName a very Happy Birthday today!' : 'Birthday upcoming in $days days.',
            });
          }
        }
      }

      if (mounted) {
        setState(() {
          _celebrations = list;
          _isLoadingCelebrations = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingCelebrations = false);
    }
  }

  Future<void> _handlePunchAction() async {
    setState(() => _isPunching = true);

    final locResult = await LocationService.getCurrentLocation();
    if (!locResult.success) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(locResult.errorMessage ?? 'GPS Location unavailable'),
            backgroundColor: Colors.red.shade700,
          ),
        );
        setState(() => _isPunching = false);
      }
      return;
    }

    final hasCheckedIn = (_todayStatus?['hasCheckedIn'] == true) ||
        (_todayStatus?['isCheckedIn'] == true) ||
        (_todayStatus?['firstCheckIn'] != null);
    final hasCheckedOut = (_todayStatus?['hasCheckedOut'] == true) ||
        (_todayStatus?['isCheckedOut'] == true) ||
        (_todayStatus?['lastCheckOut'] != null);
    final eventType = (hasCheckedIn && !hasCheckedOut) ? 'CHECK_OUT' : 'CHECK_IN';

    final employee = widget.userData['employee'] as Map<String, dynamic>? ?? {};
    final rawWork = _todayStatus?['workLocationType']?.toString() ?? employee['workLocationType']?.toString();
    final rawEmp = _todayStatus?['employmentType']?.toString() ?? employee['employmentType']?.toString();
    final isField = rawWork == 'OFF_SITE' || rawEmp == 'FIELD';
    final isOffice = !isField;
    final office = _todayStatus?['office'] as Map<String, dynamic>? ?? employee['officeLocation'] as Map<String, dynamic>?;

    // Strict local geofence guard for office employees on both Punch-In and Punch-Out (bypassed for Field/GPS employees)
    if (isOffice && office != null && office['latitude'] != null && office['longitude'] != null) {
      final offLat = (office['latitude'] as num).toDouble();
      final offLng = (office['longitude'] as num).toDouble();
      final offRadius = (office['radiusMeters'] as num?)?.toDouble() ?? 50.0;
      final dist = Geolocator.distanceBetween(
        locResult.position!.latitude,
        locResult.position!.longitude,
        offLat,
        offLng,
      );

      if (dist > offRadius) {
        if (mounted) {
          final action = eventType == 'CHECK_IN' ? 'punch in' : 'punch out';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Punch rejected: You are ${dist.round()}m away from ${office['name'] ?? 'office'} (Allowed radius: ${offRadius.round()}m). Office employees must $action inside the office geofence.',
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
        // Employee cancelled or did not complete face photo verification
        setState(() => _isPunching = false);
        return;
      }
    }

    // 3. Read phone battery level to send live telemetry to HR
    int? batteryLevel;
    try {
      batteryLevel = await Battery().batteryLevel;
    } catch (_) {}

    try {
      final response = await ApiService().dio.post(
        '/attendance/event',
        data: {
          'eventType': eventType,
          'latitude': locResult.position!.latitude,
          'longitude': locResult.position!.longitude,
          'accuracyMeters': locResult.position!.accuracy,
          'batteryPercentage': batteryLevel,
          'remarks': facePhotoUrl != null ? 'Face ID Verified Punch-In' : 'Mobile Quick Action Punch',
          'photoUrl': facePhotoUrl,
        },
      );

      final rawData = response.data;
      final Map<String, dynamic> result = (rawData is Map<String, dynamic>)
          ? (rawData['data'] is Map<String, dynamic> ? rawData['data'] as Map<String, dynamic> : rawData)
          : {};
      await _fetchHomeData();

      // Field employee live tracking is triggered strictly from Punch-In till Punch-Out
      // Office employee geofence boundary monitor is activated from Punch-In (tracks if they step outside)
      final empType = (result['employmentType'] ?? (isField ? 'FIELD' : 'OFFICE')).toString().toUpperCase();
      if (eventType == 'CHECK_IN') {
        if (empType == 'FIELD') {
          TrackingService().startTracking(workType: 'FIELD', employmentType: 'FIELD');
        } else {
          final office = _todayStatus?['office'] as Map<String, dynamic>? ?? widget.userData['employee']?['officeLocation'] as Map<String, dynamic>?;
          TrackingService().startOfficeGeofenceMonitor(office);
        }
      } else if (eventType == 'CHECK_OUT') {
        TrackingService().stopOfficeGeofenceMonitor();
        TrackingService().stopTracking();
      }

      if (mounted) {
        _showPunchFeedbackDialog(result, eventType, batteryLevel);
      }
    } catch (e) {
      if (mounted) {
        String msg = 'Punch submission failed';
        if (e is DioException) {
          final resData = e.response?.data;
          if (resData is Map && resData['message'] != null) {
            msg = resData['message'].toString();
          } else if (resData is String && resData.isNotEmpty) {
            msg = resData.length > 100 ? resData.substring(0, 100) : resData;
          } else if (e.response?.statusMessage != null) {
            msg = '${e.response?.statusCode}: ${e.response?.statusMessage}';
          } else {
            msg = e.message ?? 'Network connection error';
          }
        } else {
          msg = e.toString();
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isPunching = false);
      }
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
            // Status Icon Header
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

            // Dialog Title & Event Tag
            Text(
              isCheckIn ? 'Punch In Confirmed' : 'Punch Out Completed',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 6),

            // Timing status badge for Check-In
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
              // Working Hours Banner for Check-Out
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

            // Live Telemetry Details (Location & Battery to HR)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                // Punch Time
                Column(
                  children: [
                    const Icon(Icons.access_time_rounded, size: 18, color: Color(0xFF64748B)),
                    const SizedBox(height: 2),
                    Text(timeStr, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                    const Text('Timestamp', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                  ],
                ),
                // Battery
                if (batteryLevel != null)
                  Column(
                    children: [
                      const Icon(Icons.battery_charging_full_rounded, size: 18, color: Color(0xFF16A34A)),
                      const SizedBox(height: 2),
                      Text('$batteryLevel%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                      const Text('Phone Battery', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                    ],
                  ),
                // Geofence / Office
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

            // Close / OK Button
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

  @override
  Widget build(BuildContext context) {
    final employee = widget.userData['employee'] as Map<String, dynamic>? ?? {};
    final fullName = employee['fullName'] ?? employee['firstName'] ?? 'Ramesh';
    final firstName = fullName.toString().split(' ')[0];

    final hasCheckedIn = (_todayStatus?['hasCheckedIn'] == true) ||
        (_todayStatus?['isCheckedIn'] == true) ||
        (_todayStatus?['firstCheckIn'] != null);
    final hasCheckedOut = (_todayStatus?['hasCheckedOut'] == true) ||
        (_todayStatus?['isCheckedOut'] == true) ||
        (_todayStatus?['lastCheckOut'] != null);
    final firstIn = _todayStatus?['firstCheckIn'];
    final punchTimeStr = firstIn != null
        ? DateFormat('hh:mm a').format(DateTime.parse(firstIn).toLocal())
        : null;

    final todayFormatted = DateFormat('EEEE, d MMM').format(DateTime.now());

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: AppDrawer(userData: widget.userData, currentRoute: 'Home'),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showHelpSupportModal(context),
        backgroundColor: const Color(0xFF581C87),
        elevation: 4,
        child: const Icon(Icons.support_agent_rounded, color: Colors.white, size: 28),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchHomeData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Gradient Purple Header (matching Image 1)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 48, bottom: 24, left: 16, right: 16),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF581C87), Color(0xFF7C3AED)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // App Bar Row (Hamburger, Greeting, Avatar)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Builder(
                        builder: (ctx) => InkWell(
                          onTap: () => Scaffold.of(ctx).openDrawer(),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.menu_rounded, color: Colors.white, size: 22),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              todayFormatted,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFFE9D5FF),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Hi, $firstName',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Notification Bell with Unread Badge
                      InkWell(
                        onTap: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => NotificationsScreen(userData: widget.userData),
                            ),
                          );
                          _fetchHomeData();
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 22),
                              if (_unreadNotifsCount > 0)
                                Positioned(
                                  right: 6,
                                  top: 6,
                                  child: Container(
                                    padding: const EdgeInsets.all(3),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFEF4444),
                                      shape: BoxShape.circle,
                                    ),
                                    constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                                    child: Text(
                                      '$_unreadNotifsCount',
                                      style: const TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.white),
                                      textAlign: TextAlign.center,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      InkWell(
                        onTap: () async {
                          final updated = await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => ProfileScreen(userData: widget.userData)),
                          );
                          if (updated is Map<String, dynamic> && mounted) {
                            setState(() {
                              widget.userData.addAll(updated);
                            });
                          }
                        },
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          child: ClipOval(
                            child: Builder(
                              builder: (_) {
                                final emp = widget.userData['employee'] as Map<String, dynamic>? ?? {};
                                final avatar = ApiService.resolveImageUrl(emp['avatarUrl']?.toString());
                                if (avatar.isNotEmpty) {
                                  return Image.network(
                                    avatar,
                                    width: 44,
                                    height: 44,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => _buildAvatarFallback(firstName),
                                  );
                                }
                                return _buildAvatarFallback(firstName);
                              },
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Punch In Card (Deep purple translucent container from Image 1)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4C1D95).withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              hasCheckedIn ? 'Punched in at $punchTimeStr' : 'Punch In not received',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                            InkWell(
                              onTap: _isPunching ? null : _handlePunchAction,
                              borderRadius: BorderRadius.circular(24),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(24),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.1),
                                      blurRadius: 8,
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.location_on, size: 14, color: Color(0xFF7C3AED)),
                                    const SizedBox(width: 4),
                                    Text(
                                      _isPunching
                                          ? 'Locating...'
                                          : (hasCheckedIn ? (hasCheckedOut ? 'Completed' : 'Punch Out') : 'Punch In'),
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF7C3AED),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Divider(color: Colors.white.withValues(alpha: 0.15), height: 1),
                        const SizedBox(height: 10),

                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.access_time_rounded, size: 13, color: Color(0xFFD8B4FE)),
                                SizedBox(width: 6),
                                Text(
                                  'Last working day: 00:00 AM — 12:00 AM',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFFE9D5FF),
                                    fontWeight: FontWeight.w400,
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF6B21A8),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Present',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // QUICK ACTIONS (matching Image 1)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'QUICK ACTIONS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 12),

                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      _buildQuickActionCard(
                        title: 'My Profile',
                        icon: Icons.person_rounded,
                        iconColor: const Color(0xFF0284C7),
                        bgColor: const Color(0xFFE0F2FE),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => ProfileScreen(userData: widget.userData)),
                          );
                        },
                      ),
                      _buildQuickActionCard(
                        title: 'Apply Leave',
                        icon: Icons.edit_note_rounded,
                        iconColor: const Color(0xFFD97706),
                        bgColor: const Color(0xFFFEF3C7),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => LeaveTab(userData: widget.userData)),
                          );
                        },
                      ),
                      _buildQuickActionCard(
                        title: 'Attendance Regularisation',
                        icon: Icons.access_time_rounded,
                        iconColor: const Color(0xFF16A34A),
                        bgColor: const Color(0xFFDCFCE7),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => AttendanceRegularisationScreen(userData: widget.userData)),
                          );
                        },
                      ),
                      _buildQuickActionCard(
                        title: 'My Calendar',
                        icon: Icons.calendar_today_rounded,
                        iconColor: const Color(0xFF059669),
                        bgColor: const Color(0xFFD1FAE5),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => MyCalendarScreen(userData: widget.userData)),
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // MY ACTIVITIES (matching Image 1)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'MY ACTIVITIES',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      // Leave & Attendance with badge 13
                      Expanded(
                        child: InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => LeaveAttendanceHubScreen(userData: widget.userData)),
                            );
                          },
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFCE7F3),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(Icons.assignment_rounded, color: Color(0xFFDB2777), size: 18),
                                ),
                                const SizedBox(width: 10),
                                const Expanded(
                                  child: Text(
                                    'Leave & Attendance',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF3E8FF),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    '$_leaveCount',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),

                      // Circulars Card
                      Expanded(
                        child: InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => CircularsScreen(userData: widget.userData)),
                            );
                          },
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEDE9FE),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(Icons.campaign_rounded, color: Color(0xFF7C3AED), size: 18),
                                ),
                                const SizedBox(width: 10),
                                const Expanded(
                                  child: Text(
                                    'Circulars',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFDCFCE7),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    '$_circularsCount',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // CELEBRATIONS (Dynamic real-time feed & birthdays)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'CELEBRATIONS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF64748B),
                          letterSpacing: 0.5,
                        ),
                      ),
                      InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => NotificationsScreen(userData: widget.userData),
                            ),
                          );
                        },
                        child: const Text(
                          'View all',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  if (_isLoadingCelebrations && _celebrations.isEmpty)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF7C3AED)),
                        ),
                      ),
                    )
                  else if (_celebrations.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(
                              color: Color(0xFFFEF3C7),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.celebration_rounded, color: Color(0xFFD97706), size: 20),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'No active celebrations today',
                                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'New celebrations posted by HR will appear here live.',
                                  style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (_celebrations.length == 1)
                    _buildCelebrationCardWidget(_celebrations[0], 0, isFullWidth: true)
                  else if (_celebrations.length == 2)
                    Row(
                      children: [
                        Expanded(child: _buildCelebrationCardWidget(_celebrations[0], 0)),
                        const SizedBox(width: 12),
                        Expanded(child: _buildCelebrationCardWidget(_celebrations[1], 1)),
                      ],
                    )
                  else
                    SizedBox(
                      height: 140,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _celebrations.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (ctx, idx) => SizedBox(
                          width: 165,
                          child: _buildCelebrationCardWidget(_celebrations[idx], idx),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 36),
          ],
        ),
      ),
    ),
  );
  }

  Widget _buildQuickActionCard({
    required String title,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    final cardWidth = (MediaQuery.of(context).size.width - 32 - 36) / 4;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: cardWidth,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
                height: 1.15,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCelebrationCardWidget(Map<String, dynamic> c, int index, {bool isFullWidth = false}) {
    final name = c['name']?.toString() ?? 'Celebration';
    final location = c['location']?.toString() ?? 'Superbee Aeronautics';
    final tag = c['tag']?.toString() ?? 'Celebration';
    final icon = c['icon'] as IconData? ?? Icons.cake_rounded;
    final iconColor = c['iconColor'] as Color? ?? const Color(0xFFF43F5E);
    final message = c['message']?.toString() ?? '';
    final fullTitle = c['fullTitle']?.toString() ?? name;

    final initials = _getInitials(name);
    final palette = _getCelebrationPalette(index);

    if (isFullWidth) {
      return InkWell(
        onTap: () => _showCelebrationDetails(fullTitle, message, tag),
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: palette['avatarBg'],
                child: Text(
                  initials,
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: palette['avatarText']),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      message.isNotEmpty ? message : location,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(icon, size: 13, color: iconColor),
                        const SizedBox(width: 4),
                        Text(
                          tag,
                          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: iconColor),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return InkWell(
      onTap: () => _showCelebrationDetails(fullTitle, message, tag),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: palette['avatarBg'],
              child: Text(
                initials,
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: palette['avatarText']),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              name,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 2),
            Text(
              location,
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 13, color: iconColor),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    tag,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: iconColor),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showCelebrationDetails(String title, String message, String tag) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.celebration_rounded, color: Color(0xFFF59E0B)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                tag.toUpperCase(),
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              message.isNotEmpty ? message : 'Wishing all the best from Superbee Aeronautics!',
              style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF7C3AED))),
          ),
        ],
      ),
    );
  }

  String _getInitials(String name) {
    final clean = name.trim();
    if (clean.isEmpty) return 'SB';
    final parts = clean.split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return clean.substring(0, clean.length >= 2 ? 2 : 1).toUpperCase();
  }

  Map<String, Color> _getCelebrationPalette(int index) {
    const palettes = [
      {
        'avatarBg': Color(0xFFFEF08A),
        'avatarText': Color(0xFF854D0E),
      },
      {
        'avatarBg': Color(0xFFBAE6FD),
        'avatarText': Color(0xFF0369A1),
      },
      {
        'avatarBg': Color(0xFFFBCFE8),
        'avatarText': Color(0xFF9D174D),
      },
      {
        'avatarBg': Color(0xFFDDD6FE),
        'avatarText': Color(0xFF5B21B6),
      },
    ];
    return palettes[index % palettes.length];
  }

  void _showHelpSupportModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const Row(
              children: [
                Icon(Icons.headset_mic_rounded, color: Color(0xFF7C3AED), size: 24),
                SizedBox(width: 10),
                Text('HR Helpdesk & Assistant', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              'Need assistance with attendance regularization, leave encashment, or drone field tracking? Contact Superbee HR Operations directly:',
              style: TextStyle(fontSize: 12, color: Color(0xFF475569)),
            ),
            const SizedBox(height: 16),
            const ListTile(
              dense: true,
              leading: Icon(Icons.email, color: Color(0xFF7C3AED)),
              title: Text('hr@superbee.com'),
              subtitle: Text('Average response within 2 business hours'),
            ),
            const ListTile(
              dense: true,
              leading: Icon(Icons.phone, color: Color(0xFF16A34A)),
              title: Text('+91 80 4567 8900 (Campus Desk)'),
              subtitle: Text('Available Mon – Sat, 09:00 AM – 05:30 PM'),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C3AED),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Close', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarFallback(String name) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';
    return Container(
      color: const Color(0xFF6B21A8),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
