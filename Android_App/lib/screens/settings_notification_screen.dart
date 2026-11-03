import 'package:flutter/material.dart';
import 'permissions_onboarding_screen.dart';

class SettingsNotificationScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const SettingsNotificationScreen({super.key, required this.userData});

  @override
  State<SettingsNotificationScreen> createState() => _SettingsNotificationScreenState();
}

class _SettingsNotificationScreenState extends State<SettingsNotificationScreen> {
  bool _shiftReminders = true;
  bool _geofenceAlerts = true;
  bool _leaveApprovals = true;
  bool _circularNotifications = true;
  bool _payslipAlerts = true;

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
                const Text(
                  'Settings & Notifications',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildSettingsCard('ATTENDANCE & GEOFENCE NOTIFICATIONS', [
                  SwitchListTile(
                    activeThumbColor: const Color(0xFF7C3AED),
                    title: const Text('Office Punch-In Reminders', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: const Text('Notify 15 minutes before 09:00 AM office start time', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    value: _shiftReminders,
                    onChanged: (val) => setState(() => _shiftReminders = val),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    activeThumbColor: const Color(0xFF7C3AED),
                    title: const Text('Geofence Perimeter Alerts', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: const Text('Notify when arriving within or leaving 50m office radius', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    value: _geofenceAlerts,
                    onChanged: (val) => setState(() => _geofenceAlerts = val),
                  ),
                ]),
                const SizedBox(height: 16),

                _buildSettingsCard('WORKFLOW & PAYROLL ALERTS', [
                  SwitchListTile(
                    activeThumbColor: const Color(0xFF7C3AED),
                    title: const Text('Leave & Regularisation Approvals', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: const Text('Push alerts when manager approves or rejects requests', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    value: _leaveApprovals,
                    onChanged: (val) => setState(() => _leaveApprovals = val),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    activeThumbColor: const Color(0xFF7C3AED),
                    title: const Text('Company Circulars & Memos', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: const Text('Broadcasts from Superbee Aeronautics Management', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    value: _circularNotifications,
                    onChanged: (val) => setState(() => _circularNotifications = val),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    activeThumbColor: const Color(0xFF7C3AED),
                    title: const Text('Monthly Payslip Generation', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: const Text('Alert when official signed payslip is ready for download', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    value: _payslipAlerts,
                    onChanged: (val) => setState(() => _payslipAlerts = val),
                  ),
                ]),
                const SizedBox(height: 16),

                _buildSettingsCard('SECURITY & APP PREFERENCES', [
                  ListTile(
                    leading: const Icon(Icons.fingerprint, color: Color(0xFF7C3AED)),
                    title: const Text('Biometric / Screen Lock', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: const Text('Require biometric authentication on app launch', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    trailing: const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
                    onTap: () {},
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.security_rounded, color: Color(0xFF7C3AED)),
                    title: const Text('Device Permissions', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: const Text('Camera, Location, Push Notifications & Storage', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    trailing: const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const PermissionsOnboardingScreen(isFromSettings: true),
                        ),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  const ListTile(
                    leading: Icon(Icons.info_outline, color: Color(0xFF7C3AED)),
                    title: Text('App Version', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: Text('Superbee HRMS Mobile v1.0.0 (Build 2026.09)', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  ),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsCard(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              title,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}
