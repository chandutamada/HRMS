import 'package:flutter/material.dart';
import '../services/api_service.dart';

class TeamManagementScreen extends StatefulWidget {
  final String title;
  final String section; // 'CALENDAR' | 'LEAVE' | 'REGULARISATION' | 'OUT_ON_DUTY'
  final Map<String, dynamic> userData;

  const TeamManagementScreen({
    super.key,
    required this.title,
    required this.section,
    required this.userData,
  });

  @override
  State<TeamManagementScreen> createState() => _TeamManagementScreenState();
}

class _TeamManagementScreenState extends State<TeamManagementScreen> {
  bool _isLoading = true;
  List<Widget> _items = [];

  @override
  void initState() {
    super.initState();
    _fetchSectionData();
  }

  Future<void> _fetchSectionData() async {
    setState(() => _isLoading = true);
    final List<Widget> widgets = [];

    try {
      if (widget.section == 'CALENDAR') {
        final res = await ApiService()
            .dio
            .get('/employees')
            .timeout(const Duration(seconds: 10));

        final raw = res.data;
        List<dynamic> emps = [];
        if (raw is Map && raw['data'] is List) {
          emps = raw['data'];
        } else if (raw is List) {
          emps = raw;
        }

        for (final emp in emps) {
          final first = emp['firstName'] ?? '';
          final last = emp['lastName'] ?? '';
          final name = '$first $last'.trim().isEmpty ? (emp['email'] ?? 'Employee') : '$first $last'.trim();
          final code = emp['employeeCode'] ?? '';
          final desig = emp['designation']?['title'] ?? emp['department']?['name'] ?? 'Staff Member';
          final isField = emp['workLocationType'] == 'OFF_SITE';

          widgets.add(
            _buildMemberStatusTile(
              name,
              code.isNotEmpty ? '$code • $desig' : desig,
              isField ? 'Field / GPS Active' : 'In Office Range',
              isField ? const Color(0xFF2563EB) : const Color(0xFF16A34A),
            ),
          );
        }
      } else if (widget.section == 'LEAVE') {
        final res = await ApiService()
            .dio
            .get('/leave/applications', queryParameters: {'status': 'PENDING'})
            .timeout(const Duration(seconds: 10));

        final raw = res.data;
        List<dynamic> apps = [];
        if (raw is Map && raw['data'] is List) {
          apps = raw['data'];
        } else if (raw is List) {
          apps = raw;
        }

        for (final app in apps) {
          final emp = app['employee'] as Map<String, dynamic>? ?? {};
          final first = emp['firstName'] ?? '';
          final last = emp['lastName'] ?? '';
          final empName = '$first $last'.trim().isEmpty ? (emp['email'] ?? 'Employee') : '$first $last'.trim();
          final code = emp['employeeCode'] ?? '';

          final leaveType = app['leaveType']?['name']?.toString() ?? 'Leave Application';
          final sDate = app['startDate']?.toString().split('T')[0] ?? '';
          final eDate = app['endDate']?.toString().split('T')[0] ?? '';
          final days = app['days'] ?? 1;
          final reason = app['reason']?.toString() ?? 'Personal reasons';
          final appId = app['id']?.toString() ?? '';

          widgets.add(
            _buildApprovalCard(
              context,
              employee: code.isNotEmpty ? '$empName ($code)' : empName,
              type: leaveType,
              dates: '$sDate – $eDate ($days Day(s))',
              reason: reason,
              onReject: () => _reviewLeave(appId, 'REJECTED'),
              onApprove: () => _reviewLeave(appId, 'APPROVED'),
            ),
          );
        }
      } else if (widget.section == 'REGULARISATION') {
        final res = await ApiService()
            .dio
            .get('/attendance/corrections/pending')
            .timeout(const Duration(seconds: 10));

        final raw = res.data;
        List<dynamic> corrs = [];
        if (raw is Map && raw['data'] is List) {
          corrs = raw['data'];
        } else if (raw is List) {
          corrs = raw;
        }

        for (final corr in corrs) {
          final emp = corr['employee'] as Map<String, dynamic>? ?? {};
          final first = emp['firstName'] ?? '';
          final last = emp['lastName'] ?? '';
          final empName = '$first $last'.trim().isEmpty ? (emp['email'] ?? 'Employee') : '$first $last'.trim();
          final code = emp['employeeCode'] ?? '';

          final dateStr = corr['date']?.toString().split('T')[0] ?? 'Recent';
          final inTime = corr['requestedCheckIn'] ?? '--:--';
          final outTime = corr['requestedCheckOut'] ?? '--:--';
          final reason = corr['reason']?.toString() ?? 'No reason provided';
          final corrId = corr['id']?.toString() ?? '';

          widgets.add(
            _buildApprovalCard(
              context,
              employee: code.isNotEmpty ? '$empName ($code)' : empName,
              type: 'Punch Regularisation Request',
              dates: '$dateStr ($inTime – $outTime)',
              reason: reason,
              onReject: () => _reviewCorrection(corrId, 'REJECTED'),
              onApprove: () => _reviewCorrection(corrId, 'APPROVED'),
            ),
          );
        }
      } else if (widget.section == 'OUT_ON_DUTY') {
        final res = await ApiService()
            .dio
            .get('/tracking/team/live')
            .timeout(const Duration(seconds: 10));

        final raw = res.data;
        List<dynamic> liveTeam = [];
        if (raw is Map && raw['data'] is List) {
          liveTeam = raw['data'];
        } else if (raw is List) {
          liveTeam = raw;
        }

        for (final member in liveTeam) {
          final emp = member['employee'] as Map<String, dynamic>? ?? member;
          final first = emp['firstName'] ?? '';
          final last = emp['lastName'] ?? '';
          final name = '$first $last'.trim().isEmpty ? (emp['email'] ?? 'Field Officer') : '$first $last'.trim();
          final isMoving = member['isMoving'] == true;
          final speed = member['speed'] != null ? '${member['speed']} km/h' : 'Stationary';

          widgets.add(
            _buildMemberStatusTile(
              name,
              isMoving ? 'En Route ($speed)' : 'On Site Standby',
              isMoving ? 'Moving • Active GPS' : 'At Client Location',
              isMoving ? const Color(0xFF2563EB) : const Color(0xFF64748B),
            ),
          );
        }
      }
    } catch (_) {
      // Graceful fallback to empty state
    } finally {
      if (mounted) {
        setState(() {
          _items = widgets;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _reviewLeave(String id, String status) async {
    try {
      await ApiService().dio.put('/leave/applications/$id/review', data: {'status': status});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Leave request marked as $status'),
            backgroundColor: status == 'APPROVED' ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
          ),
        );
        _fetchSectionData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update leave request.')),
        );
      }
    }
  }

  Future<void> _reviewCorrection(String id, String status) async {
    try {
      await ApiService().dio.put('/attendance/corrections/$id/review', data: {'status': status});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Regularisation marked as $status'),
            backgroundColor: status == 'APPROVED' ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
          ),
        );
        _fetchSectionData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update regularisation request.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
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
                Expanded(
                  child: Text(
                    widget.title,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF7C3AED)),
                  )
                : _items.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.inbox_outlined, size: 48, color: Colors.grey.shade400),
                            const SizedBox(height: 12),
                            Text(
                              'No pending items',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'All team records and requests are up to date.',
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: const Color(0xFF7C3AED),
                        onRefresh: _fetchSectionData,
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: _items,
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildMemberStatusTile(String name, String role, String status, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: color.withValues(alpha: 0.15),
            child: Text(
              name.isNotEmpty ? name.substring(0, 1).toUpperCase() : '?',
              style: TextStyle(fontWeight: FontWeight.bold, color: color),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                Text(role, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
          ),
        ],
      ),
    );
  }

  Widget _buildApprovalCard(
    BuildContext context, {
    required String employee,
    required String type,
    required String dates,
    required String reason,
    required VoidCallback onReject,
    required VoidCallback onApprove,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(employee, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
          const SizedBox(height: 4),
          Text(type, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF7C3AED))),
          Text(dates, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontFamily: 'monospace')),
          const SizedBox(height: 6),
          Text('Reason: $reason', style: const TextStyle(fontSize: 11, color: Color(0xFF334155))),
          const SizedBox(height: 14),

          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton(
                onPressed: onReject,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFDC2626),
                  side: const BorderSide(color: Color(0xFFDC2626)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Reject', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: onApprove,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Approve', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
