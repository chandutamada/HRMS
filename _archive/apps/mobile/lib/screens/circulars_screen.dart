import 'package:flutter/material.dart';

class CircularsScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const CircularsScreen({super.key, required this.userData});

  @override
  State<CircularsScreen> createState() => _CircularsScreenState();
}

class _CircularsScreenState extends State<CircularsScreen> {
  String _selectedCategory = 'All';

  final List<Map<String, dynamic>> _circulars = [
    {
      'id': 'SB/HR/2026/041',
      'title': 'Mandatory Field Duty & Real-Time GPS Tracking Guidelines',
      'category': 'HR & Admin',
      'date': '20 Oct 2026',
      'issuer': 'Head of HR & People Operations',
      'priority': 'URGENT',
      'badgeColor': const Color(0xFFDC2626),
      'badgeBg': const Color(0xFFFEE2E2),
      'summary':
          'All on-field UAV testing, avionics validation, and client deployment engineers must log attendance and sync checkpoint sessions through the mobile app during duty hours.',
      'content':
          'Pursuant to executive operational guidelines for Superbee Aeronautics Pvt Ltd:\n\n1. Off-site engineers are required to initiate location-based attendance upon reaching client premises or UAV flight test grounds.\n2. Periodic GPS pings will sync automatically during active shift hours (09:00 AM – 06:00 PM).\n3. Any deviation or missed punch must be regularised via the Attendance Regularisation module within 48 hours.\n\nBy Order,\nDirectorate of Human Resources',
    },
    {
      'id': 'SB/OPS/2026/038',
      'title': 'Pre-Flight Telemetry Check & Monsoon Drone Testing SOP',
      'category': 'Operations',
      'date': '12 Oct 2026',
      'issuer': 'VP - Autonomous Avionics & Flight Systems',
      'priority': 'IMPORTANT',
      'badgeColor': const Color(0xFFD97706),
      'badgeBg': const Color(0xFFFEF3C7),
      'summary':
          'Updated safety checklists and flight clearance protocols for outdoor autonomous flight tests under wind speeds exceeding 25 knots.',
      'content':
          'Effective immediately, all flight test teams must follow the Revised Monsoons Testing Protocol:\n\n• Mandatory dual telemetry redundancy checks before propeller arming.\n• No test flights allowed if precipitation exceeds 10mm/hr without sealed IP67 avionics enclosure.\n• Flight logs must be archived to the central Superbee telemetry cloud within 2 hours of flight completion.\n\nDr. Anand Verma\nVP - Autonomous Avionics',
    },
    {
      'id': 'SB/FIN/2026/029',
      'title': 'Diwali Festive Allowance & October Payroll Advance Disbursement',
      'category': 'Finance',
      'date': '01 Oct 2026',
      'issuer': 'Chief Financial Officer',
      'priority': 'ANNOUNCEMENT',
      'badgeColor': const Color(0xFF16A34A),
      'badgeBg': const Color(0xFFDCFCE7),
      'summary':
          'October monthly payroll together with festive ex-gratia bonuses will be disbursed on 28th October ahead of Diwali celebrations.',
      'content':
          'Superbee Aeronautics is pleased to announce:\n\n• All confirmed employees will receive October remuneration along with festive ex-gratia allowances on or before 28th October 2026.\n• Digital payslips will be available for download in the mobile app under the Payroll/Payslip tab.\n• Company offices will observe gazetted holidays from 31st Oct to 2nd Nov.\n\nFinance & Accounts Department',
    },
    {
      'id': 'SB/SEC/2026/015',
      'title': 'Campus Geofence & Employee Data Privacy Governance Policy',
      'category': 'Compliance',
      'date': '15 Sep 2026',
      'issuer': 'IT Security & Legal Directorate',
      'priority': 'POLICY',
      'badgeColor': const Color(0xFF2563EB),
      'badgeBg': const Color(0xFFDBEAFE),
      'summary':
          'Comprehensive data privacy policy governing background GPS capture, biometric encryption, and device telemetry access protocols.',
      'content':
          'In compliance with data protection laws and ISO 27001 standards:\n\n1. Location tracking is active strictly between employee punch-in and punch-out timestamps.\n2. No location or background activity is logged outside office hours or during approved leaves.\n3. All data is encrypted in transit using TLS 1.3 and stored in compliant on-premises servers.\n\nLegal & Compliance Team',
    },
    {
      'id': 'SB/GEN/2026/008',
      'title': 'Annual Aeronautics Innovation Hackathon (Project Garud 2026)',
      'category': 'Operations',
      'date': '05 Sep 2026',
      'issuer': 'Office of the Managing Director',
      'priority': 'INFO',
      'badgeColor': const Color(0xFF7C3AED),
      'badgeBg': const Color(0xFFF3E8FF),
      'summary':
          'Registration opens for the 48-hour inter-department hackathon focusing on AI-guided swarm drone navigation and edge inference.',
      'content':
          'We invite all engineers, developers, and designers to participate in Project Garud 2026:\n\n• Team size: 2 to 4 members.\n• Hardware prototyping kits provided by Superbee Labs.\n• Winning solutions will be funded for patent filing and productisation.\n\nOffice of the Managing Director',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final categories = ['All', 'HR & Admin', 'Operations', 'Finance', 'Compliance'];
    final filtered = _selectedCategory == 'All'
        ? _circulars
        : _circulars.where((c) => c['category'] == _selectedCategory).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        children: [
          // Purple Gradient Header
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
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Company Circulars',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    Text(
                      'Official memos • Superbee Aeronautics',
                      style: TextStyle(fontSize: 12, color: Color(0xFFE9D5FF)),
                    ),
                  ],
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${_circulars.length} Active',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),

          // Category Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: categories.map((cat) {
                final isSelected = _selectedCategory == cat;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(
                      cat,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                        color: isSelected ? Colors.white : const Color(0xFF475569),
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: const Color(0xFF7C3AED),
                    backgroundColor: Colors.white,
                    side: BorderSide(
                      color: isSelected ? const Color(0xFF7C3AED) : const Color(0xFFE2E8F0),
                    ),
                    showCheckmark: false,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    onSelected: (_) => setState(() => _selectedCategory = cat),
                  ),
                );
              }).toList(),
            ),
          ),

          // Circulars List
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              itemCount: filtered.length,
              itemBuilder: (ctx, idx) {
                final item = filtered[idx];
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.03),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => _showCircularDetailsModal(item),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Top Row: Ref ID + Priority Badge
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF3E8FF),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Icon(Icons.campaign_rounded, color: Color(0xFF7C3AED), size: 16),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      item['id'],
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF64748B),
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: item['badgeBg'],
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    item['priority'],
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: item['badgeColor'],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),

                            // Title
                            Text(
                              item['title'],
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                                height: 1.3,
                              ),
                            ),
                            const SizedBox(height: 6),

                            // Summary
                            Text(
                              item['summary'],
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF64748B),
                                height: 1.4,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 12),

                            // Footer: Issuer & Date
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Row(
                                    children: [
                                      const Icon(Icons.account_balance_outlined, size: 13, color: Color(0xFF94A3B8)),
                                      const SizedBox(width: 4),
                                      Expanded(
                                        child: Text(
                                          item['issuer'],
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w500,
                                            color: Color(0xFF64748B),
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Row(
                                  children: [
                                    const Icon(Icons.calendar_today_outlined, size: 12, color: Color(0xFF94A3B8)),
                                    const SizedBox(width: 4),
                                    Text(
                                      item['date'],
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF475569),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showCircularDetailsModal(Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.85,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
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

              // Superbee Letterhead Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'SUPERBEE AERONAUTICS PVT LTD',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF581C87), letterSpacing: 0.8),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Ref: ${item['id']}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: item['badgeBg'],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      item['priority'],
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: item['badgeColor']),
                    ),
                  ),
                ],
              ),
              const Divider(height: 24),

              // Title
              Text(
                item['title'],
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 8),

              Row(
                children: [
                  const Icon(Icons.person_pin_outlined, size: 14, color: Color(0xFF64748B)),
                  const SizedBox(width: 4),
                  Text(item['issuer'], style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                  const Spacer(),
                  const Icon(Icons.calendar_month, size: 14, color: Color(0xFF64748B)),
                  const SizedBox(width: 4),
                  Text(item['date'], style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 16),

              // Full content in card
              Expanded(
                child: SingleChildScrollView(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Text(
                      item['content'],
                      style: const TextStyle(fontSize: 13, height: 1.6, color: Color(0xFF334155)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Action button: Download PDF / Close
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Close', style: TextStyle(color: Color(0xFF475569), fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        backgroundColor: const Color(0xFF581C87),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Downloading ${item['id']}_Memo.pdf... Saved to Downloads'),
                            backgroundColor: const Color(0xFF16A34A),
                          ),
                        );
                      },
                      icon: const Icon(Icons.download_rounded, color: Colors.white, size: 18),
                      label: const Text('Download PDF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
