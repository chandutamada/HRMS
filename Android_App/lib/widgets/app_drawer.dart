import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../screens/login_screen.dart';
import '../screens/payslips_screen.dart';
import '../screens/leave_attendance_hub_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/holiday_list_screen.dart';
import '../screens/org_structure_screen.dart';
import '../screens/circulars_screen.dart';
import '../screens/settings_notification_screen.dart';

class AppDrawer extends StatelessWidget {
  final Map<String, dynamic> userData;
  final String currentRoute;

  const AppDrawer({
    super.key,
    required this.userData,
    this.currentRoute = 'Home',
  });

  @override
  Widget build(BuildContext context) {
    final employee = userData['employee'] as Map<String, dynamic>? ?? {};
    final fullName = employee['fullName'] ?? employee['firstName'] ?? userData['email']?.toString().split('@')[0] ?? 'Employee';

    String designation = 'Team Member';
    final desigVal = employee['designation'];
    if (desigVal is Map) {
      designation = desigVal['title']?.toString() ?? desigVal['name']?.toString() ?? 'Team Member';
    } else if (desigVal != null && desigVal.toString().isNotEmpty) {
      designation = desigVal.toString();
    }

    return Drawer(
      backgroundColor: Colors.white,
      child: Column(
        children: [
          // Purple Drawer Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.only(top: 50, bottom: 24, left: 20, right: 20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF6B21A8), Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2.5),
                  ),
                  child: ClipOval(
                    child: Builder(
                      builder: (_) {
                        final avatarUrl = ApiService.resolveImageUrl(employee['avatarUrl']?.toString());
                        final initial = fullName.toString().isNotEmpty ? fullName.toString()[0].toUpperCase() : 'U';
                        if (avatarUrl.isNotEmpty) {
                          return Image.network(
                            avatarUrl,
                            width: 72,
                            height: 72,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              color: const Color(0xFF581C87),
                              alignment: Alignment.center,
                              child: Text(
                                initial,
                                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                              ),
                            ),
                          );
                        }
                        return Container(
                          color: const Color(0xFF581C87),
                          alignment: Alignment.center,
                          child: Text(
                            initial,
                            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  fullName.toString(),
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  designation.toString(),
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFFE9D5FF),
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),

          // Menu Items List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                _buildDrawerItem(
                  context,
                  icon: Icons.home_rounded,
                  title: 'Home',
                  isSelected: currentRoute == 'Home',
                  onTap: () {
                    Navigator.pop(context);
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.person_outline_rounded,
                  title: 'My Profile',
                  isSelected: currentRoute == 'My Profile',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => ProfileScreen(userData: userData)),
                    );
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.calendar_today_outlined,
                  title: 'Leave & Attendance',
                  isSelected: currentRoute == 'Leave & Attendance',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => LeaveAttendanceHubScreen(userData: userData)),
                    );
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.event_note_outlined,
                  title: 'Holiday List',
                  isSelected: currentRoute == 'Holiday List',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => HolidayListScreen(userData: userData)),
                    );
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.groups_outlined,
                  title: 'My Team/ Org Structure',
                  isSelected: currentRoute == 'My Team/ Org Structure',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => OrgStructureScreen(userData: userData)),
                    );
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.credit_card_outlined,
                  title: 'Payroll/Payslip',
                  isSelected: currentRoute == 'Payroll/Payslip',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const PayslipsScreen()),
                    );
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.language_outlined,
                  title: 'Change Language',
                  isSelected: currentRoute == 'Change Language',
                  onTap: () {
                    Navigator.pop(context);
                    _showLanguageDialog(context);
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.campaign_outlined,
                  title: 'Circulars',
                  isSelected: currentRoute == 'Circulars',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => CircularsScreen(userData: userData)),
                    );
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.settings_outlined,
                  title: 'Setting/Notification',
                  isSelected: currentRoute == 'Setting/Notification',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => SettingsNotificationScreen(userData: userData)),
                    );
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.logout_rounded,
                  title: 'Logout',
                  isSelected: false,
                  textColor: const Color(0xFFDC2626),
                  iconColor: const Color(0xFFDC2626),
                  onTap: () async {
                    await ApiService().clearAuth();
                    if (context.mounted) {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                        (route) => false,
                      );
                    }
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
    Color? textColor,
    Color? iconColor,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: isSelected ? const Color(0xFFF3E8FF) : Colors.transparent,
        borderRadius: BorderRadius.circular(24),
      ),
      child: ListTile(
        dense: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        leading: Icon(
          icon,
          size: 20,
          color: iconColor ?? (isSelected ? const Color(0xFF7C3AED) : const Color(0xFF334155)),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: textColor ?? (isSelected ? const Color(0xFF7C3AED) : const Color(0xFF1E293B)),
          ),
        ),
        onTap: onTap,
      ),
    );
  }

  void _showLanguageDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Change Language', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.check_circle, color: Color(0xFF7C3AED)),
              title: const Text('English (Default)'),
              onTap: () => Navigator.pop(ctx),
            ),
            ListTile(
              title: const Text('Hindi (हिंदी)'),
              onTap: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Language preference saved to English (Default)')),
                );
              },
            ),
            ListTile(
              title: const Text('Telugu (తెలుగు)'),
              onTap: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Language preference saved')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
