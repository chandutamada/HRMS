import 'package:flutter/material.dart';
import 'my_calendar_screen.dart';
import 'leave_tab.dart';
import 'field_duty_screen.dart';
import 'leave_balance_screen.dart';
import 'attendance_regularisation_screen.dart';
import 'transactions_screen.dart';
import 'team_management_screen.dart';

class LeaveAttendanceHubScreen extends StatelessWidget {
  final Map<String, dynamic> userData;
  const LeaveAttendanceHubScreen({super.key, required this.userData});

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
                  'Leave & Attendance',
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
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // SELF SERVICE SECTION
                  const Text(
                    'SELF SERVICE',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 12),

                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.95,
                    children: [
                      _buildHubCard(
                        title: 'My Calendar',
                        icon: Icons.calendar_month_rounded,
                        iconColor: const Color(0xFF059669),
                        bgColor: const Color(0xFFD1FAE5),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => MyCalendarScreen(userData: userData)),
                          );
                        },
                      ),
                      _buildHubCard(
                        title: 'My Leave Balance',
                        icon: Icons.balance_rounded,
                        iconColor: const Color(0xFFD97706),
                        bgColor: const Color(0xFFFEF3C7),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => LeaveBalanceScreen(userData: userData)),
                          );
                        },
                      ),
                      _buildHubCard(
                        title: 'Apply Leave',
                        icon: Icons.edit_note_rounded,
                        iconColor: const Color(0xFFD97706),
                        bgColor: const Color(0xFFFEF3C7),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => LeaveTab(userData: userData)),
                          );
                        },
                      ),
                      _buildHubCard(
                        title: 'Attendance Regularisation',
                        icon: Icons.touch_app_rounded,
                        iconColor: const Color(0xFF0284C7),
                        bgColor: const Color(0xFFE0F2FE),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => AttendanceRegularisationScreen(userData: userData)),
                          );
                        },
                      ),
                      _buildHubCard(
                        title: 'My Attendance Transactions',
                        icon: Icons.receipt_long_rounded,
                        iconColor: const Color(0xFF0284C7),
                        bgColor: const Color(0xFFE0F2FE),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => TransactionsScreen(
                                title: 'My Attendance Transactions',
                                type: 'ATTENDANCE',
                                userData: userData,
                              ),
                            ),
                          );
                        },
                      ),
                      _buildHubCard(
                        title: 'My Leave Transactions',
                        icon: Icons.account_balance_wallet_rounded,
                        iconColor: const Color(0xFFD97706),
                        bgColor: const Color(0xFFFEF3C7),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => TransactionsScreen(
                                title: 'My Leave Transactions',
                                type: 'LEAVE',
                                userData: userData,
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // MANAGER / TEAM SECTION
                  const Text(
                    'MANAGER / TEAM',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 12),

                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.95,
                    children: [
                      _buildHubCard(
                        title: 'My Team Calendar',
                        icon: Icons.calendar_view_month_rounded,
                        iconColor: const Color(0xFF059669),
                        bgColor: const Color(0xFFD1FAE5),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => TeamManagementScreen(title: 'My Team Calendar', section: 'CALENDAR', userData: userData),
                            ),
                          );
                        },
                      ),
                      _buildHubCard(
                        title: 'My Team Leave',
                        icon: Icons.diversity_3_rounded,
                        iconColor: const Color(0xFF059669),
                        bgColor: const Color(0xFFD1FAE5),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => TeamManagementScreen(title: 'My Team Leave', section: 'LEAVE', userData: userData),
                            ),
                          );
                        },
                      ),
                      _buildHubCard(
                        title: 'My Team Attendance Regularisation',
                        icon: Icons.how_to_reg_rounded,
                        iconColor: const Color(0xFF0284C7),
                        bgColor: const Color(0xFFE0F2FE),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => TeamManagementScreen(title: 'Team Attendance Regularisation', section: 'REGULARISATION', userData: userData),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHubCard({
    required String title,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
          border: Border.all(color: const Color(0xFFF1F5F9)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
