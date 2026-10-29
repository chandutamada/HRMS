import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';

class ProfileScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const ProfileScreen({super.key, required this.userData});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Map<String, dynamic> _userData;
  String? _avatarUrl;
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    _userData = Map<String, dynamic>.from(widget.userData);
    final emp = _userData['employee'] as Map<String, dynamic>?;
    _avatarUrl = emp?['avatarUrl']?.toString() ?? _userData['avatarUrl']?.toString();
    _fetchLatestProfile();
  }

  Future<void> _fetchLatestProfile() async {
    try {
      final res = await ApiService().dio.get('/auth/me');
      final data = res.data['data'] ?? res.data;
      if (data != null && mounted) {
        setState(() {
          _userData = Map<String, dynamic>.from(data);
          final emp = _userData['employee'] as Map<String, dynamic>?;
          if (emp != null && emp['avatarUrl'] != null) {
            _avatarUrl = emp['avatarUrl'].toString();
          }
        });
      }
    } catch (_) {
      // Gracefully retain current profile data
    }
  }

  Future<void> _pickAndUploadImage(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: source,
        maxWidth: 500,
        maxHeight: 500,
        imageQuality: 75,
      );

      if (image == null) return;

      setState(() => _isUploading = true);

      final bytes = await image.readAsBytes();
      final base64String = base64Encode(bytes);
      final filename = image.name.isNotEmpty ? image.name : 'avatar.jpg';

      final response = await ApiService().dio.post(
        '/employees/me/avatar',
        data: {
          'avatarBase64': base64String,
          'filename': filename,
        },
      );

      final data = response.data['data'] ?? response.data;
      final newUrl = data?['avatarUrl']?.toString();

      if (mounted) {
        setState(() {
          if (newUrl != null && newUrl.isNotEmpty) {
            _avatarUrl = newUrl;
            if (_userData['employee'] is Map) {
              (_userData['employee'] as Map<String, dynamic>)['avatarUrl'] = newUrl;
            }
          }
          _isUploading = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                SizedBox(width: 10),
                Text('Profile picture updated successfully!'),
              ],
            ),
            backgroundColor: Color(0xFF16A34A),
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUploading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update picture: ${e.toString()}'),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showImageSourcePicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Change Profile Photo',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Select a photo from your gallery or take a new one with your camera.',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 18),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3E8FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.photo_library_rounded, color: Color(0xFF7C3AED)),
                ),
                title: const Text('Choose from Gallery', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: const Text('Access your device photo gallery', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right, size: 20, color: Color(0xFF94A3B8)),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndUploadImage(ImageSource.gallery);
                },
              ),
              const Divider(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.camera_alt_rounded, color: Color(0xFF16A34A)),
                ),
                title: const Text('Take a Photo', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: const Text('Capture a picture using your camera', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right, size: 20, color: Color(0xFF94A3B8)),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndUploadImage(ImageSource.camera);
                },
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar(String resolvedUrl, String fullName) {
    final initials = fullName
        .trim()
        .split(RegExp(r'\s+'))
        .where((s) => s.isNotEmpty)
        .map((s) => s[0].toUpperCase())
        .take(2)
        .join();

    final hasImage = resolvedUrl.isNotEmpty;

    return Container(
      width: 88,
      height: 88,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        gradient: !hasImage
            ? const LinearGradient(
                colors: [Color(0xFF9333EA), Color(0xFF4F46E5)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipOval(
        child: hasImage
            ? Image.network(
                resolvedUrl,
                width: 88,
                height: 88,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _buildFallbackInitials(initials),
              )
            : _buildFallbackInitials(initials),
      ),
    );
  }

  Widget _buildFallbackInitials(String initials) {
    return Container(
      color: const Color(0xFF6B21A8),
      alignment: Alignment.center,
      child: Text(
        initials.isNotEmpty ? initials : 'SB',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 28,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final employee = _userData['employee'] as Map<String, dynamic>? ?? {};
    final fullName = employee['fullName'] ?? employee['firstName'] ?? _userData['name'] ?? 'Rajesh Sharma';
    final email = employee['email'] ?? _userData['email'] ?? 'employee@company.internal';
    final phone = employee['phone'] ?? '+91 9845012345';
    final empCode = employee['employeeCode'] ?? _userData['employeeCode'] ?? 'SB-001';

    String designation = 'Software Developer';
    final desigVal = employee['designation'];
    if (desigVal is Map) {
      designation = desigVal['title']?.toString() ?? desigVal['name']?.toString() ?? 'Software Developer';
    } else if (desigVal != null && desigVal.toString().isNotEmpty) {
      designation = desigVal.toString();
    }

    String department = 'Engineering & Technology';
    final deptVal = employee['department'];
    if (deptVal is Map) {
      department = deptVal['name']?.toString() ?? deptVal['title']?.toString() ?? 'Engineering & Technology';
    } else if (deptVal != null && deptVal.toString().isNotEmpty) {
      department = deptVal.toString();
    }

    String office = 'Superbee Aeronautics HQ';
    final officeVal = employee['office'];
    if (officeVal is Map) {
      office = officeVal['name']?.toString() ?? 'Superbee Aeronautics HQ';
    } else if (officeVal != null && officeVal.toString().isNotEmpty) {
      office = officeVal.toString();
    }

    final resolvedAvatar = ApiService.resolveImageUrl(_avatarUrl);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        children: [
          // Purple Profile Header
          Container(
            padding: const EdgeInsets.only(top: 48, bottom: 24, left: 16, right: 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF581C87), Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      onPressed: () => Navigator.pop(context, _userData),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'My Profile',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Profile Avatar with Gallery/Camera Picker Badge
                Center(
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      GestureDetector(
                        onTap: _isUploading ? null : () => _showImageSourcePicker(context),
                        child: _buildAvatar(resolvedAvatar, fullName.toString()),
                      ),
                      if (_isUploading)
                        Positioned.fill(
                          child: Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.black.withValues(alpha: 0.5),
                            ),
                            child: const Center(
                              child: SizedBox(
                                width: 28,
                                height: 28,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 3,
                                ),
                              ),
                            ),
                          ),
                        ),
                      Positioned(
                        bottom: 0,
                        right: -2,
                        child: GestureDetector(
                          onTap: _isUploading ? null : () => _showImageSourcePicker(context),
                          child: Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: const Color(0xFF7C3AED),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2.5),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.25),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.camera_alt_rounded,
                              size: 16,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),
                Text(
                  fullName.toString(),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Text(
                  designation.toString(),
                  style: const TextStyle(fontSize: 13, color: Color(0xFFE9D5FF)),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'EMP ID: $empCode',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: _isUploading ? null : () => _showImageSourcePicker(context),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF38BDF8).withValues(alpha: 0.2),
                          border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.5)),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.photo_camera_outlined, size: 12, color: Color(0xFFBAE6FD)),
                            SizedBox(width: 4),
                            Text(
                              'Change Photo',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFFBAE6FD)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildInfoSection('EMPLOYMENT DETAILS', [
                  _buildProfileTile(Icons.badge, 'Employee ID', empCode.toString()),
                  _buildProfileTile(Icons.corporate_fare, 'Department', department.toString()),
                  _buildProfileTile(Icons.work_outline, 'Designation', designation.toString()),
                  _buildProfileTile(Icons.location_city, 'Base Office', office.toString()),
                  _buildProfileTile(Icons.schedule, 'Shift Timing', '09:00 AM – 05:30 PM (General)'),
                ]),
                const SizedBox(height: 16),
                _buildInfoSection('CONTACT INFORMATION', [
                  _buildProfileTile(Icons.email_outlined, 'Official Email', email.toString()),
                  _buildProfileTile(Icons.phone_outlined, 'Mobile Number', phone.toString()),
                  _buildProfileTile(Icons.home_outlined, 'Location', 'Bangalore Manufacturing Unit'),
                ]),
                const SizedBox(height: 16),
                _buildInfoSection('STATUTORY DETAILS', [
                  _buildProfileTile(Icons.account_balance, 'Bank Name', 'State Bank of India'),
                  _buildProfileTile(Icons.credit_card, 'PAN Card', 'ABCDE1234F'),
                  _buildProfileTile(Icons.verified_user_outlined, 'PF / UAN Number', '100987654321'),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoSection(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: Color(0xFF64748B),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }

  Widget _buildProfileTile(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 16, color: const Color(0xFF475569)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                Text(
                  value,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
