import 'package:flutter/material.dart';
import '../services/api_service.dart';

class EngageTab extends StatefulWidget {
  final Map<String, dynamic> userData;
  const EngageTab({super.key, required this.userData});

  @override
  State<EngageTab> createState() => _EngageTabState();
}

class _EngageTabState extends State<EngageTab> {
  List<dynamic> _circulars = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchCirculars();
  }

  Future<void> _fetchCirculars() async {
    try {
      final res = await ApiService().dio.get('/circulars');
      if (mounted) {
        setState(() {
          _circulars = res.data['data'] ?? [];
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
      appBar: AppBar(
        title: const Text('Engage & Feed', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchCirculars,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Celebrations Banner
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.celebration, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Celebrations & Kudos',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Wishing Superbee team members on achievements and work milestones!',
                              style: TextStyle(fontSize: 11, color: Color(0xFFE0E7FF)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                const Text(
                  'COMPANY ANNOUNCEMENTS & CIRCULARS',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 12),

                if (_isLoading)
                  const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
                else if (_circulars.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Center(
                      child: Text(
                        'No announcements at this time.',
                        style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                      ),
                    ),
                  )
                else
                  ..._circulars.map((c) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.campaign, size: 18, color: Color(0xFF2563EB)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  c['title'] ?? '',
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            c['content'] ?? '',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.4),
                          ),
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
