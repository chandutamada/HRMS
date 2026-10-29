import 'package:flutter/material.dart';

class TransactionsScreen extends StatelessWidget {
  final String title;
  final String type; // 'ATTENDANCE' | 'LEAVE' | 'OUT_ON_DUTY'
  final Map<String, dynamic> userData;

  const TransactionsScreen({
    super.key,
    required this.title,
    required this.type,
    required this.userData,
  });

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
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: _buildTransactionList(),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildTransactionList() {
    if (type == 'ATTENDANCE') {
      return [
        _buildTransactionCard(
          title: 'Check-In • On-Site Geofenced',
          date: '15 Sep 2026, 09:02 AM',
          status: 'SUCCESS',
          statusColor: const Color(0xFF16A34A),
          subtitle: 'Bangalore Campus (GPS Accuracy ±4.2m)',
          details: 'Device GPS verified within 50m office radius',
        ),
        _buildTransactionCard(
          title: 'Check-Out • Regular Day End',
          date: '14 Sep 2026, 05:36 PM',
          status: 'SUCCESS',
          statusColor: const Color(0xFF16A34A),
          subtitle: 'Total span: 8h 34m (General Shift)',
          details: 'Within 50m geofence perimeter',
        ),
        _buildTransactionCard(
          title: 'Check-In • Morning Shift',
          date: '14 Sep 2026, 09:02 AM',
          status: 'SUCCESS',
          statusColor: const Color(0xFF16A34A),
          subtitle: 'Bangalore Campus',
          details: 'Verified by backend Haversine calculation',
        ),
      ];
    } else if (type == 'LEAVE') {
      return [
        _buildTransactionCard(
          title: 'Casual Leave (CL) • 1.0 Day',
          date: '02 Sep 2026 – 02 Sep 2026',
          status: 'APPROVED',
          statusColor: const Color(0xFF16A34A),
          subtitle: 'Reason: Personal emergency at home',
          details: 'Deducted from CL Balance (Remaining: 8.5)',
        ),
        _buildTransactionCard(
          title: 'Sick Leave (SL) • 2.0 Days',
          date: '18 Aug 2026 – 19 Aug 2026',
          status: 'APPROVED',
          statusColor: const Color(0xFF16A34A),
          subtitle: 'Reason: Viral fever',
          details: 'Approved by Reporting Manager',
        ),
      ];
    } else {
      // OUT_ON_DUTY
      return [
        _buildTransactionCard(
          title: 'Field Flight Mission • 6.45 KM',
          date: '15 Sep 2026, 11:00 AM – 01:30 PM',
          status: 'COMPLETED',
          statusColor: const Color(0xFF2563EB),
          subtitle: 'Client: Hitech Solutions Pvt. Ltd.',
          details: '12 Route points recorded • 2 Checkpoint dwell stops',
        ),
        _buildTransactionCard(
          title: 'Outdoor Client Inspection • 4.20 KM',
          date: '11 Sep 2026, 02:00 PM – 04:30 PM',
          status: 'COMPLETED',
          statusColor: const Color(0xFF2563EB),
          subtitle: 'Client: Aerospace Park Devanahalli',
          details: 'Perimeter survey completed • Synced to HR portal',
        ),
      ];
    }
  }

  Widget _buildTransactionCard({
    required String title,
    required String date,
    required String status,
    required Color statusColor,
    required String subtitle,
    required String details,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(date, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontFamily: 'monospace')),
          const SizedBox(height: 6),
          Text(subtitle, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF334155))),
          const SizedBox(height: 4),
          Text(details, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }
}
