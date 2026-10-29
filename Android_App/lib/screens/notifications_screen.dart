import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class NotificationsScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const NotificationsScreen({super.key, required this.userData});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = true;
  String _selectedFilter = 'ALL'; // ALL, UNREAD, CELEBRATION, LEAVE
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
    _pollingTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (mounted) _fetchNotifications(isSilent: true);
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchNotifications({bool isSilent = false}) async {
    if (!isSilent) setState(() => _isLoading = true);
    try {
      final res = await ApiService()
          .dio
          .get('/notifications')
          .timeout(const Duration(seconds: 4));

      final data = res.data['data'] ?? res.data;
      final notifs = data['notifications'] as List<dynamic>? ?? [];
      final count = data['unreadCount'] as int? ?? 0;

      if (mounted) {
        setState(() {
          _notifications = notifs;
          _unreadCount = count;
        });
      }
    } catch (_) {
    } finally {
      if (mounted && !isSilent) setState(() => _isLoading = false);
    }
  }

  Future<void> _markAsRead(String id, int index) async {
    try {
      await ApiService().dio.patch('/notifications/$id/read');
      if (mounted) {
        setState(() {
          _notifications[index]['isRead'] = true;
          if (_unreadCount > 0) _unreadCount--;
        });
      }
    } catch (_) {}
  }

  Future<void> _markAllAsRead() async {
    try {
      await ApiService().dio.put('/notifications/read-all');
      if (mounted) {
        setState(() {
          for (var n in _notifications) {
            n['isRead'] = true;
          }
          _unreadCount = 0;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All notifications marked as read')),
        );
      }
    } catch (_) {}
  }

  List<dynamic> get _filteredNotifications {
    if (_selectedFilter == 'UNREAD') {
      return _notifications.where((n) => n['isRead'] != true).toList();
    } else if (_selectedFilter == 'LEAVE') {
      return _notifications.where((n) => n['type'] == 'LEAVE' || (n['title'] ?? '').toString().contains('Leave')).toList();
    } else if (_selectedFilter == 'CELEBRATION') {
      return _notifications.where((n) =>
          (n['title'] ?? '').toString().toLowerCase().contains('birthday') ||
          (n['title'] ?? '').toString().toLowerCase().contains('celebration') ||
          (n['message'] ?? '').toString().toLowerCase().contains('celebration')).toList();
    }
    return _notifications;
  }

  Color _getBadgeColor(String type, String title) {
    final lowerTitle = title.toLowerCase();
    if (lowerTitle.contains('birthday') || lowerTitle.contains('celebration')) {
      return const Color(0xFFF59E0B);
    }
    if (type == 'LEAVE' || lowerTitle.contains('approved')) {
      return const Color(0xFF10B981);
    }
    if (type == 'ATTENDANCE' || lowerTitle.contains('breach')) {
      return const Color(0xFFEF4444);
    }
    if (type == 'CIRCULAR') {
      return const Color(0xFF3B82F6);
    }
    return const Color(0xFF6366F1);
  }

  IconData _getBadgeIcon(String type, String title) {
    final lowerTitle = title.toLowerCase();
    if (lowerTitle.contains('birthday') || lowerTitle.contains('celebration')) {
      return Icons.cake_rounded;
    }
    if (type == 'LEAVE' || lowerTitle.contains('approved')) {
      return Icons.check_circle_rounded;
    }
    if (type == 'ATTENDANCE' || lowerTitle.contains('breach')) {
      return Icons.warning_amber_rounded;
    }
    if (type == 'CIRCULAR') {
      return Icons.campaign_rounded;
    }
    return Icons.notifications_rounded;
  }

  String _formatTimestamp(String? iso) {
    if (iso == null || iso.isEmpty) return 'Just now';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('d MMM, hh:mm a').format(dt);
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = _filteredNotifications;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Row(
          children: [
            const Text(
              'Notifications',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            if (_unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$_unreadCount new',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
            ],
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (_unreadCount > 0)
            TextButton.icon(
              onPressed: _markAllAsRead,
              icon: const Icon(Icons.done_all_rounded, size: 16, color: Color(0xFF2563EB)),
              label: const Text('Mark all read', style: TextStyle(fontSize: 12, color: Color(0xFF2563EB))),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filter Chips
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('All (${_notifications.length})', 'ALL'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Unread ($_unreadCount)', 'UNREAD'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Celebrations', 'CELEBRATION'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Leave Status', 'LEAVE'),
                  ],
                ),
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // Content List
            Expanded(
              child: RefreshIndicator(
                onRefresh: _fetchNotifications,
                child: _isLoading && _notifications.isEmpty
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF581C87)))
                    : list.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                              Center(
                                child: Column(
                                  children: [
                                    Icon(Icons.notifications_none_rounded, size: 54, color: Colors.grey.shade400),
                                    const SizedBox(height: 12),
                                    Text(
                                      _selectedFilter == 'UNREAD'
                                          ? 'You have caught up with all notifications!'
                                          : 'No notifications in this category yet',
                                      style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.all(14),
                            itemCount: list.length,
                            itemBuilder: (ctx, idx) {
                              final item = list[idx];
                              final isRead = item['isRead'] == true;
                              final type = item['type']?.toString() ?? 'SYSTEM';
                              final title = item['title']?.toString() ?? 'Notification';
                              final message = item['message']?.toString() ?? '';
                              final time = _formatTimestamp(item['createdAt']?.toString());
                              final badgeColor = _getBadgeColor(type, title);
                              final badgeIcon = _getBadgeIcon(type, title);

                              return Container(
                                margin: const EdgeInsets.only(bottom: 10),
                                decoration: BoxDecoration(
                                  color: isRead ? Colors.white : const Color(0xFFF0FDF4),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: isRead ? const Color(0xFFE2E8F0) : const Color(0xFF86EFAC),
                                    width: isRead ? 1 : 1.5,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.02),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: InkWell(
                                  onTap: () {
                                    if (!isRead && item['id'] != null) {
                                      _markAsRead(item['id'].toString(), idx);
                                    }
                                  },
                                  borderRadius: BorderRadius.circular(16),
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        // Left Icon
                                        Container(
                                          width: 38,
                                          height: 38,
                                          decoration: BoxDecoration(
                                            color: badgeColor.withValues(alpha: 0.12),
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(badgeIcon, color: badgeColor, size: 20),
                                        ),
                                        const SizedBox(width: 12),
                                        // Text Content
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
                                                      style: TextStyle(
                                                        fontSize: 13.5,
                                                        fontWeight: isRead ? FontWeight.w600 : FontWeight.bold,
                                                        color: const Color(0xFF0F172A),
                                                      ),
                                                    ),
                                                  ),
                                                  if (!isRead)
                                                    Container(
                                                      width: 8,
                                                      height: 8,
                                                      decoration: const BoxDecoration(
                                                        color: Color(0xFF10B981),
                                                        shape: BoxShape.circle,
                                                      ),
                                                    ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                message,
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  color: Color(0xFF475569),
                                                  height: 1.35,
                                                ),
                                              ),
                                              const SizedBox(height: 8),
                                              Row(
                                                children: [
                                                  const Icon(Icons.access_time_rounded, size: 12, color: Color(0xFF94A3B8)),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    time,
                                                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
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
    );
  }

  Widget _buildFilterChip(String label, String code) {
    final isSelected = _selectedFilter == code;
    return InkWell(
      onTap: () => setState(() => _selectedFilter = code),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF581C87) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}
