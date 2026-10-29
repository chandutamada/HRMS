import 'package:flutter/material.dart';
import 'leave_tab.dart';

class LeaveBalanceScreen extends StatelessWidget {
  final Map<String, dynamic> userData;
  const LeaveBalanceScreen({super.key, required this.userData});

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
                  'My Leave Balance',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildBalanceCard(
                  title: 'Casual Leave (CL)',
                  code: 'CL',
                  total: 12.0,
                  available: 8.5,
                  consumed: 3.5,
                  color: const Color(0xFF2563EB),
                  bgLight: const Color(0xFFEFF6FF),
                  policyNote: 'Max 3 consecutive days. Non-accumulative.',
                ),
                const SizedBox(height: 12),
                _buildBalanceCard(
                  title: 'Sick Leave (SL)',
                  code: 'SL',
                  total: 10.0,
                  available: 7.0,
                  consumed: 3.0,
                  color: const Color(0xFF059669),
                  bgLight: const Color(0xFFECFDF5),
                  policyNote: 'Medical cert required if > 2 consecutive days.',
                ),
                const SizedBox(height: 12),
                _buildBalanceCard(
                  title: 'Earned / Privilege Leave (EL)',
                  code: 'EL',
                  total: 15.0,
                  available: 11.0,
                  consumed: 4.0,
                  color: const Color(0xFFD97706),
                  bgLight: const Color(0xFFFFFBEB),
                  policyNote: 'Carry forward up to 45 days. Encashable upon exit.',
                ),
                const SizedBox(height: 12),
                _buildBalanceCard(
                  title: 'Compensatory Off (Comp-Off)',
                  code: 'CO',
                  total: 3.0,
                  available: 2.0,
                  consumed: 1.0,
                  color: const Color(0xFF7C3AED),
                  bgLight: const Color(0xFFF5F3FF),
                  policyNote: 'Earned by working on designated weekly offs/holidays.',
                ),
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => LeaveTab(userData: userData)),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7C3AED),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: const Icon(Icons.edit_note, color: Colors.white),
                    label: const Text('Apply for Leave', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBalanceCard({
    required String title,
    required String code,
    required double total,
    required double available,
    required double consumed,
    required Color color,
    required Color bgLight,
    required String policyNote,
  }) {
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: bgLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(code, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 13)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                ],
              ),
              Text(
                '${available.toStringAsFixed(1)} Available',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: total > 0 ? (available / total) : 0,
              backgroundColor: const Color(0xFFF1F5F9),
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 10),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Credited: ${total.toStringAsFixed(1)} days', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              Text('Consumed: ${consumed.toStringAsFixed(1)} days', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
            ],
          ),
          const SizedBox(height: 6),
          Text(policyNote, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontStyle: FontStyle.italic)),
        ],
      ),
    );
  }
}
