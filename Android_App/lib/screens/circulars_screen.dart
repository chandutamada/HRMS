import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class CircularsScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const CircularsScreen({super.key, required this.userData});

  @override
  State<CircularsScreen> createState() => _CircularsScreenState();
}

class _CircularsScreenState extends State<CircularsScreen> {
  String _selectedCategory = 'All';
  List<dynamic> _circulars = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchCirculars();
  }

  Future<void> _fetchCirculars() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final res = await ApiService()
          .dio
          .get('/circulars')
          .timeout(const Duration(seconds: 5));

      final data = res.data['data'] as List<dynamic>? ?? [];
      if (mounted) {
        setState(() {
          _circulars = data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load circulars. Pull down to retry.';
        });
      }
    }
  }

  Future<void> _acknowledgeCircular(String circularId, int index) async {
    try {
      await ApiService()
          .dio
          .post('/circulars/$circularId/acknowledge')
          .timeout(const Duration(seconds: 5));

      if (mounted) {
        setState(() {
          _circulars[index]['isAcknowledged'] = true;
          _circulars[index]['acknowledgedAt'] = DateTime.now().toIso8601String();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Circular acknowledged successfully! Response recorded with HR.'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to submit acknowledgement. Please try again.'),
            backgroundColor: Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  String _formatDate(dynamic dateVal) {
    if (dateVal == null) return 'Recent';
    try {
      final dt = DateTime.parse(dateVal.toString());
      return DateFormat('dd MMM yyyy').format(dt);
    } catch (_) {
      return dateVal.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = ['All', 'Company Wide', 'HR & Admin', 'Operations'];

    final filtered = _circulars.where((c) {
      if (_selectedCategory == 'All') return true;
      final title = (c['title'] ?? '').toString().toLowerCase();
      final content = (c['content'] ?? '').toString().toLowerCase();
      if (_selectedCategory == 'HR & Admin') {
        return title.contains('hr') || content.contains('policy') || content.contains('leave');
      }
      if (_selectedCategory == 'Operations') {
        return title.contains('ops') || content.contains('uav') || content.contains('flight') || content.contains('test');
      }
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        children: [
          // Purple Gradient Header
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
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Company Circulars',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    Text(
                      'Live HR Notices • Superbee Aeronautics',
                      style: TextStyle(fontSize: 12, color: Color(0xFFE9D5FF)),
                    ),
                  ],
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${_circulars.length} Active',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),

          // Category Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: categories.map((cat) {
                final isSelected = _selectedCategory == cat;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(
                      cat,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                        color: isSelected ? Colors.white : const Color(0xFF475569),
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: const Color(0xFF7C3AED),
                    backgroundColor: Colors.white,
                    side: BorderSide(
                      color: isSelected ? const Color(0xFF7C3AED) : const Color(0xFFE2E8F0),
                    ),
                    showCheckmark: false,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    onSelected: (_) => setState(() => _selectedCategory = cat),
                  ),
                );
              }).toList(),
            ),
          ),

          // Circulars List
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF7C3AED)),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.wifi_off_rounded, color: Color(0xFF94A3B8), size: 40),
                            const SizedBox(height: 12),
                            Text(_errorMessage!, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                            const SizedBox(height: 12),
                            ElevatedButton(
                              onPressed: _fetchCirculars,
                              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
                              child: const Text('Retry', style: TextStyle(color: Colors.white)),
                            )
                          ],
                        ),
                      )
                    : filtered.isEmpty
                        ? RefreshIndicator(
                            onRefresh: _fetchCirculars,
                            child: ListView(
                              children: const [
                                SizedBox(height: 100),
                                Center(
                                  child: Text('No active circulars found for your company.',
                                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _fetchCirculars,
                            child: ListView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                              itemCount: filtered.length,
                              itemBuilder: (ctx, idx) {
                                final item = filtered[idx];
                                final isAck = item['isAcknowledged'] == true;
                                final dateStr = _formatDate(item['publishedAt'] ?? item['createdAt']);
                                final targetCodes = (item['targetCompanyCodes'] as List<dynamic>?)?.join(', ') ?? 'SUPERBEE';

                                return Container(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: isAck ? const Color(0xFFE2E8F0) : const Color(0xFFDDD6FE),
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.03),
                                        blurRadius: 6,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Material(
                                    color: Colors.transparent,
                                    borderRadius: BorderRadius.circular(16),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(16),
                                      onTap: () => _showCircularDetailsModal(item, idx),
                                      child: Padding(
                                        padding: const EdgeInsets.all(16),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            // Top Row: Target & Status
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Row(
                                                  children: [
                                                    Container(
                                                      padding: const EdgeInsets.all(6),
                                                      decoration: BoxDecoration(
                                                        color: const Color(0xFFF3E8FF),
                                                        borderRadius: BorderRadius.circular(8),
                                                      ),
                                                      child: const Icon(Icons.campaign_rounded, color: Color(0xFF7C3AED), size: 16),
                                                    ),
                                                    const SizedBox(width: 8),
                                                    Text(
                                                      'Target: $targetCodes',
                                                      style: const TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.bold,
                                                        color: Color(0xFF64748B),
                                                        letterSpacing: 0.5,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: isAck ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      if (isAck)
                                                        const Icon(Icons.check, size: 12, color: Color(0xFF16A34A)),
                                                      if (isAck) const SizedBox(width: 4),
                                                      Text(
                                                        isAck ? 'Acknowledged' : 'New Notice',
                                                        style: TextStyle(
                                                          fontSize: 10,
                                                          fontWeight: FontWeight.bold,
                                                          color: isAck ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 10),

                                            // Title
                                            Text(
                                              item['title'] ?? 'Company Notice',
                                              style: const TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFF0F172A),
                                                height: 1.3,
                                              ),
                                            ),
                                            const SizedBox(height: 6),

                                            // Summary
                                            Text(
                                              item['content'] ?? '',
                                              style: const TextStyle(
                                                fontSize: 12,
                                                color: Color(0xFF64748B),
                                                height: 1.4,
                                              ),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 12),

                                            // Footer: Date & Tap for full text
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                const Row(
                                                  children: [
                                                    Icon(Icons.business_outlined, size: 13, color: Color(0xFF94A3B8)),
                                                    SizedBox(width: 4),
                                                    Text(
                                                      'Superbee HR Admin',
                                                      style: TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.w500,
                                                        color: Color(0xFF64748B),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                                Row(
                                                  children: [
                                                    const Icon(Icons.calendar_today_outlined, size: 12, color: Color(0xFF94A3B8)),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      dateStr,
                                                      style: const TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.w600,
                                                        color: Color(0xFF475569),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ],
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
    );
  }

  void _showCircularDetailsModal(Map<String, dynamic> item, int idx) {
    final dateStr = _formatDate(item['publishedAt'] ?? item['createdAt']);
    final targetCodes = (item['targetCompanyCodes'] as List<dynamic>?)?.join(', ') ?? 'SUPERBEE';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final currentlyAck = _circulars[idx]['isAcknowledged'] == true;

            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.85,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFFCBD5E1),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Superbee Letterhead Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'SUPERBEE AERONAUTICS PVT LTD',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF581C87), letterSpacing: 0.8),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Target: $targetCodes',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: currentlyAck ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          currentlyAck ? 'Acknowledged ✓' : 'Action Required',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: currentlyAck ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),

                  // Title
                  Text(
                    item['title'] ?? '',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 8),

                  Row(
                    children: [
                      const Icon(Icons.person_pin_outlined, size: 14, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      const Text('HR Directorate', style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                      const Spacer(),
                      const Icon(Icons.calendar_month, size: 14, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(dateStr, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Full content in card
                  Expanded(
                    child: SingleChildScrollView(
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          item['content'] ?? '',
                          style: const TextStyle(fontSize: 14, height: 1.6, color: Color(0xFF334155)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            side: const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Close', style: TextStyle(color: Color(0xFF475569), fontWeight: FontWeight.bold)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            backgroundColor: currentlyAck ? const Color(0xFF16A34A) : const Color(0xFF581C87),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: currentlyAck
                              ? null
                              : () async {
                                  await _acknowledgeCircular(item['id'], idx);
                                  setModalState(() {});
                                  if (ctx.mounted) Navigator.pop(ctx);
                                },
                          icon: Icon(
                            currentlyAck ? Icons.check_circle : Icons.done_all_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                          label: Text(
                            currentlyAck ? 'Already Acknowledged' : 'Acknowledge Circular',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
