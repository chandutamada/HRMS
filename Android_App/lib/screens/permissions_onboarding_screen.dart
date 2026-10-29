import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';

class PermissionsOnboardingScreen extends StatefulWidget {
  final bool isFromSettings;
  const PermissionsOnboardingScreen({super.key, this.isFromSettings = false});

  @override
  State<PermissionsOnboardingScreen> createState() =>
      _PermissionsOnboardingScreenState();
}

class _PermissionsOnboardingScreenState
    extends State<PermissionsOnboardingScreen> {
  bool _cameraGranted = false;
  bool _locationGranted = false;
  bool _notificationGranted = false;
  bool _storageGranted = false;
  bool _isRequestingAll = false;

  @override
  void initState() {
    super.initState();
    _checkPermissionsStatus();
  }

  Future<void> _checkPermissionsStatus() async {
    final camera = await Permission.camera.status;
    final location = await Permission.locationWhenInUse.status;
    final notification = await Permission.notification.status;
    final storage = await Permission.storage.status;

    if (mounted) {
      setState(() {
        _cameraGranted = camera.isGranted;
        _locationGranted = location.isGranted;
        _notificationGranted = notification.isGranted;
        _storageGranted = storage.isGranted;
      });
    }
  }

  Future<void> _requestSinglePermission(Permission permission, String type) async {
    final status = await permission.request();
    if (mounted) {
      setState(() {
        if (type == 'camera') _cameraGranted = status.isGranted;
        if (type == 'location') _locationGranted = status.isGranted;
        if (type == 'notification') _notificationGranted = status.isGranted;
        if (type == 'storage') _storageGranted = status.isGranted;
      });
    }
  }

  Future<void> _requestAllPermissions() async {
    setState(() => _isRequestingAll = true);

    try {
      // 1. Camera
      final camStatus = await Permission.camera.request();
      // 2. Location
      final locStatus = await Permission.locationWhenInUse.request();
      // 3. Notification
      final notifStatus = await Permission.notification.request();
      // 4. Storage / Photos
      final storStatus = await Permission.storage.request();

      if (mounted) {
        setState(() {
          _cameraGranted = camStatus.isGranted;
          _locationGranted = locStatus.isGranted;
          _notificationGranted = notifStatus.isGranted;
          _storageGranted = storStatus.isGranted;
          _isRequestingAll = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isRequestingAll = false);
      }
    }

    await _completeOnboarding();
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_completed_permissions_setup', true);

    if (mounted) {
      if (widget.isFromSettings) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Permissions updated successfully'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      } else {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final allGranted = _cameraGranted && _locationGranted && _notificationGranted;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        children: [
          // Purple Gradient Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.only(top: 50, bottom: 28, left: 20, right: 20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF581C87), Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(Icons.security_rounded, color: Colors.white, size: 26),
                    ),
                    if (widget.isFromSettings)
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white),
                        onPressed: () => Navigator.pop(context),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'Step 1 of 1 • Setup',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 18),
                const Text(
                  'Device Permissions',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Superbee Aeronautics HRMS requires these permissions to enable face selfie punch-in, 50m geofence validation, shift alerts, and payslip downloads.',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFFE9D5FF),
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),

          // Permissions Cards List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
              children: [
                _buildPermissionCard(
                  icon: Icons.camera_alt_rounded,
                  iconColor: const Color(0xFF7C3AED),
                  iconBg: const Color(0xFFF3E8FF),
                  title: 'Camera Access (Face ID)',
                  subtitle:
                      'Required to capture employee selfie photo before Punch-In for HR attendance verification.',
                  isGranted: _cameraGranted,
                  onGrant: () => _requestSinglePermission(Permission.camera, 'camera'),
                ),
                const SizedBox(height: 12),

                _buildPermissionCard(
                  icon: Icons.location_on_rounded,
                  iconColor: const Color(0xFF0284C7),
                  iconBg: const Color(0xFFE0F2FE),
                  title: 'Precise GPS Location',
                  subtitle:
                      'Used to validate your office 50m geofence boundary and on-field client operations during shift hours.',
                  isGranted: _locationGranted,
                  onGrant: () => _requestSinglePermission(Permission.locationWhenInUse, 'location'),
                ),
                const SizedBox(height: 12),

                _buildPermissionCard(
                  icon: Icons.notifications_active_rounded,
                  iconColor: const Color(0xFFD97706),
                  iconBg: const Color(0xFFFEF3C7),
                  title: 'Push Notifications',
                  subtitle:
                      'Delivers shift punch-in reminders, company circulars, monthly payslip releases, and manager approvals.',
                  isGranted: _notificationGranted,
                  onGrant: () => _requestSinglePermission(Permission.notification, 'notification'),
                ),
                const SizedBox(height: 12),

                _buildPermissionCard(
                  icon: Icons.folder_shared_rounded,
                  iconColor: const Color(0xFF16A34A),
                  iconBg: const Color(0xFFDCFCE7),
                  title: 'Files & Storage',
                  subtitle:
                      'Allows downloading and saving official signed payslip PDFs and policy documents to your device.',
                  isGranted: _storageGranted,
                  onGrant: () => _requestSinglePermission(Permission.storage, 'storage'),
                ),
                const SizedBox(height: 20),

                // Privacy Note
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.lock_outline_rounded, size: 16, color: Color(0xFF64748B)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Your data is protected under ISO 27001 & Superbee Aeronautics Privacy Policy. Location is tracked strictly during duty hours.',
                          style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Bottom Button Bar
          Container(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isRequestingAll ? null : _requestAllPermissions,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: allGranted ? const Color(0xFF16A34A) : const Color(0xFF7C3AED),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 3,
                    ),
                    icon: _isRequestingAll
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Icon(allGranted ? Icons.check_circle_rounded : Icons.verified_user_rounded, size: 20),
                    label: Text(
                      _isRequestingAll
                          ? 'Requesting Permissions...'
                          : (allGranted ? 'Continue to App' : 'Grant All Permissions'),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                if (!widget.isFromSettings) ...[
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: _completeOnboarding,
                    child: const Text(
                      'Skip for Now (Permissions Required on Punch)',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPermissionCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String title,
    required String subtitle,
    required bool isGranted,
    required VoidCallback onGrant,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isGranted ? const Color(0xFF86EFAC) : const Color(0xFFE2E8F0),
          width: isGranted ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.35),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (isGranted)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_rounded, size: 14, color: Color(0xFF16A34A)),
                  SizedBox(width: 4),
                  Text(
                    'Granted',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                  ),
                ],
              ),
            )
          else
            ElevatedButton(
              onPressed: onGrant,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7C3AED),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              child: const Text('Grant', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            ),
        ],
      ),
    );
  }
}
