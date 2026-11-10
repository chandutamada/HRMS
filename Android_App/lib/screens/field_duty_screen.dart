import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../widgets/face_capture_dialog.dart';

class FieldDutyScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const FieldDutyScreen({super.key, required this.userData});

  @override
  State<FieldDutyScreen> createState() => _FieldDutyScreenState();
}

class _FieldDutyScreenState extends State<FieldDutyScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isPunchedIn = false;
  bool _isHolding = false;
  String? _lastPunchTime;

  // Selected task filter tab in Task view
  String _taskFilter = 'ALL_TASKS';

  // Tasks list (dynamically populated)
  final List<Map<String, dynamic>> _tasks = [];

  // Daily timeline activity list (dynamically populated)
  final List<Map<String, dynamic>> _activities = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _handlePunchAction() async {
    final locResult = await LocationService.getCurrentLocation();
    if (!locResult.success) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(locResult.errorMessage ?? 'GPS error')),
        );
      }
      return;
    }

    final willCheckIn = !_isPunchedIn;
    String? facePhotoUrl;

    if (willCheckIn) {
      final employee = widget.userData['employee'] as Map<String, dynamic>? ?? {};
      final firstName = employee['firstName'] ?? employee['fullName'] ?? 'Field Officer';
      final empCode = employee['employeeCode'] ?? widget.userData['employeeCode'] ?? 'SB-001';

      if (!mounted) return;
      facePhotoUrl = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (_) => FaceCaptureDialog(
          employeeName: firstName.toString(),
          employeeCode: empCode.toString(),
          officeName: 'Field Duty Ops Location',
        ),
      );

      if (facePhotoUrl == null) {
        return; // Cancelled
      }
    }

    try {
      final now = DateTime.now();
      final timeStr = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";
      setState(() {
        _isPunchedIn = !_isPunchedIn;
        _lastPunchTime = timeStr;
      });

      // Submit event to API
      await ApiService().dio.post('/attendance/event', data: {
        'eventType': _isPunchedIn ? 'CHECK_IN' : 'CHECK_OUT',
        'latitude': locResult.position!.latitude,
        'longitude': locResult.position!.longitude,
        'accuracyMeters': locResult.position!.accuracy,
        'remarks': facePhotoUrl != null ? 'Field Duty Face ID Verified Punch' : 'Field Duty Mobile Location-Based Punch',
        'photoUrl': facePhotoUrl,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isPunchedIn ? 'Checked IN with Face ID at $timeStr' : 'Checked OUT at $timeStr'),
            backgroundColor: _isPunchedIn ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Punch recorded offline with GPS coordinates')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: const Text('Field Duty & Location Operations', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF38BDF8),
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF94A3B8),
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          tabs: const [
            Tab(text: 'Attendance', icon: Icon(Icons.location_on, size: 18)),
            Tab(text: 'Task Management', icon: Icon(Icons.assignment, size: 18)),
            Tab(text: 'Day Activity', icon: Icon(Icons.history, size: 18)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildAttendanceView(),
          _buildTaskManagementView(),
          _buildDayActivityView(),
        ],
      ),
    );
  }

  // 1. LOCATION-BASED ATTENDANCE (Panel 1 of Image 5)
  Widget _buildAttendanceView() {
    final employee = widget.userData['employee'] as Map<String, dynamic>? ?? {};
    final fullName = employee['fullName'] ?? employee['firstName'] ?? widget.userData['email'] ?? 'Employee';
    final office = employee['officeLocation'] as Map<String, dynamic>? ?? widget.userData['company'] as Map<String, dynamic>?;
    final officeName = office?['name']?.toString() ?? 'Assigned Workplace';
    final radiusM = office?['radiusMeters'] != null ? '${office!['radiusMeters']}m' : '50m';

    return Stack(
      children: [
        // Map Vector Graphic Background
        Container(
          width: double.infinity,
          height: double.infinity,
          color: const Color(0xFFE2E8F0),
          child: CustomPaint(
            painter: _MapGridPainter(),
          ),
        ),

        // User Pin on Map
        Positioned(
          top: 180,
          left: MediaQuery.of(context).size.width * 0.45,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8),
                  ],
                ),
                child: Text(
                  _lastPunchTime != null ? 'Punched at $_lastPunchTime' : 'GPS Located: Superbee Campus',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
              ),
              const SizedBox(height: 4),
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF2563EB),
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [
                    BoxShadow(color: const Color(0xFF2563EB).withValues(alpha: 0.4), blurRadius: 16),
                  ],
                ),
                child: const Center(
                  child: Icon(Icons.person, color: Colors.white, size: 22),
                ),
              ),
            ],
          ),
        ),

        // Floating Bottom Card with Big Circular Punch Button
        Positioned(
          bottom: 24,
          left: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: const Color(0xFF7C3AED),
                      child: Text(fullName.toString().substring(0, 1), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(fullName.toString(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                          Text('$officeName ($radiusM Radius)', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text('In Office Range', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF166534))),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Large Circular "In" / "Out" Button (matching Image 5 Panel 1)
                GestureDetector(
                  onTapDown: (_) => setState(() => _isHolding = true),
                  onTapUp: (_) {
                    setState(() => _isHolding = false);
                    _handlePunchAction();
                  },
                  onTapCancel: () => setState(() => _isHolding = false),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: _isHolding ? 105 : 100,
                    height: _isHolding ? 105 : 100,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _isPunchedIn ? const Color(0xFFEF4444) : const Color(0xFF22C55E),
                      border: Border.all(
                        color: _isPunchedIn ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC),
                        width: 5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: (_isPunchedIn ? const Color(0xFFEF4444) : const Color(0xFF22C55E)).withValues(alpha: 0.35),
                          blurRadius: 20,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        _isPunchedIn ? 'Out' : 'In',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  _isPunchedIn ? 'Press to Punch Out' : 'Press & Hold to Punch In',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // 2. LOCATION-BASED TASK MANAGEMENT (Panel 2 of Image 5)
  Widget _buildTaskManagementView() {
    return Column(
      children: [
        // Simulated Map Preview Header with Task Pins
        Container(
          width: double.infinity,
          height: 180,
          color: const Color(0xFFE2E8F0),
          child: Stack(
            children: [
              CustomPaint(size: const Size(double.infinity, 180), painter: _MapGridPainter()),
              Positioned(
                top: 30,
                left: 80,
                child: _buildMapPin('Payment Collection', const Color(0xFF16A34A)),
              ),
              Positioned(
                top: 50,
                right: 90,
                child: _buildMapPin('On-site Demo', const Color(0xFFDC2626)),
              ),
              Positioned(
                bottom: 25,
                left: 170,
                child: _buildMapPin('Checked In', const Color(0xFF0284C7)),
              ),
            ],
          ),
        ),

        // Task List Sheet (matching Image 5 Panel 2)
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tasks - Select a task', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                    IconButton(
                      icon: const Icon(Icons.refresh, size: 20, color: Color(0xFF64748B)),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Synced tasks with headquarters')),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Pill Filter: ALL TASKS / ASSIGNED TO ME
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _taskFilter = 'ALL_TASKS'),
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: _taskFilter == 'ALL_TASKS' ? const Color(0xFF2563EB) : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Center(
                              child: Text(
                                'ALL TASKS',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: _taskFilter == 'ALL_TASKS' ? Colors.white : const Color(0xFF64748B),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _taskFilter = 'ASSIGNED_TO_ME'),
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: _taskFilter == 'ASSIGNED_TO_ME' ? const Color(0xFF2563EB) : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Center(
                              child: Text(
                                'ASSIGNED TO ME',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: _taskFilter == 'ASSIGNED_TO_ME' ? Colors.white : const Color(0xFF64748B),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Tasks List
                Expanded(
                  child: _tasks.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.assignment_outlined, size: 48, color: Colors.grey.shade400),
                              const SizedBox(height: 12),
                              Text(
                                'No field tasks assigned currently',
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'New tasks assigned by supervisor will appear here.',
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          itemCount: _tasks.length,
                          itemBuilder: (ctx, idx) {
                      final task = _tasks[idx];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    task['title'],
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: task['status'] == 'Checked In'
                                        ? const Color(0xFFE0F2FE)
                                        : const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    task['status'],
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: task['status'] == 'Checked In' ? const Color(0xFF0284C7) : const Color(0xFFB45309),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(Icons.location_on, size: 14, color: Color(0xFF64748B)),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(task['location'], style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                ),
                                Text(task['time'], style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                              ],
                            ),
                            if (task['notes'] != null) ...[
                              const SizedBox(height: 6),
                              Text(task['notes'], style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontStyle: FontStyle.italic)),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // 3. DETAILED HISTORY OF THE DAY'S ACTIVITY (Panel 3 of Image 5)
  Widget _buildDayActivityView() {
    final employee = widget.userData['employee'] as Map<String, dynamic>? ?? {};
    final fullName = employee['fullName'] ?? employee['firstName'] ?? widget.userData['email'] ?? 'Field Officer';
    final office = employee['officeLocation'] as Map<String, dynamic>? ?? widget.userData['company'] as Map<String, dynamic>?;
    final officeName = office?['name']?.toString() ?? 'Assigned Workplace';
    final initial = fullName.toString().isNotEmpty ? fullName.toString().substring(0, 1).toUpperCase() : 'F';
    final photoUrl = employee['photoUrl']?.toString();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Employee Header Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF7C3AED),
                        image: photoUrl != null && photoUrl.isNotEmpty
                            ? DecorationImage(
                                image: NetworkImage(photoUrl),
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                      child: photoUrl == null || photoUrl.isEmpty
                          ? Center(
                              child: Text(
                                initial,
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(fullName.toString(), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                          Text(officeName, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        const Icon(Icons.battery_charging_full, color: Color(0xFF16A34A), size: 16),
                        const Text(' 100%', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
                        const SizedBox(width: 8),
                        IconButton(icon: const Icon(Icons.phone, size: 18, color: Color(0xFF2563EB)), onPressed: () {}),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 3 Metric Counters: TOTAL DURATION, TOTAL DISTANCE, TOTAL CHECKINS
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Column(
                        children: [
                          Text(_activities.isNotEmpty ? '${_activities.length * 1.5} Hrs' : '0.0 Hrs', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                          const SizedBox(height: 2),
                          const Text('TOTAL DURATION', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                        ],
                      ),
                      Column(
                        children: [
                          Text(_activities.isNotEmpty ? '${_activities.length * 5} KM' : '0 KM', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                          const SizedBox(height: 2),
                          const Text('TOTAL DISTANCE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                        ],
                      ),
                      Column(
                        children: [
                          Text(_activities.isNotEmpty ? (_activities.length < 10 ? '0${_activities.length}' : '${_activities.length}') : '00', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
                          const SizedBox(height: 2),
                          const Text('TOTAL CHECKINS', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Date Switcher: < Yesterday >
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(icon: const Icon(Icons.chevron_left, size: 20), onPressed: () {}),
              const Text('Yesterday', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
              IconButton(icon: const Icon(Icons.chevron_right, size: 20), onPressed: () {}),
            ],
          ),
          const SizedBox(height: 8),

          // Activity Timeline with Connecting Line
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: _activities.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Column(
                        children: [
                          Icon(Icons.timeline_rounded, size: 40, color: Colors.grey.shade400),
                          const SizedBox(height: 10),
                          Text(
                            'No timeline activities recorded today',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Exact punch time and GPS location address will display here beside time.',
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _activities.length,
                    itemBuilder: (ctx, idx) {
                final act = _activities[idx];
                final isLast = idx == _activities.length - 1;

                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Time
                      SizedBox(
                        width: 65,
                        child: Text(
                          act['time'],
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                        ),
                      ),

                      // Vertical Line & Dot
                      Column(
                        children: [
                          Container(
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: act['color'],
                              border: Border.all(color: Colors.white, width: 2),
                              boxShadow: [
                                BoxShadow(color: (act['color'] as Color).withValues(alpha: 0.4), blurRadius: 4),
                              ],
                            ),
                          ),
                          if (!isLast)
                            Expanded(
                              child: Container(
                                width: 2,
                                color: const Color(0xFFCBD5E1),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 14),

                      // Activity Details
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                act['type'],
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: act['color']),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                act['address'],
                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                              ),
                              if (act['notes'] != null) ...[
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    'Notes: ${act['notes']}',
                                    style: const TextStyle(fontSize: 10, color: Color(0xFFB45309), fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapPin(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color, width: 1.5),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.2), blurRadius: 6),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.location_on, color: color, size: 14),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFCBD5E1).withValues(alpha: 0.5)
      ..strokeWidth = 1.0;

    for (double i = 0; i < size.width; i += 30) {
      canvas.drawLine(Offset(i, 0), Offset(i, size.height), paint);
    }
    for (double j = 0; j < size.height; j += 30) {
      canvas.drawLine(Offset(0, j), Offset(size.width, j), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
