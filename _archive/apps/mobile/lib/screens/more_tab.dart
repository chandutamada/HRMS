import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'login_screen.dart';
import 'payslips_screen.dart';
import 'profile_screen.dart';

class MoreTab extends StatelessWidget {
  final Map<String, dynamic> userData;
  const MoreTab({super.key, required this.userData});

  void _showPrivacyNotice(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.privacy_tip, color: Color(0xFF16A34A)),
            SizedBox(width: 8),
            Text('Location Privacy Policy', style: TextStyle(fontSize: 16)),
          ],
        ),
        content: const SingleChildScrollView(
          child: Text(
            '• Event-Based Location Only: Your location is ONLY checked at the instant you press Check In or Check Out.\n\n'
            '• No Background Tracking: The application does NOT collect location in the background and does NOT build a movement timeline.\n\n'
            '• Purpose: Location coordinates and accuracy are collected strictly to validate proximity to the 50-metre office geofence.\n\n'
            '• Access: Location events are stored securely in MySQL and accessible only by authorized HR personnel.',
            style: TextStyle(fontSize: 12, height: 1.5, color: Color(0xFF334155)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Understand')),
        ],
      ),
    );
  }

  void _showCircularsModal(BuildContext context) async {
    try {
      final res = await ApiService().dio.get('/circulars');
      final circulars = res.data['data'] as List<dynamic>? ?? [];

      if (!context.mounted) return;
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        builder: (ctx) => Container(
          padding: const EdgeInsets.all(20),
          height: 450,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Company Circulars', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.builder(
                  itemCount: circulars.length,
                  itemBuilder: (_, i) {
                    final c = circulars[i];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c['title'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Text(c['content'] ?? '', style: const TextStyle(fontSize: 11, color: Color(0xFF475569))),
                          const SizedBox(height: 8),
                          if (c['isAcknowledged'] == true)
                            const Text('✓ Acknowledged', style: TextStyle(fontSize: 10, color: Color(0xFF16A34A), fontWeight: FontWeight.bold))
                          else
                            ElevatedButton(
                              onPressed: () async {
                                try {
                                  await ApiService().dio.post('/circulars/${c['id']}/acknowledge');
                                  if (ctx.mounted) Navigator.pop(ctx);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Circular acknowledged')),
                                    );
                                  }
                                } catch (_) {}
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF16A34A),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                              ),
                              child: const Text('Acknowledge', style: TextStyle(fontSize: 11)),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load circulars')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final emp = (userData['employee'] as Map<String, dynamic>?) ?? {};
    final fullName = (emp['fullName'] ?? userData['email'] ?? 'Employee').toString();
    final empCode = (userData['employeeCode'] ?? 'EMP').toString();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('More', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              // Profile Header Card
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => ProfileScreen(userData: userData)),
                  );
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFF0F172A),
                        ),
                        child: ClipOval(
                          child: Builder(
                            builder: (_) {
                              final avatarUrl = ApiService.resolveImageUrl(emp['avatarUrl']?.toString());
                              final initial = fullName.isNotEmpty ? fullName[0].toUpperCase() : 'U';
                              if (avatarUrl.isNotEmpty) {
                                return Image.network(
                                  avatarUrl,
                                  width: 52,
                                  height: 52,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Center(
                                    child: Text(
                                      initial,
                                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                );
                              }
                              return Center(
                                child: Text(
                                  initial,
                                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(fullName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                            Text('$empCode • ${userData['email']}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, size: 20, color: Color(0xFF94A3B8)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Menu list
              _buildMenuItem(Icons.description_outlined, 'My Payslips', () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const PayslipsScreen()),
                );
              }),
              _buildMenuItem(Icons.campaign_outlined, 'Company Circulars', () => _showCircularsModal(context)),
              _buildMenuItem(Icons.privacy_tip_outlined, 'Location Privacy Notice', () => _showPrivacyNotice(context)),
              _buildMenuItem(Icons.support_agent_outlined, 'Helpdesk & Support', () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Helpdesk feature available in HR web portal')),
                );
              }),
              _buildMenuItem(Icons.settings_outlined, 'Settings', () {}),

              const SizedBox(height: 20),

              // Sign out button
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

  Widget _buildMenuItem(IconData icon, String title, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF16A34A), size: 20),
        title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94A3B8)),
        onTap: onTap,
        dense: true,
      ),
    );
  }
}
