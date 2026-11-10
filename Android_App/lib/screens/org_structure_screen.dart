import 'package:flutter/material.dart';
import '../services/api_service.dart';

class OrgStructureScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const OrgStructureScreen({super.key, required this.userData});

  @override
  State<OrgStructureScreen> createState() => _OrgStructureScreenState();
}

class _OrgStructureScreenState extends State<OrgStructureScreen> {
  bool _isLoading = true;
  List<dynamic> _colleagues = [];
  Map<String, dynamic>? _reportingManager;

  @override
  void initState() {
    super.initState();
    _loadOrgData();
  }

  Future<void> _loadOrgData() async {
    setState(() => _isLoading = true);

    try {
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

      final myEmail = widget.userData['email']?.toString().toLowerCase();
      final myEmpCode = widget.userData['employee']?['employeeCode']?.toString().toUpperCase();

      // Exclude self from colleagues list
      final filtered = emps.where((e) {
        final email = e['email']?.toString().toLowerCase();
        final code = e['employeeCode']?.toString().toUpperCase();
        if (myEmail != null && email == myEmail) return false;
        if (myEmpCode != null && code == myEmpCode) return false;
        return true;
      }).toList();

      final manager = widget.userData['employee']?['reportingManager'] as Map<String, dynamic>?;

      if (mounted) {
        setState(() {
          _colleagues = filtered;
          _reportingManager = manager;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final company = widget.userData['company'] as Map<String, dynamic>?;
    final companyName = company?['name']?.toString() ?? 'Corporate Headquarters';
    final hrEmail = company?['email']?.toString() ?? 'hr@gramtarang.org';

    final managerName = _reportingManager?['fullName'] ??
        _reportingManager?['name'] ??
        (company != null ? '$companyName HR Administration' : 'HR Administration');

    final managerRole = _reportingManager?['designation']?['title'] ??
        _reportingManager?['designation'] ??
        'HR Lead & Operations Head';

    final managerDept = _reportingManager?['department']?['name'] ?? companyName;
    final managerEmail = _reportingManager?['email'] ?? hrEmail;

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
                  'My Team & Org Structure',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
          ),

          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF7C3AED)),
                  )
                : RefreshIndicator(
                    color: const Color(0xFF7C3AED),
                    onRefresh: _loadOrgData,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        // Reporting Manager Card
                        const Text(
                          'REPORTING MANAGER',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 8),
                        _buildOrgCard(
                          name: managerName.toString(),
                          role: managerRole.toString(),
                          dept: managerDept.toString(),
                          email: managerEmail.toString(),
                          isManager: true,
                        ),
                        const SizedBox(height: 20),

                        // Department Colleagues
                        const Text(
                          'DEPARTMENT COLLEAGUES',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 8),

                        if (_colleagues.isEmpty)
                          Container(
                            padding: const EdgeInsets.all(24),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: const Text(
                              'No other colleagues registered yet.',
                              style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                            ),
                          )
                        else
                          ..._colleagues.map((colleague) {
                            final first = colleague['firstName'] ?? '';
                            final last = colleague['lastName'] ?? '';
                            final name = '$first $last'.trim().isEmpty
                                ? (colleague['email'] ?? 'Colleague')
                                : '$first $last'.trim();

                            final role = colleague['designation']?['title'] ??
                                colleague['designation'] ??
                                'Team Member';

                            final dept = colleague['department']?['name'] ??
                                colleague['department'] ??
                                companyName;

                            final email = colleague['email']?.toString() ?? '';

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _buildOrgCard(
                                name: name,
                                role: role.toString(),
                                dept: dept.toString(),
                                email: email,
                                isManager: false,
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrgCard({
    required String name,
    required String role,
    required String dept,
    required String email,
    required bool isManager,
  }) {
    final initial = name.isNotEmpty ? name.substring(0, 1).toUpperCase() : '?';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isManager ? const Color(0xFF7C3AED) : const Color(0xFFE2E8F0),
          width: isManager ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: isManager ? const Color(0xFF7C3AED) : const Color(0xFFE0F2FE),
            child: Text(
              initial,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isManager ? Colors.white : const Color(0xFF0369A1),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        name,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (isManager)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3E8FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('MANAGER', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED))),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(role, style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
                const SizedBox(height: 2),
                Text('$dept • $email', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
