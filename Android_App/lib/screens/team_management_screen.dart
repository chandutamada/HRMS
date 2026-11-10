import 'package:flutter/material.dart';

class TeamManagementScreen extends StatelessWidget {
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
                    title,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: _buildSectionContent(context),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildSectionContent(BuildContext context) {
    if (section == 'CALENDAR') {
      return [
        _buildMemberStatusTile('Venkat', 'SB-002 • Field Specialist', 'On Field Duty (Site Alpha)', const Color(0xFF2563EB)),
        _buildMemberStatusTile('Ram', 'SB-003 • Aeronautical Engineer', 'On Field Duty (Drone Site)', const Color(0xFF2563EB)),
        _buildMemberStatusTile('T Chandu', 'SB-004 • Operations Lead', 'In Office (50m Geofence)', const Color(0xFF16A34A)),
        _buildMemberStatusTile('Manoj Kumar', 'GTIDS-002 • Field Lead', 'On Field Duty (Active Route)', const Color(0xFF2563EB)),
      ];
    } else if (section == 'LEAVE') {
      return [
        _buildApprovalCard(
          context,
          employee: 'Venkat (SB-002)',
          type: 'Casual Leave (CL)',
          dates: '16 Nov 2026 – 17 Nov 2026 (2 Days)',
          reason: 'Personal work at hometown',
        ),
        _buildApprovalCard(
          context,
          employee: 'Ram (SB-003)',
          type: 'Sick Leave (SL)',
          dates: '18 Nov 2026 (1 Day)',
          reason: 'Medical consultation',
        ),
      ];
    } else if (section == 'REGULARISATION') {
      return [
        _buildApprovalCard(
          context,
          employee: 'T Chandu (SB-004)',
          type: 'Punch Regularisation',
          dates: '12 Nov 2026 (09:00 AM – 05:30 PM)',
          reason: 'Client site field testing near Nellimarla',
        ),
      ];
    } else {
      // OUT_ON_DUTY
      return [
        _buildMemberStatusTile('Venkat', 'Active Mission • Vizianagaram Route', '6.45 KM Traveled • 2 Stops', const Color(0xFF2563EB)),
        _buildMemberStatusTile('Ram', 'Scheduled Mission • Nellimarla Field', 'Scheduled for 02:00 PM', const Color(0xFF64748B)),
      ];
    }
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
            child: Text(name.substring(0, 1), style: TextStyle(fontWeight: FontWeight.bold, color: color)),
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
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Request marked as Rejected')),
                  );
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFDC2626),
                  side: const BorderSide(color: Color(0xFFDC2626)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Reject', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Request Approved successfully'),
                      backgroundColor: Color(0xFF16A34A),
                    ),
                  );
                },
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
