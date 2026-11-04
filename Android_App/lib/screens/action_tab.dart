import 'package:flutter/material.dart';
import 'leave_tab.dart';
import 'attendance_tab.dart';
import 'live_tracking_screen.dart';

class ActionTab extends StatelessWidget {
  final Map<String, dynamic> userData;
  const ActionTab({super.key, required this.userData});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Actions & Requests', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'QUICK WORKFLOWS',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
              ),
              const SizedBox(height: 12),

              _buildActionCard(
                context,
                icon: Icons.flight_takeoff,
                iconColor: const Color(0xFF2563EB),
                title: 'Apply for Leave',
                subtitle: 'Casual (CL), Sick (SL), Earned (EL) with Sandwich rules',
                badgeText: 'Policy Active',
                badgeColor: const Color(0xFFDCFCE7),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => LeaveTab(userData: userData)),
                  );
                },
              ),
              const SizedBox(height: 12),

              _buildActionCard(
                context,
                icon: Icons.fingerprint,
                iconColor: const Color(0xFF16A34A),
                title: 'Attendance Regularization',
                subtitle: 'Request punch regularizations or missed punch approvals',
                badgeText: '50m Geofence',
                badgeColor: const Color(0xFFFEF3C7),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => AttendanceTab(userData: userData)),
                  );
                },
              ),
              const SizedBox(height: 24),

              const Text(
                'MY REQUESTS & APPROVALS',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
              ),
              const SizedBox(height: 12),

              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: const BoxDecoration(
                        color: Color(0xFFF1F5F9),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.task_alt, color: Color(0xFF64748B), size: 24),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'No Pending Action Requests',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'All your leave applications and attendance punch logs are up to date.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionCard(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String badgeText,
    required Color badgeColor,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: iconColor, size: 22),
        ),
        title: Row(
          children: [
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(8)),
              child: Text(badgeText, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
        ),
        trailing: const Icon(Icons.chevron_right, color: Color(0xFF94A3B8), size: 20),
        onTap: onTap,
      ),
    );
  }
}
