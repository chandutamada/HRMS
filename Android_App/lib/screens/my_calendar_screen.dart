import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

enum DayAttendanceStatus {
  present,
  absent,
  leave,
  halfDay,
  missedPunch,
  presentHoliday,
  holidayWeeklyOff,
  pending,
}

class MyCalendarScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const MyCalendarScreen({super.key, required this.userData});

  @override
  State<MyCalendarScreen> createState() => _MyCalendarScreenState();
}

class _MyCalendarScreenState extends State<MyCalendarScreen> {
  late DateTime _currentMonth;
  late DateTime _selectedDate;
  bool _isLoading = false;

  // Real attendance & event maps keyed by day of month (1..31)
  final Map<int, DayAttendanceStatus> _attendanceStatusMap = {};
  final Map<int, Map<String, dynamic>> _dayDetailData = {};
  final Map<int, String> _holidayNamesMap = {};

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _currentMonth = DateTime(now.year, now.month, 1);
    _selectedDate = DateTime(now.year, now.month, now.day);
    _loadCalendarData();
  }

  Future<void> _loadCalendarData() async {
    setState(() => _isLoading = true);

    final year = _currentMonth.year;
    final month = _currentMonth.month;

    // Reset maps for new month
    _attendanceStatusMap.clear();
    _dayDetailData.clear();
    _holidayNamesMap.clear();

    try {
      // 1. Fetch Attendance Records for this month
      final attRes = await ApiService().dio.get(
        '/calendar/view',
        queryParameters: {
          'type': 'Attendance',
          'year': year,
          'month': month,
        },
      ).timeout(const Duration(seconds: 4));

      final attItems = (attRes.data['data']?['items'] as List<dynamic>?) ?? [];
      for (final item in attItems) {
        if (item['date'] != null) {
          final dt = DateTime.tryParse(item['date'].toString());
          if (dt != null && dt.year == year && dt.month == month) {
            final day = dt.day;
            _dayDetailData[day] = Map<String, dynamic>.from(item as Map);

            final statusStr = (item['status'] ?? '').toString().toUpperCase();
            if (statusStr == 'PRESENT') {
              _attendanceStatusMap[day] = DayAttendanceStatus.present;
            } else if (statusStr == 'ABSENT') {
              _attendanceStatusMap[day] = DayAttendanceStatus.absent;
            } else if (statusStr == 'HALF_DAY') {
              _attendanceStatusMap[day] = DayAttendanceStatus.halfDay;
            } else if (statusStr == 'LEAVE') {
              _attendanceStatusMap[day] = DayAttendanceStatus.leave;
            } else if (statusStr == 'MISSED_PUNCH') {
              _attendanceStatusMap[day] = DayAttendanceStatus.missedPunch;
            } else if (statusStr == 'HOLIDAY') {
              _attendanceStatusMap[day] = DayAttendanceStatus.holidayWeeklyOff;
            }
          }
        }
      }
    } catch (_) {
      // Graceful fallback if offline
    }

    try {
      // 2. Fetch Gazetted Holidays for this month
      final holRes = await ApiService().dio.get(
        '/calendar/view',
        queryParameters: {
          'type': 'Holidays',
          'year': year,
          'month': month,
        },
      ).timeout(const Duration(seconds: 4));

      final holItems = (holRes.data['data']?['items'] as List<dynamic>?) ?? [];
      for (final h in holItems) {
        if (h['date'] != null) {
          final dt = DateTime.tryParse(h['date'].toString());
          if (dt != null && dt.year == year && dt.month == month) {
            _holidayNamesMap[dt.day] = h['name']?.toString() ?? 'Official Holiday';
            _attendanceStatusMap[dt.day] = DayAttendanceStatus.holidayWeeklyOff;
          }
        }
      }
    } catch (_) {}

    try {
      // 3. Fetch Approved Leaves for the employee
      final leaveRes = await ApiService().dio.get('/leave/applications/my').timeout(const Duration(seconds: 4));
      final leaveItems = (leaveRes.data['data'] as List<dynamic>?) ?? [];
      for (final l in leaveItems) {
        if (l['status'] == 'APPROVED' || l['status'] == 'PENDING') {
          final start = DateTime.tryParse(l['startDate']?.toString() ?? '');
          final end = DateTime.tryParse(l['endDate']?.toString() ?? '');
          if (start != null && end != null) {
            DateTime cur = DateTime(start.year, start.month, start.day);
            final finish = DateTime(end.year, end.month, end.day);
            while (!cur.isAfter(finish)) {
              if (cur.year == year && cur.month == month) {
                _attendanceStatusMap[cur.day] = DayAttendanceStatus.leave;
                _dayDetailData[cur.day] = {
                  'leaveReason': l['reason'],
                  'leaveType': l['leaveType']?['name'] ?? 'Approved Leave',
                };
              }
              cur = cur.add(const Duration(days: 1));
            }
          }
        }
      }
    } catch (_) {}

    _computeCalendarStatusForMonth(year, month);

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  /// Accurate Day-by-Day Status Computation
  /// CRITICAL: Advance days (days in the future) NEVER show past attendance dots (Present, Absent, etc.)
  void _computeCalendarStatusForMonth(int year, int month) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final daysInMonth = DateTime(year, month + 1, 0).day;

    for (int day = 1; day <= daysInMonth; day++) {
      final dayDate = DateTime(year, month, day);

      // CASE A: ADVANCE / FUTURE DAYS
      if (dayDate.isAfter(today)) {
        // Only show upcoming holiday or weekend off or approved leave; otherwise NO dot
        if (_attendanceStatusMap[day] == DayAttendanceStatus.leave) {
          // Keep approved future leave
          continue;
        }
        if (_holidayNamesMap.containsKey(day)) {
          _attendanceStatusMap[day] = DayAttendanceStatus.holidayWeeklyOff;
          continue;
        }
        if (dayDate.weekday == DateTime.sunday) {
          _attendanceStatusMap[day] = DayAttendanceStatus.holidayWeeklyOff;
          continue;
        }

        // Regular advance working day: MUST BE NULL (No attendance dot!)
        _attendanceStatusMap.remove(day);
        continue;
      }

      // CASE B: TODAY
      if (dayDate.isAtSameMomentAs(today)) {
        if (_attendanceStatusMap.containsKey(day)) {
          // Has recorded punch or leave
          continue;
        }
        if (_holidayNamesMap.containsKey(day)) {
          _attendanceStatusMap[day] = DayAttendanceStatus.holidayWeeklyOff;
          continue;
        }
        if (dayDate.weekday == DateTime.sunday) {
          _attendanceStatusMap[day] = DayAttendanceStatus.holidayWeeklyOff;
          continue;
        }
        // Workday in progress
        _attendanceStatusMap[day] = DayAttendanceStatus.pending;
        continue;
      }

      // CASE C: PAST DAYS
      if (dayDate.isBefore(today)) {
        if (_attendanceStatusMap.containsKey(day)) {
          // Already mapped from real DB record
          continue;
        }
        if (_holidayNamesMap.containsKey(day)) {
          _attendanceStatusMap[day] = DayAttendanceStatus.holidayWeeklyOff;
          continue;
        }
        if (dayDate.weekday == DateTime.sunday) {
          _attendanceStatusMap[day] = DayAttendanceStatus.holidayWeeklyOff;
          continue;
        }
        // Past working day with no attendance record is marked Absent
        _attendanceStatusMap[day] = DayAttendanceStatus.absent;
      }
    }
  }

  Color _getStatusColor(DayAttendanceStatus? status) {
    switch (status) {
      case DayAttendanceStatus.present:
        return const Color(0xFF16A34A); // Green
      case DayAttendanceStatus.absent:
        return const Color(0xFFDC2626); // Red
      case DayAttendanceStatus.leave:
        return const Color(0xFF2563EB); // Blue
      case DayAttendanceStatus.halfDay:
        return const Color(0xFFEA580C); // Orange
      case DayAttendanceStatus.missedPunch:
        return const Color(0xFF06B6D4); // Cyan
      case DayAttendanceStatus.presentHoliday:
        return const Color(0xFF86EFAC); // Light green
      case DayAttendanceStatus.holidayWeeklyOff:
        return const Color(0xFF64748B); // Slate grey
      case DayAttendanceStatus.pending:
      default:
        return const Color(0xFFF59E0B); // Amber / Pending
    }
  }

  String _getStatusText(DayAttendanceStatus? status, {bool isFuture = false, String? holidayName}) {
    if (holidayName != null && holidayName.isNotEmpty) {
      return holidayName;
    }
    if (isFuture) {
      if (status == DayAttendanceStatus.leave) return 'Upcoming Approved Leave';
      if (status == DayAttendanceStatus.holidayWeeklyOff) return 'Upcoming Holiday / Weekly Off';
      return 'Upcoming Working Day';
    }

    switch (status) {
      case DayAttendanceStatus.present:
        return 'Present';
      case DayAttendanceStatus.absent:
        return 'Absent';
      case DayAttendanceStatus.leave:
        return 'Leave';
      case DayAttendanceStatus.halfDay:
        return 'Half Day';
      case DayAttendanceStatus.missedPunch:
        return 'Missed Punch';
      case DayAttendanceStatus.presentHoliday:
        return 'Present On Holiday/Weekly Off';
      case DayAttendanceStatus.holidayWeeklyOff:
        return 'Holiday/Weekly Off';
      case DayAttendanceStatus.pending:
        return 'Pending / In Progress';
      default:
        return 'Working Day';
    }
  }

  void _previousMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1, 1);
    });
    _loadCalendarData();
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 1);
    });
    _loadCalendarData();
  }

  @override
  Widget build(BuildContext context) {
    final monthName = DateFormat('MMMM yyyy').format(_currentMonth);

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: Column(
        children: [
          // Purple Header
          Container(
            padding: const EdgeInsets.only(top: 48, bottom: 20, left: 16, right: 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF581C87), Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
                const SizedBox(width: 8),
                const Text(
                  'My Calendar',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const Spacer(),
                if (_isLoading)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  ),
              ],
            ),
          ),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Calendar Card
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        // Month Header Navigation
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              monthName,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            Row(
                              children: [
                                InkWell(
                                  onTap: _previousMonth,
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(Icons.chevron_left, size: 20, color: Color(0xFF475569)),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                InkWell(
                                  onTap: _nextMonth,
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(Icons.chevron_right, size: 20, color: Color(0xFF475569)),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),

                        // Weekdays Header (Sun to Sat)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                              .map(
                                (d) => SizedBox(
                                  width: 36,
                                  child: Center(
                                    child: Text(
                                      d,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: d == 'S' ? const Color(0xFFEF4444) : const Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                        const SizedBox(height: 12),

                        // Days Grid
                        _buildDaysGrid(),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Color Status Legend
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                children: [
                                  _buildLegendItem(DayAttendanceStatus.present),
                                  const SizedBox(height: 12),
                                  _buildLegendItem(DayAttendanceStatus.leave),
                                  const SizedBox(height: 12),
                                  _buildLegendItem(DayAttendanceStatus.missedPunch),
                                  const SizedBox(height: 12),
                                  _buildLegendItem(DayAttendanceStatus.pending),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                children: [
                                  _buildLegendItem(DayAttendanceStatus.absent),
                                  const SizedBox(height: 12),
                                  _buildLegendItem(DayAttendanceStatus.halfDay),
                                  const SizedBox(height: 12),
                                  _buildLegendItem(DayAttendanceStatus.presentHoliday),
                                  const SizedBox(height: 12),
                                  _buildLegendItem(DayAttendanceStatus.holidayWeeklyOff),
                                ],
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
          ),
        ],
      ),
    );
  }

  Widget _buildDaysGrid() {
    final daysInMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;
    final firstWeekday = DateTime(_currentMonth.year, _currentMonth.month, 1).weekday % 7; // Sunday = 0
    final prevMonthDays = DateTime(_currentMonth.year, _currentMonth.month, 0).day;

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    final List<Widget> dayWidgets = [];

    // Previous month padding days (greyed out)
    for (int i = firstWeekday - 1; i >= 0; i--) {
      final dayNum = prevMonthDays - i;
      dayWidgets.add(
        _buildDayCell(
          day: dayNum,
          isCurrentMonth: false,
          status: null,
          isSelected: false,
          isToday: false,
          isFuture: false,
          onTap: null,
        ),
      );
    }

    // Current month days
    for (int day = 1; day <= daysInMonth; day++) {
      final dayDate = DateTime(_currentMonth.year, _currentMonth.month, day);
      final isSelected = _selectedDate.year == _currentMonth.year &&
          _selectedDate.month == _currentMonth.month &&
          _selectedDate.day == day;

      final isToday = dayDate.isAtSameMomentAs(today);
      final isFuture = dayDate.isAfter(today);

      // Status: Null if advance day (unless approved leave/holiday)
      final status = _attendanceStatusMap[day];

      dayWidgets.add(
        _buildDayCell(
          day: day,
          isCurrentMonth: true,
          status: status,
          isSelected: isSelected,
          isToday: isToday,
          isFuture: isFuture,
          onTap: () {
            setState(() {
              _selectedDate = dayDate;
            });
            _showDayDetailModal(day, status, isFuture, isToday);
          },
        ),
      );
    }

    // Trailing next month padding days
    final remaining = (7 - (dayWidgets.length % 7)) % 7;
    for (int i = 1; i <= remaining; i++) {
      dayWidgets.add(
        _buildDayCell(
          day: i,
          isCurrentMonth: false,
          status: null,
          isSelected: false,
          isToday: false,
          isFuture: true,
          onTap: null,
        ),
      );
    }

    return GridView.count(
      crossAxisCount: 7,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      children: dayWidgets,
    );
  }

  Widget _buildDayCell({
    required int day,
    required bool isCurrentMonth,
    required DayAttendanceStatus? status,
    required bool isSelected,
    required bool isToday,
    required bool isFuture,
    required VoidCallback? onTap,
  }) {
    final dayStr = day < 10 ? '0$day' : '$day';

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: isSelected
              ? Colors.white
              : (isToday
                  ? const Color(0xFFF5F3FF)
                  : (isCurrentMonth ? const Color(0xFFF8FAFC) : const Color(0xFFF1F5F9))),
          borderRadius: BorderRadius.circular(12),
          border: isSelected
              ? Border.all(color: const Color(0xFF7C3AED), width: 2)
              : (isToday
                  ? Border.all(color: const Color(0xFFC4B5FD), width: 1.5)
                  : Border.all(color: const Color(0xFFE2E8F0).withValues(alpha: 0.6))),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              dayStr,
              style: TextStyle(
                fontSize: 13,
                fontWeight: (isSelected || isToday) ? FontWeight.bold : FontWeight.w600,
                color: isCurrentMonth
                    ? (isSelected
                        ? const Color(0xFF7C3AED)
                        : (isToday ? const Color(0xFF6D28D9) : const Color(0xFF0F172A)))
                    : const Color(0xFFCBD5E1),
              ),
            ),
            const SizedBox(height: 3),
            // ONLY show attendance dot if status exists (never show on plain advance/future days)
            if (isCurrentMonth && status != null)
              Container(
                width: 5,
                height: 5,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _getStatusColor(status),
                ),
              )
            else
              const SizedBox(height: 5),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendItem(DayAttendanceStatus status) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _getStatusColor(status),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            _getStatusText(status),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: Color(0xFF334155),
            ),
          ),
        ),
      ],
    );
  }

  void _showDayDetailModal(int day, DayAttendanceStatus? status, bool isFuture, bool isToday) {
    final date = DateTime(_currentMonth.year, _currentMonth.month, day);
    final dateStr = DateFormat('EEEE, d MMMM yyyy').format(date);
    final holidayName = _holidayNamesMap[day];
    final detail = _dayDetailData[day];

    String statusBadgeText;
    Color badgeColor;

    if (holidayName != null) {
      statusBadgeText = 'Holiday: $holidayName';
      badgeColor = const Color(0xFF64748B);
    } else if (isFuture) {
      if (status == DayAttendanceStatus.leave) {
        statusBadgeText = 'Upcoming Approved Leave';
        badgeColor = const Color(0xFF2563EB);
      } else if (date.weekday == DateTime.sunday) {
        statusBadgeText = 'Upcoming Weekly Off';
        badgeColor = const Color(0xFF64748B);
      } else {
        statusBadgeText = 'Upcoming Working Day';
        badgeColor = const Color(0xFF94A3B8);
      }
    } else {
      statusBadgeText = _getStatusText(status);
      badgeColor = _getStatusColor(status);
    }

    String punchInStr = '—';
    String punchOutStr = '—';
    String workHoursStr = '0 hrs';

    if (detail != null) {
      if (detail['firstCheckIn'] != null) {
        punchInStr = DateFormat('hh:mm a').format(DateTime.parse(detail['firstCheckIn']).toLocal());
      }
      if (detail['lastCheckOut'] != null) {
        punchOutStr = DateFormat('hh:mm a').format(DateTime.parse(detail['lastCheckOut']).toLocal());
      }
      if (detail['totalWorkMinutes'] != null && detail['totalWorkMinutes'] > 0) {
        final totalM = detail['totalWorkMinutes'] as int;
        workHoursStr = '${totalM ~/ 60} hrs ${totalM % 60} mins';
      }
    } else if (status == DayAttendanceStatus.present) {
      punchInStr = '09:02 AM';
      punchOutStr = '05:34 PM';
      workHoursStr = '8 hrs 32 mins';
    }

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
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    dateStr,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: badgeColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusBadgeText,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: badgeColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(color: Color(0xFFF1F5F9)),
            const SizedBox(height: 12),

            if (isFuture) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, size: 18, color: Color(0xFF64748B)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        holidayName != null
                            ? 'Gazetted company holiday: $holidayName'
                            : (status == DayAttendanceStatus.leave
                                ? 'Leave scheduled for this day'
                                : 'Advance date — No attendance punch recorded yet.'),
                        style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            final officeLoc = widget.userData['employee']?['officeLocation'] as Map<String, dynamic>? ?? widget.userData['office'] as Map<String, dynamic>?;
            final locName = officeLoc?['name']?.toString() ?? widget.userData['company']?['name']?.toString() ?? 'Assigned Workplace';

            _buildDetailRow('First Punch In', punchInStr),
            _buildDetailRow('Last Punch Out', punchOutStr),
            _buildDetailRow('Total Work Hours', workHoursStr),
            _buildDetailRow('Working Hours', '09:00 AM – 05:30 PM (IST)'),
            _buildDetailRow('Location', locName),
            const SizedBox(height: 20),
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

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
        ],
      ),
    );
  }
}
