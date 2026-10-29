import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class PayslipsScreen extends StatefulWidget {
  final Map<String, dynamic>? initialPayslip;
  const PayslipsScreen({super.key, this.initialPayslip});

  @override
  State<PayslipsScreen> createState() => _PayslipsScreenState();
}

class _PayslipsScreenState extends State<PayslipsScreen> {
  List<dynamic> _allPayslips = [];
  bool _isLoading = true;
  bool _isDownloading = false;

  // Selected period filters
  int _selectedYear = DateTime.now().year;
  int _selectedMonth = DateTime.now().month;

  // Accordion states
  bool _isEarningsExpanded = true;
  bool _isDeductionsExpanded = false;

  final List<String> _monthsShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialPayslip != null) {
      final period = widget.initialPayslip!['payrollPeriod'] ?? {};
      if (period['year'] != null) _selectedYear = int.tryParse('${period['year']}') ?? _selectedYear;
      if (period['month'] != null) _selectedMonth = int.tryParse('${period['month']}') ?? _selectedMonth;
    }
    _fetchPayslips();
  }

  Future<void> _fetchPayslips() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService()
          .dio
          .get('/payroll/payslips/my')
          .timeout(const Duration(seconds: 4));

      final data = res.data['data'] as List<dynamic>? ?? [];
      if (mounted) {
        setState(() {
          _allPayslips = data;
          if (_allPayslips.isNotEmpty && widget.initialPayslip == null) {
            final latest = _allPayslips.first;
            final period = latest['payrollPeriod'] ?? {};
            if (period['year'] != null) _selectedYear = int.tryParse('${period['year']}') ?? _selectedYear;
            if (period['month'] != null) _selectedMonth = int.tryParse('${period['month']}') ?? _selectedMonth;
          }
        });
      }
    } catch (e) {
      // Graceful fallback
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Map<String, dynamic>? get _currentPayslip {
    for (final p in _allPayslips) {
      final period = p['payrollPeriod'] ?? {};
      final y = int.tryParse('${period['year']}');
      final m = int.tryParse('${period['month']}');
      if (y == _selectedYear && m == _selectedMonth) {
        return p as Map<String, dynamic>;
      }
    }
    return null;
  }

  // Helper to convert number to words in Indian numbering system
  String _numberToWordsIndian(double amount) {
    final int val = amount.floor();
    if (val <= 0) return 'Rupees Zero Only';

    final units = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    final tens = [
      '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    String convertTwoDigits(int n) {
      if (n < 20) return units[n];
      final rem = n % 10;
      return rem > 0 ? '${tens[n ~/ 10]} ${units[rem]}' : tens[n ~/ 10];
    }

    String convertThreeDigits(int n) {
      if (n == 0) return '';
      if (n < 100) return convertTwoDigits(n);
      final h = '${units[n ~/ 100]} Hundred';
      final rem = n % 100;
      if (rem > 0) return '$h ${convertTwoDigits(rem)}';
      return h;
    }

    final int crores = val ~/ 10000000;
    final int remAfterCrores = val % 10000000;
    final int lakhs = remAfterCrores ~/ 100000;
    final int remAfterLakhs = remAfterCrores % 100000;
    final int thousands = remAfterLakhs ~/ 1000;
    final int remAfterThousands = remAfterLakhs % 1000;

    final List<String> parts = [];
    if (crores > 0) parts.add('${convertTwoDigits(crores)} Crore');
    if (lakhs > 0) parts.add('${convertTwoDigits(lakhs)} Lakh');
    if (thousands > 0) parts.add('${convertTwoDigits(thousands)} Thousand');
    if (remAfterThousands > 0) parts.add(convertThreeDigits(remAfterThousands));

    return 'Rupees ${parts.join(' ')} Only';
  }

  @override
  Widget build(BuildContext context) {
    final slip = _currentPayslip;
    final netSalary = double.tryParse(slip?['netSalary']?.toString() ?? '0') ?? 0;
    final grossEarnings = double.tryParse(slip?['grossEarnings']?.toString() ?? '0') ?? 0;
    final totalDeductions = double.tryParse(slip?['totalDeductions']?.toString() ?? '0') ?? 0;

    final lineItems = (slip?['lineItems'] as List<dynamic>?) ?? [];
    final earningsItems = lineItems.where((i) => i['type'] == 'EARNING').toList();
    final deductionItems = lineItems.where((i) => i['type'] == 'DEDUCTION').toList();

    final employee = slip?['employee'] ?? {};
    final employeeNo = employee['employeeCode'] ?? '09123';
    final employeeName = '${employee['firstName'] ?? ''} ${employee['lastName'] ?? ''}'.trim();
    final bankName = employee['bankName'] ?? 'HDFC Bank';
    final bankAccount = employee['bankAccountNumber'] ?? '••••••••7890';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF2563EB),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Payslips',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 10,
                  backgroundColor: Colors.white.withValues(alpha: 0.25),
                  child: const Text('Me', style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Month & Year Selector Strip (Exactly matching the design)
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
              child: Row(
                children: [
                  // Year Selector
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        value: _selectedYear,
                        isDense: true,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                        icon: const Icon(Icons.arrow_drop_down, color: Color(0xFF64748B), size: 18),
                        items: [2024, 2025, 2026, 2027].map((y) {
                          return DropdownMenuItem<int>(
                            value: y,
                            child: Text('$y - ${y + 1}'),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedYear = val);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Horizontal Months Strip
                  Expanded(
                    child: SizedBox(
                      height: 36,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        itemCount: _monthsShort.length,
                        itemBuilder: (context, idx) {
                          final monthNum = idx + 1;
                          final isSelected = monthNum == _selectedMonth;

                          return GestureDetector(
                            onTap: () {
                              setState(() => _selectedMonth = monthNum);
                            },
                            child: Container(
                              margin: const EdgeInsets.symmetric(horizontal: 4),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFF2563EB) : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: Text(
                                  _monthsShort[idx],
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                    color: isSelected ? Colors.white : const Color(0xFF64748B),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // Main Content Area
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
                  : slip == null
                      ? _buildEmptyState()
                      : SingleChildScrollView(
                          physics: const BouncingScrollPhysics(),
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // 1. Net Pay Card
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(18),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                  boxShadow: [
                                    BoxDecoration(
                                      color: Colors.black.withValues(alpha: 0.02),
                                      borderRadius: BorderRadius.circular(16),
                                    ).color != null
                                        ? BoxShadow(
                                            color: Colors.black.withValues(alpha: 0.02),
                                            blurRadius: 10,
                                            offset: const Offset(0, 4),
                                          )
                                        : const BoxShadow(),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Net Pay',
                                      style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        Container(
                                          width: 24,
                                          height: 24,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF14B8A6).withValues(alpha: 0.2),
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Center(
                                            child: Text(
                                              '₹',
                                              style: TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFF0D9488),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          NumberFormat('#,##,##0.00').format(netSalary),
                                          style: const TextStyle(
                                            fontSize: 26,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFF0F172A),
                                            letterSpacing: -0.5,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      _numberToWordsIndian(netSalary),
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.3),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 14),

                              // 2. Earnings Accordion Card (+ Earnings)
                              Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: Column(
                                  children: [
                                    InkWell(
                                      onTap: () {
                                        setState(() => _isEarningsExpanded = !_isEarningsExpanded);
                                      },
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Row(
                                              children: [
                                                Container(
                                                  width: 22,
                                                  height: 22,
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF22C55E).withValues(alpha: 0.15),
                                                    shape: BoxShape.circle,
                                                  ),
                                                  child: const Center(
                                                    child: Icon(Icons.add, size: 14, color: Color(0xFF16A34A)),
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                const Text(
                                                  'Earnings',
                                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                                ),
                                              ],
                                            ),
                                            Row(
                                              children: [
                                                Text(
                                                  '₹${NumberFormat('#,##,##0.00').format(grossEarnings)}',
                                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                                ),
                                                const SizedBox(width: 8),
                                                Icon(
                                                  _isEarningsExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                                                  color: const Color(0xFF64748B),
                                                  size: 20,
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    if (_isEarningsExpanded) ...[
                                      const Divider(height: 1, color: Color(0xFFF1F5F9)),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                        child: Column(
                                          children: earningsItems.isNotEmpty
                                              ? earningsItems.map((item) {
                                                  final amt = double.tryParse(item['amount']?.toString() ?? '0') ?? 0;
                                                  return _buildLineItemRow(item['name'] ?? 'Earning', amt);
                                                }).toList()
                                              : [
                                                  _buildLineItemRow('Basic', double.tryParse(slip['basicEarnings']?.toString() ?? '0') ?? 0),
                                                  if (grossEarnings > (double.tryParse(slip['basicEarnings']?.toString() ?? '0') ?? 0))
                                                    _buildLineItemRow('Allowances', grossEarnings - (double.tryParse(slip['basicEarnings']?.toString() ?? '0') ?? 0)),
                                                ],
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(height: 12),

                              // 3. Deductions Accordion Card (- Deductions)
                              Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: Column(
                                  children: [
                                    InkWell(
                                      onTap: () {
                                        setState(() => _isDeductionsExpanded = !_isDeductionsExpanded);
                                      },
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Row(
                                              children: [
                                                Container(
                                                  width: 22,
                                                  height: 22,
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                                                    shape: BoxShape.circle,
                                                  ),
                                                  child: const Center(
                                                    child: Icon(Icons.remove, size: 14, color: Color(0xFFDC2626)),
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                const Text(
                                                  'Deductions',
                                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                                ),
                                              ],
                                            ),
                                            Row(
                                              children: [
                                                Text(
                                                  '₹${NumberFormat('#,##,##0.00').format(totalDeductions)}',
                                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                                ),
                                                const SizedBox(width: 8),
                                                Icon(
                                                  _isDeductionsExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                                                  color: const Color(0xFF64748B),
                                                  size: 20,
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    if (_isDeductionsExpanded) ...[
                                      const Divider(height: 1, color: Color(0xFFF1F5F9)),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                        child: Column(
                                          children: deductionItems.isNotEmpty
                                              ? deductionItems.map((item) {
                                                  final amt = double.tryParse(item['amount']?.toString() ?? '0') ?? 0;
                                                  return _buildLineItemRow(item['name'] ?? 'Deduction', amt);
                                                }).toList()
                                              : [
                                                  _buildLineItemRow('EPF / PT / TDS', totalDeductions),
                                                ],
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(height: 14),

                              // 4. Employee Details Card
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Employee Details',
                                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                                    ),
                                    const SizedBox(height: 12),
                                    _buildDetailRow('Employee No', employeeNo),
                                    const SizedBox(height: 8),
                                    _buildDetailRow('Name', employeeName.isNotEmpty ? employeeName : 'Rajesh Sharma'),
                                    const SizedBox(height: 8),
                                    _buildDetailRow('Bank', bankName),
                                    const SizedBox(height: 8),
                                    _buildDetailRow('Bank Account', bankAccount),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 24),

                              // 5. Download Payslip Button
                              Builder(
                                builder: (_) {
                                  final period = (slip['payrollPeriod'] as Map<String, dynamic>?) ?? {};
                                  final periodMonth = int.tryParse('${period['month']}') ?? _selectedMonth;
                                  final periodYear = int.tryParse('${period['year']}') ?? _selectedYear;
                                  final monthName = _monthsShort[(periodMonth - 1).clamp(0, 11)];

                                  return SizedBox(
                                    width: double.infinity,
                                    height: 50,
                                    child: ElevatedButton(
                                      onPressed: _isDownloading
                                          ? null
                                          : () => _downloadPayslip(
                                                slip['id'],
                                                employeeNo,
                                                monthName,
                                                periodYear,
                                              ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF2563EB),
                                    foregroundColor: Colors.white,
                                    elevation: 2,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                  ),
                                  child: _isDownloading
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                        )
                                      : Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            const Text(
                                              'Download Payslip',
                                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                            ),
                                            const SizedBox(width: 8),
                                            Container(
                                              width: 22,
                                              height: 22,
                                              decoration: BoxDecoration(
                                                color: Colors.white.withValues(alpha: 0.2),
                                                shape: BoxShape.circle,
                                              ),
                                              child: const Center(
                                                child: Icon(Icons.arrow_downward, color: Colors.white, size: 13),
                                              ),
                                            ),
                                          ],
                                        ),
                                    ),
                                  );
                              },
                            ),
                              const SizedBox(height: 16),
                            ],
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _downloadPayslip(String slipId, String empCode, String month, int year) async {
    setState(() => _isDownloading = true);
    try {
      final res = await ApiService().dio.get(
        '/payroll/payslips/$slipId/pdf',
        options: Options(responseType: ResponseType.bytes),
      );
      final byteLength = (res.data as List<int>).length;
      final kb = (byteLength / 1024).toStringAsFixed(1);

      if (!mounted) return;
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 24),
              SizedBox(width: 10),
              Text('Payslip Downloaded', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Official Superbee Aeronautics payslip for $month $year has been generated and downloaded.',
                style: const TextStyle(fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Document:', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        Text('Payslip_${empCode}_$month.pdf', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('File Size:', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        Text('$kb KB', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Official Template:', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        Text('Superbee Aeronautics Pvt. Ltd.', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to download payslip. Please try again.'),
            backgroundColor: Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isDownloading = false);
    }
  }

  Widget _buildLineItemRow(String name, double amount) {
    final isLop = name.contains('LOP') || name.contains('Loss of Pay');
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Text(
                name,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isLop ? FontWeight.bold : FontWeight.normal,
                  color: isLop ? const Color(0xFFDC2626) : const Color(0xFF64748B),
                ),
              ),
              if (isLop) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Unapproved Leave',
                    style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                  ),
                ),
              ],
            ],
          ),
          Text(
            isLop
                ? '-₹${NumberFormat('#,##,##0.00').format(amount)}'
                : '₹${NumberFormat('#,##,##0.00').format(amount)}',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isLop ? const Color(0xFFDC2626) : const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
        Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.receipt_long_outlined, size: 40, color: Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 16),
            const Text(
              'No Payslip Found',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 6),
            Text(
              'No payslip has been finalized for ${_monthsShort[_selectedMonth - 1]} $_selectedYear.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }
}
