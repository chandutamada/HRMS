import 'package:flutter/material.dart';

class HolidayListScreen extends StatelessWidget {
  final Map<String, dynamic> userData;
  const HolidayListScreen({super.key, required this.userData});

  final List<Map<String, dynamic>> _holidays = const [
    {'date': '01 Jan 2026', 'day': 'Thursday', 'name': 'New Year\'s Day', 'type': 'National Holiday'},
    {'date': '26 Jan 2026', 'day': 'Monday', 'name': 'Republic Day', 'type': 'Gazetted Holiday'},
    {'date': '04 Mar 2026', 'day': 'Wednesday', 'name': 'Holi', 'type': 'Festival Holiday'},
    {'date': '20 Mar 2026', 'day': 'Friday', 'name': 'Eid-ul-Fitr', 'type': 'Festival Holiday'},
    {'date': '14 Apr 2026', 'day': 'Tuesday', 'name': 'Dr. B.R. Ambedkar Jayanti', 'type': 'State Holiday'},
    {'date': '01 May 2026', 'day': 'Friday', 'name': 'May Day / Labour Day', 'type': 'National Holiday'},
    {'date': '15 Aug 2026', 'day': 'Saturday', 'name': 'Independence Day', 'type': 'Gazetted Holiday'},
    {'date': '02 Oct 2026', 'day': 'Friday', 'name': 'Mahatma Gandhi Jayanti', 'type': 'Gazetted Holiday'},
    {'date': '20 Oct 2026', 'day': 'Tuesday', 'name': 'Dussehra / Vijaya Dashami', 'type': 'Festival Holiday'},
    {'date': '08 Nov 2026', 'day': 'Sunday', 'name': 'Diwali / Deepavali', 'type': 'Festival Holiday'},
    {'date': '25 Dec 2026', 'day': 'Friday', 'name': 'Christmas Day', 'type': 'Festival Holiday'},
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
                  'Holiday List 2026',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
          ),

          Expanded(
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
        ],
      ),
    );
  }
}
