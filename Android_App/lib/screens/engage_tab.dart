import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'notifications_screen.dart';

class EngageTab extends StatefulWidget {
  final Map<String, dynamic> userData;
  const EngageTab({super.key, required this.userData});

  @override
  State<EngageTab> createState() => _EngageTabState();
}

class _EngageTabState extends State<EngageTab> {
  List<dynamic> _feedItems = [];
  List<dynamic> _birthdays = [];
  Map<String, dynamic>? _thought;
  int _unreadNotifsCount = 0;
  bool _isLoading = true;
  Timer? _liveFeedTimer;

  @override
  void initState() {
    super.initState();
    _loadAllEngageData();
    // Auto-poll every 5 seconds so live celebrations/announcements posted by HR appear immediately
    _liveFeedTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) _loadAllEngageData(isSilent: true);
    });
  }

  @override
  void dispose() {
    _liveFeedTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadAllEngageData({bool isSilent = false}) async {
    if (!isSilent) setState(() => _isLoading = true);

    try {
      final results = await Future.wait([
        ApiService().dio.get('/notifications/feed').catchError((_) => null as dynamic),
        ApiService().dio.get('/notifications/birthdays').catchError((_) => null as dynamic),
        ApiService().dio.get('/notifications/thought').catchError((_) => null as dynamic),
        ApiService().dio.get('/notifications/unread-count').catchError((_) => null as dynamic),
      ]);

      if (mounted) {
        setState(() {
          // Feed
          final feedRes = results[0];
          if (feedRes.data != null) {
            _feedItems = (feedRes.data['data'] ?? feedRes.data) as List<dynamic>? ?? [];
          }

          // Birthdays
          final bdayRes = results[1];
          if (bdayRes.data != null) {
            _birthdays = (bdayRes.data['data'] ?? bdayRes.data) as List<dynamic>? ?? [];
          }

          // Thought of the Day
          final thoughtRes = results[2];
          if (thoughtRes.data != null) {
            final tData = thoughtRes.data['data'] ?? thoughtRes.data;
            if (tData is Map<String, dynamic>) {
              _thought = tData;
            }
          }

          // Unread Notifications Count
          final unreadRes = results[3];
          if (unreadRes.data != null) {
            final uData = unreadRes.data['data'] ?? unreadRes.data;
            _unreadNotifsCount = (uData is Map ? uData['count'] : uData) as int? ?? 0;
          }

          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted && !isSilent) setState(() => _isLoading = false);
    }
  }

  String _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return 'Recent';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('d MMM, hh:mm a').format(dt);
    } catch (_) {
      return iso;
    }
  }

  Color _getFeedBorderColor(String type, String title) {
    final lowerTitle = title.toLowerCase();
    final lowerType = type.toLowerCase();
    if (lowerType == 'birthday' || lowerTitle.contains('birthday') || lowerTitle.contains('celebration')) {
      return const Color(0xFFF59E0B); // Amber/Gold celebration
    }
    if (lowerType == 'info' || lowerTitle.contains('approved') || lowerTitle.contains('leave')) {
      return const Color(0xFF10B981); // Emerald green leave
    }
    if (lowerType == 'alert' || lowerTitle.contains('breach') || lowerTitle.contains('warning')) {
      return const Color(0xFFEF4444); // Crimson alert
    }
    return const Color(0xFF3B82F6); // Blue announcement
  }

  Color _getFeedBgColor(String type, String title) {
    final lowerTitle = title.toLowerCase();
    final lowerType = type.toLowerCase();
    if (lowerType == 'birthday' || lowerTitle.contains('birthday') || lowerTitle.contains('celebration')) {
      return const Color(0xFFFFFBEB);
    }
    if (lowerType == 'info' || lowerTitle.contains('approved') || lowerTitle.contains('leave')) {
      return const Color(0xFFF0FDF4);
    }
    if (lowerType == 'alert' || lowerTitle.contains('breach') || lowerTitle.contains('warning')) {
      return const Color(0xFFFEF2F2);
    }
    return const Color(0xFFF8FAFC);
  }

  IconData _getFeedIcon(String type, String title) {
    final lowerTitle = title.toLowerCase();
    final lowerType = type.toLowerCase();
    if (lowerType == 'birthday' || lowerTitle.contains('birthday') || lowerTitle.contains('celebration')) {
      return Icons.cake_rounded;
    }
    if (lowerType == 'info' || lowerTitle.contains('approved') || lowerTitle.contains('leave')) {
      return Icons.check_circle_rounded;
    }
    if (lowerType == 'alert' || lowerTitle.contains('breach') || lowerTitle.contains('warning')) {
      return Icons.warning_amber_rounded;
    }
    return Icons.campaign_rounded;
  }

  String _getFeedBadgeLabel(String type, String title) {
    final lowerTitle = title.toLowerCase();
    final lowerType = type.toLowerCase();
    if (lowerType == 'birthday' || lowerTitle.contains('birthday') || lowerTitle.contains('celebration')) {
      return 'CELEBRATION';
    }
    if (lowerType == 'info' || lowerTitle.contains('approved') || lowerTitle.contains('leave')) {
      return 'LEAVE UPDATE';
    }
    if (lowerType == 'alert' || lowerTitle.contains('breach')) {
      return 'ALERT';
    }
    return 'ANNOUNCEMENT';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Engage & Celebrations',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          // Notification Bell with live unread badge
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: Color(0xFF334155), size: 24),
                tooltip: 'Notifications',
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => NotificationsScreen(userData: widget.userData),
                    ),
                  );
                  _loadAllEngageData(isSilent: true);
                },
              ),
              if (_unreadNotifsCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Color(0xFFEF4444),
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '$_unreadNotifsCount',
                      style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _loadAllEngageData(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. THOUGHT OF THE DAY (matching Web Portal)
                if (_thought != null && (_thought!['thought'] ?? '').toString().isNotEmpty)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 18),
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F172A).withValues(alpha: 0.15),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFBBF24).withValues(alpha: 0.2),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.lightbulb_outline_rounded, color: Color(0xFFFBBF24), size: 18),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'THOUGHT OF THE DAY',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.0,
                                color: Color(0xFFFBBF24),
                              ),
                            ),
                            const Spacer(),
                            if (_thought!['date'] != null)
                              Text(
                                _thought!['date'].toString(),
                                style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '“${_thought!['thought']}”',
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w500,
                            fontStyle: FontStyle.italic,
                            color: Colors.white,
                            height: 1.45,
                          ),
                        ),
                        if (_thought!['author'] != null && (_thought!['author'] ?? '').toString().isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Align(
                            alignment: Alignment.centerRight,
                            child: Text(
                              '— ${_thought!['author']}',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFCBD5E1),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                // 2. UPCOMING BIRTHDAYS / CELEBRATIONS STRIP
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 18),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF581C87), Color(0xFF7C3AED)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.celebration_rounded, color: Colors.white, size: 20),
                          ),
                          const SizedBox(width: 10),
                          const Text(
                            'Team Birthday Celebrations',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              _birthdays.isEmpty ? 'Next 30 Days' : '${_birthdays.length} Upcoming',
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (_birthdays.isEmpty)
                        const Text(
                          'No team birthdays in the next 30 days. Stay tuned for work anniversaries and milestones!',
                          style: TextStyle(fontSize: 12, color: Color(0xFFE9D5FF), height: 1.35),
                        )
                      else
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: _birthdays.map((b) {
                              final isToday = b['is_today'] == true;
                              return Container(
                                margin: const EdgeInsets.only(right: 10),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: isToday ? const Color(0xFFFBBF24) : Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.cake_rounded,
                                      size: 16,
                                      color: isToday ? Colors.black87 : const Color(0xFF7C3AED),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      b['employee_name'] ?? 'Colleague',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: isToday ? Colors.black87 : const Color(0xFF0F172A),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      isToday ? '🎂 TODAY!' : 'in ${b['days_until']}d',
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w600,
                                        color: isToday ? Colors.black87 : const Color(0xFF7C3AED),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                    ],
                  ),
                ),

                // 3. LIVE ORGANIZATION FEED & CELEBRATIONS SECTION
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'LIVE ORGANIZATION FEED',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.8,
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Color(0xFF10B981),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        const Text(
                          'LIVE SYNC',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                if (_isLoading && _feedItems.isEmpty)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: CircularProgressIndicator(color: Color(0xFF581C87)),
                    ),
                  )
                else if (_feedItems.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      children: [
                        Icon(Icons.feed_outlined, size: 44, color: Colors.grey.shade400),
                        const SizedBox(height: 10),
                        const Text(
                          'No recent updates or celebrations.',
                          style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'HR announcements and birthday celebrations will appear here live.',
                          style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  )
                else
                  ..._feedItems.map((item) {
                    final type = item['type']?.toString() ?? 'system';
                    final title = item['title']?.toString() ?? 'Announcement';
                    final message = item['message']?.toString() ?? '';
                    final dateStr = _formatDate(item['created_at']?.toString() ?? item['createdAt']?.toString());
                    final borderColor = _getFeedBorderColor(type, title);
                    final bgColor = _getFeedBgColor(type, title);
                    final icon = _getFeedIcon(type, title);
                    final badgeLabel = _getFeedBadgeLabel(type, title);

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: bgColor,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: borderColor.withValues(alpha: 0.5), width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: borderColor.withValues(alpha: 0.04),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Header Row: Icon + Title + Badge
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: borderColor.withValues(alpha: 0.15),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(icon, size: 20, color: borderColor),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: Text(
                                              title,
                                              style: const TextStyle(
                                                fontSize: 14.5,
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFF0F172A),
                                              ),
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: borderColor.withValues(alpha: 0.15),
                                              borderRadius: BorderRadius.circular(8),
                                              border: Border.all(color: borderColor.withValues(alpha: 0.3)),
                                            ),
                                            child: Text(
                                              badgeLabel,
                                              style: TextStyle(
                                                fontSize: 9.5,
                                                fontWeight: FontWeight.w800,
                                                letterSpacing: 0.4,
                                                color: borderColor,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      Row(
                                        children: [
                                          const Icon(Icons.access_time_rounded, size: 12, color: Color(0xFF94A3B8)),
                                          const SizedBox(width: 4),
                                          Text(
                                            dateStr,
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Padding(
                              padding: const EdgeInsets.only(left: 4),
                              child: Text(
                                message,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF334155),
                                  height: 1.45,
                                ),
                              ),
                            ),
                          ],
                        ),
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
