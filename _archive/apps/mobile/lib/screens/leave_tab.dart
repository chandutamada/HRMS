import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:dio/dio.dart';
import '../services/api_service.dart';

class LeaveTab extends StatefulWidget {
  final Map<String, dynamic> userData;
  const LeaveTab({super.key, required this.userData});

  @override
  State<LeaveTab> createState() => _LeaveTabState();
}

class _LeaveTabState extends State<LeaveTab> {
  List<dynamic> _balances = [];
  List<dynamic> _applications = [];
  List<dynamic> _leaveTypes = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchLeaveData();
  }

  Future<void> _fetchLeaveData() async {
    setState(() => _isLoading = true);
    try {
      final balRes = await ApiService()
          .dio
          .get('/leave/balances/my')
          .timeout(const Duration(seconds: 4));
      final appRes = await ApiService()
          .dio
          .get('/leave/applications/my')
          .timeout(const Duration(seconds: 4));
      final typeRes = await ApiService()
          .dio
          .get('/leave/types')
          .timeout(const Duration(seconds: 4));

      if (mounted) {
        setState(() {
          _balances = balRes.data['data'] ?? [];
          _applications = appRes.data['data'] ?? [];
          _leaveTypes = typeRes.data['data'] ?? [];
        });
      }
    } catch (e) {
      // Handled gracefully
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showPolicyModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(ctx).size.height * 0.85,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Superbee Leave Policy',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    Text(
                      'MSME Manufacturing Unit Compliance',
                      style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Sandwich Leave Rule Highlight
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.warning_amber_rounded, color: Color(0xFFB45309), size: 18),
                              SizedBox(width: 8),
                              Text(
                                'Sandwich Leave Rule (Section 4 & Note 1)',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF92400E)),
                              ),
                            ],
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Weekly offs and holidays falling between or adjacent to leave days are also counted as leave:\n'
                            '• Friday Leave: Friday + Sat + Sun = 3 Days Leave\n'
                            '• Monday Leave: Sat + Sun + Monday = 3 Days Leave\n'
                            '• Friday & Monday Bridge: Fri + Sat + Sun + Mon = 4 Days Leave',
                            style: TextStyle(fontSize: 11, color: Color(0xFF78350F), height: 1.4),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Leave Types Overview
                    const Text('Leave Types & Entitlements', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 8),

                    _buildPolicyCard(
                      'Casual Leave (CL)',
                      '7 Days / Year',
                      'Max 2 consecutive days in a row. Leave beyond 2 days treated as EL or LOP. Cannot be suffixed or prefixed to weekly holidays. Lapses at year end.',
                      const Color(0xFF2563EB),
                    ),
                    _buildPolicyCard(
                      'Sick Leave (SL)',
                      '7 Days / Year',
                      'Medical certificate mandatory for absence exceeding 1 day. Intimation to Reporting Manager & HR Manager. Lapses at year end.',
                      const Color(0xFFD97706),
                    ),
                    _buildPolicyCard(
                      'Earned Leave (EL / Privileged)',
                      '15 Days / Year (1.25/mo)',
                      'Eligible after 240 days / post-probation. Max 30 days carry forward. Sandwich rule applies. Apply at least 10 days in advance with handover. Encashed on exit at basic pay.',
                      const Color(0xFF16A34A),
                    ),
                    _buildPolicyCard(
                      'Maternity Leave (ML)',
                      '26 Weeks',
                      'Applicable for married female employees with >80 days service. First 2 children. Fully paid. Apply 2 weeks in advance.',
                      const Color(0xFF9333EA),
                    ),
                    _buildPolicyCard(
                      'Paternity Leave (PL)',
                      '15 Days',
                      'Applicable for married male employees post-probation. Within 15 days of child birth. Max 2 instances during employment.',
                      const Color(0xFF4F46E5),
                    ),

                    const SizedBox(height: 12),
                    // Drone Teams Special Consideration
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.flight_takeoff, color: Color(0xFF475569), size: 18),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Drone Operations: Leave during active flight testing and project deadlines should be avoided unless critical.',
                              style: TextStyle(fontSize: 11, color: Color(0xFF334155)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPolicyCard(String title, String entitlement, String desc, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  entitlement,
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: color),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(desc, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.3)),
        ],
      ),
    );
  }

  void _showApplyModal() {
    String? selectedTypeId = _leaveTypes.isNotEmpty ? _leaveTypes[0]['id'] : null;
    DateTime startDate = DateTime.now().add(const Duration(days: 1));
    DateTime endDate = DateTime.now().add(const Duration(days: 1));
    bool isHalfDay = false;
    final reasonController = TextEditingController();

    // Helper to compute preview days
    Map<String, dynamic> computePreview(String? typeId, DateTime sDate, DateTime eDate, bool halfDay) {
      if (halfDay) {
        return {'days': 0.5, 'isSandwich': false, 'warning': null};
      }
      final diff = eDate.difference(sDate).inDays + 1;
      final type = _leaveTypes.firstWhere((t) => t['id'] == typeId, orElse: () => {});
      final code = type['code'] ?? '';

      int effectiveDays = diff;
      bool isSandwich = false;
      String? warning;

      if (code == 'EL') {
        if (diff > 1) {
          isSandwich = true;
        } else if (diff == 1) {
          if (sDate.weekday == DateTime.friday || sDate.weekday == DateTime.monday) {
            effectiveDays = 3;
            isSandwich = true;
          }
        }
        final daysUntil = sDate.difference(DateTime.now()).inDays;
        if (daysUntil < 10) {
          warning = 'Earned Leave normally requires 10 days advance notice & handover.';
        }
      } else if (code == 'CL') {
        if (diff > 2) {
          warning = 'Casual Leave cannot exceed 2 consecutive days per policy.';
        }
      } else if (code == 'SL') {
        if (diff > 1) {
          warning = 'Sick Leave > 1 day requires a Doctor / Medical Certificate.';
        }
      }

      return {'days': effectiveDays, 'isSandwich': isSandwich, 'warning': warning};
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          final preview = computePreview(selectedTypeId, startDate, endDate, isHalfDay);

          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              top: 20,
              left: 20,
              right: 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Apply for Leave', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      IconButton(
                        icon: const Icon(Icons.info_outline, size: 20, color: Color(0xFF16A34A)),
                        tooltip: 'View Policy',
                        onPressed: () {
                          Navigator.pop(ctx);
                          _showPolicyModal();
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Leave Type Dropdown
                  DropdownButtonFormField<String>(
                    initialValue: selectedTypeId,
                    decoration: InputDecoration(
                      labelText: 'Leave Type',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    items: _leaveTypes.map<DropdownMenuItem<String>>((t) {
                      return DropdownMenuItem<String>(
                        value: t['id'],
                        child: Text('${t['name']} (${t['code']})', style: const TextStyle(fontSize: 13)),
                      );
                    }).toList(),
                    onChanged: (val) => setModalState(() => selectedTypeId = val),
                  ),
                  const SizedBox(height: 12),

                  // Date Pickers (From Date - To Date)
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: startDate,
                              firstDate: DateTime.now().subtract(const Duration(days: 30)),
                              lastDate: DateTime.now().add(const Duration(days: 180)),
                            );
                            if (picked != null) {
                              setModalState(() {
                                startDate = picked;
                                if (endDate.isBefore(picked)) endDate = picked;
                              });
                            }
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('From Date', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                const SizedBox(height: 2),
                                Text(
                                  DateFormat('dd MMM yyyy').format(startDate),
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: InkWell(
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: endDate,
                              firstDate: startDate,
                              lastDate: DateTime.now().add(const Duration(days: 180)),
                            );
                            if (picked != null) {
                              setModalState(() => endDate = picked);
                            }
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('To Date', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                const SizedBox(height: 2),
                                Text(
                                  DateFormat('dd MMM yyyy').format(endDate),
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Half Day Toggle
                  Row(
                    children: [
                      Checkbox(
                        value: isHalfDay,
                        onChanged: (v) => setModalState(() => isHalfDay = v ?? false),
                        activeColor: const Color(0xFF16A34A),
                      ),
                      const Text('Half Day Leave (0.5 Day)', style: TextStyle(fontSize: 12)),
                    ],
                  ),

                  // Preview Badge & Sandwich Warning
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: preview['isSandwich'] ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: preview['isSandwich'] ? const Color(0xFFFDE68A) : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Effective Duration:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            Text(
                              '${preview['days']} Days ${preview['isSandwich'] ? '(Sandwich Rule)' : ''}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: preview['isSandwich'] ? const Color(0xFFB45309) : const Color(0xFF16A34A),
                              ),
                            ),
                          ],
                        ),
                        if (preview['warning'] != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            preview['warning'] as String,
                            style: const TextStyle(fontSize: 10, color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Reason Text Field
                  TextField(
                    controller: reasonController,
                    maxLines: 2,
                    style: const TextStyle(fontSize: 13),
                    decoration: InputDecoration(
                      labelText: 'Reason for leave',
                      contentPadding: const EdgeInsets.all(12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () async {
                        if (selectedTypeId == null || reasonController.text.trim().isEmpty) return;
                        try {
                          await ApiService().dio.post(
                            '/leave/apply',
                            data: {
                              'leaveTypeId': selectedTypeId,
                              'startDate': DateFormat('yyyy-MM-dd').format(startDate),
                              'endDate': DateFormat('yyyy-MM-dd').format(endDate),
                              'isHalfDay': isHalfDay,
                              'reason': reasonController.text.trim(),
                            },
                          );
                          if (ctx.mounted) Navigator.pop(ctx);
                          _fetchLeaveData();
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Leave application submitted successfully')),
                            );
                          }
                        } on DioException catch (e) {
                          final msg = e.response?.data?['message'] ?? 'Failed to apply leave';
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(msg), backgroundColor: Colors.red),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                            );
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Submit Application', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Leave Desk', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.menu_book_rounded, color: Color(0xFF16A34A)),
            tooltip: 'Leave Policy',
            onPressed: _showPolicyModal,
          ),
          IconButton(
            icon: const Icon(Icons.add_circle, color: Color(0xFF16A34A)),
            tooltip: 'Apply Leave',
            onPressed: _showApplyModal,
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchLeaveData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_isLoading)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 12),
                    child: ClipRRect(
                      borderRadius: BorderRadius.all(Radius.circular(4)),
                      child: LinearProgressIndicator(color: Color(0xFF16A34A)),
                    ),
                  ),

                // Superbee Leave Policy Banner
                InkWell(
                  onTap: _showPolicyModal,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.shield_outlined, color: Color(0xFF4ADE80), size: 22),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Superbee Leave Policy (MSME)',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              Text(
                                '7d CL • 7d SL • 15d EL • Sandwich rules apply',
                                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: Colors.white54, size: 20),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),

                // Leave Balances Cards
                const Text('My Leave Balances (2026)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                const SizedBox(height: 10),

                if (_balances.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Center(
                      child: Text('No balances found for current year', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                    ),
                  )
                else
                  SizedBox(
                    height: 110,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: _balances.length,
                      itemBuilder: (ctx, idx) {
                        final b = _balances[idx];
                        final type = b['leaveType'] ?? {};
                        final code = type['code'] ?? 'LV';
                        final available = b['availableDays'] ?? 0;
                        final entitled = b['entitledDays'] ?? 0;

                        return Container(
                          width: 130,
                          margin: const EdgeInsets.only(right: 10),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    code,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                                  ),
                                  Text(
                                    '/ $entitled',
                                    style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                                  ),
                                ],
                              ),
                              Text(
                                '$available',
                                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                              ),
                              Text(
                                type['name'] ?? 'Leave',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                const SizedBox(height: 20),

                // Application History
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Application History', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                    ElevatedButton.icon(
                      onPressed: _showApplyModal,
                      icon: const Icon(Icons.add, size: 14),
                      label: const Text('Apply', style: TextStyle(fontSize: 11)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                if (_applications.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Center(
                      child: Text('No leave applications recorded yet', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                    ),
                  )
                else
                  ..._applications.map((app) {
                    final type = app['leaveType'] ?? {};
                    final status = app['status'] ?? 'PENDING';
                    final isApproved = status == 'APPROVED';
                    final isRejected = status == 'REJECTED';
                    final isSandwich = (type['code'] == 'EL' && (double.tryParse('${app['totalDays']}') ?? 0) > 1);

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
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
                                  Text(
                                    type['name'] ?? 'Leave',
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                  ),
                                  if (isSandwich) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEF3C7),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        'Sandwich',
                                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: isApproved
                                      ? const Color(0xFFDCFCE7)
                                      : isRejected
                                          ? const Color(0xFFFFE4E6)
                                          : const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  status,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: isApproved
                                        ? const Color(0xFF16A34A)
                                        : isRejected
                                            ? const Color(0xFFE11D48)
                                            : const Color(0xFFB45309),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${DateFormat('d MMM').format(DateTime.parse(app['startDate']))} - ${DateFormat('d MMM').format(DateTime.parse(app['endDate']))} • ${app['totalDays']} Days ${app['isHalfDay'] == true ? '(Half Day)' : ''}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Reason: ${app['reason'] ?? ''}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                          ),
                          if (app['reviewRemarks'] != null && '${app['reviewRemarks']}'.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              'HR Remarks: ${app['reviewRemarks']}',
                              style: TextStyle(
                                fontSize: 10,
                                color: isApproved ? const Color(0xFF16A34A) : const Color(0xFFE11D48),
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ],
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
