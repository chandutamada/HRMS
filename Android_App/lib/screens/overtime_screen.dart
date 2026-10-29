import 'package:flutter/material.dart';

class OvertimeScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const OvertimeScreen({super.key, required this.userData});

  @override
  State<OvertimeScreen> createState() => _OvertimeScreenState();
}

class _OvertimeScreenState extends State<OvertimeScreen> {
  final List<Map<String, dynamic>> _overtimeRecords = [
    {
      'date': '14 Sep 2026',
      'hours': '2.5 hrs',
      'project': 'Drone Firmware Night Flight Test (Project Vayu)',
      'status': 'APPROVED',
      'payout': '₹ 1,250 (Added to Sep Payroll)',
    },
    {
      'date': '07 Sep 2026',
      'hours': '3.0 hrs',
      'project': 'Client Urgent Bug Triage (Electronic City Deploy)',
      'status': 'APPROVED',
      'payout': 'Converted to 0.5 Day Comp-Off',
    },
  ];

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
                  'Overtime & Extra Hours',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Summary KPI
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildSummaryItem('5.5 Hrs', 'TOTAL OT THIS MONTH', const Color(0xFF7C3AED)),
                      Container(width: 1, height: 40, color: const Color(0xFFE2E8F0)),
                      _buildSummaryItem('₹ 1,250', 'ESTIMATED PAYOUT', const Color(0xFF16A34A)),
                      Container(width: 1, height: 40, color: const Color(0xFFE2E8F0)),
                      _buildSummaryItem('0.5 Day', 'COMP-OFF EARNED', const Color(0xFF2563EB)),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                const Text(
                  'OVERTIME LOGS & CLAIMS',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 10),

                ..._overtimeRecords.map(
                  (ot) => Container(
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
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(ot['date'], style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                ot['status'],
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF166534)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(ot['project'], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Logged: ${ot['hours']}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                            Text(ot['payout'], style: const TextStyle(fontSize: 11, color: Color(0xFF059669), fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryItem(String value, String label, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
      ],
    );
  }
}
