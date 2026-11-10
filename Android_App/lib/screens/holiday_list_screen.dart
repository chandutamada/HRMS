import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class HolidayListScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const HolidayListScreen({super.key, required this.userData});

  @override
  State<HolidayListScreen> createState() => _HolidayListScreenState();
}

class _HolidayListScreenState extends State<HolidayListScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _holidays = [];
  final int _currentYear = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    _fetchHolidays();
  }

  Future<void> _fetchHolidays() async {
    setState(() => _isLoading = true);

    try {
      final res = await ApiService()
          .dio
          .get('/calendar/holidays', queryParameters: {'year': _currentYear})
          .timeout(const Duration(seconds: 10));

      final raw = res.data;
      List<dynamic> items = [];
      if (raw is Map && raw['data'] is List) {
        items = raw['data'];
      } else if (raw is List) {
        items = raw;
      }

      final List<Map<String, dynamic>> parsed = [];
      for (final h in items) {
        final name = h['name']?.toString() ?? 'Holiday';
        final isOpt = h['isOptional'] == true;
        final rawDate = h['date']?.toString();

        DateTime? dt;
        if (rawDate != null) {
          dt = DateTime.tryParse(rawDate);
        }

        final dateFormatted = dt != null ? DateFormat('dd MMM yyyy').format(dt) : 'Upcoming';
        final dayFormatted = dt != null ? DateFormat('EEEE').format(dt) : 'Weekday';

        parsed.add({
          'name': name,
          'date': dateFormatted,
          'day': dayFormatted,
          'type': isOpt ? 'Restricted Holiday' : 'Gazetted Holiday',
        });
      }

      if (mounted) {
        setState(() {
          _holidays = parsed;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
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
                Text(
                  'Holiday List $_currentYear',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
          ),

          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF7C3AED)),
                  )
                : _holidays.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.event_busy_rounded, size: 48, color: Colors.grey.shade400),
                            const SizedBox(height: 12),
                            Text(
                              'No holidays listed for $_currentYear',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Holidays published by HR will appear here.',
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: const Color(0xFF7C3AED),
                        onRefresh: _fetchHolidays,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _holidays.length,
                          itemBuilder: (ctx, idx) {
                            final h = _holidays[idx];
                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF3E8FF),
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: const Icon(Icons.event_available_rounded, color: Color(0xFF7C3AED), size: 24),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(h['name'], style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                                        const SizedBox(height: 3),
                                        Text('${h['day']} • ${h['type']}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      h['date'],
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF334155), fontFamily: 'monospace'),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
