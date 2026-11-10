import 'package:flutter/material.dart';

class OrgStructureScreen extends StatelessWidget {
  final Map<String, dynamic> userData;
  const OrgStructureScreen({super.key, required this.userData});

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
                  'My Team & Org Structure',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Reporting Manager Card
                const Text(
                  'REPORTING MANAGER',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 8),
                _buildOrgCard(
                  name: 'HR Administration',
                  role: 'HR Lead & Operations Head',
                  dept: 'Superbee Aeronautics Pvt. Ltd.',
                  email: 'hr@gramtarang.org',
                  isManager: true,
                ),
                const SizedBox(height: 20),

                // Department Colleagues
                const Text(
                  'DEPARTMENT COLLEAGUES',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 8),
                _buildOrgCard(
                  name: 'Venkat',
                  role: 'Flight Operations & Field Specialist',
                  dept: 'Drone Operations',
                  email: 'venkat@gramtarang.org',
                  isManager: false,
                ),
                const SizedBox(height: 10),
                _buildOrgCard(
                  name: 'Ram',
                  role: 'Aeronautical & Embedded Engineer',
                  dept: 'Aeronautical Engineering',
                  email: 'venkataramireddycse@gmail.com',
                  isManager: false,
                ),
                const SizedBox(height: 10),
                _buildOrgCard(
                  name: 'T Chandu',
                  role: 'Technical Operations Lead',
                  dept: 'Flight Field Operations',
                  email: 'chandutamada4@gmail.com',
                  isManager: false,
                ),
                const SizedBox(height: 10),
                _buildOrgCard(
                  name: 'Manoj Kumar',
                  role: 'Field Operations Specialist',
                  dept: 'Field Operations',
                  email: 'manoj.kumar@gtids.in',
                  isManager: false,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrgCard({
    required String name,
    required String role,
    required String dept,
    required String email,
    required bool isManager,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isManager ? const Color(0xFF7C3AED) : const Color(0xFFE2E8F0),
          width: isManager ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: isManager ? const Color(0xFF7C3AED) : const Color(0xFFE0F2FE),
            child: Text(
              name.substring(0, 1),
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isManager ? Colors.white : const Color(0xFF0369A1),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                    if (isManager)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3E8FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('MANAGER', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED))),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(role, style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
                const SizedBox(height: 2),
                Text('$dept • $email', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
