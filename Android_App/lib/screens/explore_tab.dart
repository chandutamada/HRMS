import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'payslips_screen.dart';
import 'attendance_tab.dart';
import 'leave_tab.dart';
import 'calendar_tab.dart';
import 'login_screen.dart';

class ExploreTab extends StatelessWidget {
  final Map<String, dynamic> userData;
  const ExploreTab({super.key, required this.userData});

  @override
  Widget build(BuildContext context) {
    final emp = (userData['employee'] as Map<String, dynamic>?) ?? {};
    final fullName = (emp['fullName'] ?? userData['email'] ?? 'Employee').toString();
    final empCode = (userData['employeeCode'] ?? 'EMP').toString();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Explore', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Employee Profile Summary Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: const Color(0xFF2563EB),
                      child: Text(
                        fullName.isNotEmpty ? fullName[0].toUpperCase() : 'U',
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(fullName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                          const SizedBox(height: 2),
                          Text('$empCode • Superbee Aeronautics', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              const Text(
                'PAYROLL & COMPENSATION',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
              ),
              const SizedBox(height: 10),
              _buildExploreItem(
                icon: Icons.receipt_long,
                iconColor: const Color(0xFF2563EB),
                title: 'My Payslips',
                subtitle: 'Earnings, Deductions, and official PDF download',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const PayslipsScreen()),
                  );
                },
              ),
              const SizedBox(height: 20),

              const Text(
                'TIME & ATTENDANCE',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
              ),
              const SizedBox(height: 10),
              _buildExploreItem(
                icon: Icons.fingerprint,
                iconColor: const Color(0xFF16A34A),
                title: 'Attendance Records',
                subtitle: 'Daily punches, working hours, and 50m geofence logs',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => AttendanceTab(userData: userData)),
                  );
                },
              ),
              const SizedBox(height: 8),
              _buildExploreItem(
                icon: Icons.calendar_month,
                iconColor: const Color(0xFF0284C7),
                title: 'Company Calendar & Holidays',
                subtitle: '2026 gazetted holidays and office working hours (09:00 AM – 05:30 PM)',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => CalendarTab(userData: userData)),
                  );
                },
              ),
              const SizedBox(height: 20),

              const Text(
                'LEAVE & TIME OFF',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
              ),
              const SizedBox(height: 10),
              _buildExploreItem(
                icon: Icons.beach_access,
                iconColor: const Color(0xFFF59E0B),
                title: 'Leave Desk',
                subtitle: 'Balances, Sandwich rule checks, and history',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => LeaveTab(userData: userData)),
                  );
                },
              ),
              const SizedBox(height: 20),

              const Text(
                'SECURITY & ACCOUNT',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
              ),
              const SizedBox(height: 10),
              _buildExploreItem(
                icon: Icons.security,
                iconColor: const Color(0xFF64748B),
                title: 'Location & Geofence Privacy Notice',
                subtitle: 'Transparency on 50m office perimeter validation',
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (_) => AlertDialog(
                      title: const Row(
                        children: [
                          Icon(Icons.shield_outlined, color: Color(0xFF16A34A)),
                          SizedBox(width: 8),
                          Text('Privacy Notice', style: TextStyle(fontSize: 16)),
                        ],
                      ),
                      content: const Text(
                        'Location access is exclusively used during punch events to verify that check-ins and check-outs occur within the designated 50-meter office perimeter or authorized drone testing campus.',
                        style: TextStyle(fontSize: 13, height: 1.4),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Acknowledge'),
                        ),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: 24),

              // Sign Out
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await ApiService().clearAuth();
                    if (context.mounted) {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                        (route) => false,
                      );
                    }
                  },
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text('Sign Out'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFEE2E2),
                    foregroundColor: const Color(0xFFDC2626),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildExploreItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListTile(
        leading: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        trailing: const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94A3B8)),
        onTap: onTap,
        dense: true,
      ),
    );
  }
}
