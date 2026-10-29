import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'api_service.dart';

class GoogleAuthService {
  static final GoogleAuthService _instance = GoogleAuthService._internal();
  factory GoogleAuthService() => _instance;
  GoogleAuthService._internal();

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  /// Triggers the native Android Google Account Picker sheet
  Future<GoogleSignInAccount?> promptGoogleAccount() async {
    try {
      // Disconnect any previous cached session so account picker always opens
      try {
        await _googleSignIn.signOut();
      } catch (_) {}

      final account = await _googleSignIn.signIn();
      return account;
    } catch (e) {
      debugPrint('Google Sign-In Native Prompt Error: $e');
      rethrow;
    }
  }

  /// Complete authentication flow with the HRMS backend
  Future<Map<String, dynamic>> authenticateWithBackend({
    String? email,
    String? idToken,
    String? googleId,
    String? displayName,
  }) async {
    final response = await ApiService().dio.post(
      '/auth/google',
      data: {
        if (idToken != null) 'idToken': idToken,
        if (email != null && email.isNotEmpty) 'email': email.trim().toLowerCase(),
        if (googleId != null) 'googleId': googleId,
        if (displayName != null) 'displayName': displayName,
      },
    );

    final data = response.data['data'];
    final tokens = data['tokens'];
    final user = data['user'];

    // Persist session tokens
    await ApiService().saveAuthTokens(
      tokens['accessToken'],
      tokens['refreshToken'],
    );

    return {
      'user': user,
      'tokens': tokens,
    };
  }

  /// Sign out from Google
  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
    } catch (_) {}
  }
}
