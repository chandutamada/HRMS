import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class BiometricService {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;
  BiometricService._internal();

  final LocalAuthentication _auth = LocalAuthentication();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const String _keyBiometricEnabled = 'timesync_biometric_enabled';
  static const String _keyStoredIdentifier = 'timesync_bio_identifier';
  static const String _keyStoredPassword = 'timesync_bio_password';
  static const String _keyStoredEmployeeName = 'timesync_bio_emp_name';

  /// Check if hardware supports biometrics and has enrolled finger/face
  Future<bool> isBiometricAvailable() async {
    try {
      final bool canCheck = await _auth.canCheckBiometrics;
      final bool isSupported = await _auth.isDeviceSupported();
      return canCheck || isSupported;
    } on PlatformException catch (e) {
      debugPrint('Biometric availability check failed: $e');
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Check if employee has previously enabled biometric quick login
  Future<bool> isBiometricEnabled() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final bool? enabled = prefs.getBool(_keyBiometricEnabled);
      if (enabled == true) return true;

      final storedPass = await _storage.read(key: _keyStoredPassword);
      return storedPass != null && storedPass.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Save employee credentials securely for subsequent one-touch biometric logins
  Future<void> saveBiometricCredentials({
    required String identifier,
    required String password,
    String? employeeName,
  }) async {
    try {
      await _storage.write(key: _keyStoredIdentifier, value: identifier);
      await _storage.write(key: _keyStoredPassword, value: password);
      if (employeeName != null) {
        await _storage.write(key: _keyStoredEmployeeName, value: employeeName);
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_keyBiometricEnabled, true);
      await prefs.setString(_keyStoredIdentifier, identifier);
      if (employeeName != null) {
        await prefs.setString(_keyStoredEmployeeName, employeeName);
      }
    } catch (e) {
      debugPrint('Failed to save biometric credentials: $e');
    }
  }

  /// Retrieve stored credentials
  Future<Map<String, String>?> getStoredCredentials() async {
    try {
      String? id = await _storage.read(key: _keyStoredIdentifier);
      String? pass = await _storage.read(key: _keyStoredPassword);

      if (id == null || id.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        id = prefs.getString(_keyStoredIdentifier);
      }

      if (id != null && pass != null && id.isNotEmpty && pass.isNotEmpty) {
        return {'identifier': id, 'password': pass};
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Clear stored credentials on logout or if user disables biometrics
  Future<void> clearBiometricCredentials() async {
    try {
      await _storage.delete(key: _keyStoredIdentifier);
      await _storage.delete(key: _keyStoredPassword);
      await _storage.delete(key: _keyStoredEmployeeName);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_keyBiometricEnabled, false);
      await prefs.remove(_keyStoredIdentifier);
      await prefs.remove(_keyStoredEmployeeName);
    } catch (_) {}
  }

  /// Prompt system biometric fingerprint / face scanner
  Future<bool> promptBiometricAuthentication({
    String reason = 'Scan your fingerprint to log in to TimeSync',
  }) async {
    try {
      final bool authenticated = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false, // fallback to device passcode if sensor fails
          useErrorDialogs: true,
        ),
      );
      return authenticated;
    } on PlatformException catch (e) {
      debugPrint('Biometric prompt exception: ${e.code} - ${e.message}');
      return false;
    } catch (e) {
      debugPrint('Biometric error: $e');
      return false;
    }
  }

  /// Perform end-to-end quick biometric login:
  /// 1. Prompts fingerprint impression
  /// 2. If matched, logs in with stored credentials via ApiService
  /// Returns user profile map on success, or throws error
  Future<Map<String, dynamic>> performQuickBiometricLogin() async {
    final credentials = await getStoredCredentials();
    if (credentials == null) {
      throw Exception('No biometric credentials saved yet. Please sign in with your Employee ID and Password first.');
    }

    final bool bioSuccess = await promptBiometricAuthentication();
    if (!bioSuccess) {
      throw Exception('Biometric authentication was cancelled or failed.');
    }

    // Authenticate with server using stored credentials to get fresh tokens
    final response = await ApiService().dio.post(
      '/auth/login',
      data: {
        'identifier': credentials['identifier'],
        'password': credentials['password'],
      },
    );

    final data = response.data['data'];
    final tokens = data['tokens'];
    final user = data['user'];

    await ApiService().saveAuthTokens(
      tokens['accessToken'],
      tokens['refreshToken'],
    );

    if (user != null) {
      await ApiService().saveCachedUser(user as Map<String, dynamic>);
    }

    return user as Map<String, dynamic>;
  }
}
