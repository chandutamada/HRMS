import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class CalendarTab extends StatefulWidget {
  final Map<String, dynamic> userData;
  const CalendarTab({super.key, required this.userData});

  @override
  State<CalendarTab> createState() => _CalendarTabState();
}

class _CalendarTabState extends State<CalendarTab> {
  String _selectedOption = 'Holidays';
  final List<String> _options = ['Holidays', 'Payslips', 'Attendance', 'Office Timing'];

  Map<String, dynamic>? _calendarData;
  bool _isLoading = true;
  DateTime _currentMonth = DateTime.now();

  @override
  void initState() {
    super.initState();
    _fetchCalendarData();
  }

  Future<void> _fetchCalendarData() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService()
          .dio
          .get(
            '/calendar/view',
            queryParameters: {
              'type': _selectedOption,
              'year': _currentMonth.year,
              'month': _currentMonth.month,
            },
          )
          .timeout(const Duration(seconds: 3));
      if (mounted) {
        setState(() {
          _calendarData = res.data['data'];
        });
      }
    } catch (e) {
      // Handle gracefully
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Calendar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Dropdown above Calendar (Mandatory requirement)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Text('Calendar View:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedOption,
                          isExpanded: true,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                          items: _options.map((opt) {
                            return DropdownMenuItem<String>(
                              value: opt,
                              child: Text(opt),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _selectedOption = val);
                              _fetchCalendarData();
                            }
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Month Header
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left),
                      onPressed: () {
                        setState(() {
                          _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
                        });
                        _fetchCalendarData();
                      },
                    ),
                    Text(
                      DateFormat('MMMM yyyy').format(_currentMonth),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right),
                      onPressed: () {
                        setState(() {
                          _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
                        });
                        _fetchCalendarData();
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: ClipRRect(
                    borderRadius: BorderRadius.all(Radius.circular(4)),
                    child: LinearProgressIndicator(color: Color(0xFF16A34A)),
                  ),
                ),

              // View Specific Content
              if (_selectedOption == 'Holidays') _buildHolidaysView(),
              if (_selectedOption == 'Office Timing') _buildOfficeTimingView(),
              if (_selectedOption == 'Payslips') _buildPayslipsView(),
              if (_selectedOption == 'Attendance') _buildAttendanceView(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHolidaysView() {
    final items = _calendarData?['items'] as List<dynamic>? ?? [];
    if (items.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
        child: const Center(child: Text('No holidays scheduled this month', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)))),
      );
    }

    return Column(
      children: items.map((h) {
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFDCFCE7),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF86EFAC)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(h['name'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF14532D))),
              Text(DateFormat('d MMM').format(DateTime.parse(h['date'])), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF16A34A))),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildOfficeTimingView() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Company Scheduled Office Timing', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
          SizedBox(height: 12),
          Text('• Office Starts: 09:00 AM IST', style: TextStyle(fontSize: 12, color: Color(0xFF475569))),
          SizedBox(height: 6),
          Text('• Lunch Break: 01:00 PM – 02:00 PM', style: TextStyle(fontSize: 12, color: Color(0xFF475569))),
          SizedBox(height: 6),
          Text('• Office Ends: 05:30 PM IST', style: TextStyle(fontSize: 12, color: Color(0xFF475569))),
          SizedBox(height: 6),
          Text('• Grace Period: 30 mins (Up to 09:30 AM)', style: TextStyle(fontSize: 12, color: Color(0xFF16A34A), fontWeight: FontWeight.bold)),
          SizedBox(height: 6),
          Text('• Working Span: 8h 30m Span (7h 30m Net Work)', style: TextStyle(fontSize: 12, color: Color(0xFF475569))),
        ],
      ),
    );
  }

  Widget _buildPayslipsView() {
    final items = _calendarData?['items'] as List<dynamic>? ?? [];
    if (items.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
        child: const Center(child: Text('No payslip available for this month', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)))),
      );
    }

    return Column(
      children: items.map((p) {
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Builder(builder: (_) {
                final period = p['payrollPeriod'];
                final periodStr = (period is Map) ? '${period['month']}/${period['year']}' : (period?.toString() ?? '');
                return Text('Payslip • $periodStr', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold));
              }),
              Text('₹${p['netSalary']}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildAttendanceView() {
    final items = _calendarData?['items'] as List<dynamic>? ?? [];
    if (items.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
        child: const Center(child: Text('No attendance recorded this month', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)))),
      );
    }

    return Column(
      children: items.map((a) {
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(DateFormat('EEE, d MMM').format(DateTime.parse(a['date'])), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              Text(a['status'] ?? '', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
            ],
          ),
        );
      }).toList(),
    );
  }
}
