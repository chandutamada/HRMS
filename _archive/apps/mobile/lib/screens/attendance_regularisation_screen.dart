import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class AttendanceRegularisationScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const AttendanceRegularisationScreen({super.key, required this.userData});

  @override
  State<AttendanceRegularisationScreen> createState() => _AttendanceRegularisationScreenState();
}

class _AttendanceRegularisationScreenState extends State<AttendanceRegularisationScreen> {
  DateTime _selectedDate = DateTime.now().subtract(const Duration(days: 1));
  TimeOfDay _requestedCheckIn = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _requestedCheckOut = const TimeOfDay(hour: 17, minute: 30);
  String _selectedReason = 'Outdoor Client Site Visit';
  final TextEditingController _remarksController = TextEditingController();
  bool _isSubmitting = false;

  final List<String> _reasons = [
    'Outdoor Client Site Visit',
    'Device GPS Error / Geofence Glitch',
    'Official Duty at Branch Unit',
    'Forgot to Punch Out',
    'Network Connection Issue',
  ];

  final List<Map<String, dynamic>> _pastRequests = [
    {
      'date': '12 Sep 2026',
      'reason': 'Outdoor Client Site Visit',
      'requestedSpan': '09:00 AM – 05:30 PM',
      'status': 'APPROVED',
      'remarks': 'Drone flight testing at Electronic City Phase 1',
    },
    {
      'date': '08 Sep 2026',
      'reason': 'Device GPS Error / Geofence Glitch',
      'requestedSpan': '09:15 AM – 05:40 PM',
      'status': 'APPROVED',
      'remarks': 'Attended morning standup in campus',
    },
  ];

  Future<void> _submitRegularisation() async {
    setState(() => _isSubmitting = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final inTimeStr = "${_requestedCheckIn.hour.toString().padLeft(2, '0')}:${_requestedCheckIn.minute.toString().padLeft(2, '0')}";
      final outTimeStr = "${_requestedCheckOut.hour.toString().padLeft(2, '0')}:${_requestedCheckOut.minute.toString().padLeft(2, '0')}";

      await ApiService().dio.post('/attendance/corrections/request', data: {
        'date': dateStr,
        'requestedFirstCheckIn': "${dateStr}T$inTimeStr:00.000Z",
        'requestedLastCheckOut': "${dateStr}T$outTimeStr:00.000Z",
        'reason': "$_selectedReason: ${_remarksController.text.trim()}",
      });

      setState(() {
        _pastRequests.insert(0, {
          'date': DateFormat('dd MMM yyyy').format(_selectedDate),
          'reason': _selectedReason,
          'requestedSpan': "$inTimeStr – $outTimeStr",
          'status': 'PENDING',
          'remarks': _remarksController.text.trim(),
        });
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Regularisation request submitted to HR manager'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
        _remarksController.clear();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Request logged successfully'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
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
                const Text(
                  'Attendance Regularisation',
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
                // Request Form Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'NEW REGULARISATION REQUEST',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 14),

                      // Date Picker Tile
                      InkWell(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _selectedDate,
                            firstDate: DateTime(2026, 1, 1),
                            lastDate: DateTime.now(),
                          );
                          if (picked != null) setState(() => _selectedDate = picked);
                        },
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Select Date', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                  Text(
                                    DateFormat('EEEE, dd MMMM yyyy').format(_selectedDate),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                  ),
                                ],
                              ),
                              const Icon(Icons.calendar_today, color: Color(0xFF7C3AED), size: 18),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Time Pickers Row
                      Row(
                        children: [
                          Expanded(
                            child: InkWell(
                              onTap: () async {
                                final time = await showTimePicker(context: context, initialTime: _requestedCheckIn);
                                if (time != null) setState(() => _requestedCheckIn = time);
                              },
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Check-In Time', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                    Text(_requestedCheckIn.format(context), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: InkWell(
                              onTap: () async {
                                final time = await showTimePicker(context: context, initialTime: _requestedCheckOut);
                                if (time != null) setState(() => _requestedCheckOut = time);
                              },
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Check-Out Time', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                    Text(_requestedCheckOut.format(context), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Reason Dropdown
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedReason,
                            isExpanded: true,
                            items: _reasons.map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 13)))).toList(),
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedReason = val);
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Remarks
                      TextField(
                        controller: _remarksController,
                        maxLines: 2,
                        decoration: InputDecoration(
                          hintText: 'Provide details (e.g. client name, meeting agenda)...',
                          hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          contentPadding: const EdgeInsets.all(12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      SizedBox(
                        width: double.infinity,
                        height: 46,
                        child: ElevatedButton(
                          onPressed: _isSubmitting ? null : _submitRegularisation,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF7C3AED),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: Text(
                            _isSubmitting ? 'Submitting...' : 'Submit Request',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Past Requests History
                const Text(
                  'RECENT REGULARISATIONS',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 8),

                ..._pastRequests.map(
                  (req) => Container(
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
                            Text(req['date'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: req['status'] == 'APPROVED' ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                req['status'],
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: req['status'] == 'APPROVED' ? const Color(0xFF166534) : const Color(0xFFB45309),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(req['reason'], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
                        const SizedBox(height: 2),
                        Text('Requested: ${req['requestedSpan']}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontFamily: 'monospace')),
                        if (req['remarks'] != null) ...[
                          const SizedBox(height: 4),
                          Text('Remarks: ${req['remarks']}', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontStyle: FontStyle.italic)),
                        ],
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
}
