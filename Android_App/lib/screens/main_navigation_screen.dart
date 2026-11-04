import 'dart:async';
import 'package:flutter/material.dart';
import 'home_tab.dart';
import 'action_tab.dart';
import 'explore_tab.dart';
import 'engage_tab.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';

class MainNavigationScreen extends StatefulWidget {
  final Map<String, dynamic> userData;
  const MainNavigationScreen({
    super.key,
    this.userData = const {
      'employeeCode': '',
      'email': '',
      'roles': ['EMPLOYEE'],
      'employee': {}
    },
  });

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  Timer? _liveLocationTimer;

  late final List<Widget> _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = [
      HomeTab(userData: widget.userData),
      ActionTab(userData: widget.userData),
      ExploreTab(userData: widget.userData),
      EngageTab(userData: widget.userData),
    ];

    _startLiveLocationBroadcasting();
  }

  @override
  void dispose() {
    _liveLocationTimer?.cancel();
    super.dispose();
  }

  void _startLiveLocationBroadcasting() {
    // Initial device GPS ping
    _pingLiveLocation();

    // Broadcast device GPS coordinates every 20 seconds while app is active
    _liveLocationTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      _pingLiveLocation();
    });
  }

  Future<void> _pingLiveLocation() async {
    try {
      final locResult = await LocationService.getCurrentLocation();
      if (locResult.success && locResult.position != null) {
        final pos = locResult.position!;
        await ApiService().dio.post(
          '/tracking/live',
          data: {
            'latitude': pos.latitude,
            'longitude': pos.longitude,
            'accuracy': pos.accuracy,
            'altitude': pos.altitude,
            'speed': pos.speed >= 0 ? pos.speed * 3.6 : 0.0,
            'heading': pos.heading,
            'isMoving': pos.speed > 0.5,
          },
        );
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _tabs,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(
            top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() => _currentIndex = index);
          },
          backgroundColor: Colors.white,
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          selectedItemColor: const Color(0xFF2563EB),
          unselectedItemColor: const Color(0xFF94A3B8),
          selectedLabelStyle: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home_rounded),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.bolt_outlined),
              activeIcon: Icon(Icons.bolt_rounded),
              label: 'Action',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.grid_view_outlined),
              activeIcon: Icon(Icons.grid_view_rounded),
              label: 'Explore',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.sensors_outlined),
              activeIcon: Icon(Icons.sensors_rounded),
              label: 'Engage',
            ),
          ],
        ),
      ),
    );
  }
}
