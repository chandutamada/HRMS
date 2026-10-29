import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'services/api_service.dart';
import 'screens/login_screen.dart';
import 'screens/permissions_onboarding_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService().initBaseUrl();
  final prefs = await SharedPreferences.getInstance();
  final hasCompletedPermissions =
      prefs.getBool('has_completed_permissions_setup') ?? false;

  runApp(HRMSApp(hasCompletedPermissions: hasCompletedPermissions));
}

class HRMSApp extends StatelessWidget {
  final bool hasCompletedPermissions;
  const HRMSApp({super.key, this.hasCompletedPermissions = true});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TimeSync - Attendance Tracker',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF7C3AED),
          primary: const Color(0xFF7C3AED),
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF0F172A),
          elevation: 0,
        ),
      ),
      home: hasCompletedPermissions
          ? const LoginScreen()
          : const PermissionsOnboardingScreen(),
    );
  }
}
