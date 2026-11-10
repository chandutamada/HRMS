import 'package:flutter/material.dart';
import '../services/api_service.dart';

class TransactionsScreen extends StatefulWidget {
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
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  bool _isLoading = true;
  List<Widget> _transactionCards = [];

  @override
  void initState() {
    super.initState();
    _fetchTransactions();
  }

  Future<void> _fetchTransactions() async {
    setState(() => _isLoading = true);
    final List<Widget> cards = [];

    try {
      if (widget.type == 'ATTENDANCE') {
        final res = await ApiService()
            .dio
            .get('/attendance/history', queryParameters: {'limit': 50})
            .timeout(const Duration(seconds: 10));

        final raw = res.data;
        List<dynamic> items = [];
        if (raw is Map && raw['data'] != null) {
          final d = raw['data'];
          if (d is Map && d['items'] is List) {
            items = d['items'];
          } else if (d is List) {
            items = d;
          }
        } else if (raw is Map && raw['items'] is List) {
          items = raw['items'];
        } else if (raw is List) {
          items = raw;
        }

        for (final rec in items) {
          final status = rec['status']?.toString() ?? 'RECORDED';
          final dateStr = rec['date'] != null ? rec['date'].toString().split('T')[0] : 'Recent';
          final isPresent = status == 'PRESENT';
          final isAbsent = status == 'ABSENT';

          final statusColor = isPresent
              ? const Color(0xFF16A34A)
              : (isAbsent ? const Color(0xFFDC2626) : const Color(0xFFD97706));

          final firstIn = rec['firstCheckIn'] != null
              ? (rec['firstCheckIn'].toString().contains('T')
                  ? rec['firstCheckIn'].toString().split('T')[1].split('.')[0]
                  : rec['firstCheckIn'].toString())
              : null;

          final lastOut = rec['lastCheckOut'] != null
              ? (rec['lastCheckOut'].toString().contains('T')
                  ? rec['lastCheckOut'].toString().split('T')[1].split('.')[0]
                  : rec['lastCheckOut'].toString())
              : null;

          final subtitle = firstIn != null
              ? 'Punch In: $firstIn • Punch Out: ${lastOut ?? 'In Progress'}'
              : 'Status: $status';

          final totalMins = int.tryParse('${rec['totalWorkMinutes']}') ?? 0;
          final isLate = rec['isLate'] == true;
          final lateMins = int.tryParse('${rec['lateMinutes']}') ?? 0;

          final details = totalMins > 0
              ? 'Worked: ${totalMins ~/ 60}h ${totalMins % 60}m • Late: ${isLate ? '${lateMins}m' : 'On Time'}'
              : (isLate ? 'Late by $lateMins minutes' : 'Standard scheduled day');

          cards.add(
            _buildTransactionCard(
              title: isPresent ? 'Attendance • Present' : 'Attendance • $status',
              date: dateStr,
              status: status,
              statusColor: statusColor,
              subtitle: subtitle,
              details: details,
            ),
          );
        }
      } else if (widget.type == 'LEAVE') {
        final res = await ApiService()
            .dio
            .get('/leave/applications/my')
            .timeout(const Duration(seconds: 10));

        final raw = res.data;
        List<dynamic> items = [];
        if (raw is Map && raw['data'] is List) {
          items = raw['data'];
        } else if (raw is List) {
          items = raw;
        }

        for (final app in items) {
          final status = app['status']?.toString() ?? 'PENDING';
          final statusColor = status == 'APPROVED'
              ? const Color(0xFF16A34A)
              : (status == 'REJECTED' ? const Color(0xFFDC2626) : const Color(0xFFD97706));

          final leaveTypeName = app['leaveType']?['name']?.toString() ?? 'Leave Application';
          final days = app['days'] ?? 1;

          final sDate = app['startDate']?.toString().split('T')[0] ?? '';
          final eDate = app['endDate']?.toString().split('T')[0] ?? '';
          final dateStr = sDate == eDate ? sDate : '$sDate – $eDate';

          final reason = app['reason']?.toString() ?? 'Not specified';
          final appliedAt = app['createdAt']?.toString().split('T')[0] ?? '';

          cards.add(
            _buildTransactionCard(
              title: '$leaveTypeName • $days Day(s)',
              date: dateStr,
              status: status,
              statusColor: statusColor,
              subtitle: 'Reason: $reason',
              details: 'Applied on: $appliedAt',
            ),
          );
        }
      } else if (widget.type == 'OUT_ON_DUTY') {
        final res = await ApiService()
            .dio
            .get('/tracking/sessions')
            .timeout(const Duration(seconds: 10));

        final raw = res.data;
        List<dynamic> items = [];
        if (raw is Map && raw['data'] is List) {
          items = raw['data'];
        } else if (raw is List) {
          items = raw;
        }

        for (final sess in items) {
          final status = sess['status']?.toString() ?? 'COMPLETED';
          final statusColor = status == 'IN_PROGRESS' ? const Color(0xFF2563EB) : const Color(0xFF16A34A);
          final dist = sess['distanceKm'] != null ? '${sess['distanceKm']} km' : '0 km';
          final sTime = sess['startTime']?.toString().split('T')[0] ?? 'Recent';
          final area = sess['areaName']?.toString() ?? 'Field Station';

          cards.add(
            _buildTransactionCard(
              title: 'Field Duty Mission • $area',
              date: sTime,
              status: status,
              statusColor: statusColor,
              subtitle: 'Distance: $dist',
              details: 'Session ID: ${sess['id']}',
            ),
          );
        }
      }
    } catch (_) {
      // Graceful fallback to empty state
    } finally {
      if (mounted) {
        setState(() {
          _transactionCards = cards;
          _isLoading = false;
        });
      }
    }
  }

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
                    widget.title,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF7C3AED)),
                  )
                : _transactionCards.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey.shade400),
                            const SizedBox(height: 12),
                            Text(
                              'No transactions recorded',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Transactions synchronized with HR will show here.',
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: const Color(0xFF7C3AED),
                        onRefresh: _fetchTransactions,
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: _transactionCards,
                        ),
                      ),
          ),
        ],
      ),
    );
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
