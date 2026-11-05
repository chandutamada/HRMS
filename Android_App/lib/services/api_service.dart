import 'dart:convert';


import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../core/constants/api_constants.dart';



class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late Dio dio;
  final FlutterSecureStorage secureStorage = const FlutterSecureStorage();

  // Official production API endpoint (fallback to local dev if modified)
  static String get baseUrl => ApiConstants.baseUrl;

  static String resolveImageUrl(String? url) {
    if (url == null || url.trim().isEmpty) return '';
    final trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final serverRoot = baseUrl.replaceAll(RegExp(r'/api/?$'), '');
    final cleanPath = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '$serverRoot$cleanPath';
  }

  void updateBaseUrl(String url) async {
    dio.options.baseUrl = url;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('custom_base_url', url);
    } catch (_) {}
  }

  Future<void> initBaseUrl() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString('custom_base_url');
      if (saved != null && saved.isNotEmpty && !saved.contains('hrms.superbeeaeronautics.com')) {
        dio.options.baseUrl = saved;
      } else {
        dio.options.baseUrl = ApiConstants.baseUrl;
      }
    } catch (_) {}
  }

  ApiService._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 60),
        sendTimeout: const Duration(seconds: 60),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'bypass-tunnel-reminder': 'true',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401 && !e.requestOptions.path.contains('/auth/')) {
            // Attempt silent refresh using refresh token
            final refreshToken = await getRefreshToken();
            if (refreshToken != null && refreshToken.isNotEmpty) {
              try {
                final refreshDio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 15)));
                final res = await refreshDio.post('/auth/refresh', data: {'refreshToken': refreshToken});
                final data = res.data['data'] ?? res.data;
                final newAccess = data['accessToken'] ?? data['tokens']?['accessToken'];
                final newRefresh = data['refreshToken'] ?? data['tokens']?['refreshToken'] ?? refreshToken;
                if (newAccess != null) {
                  await saveAuthTokens(newAccess, newRefresh);
                  final clonedOptions = e.requestOptions;
                  clonedOptions.headers['Authorization'] = 'Bearer $newAccess';
                  final retryRes = await dio.fetch(clonedOptions);
                  return handler.resolve(retryRes);
                }
              } catch (_) {
                // Refresh failed; only clear if token truly revoked
              }
            }
          }
          return handler.next(e);
        },
      ),
    );
  }

  Future<void> saveAuthTokens(String accessToken, String refreshToken) async {
    try {
      await secureStorage.write(key: 'jwt_token', value: accessToken);
      await secureStorage.write(key: 'refresh_token', value: refreshToken);
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('jwt_token', accessToken);
      await prefs.setString('refresh_token', refreshToken);
    } catch (_) {}
  }

  Future<void> clearAuth() async {
    try {
      await secureStorage.deleteAll();
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('jwt_token');
      await prefs.remove('refresh_token');
      await prefs.remove('cached_user_data');
    } catch (_) {}
  }

  Future<String?> getToken() async {
    try {
      final token = await secureStorage.read(key: 'jwt_token');
      if (token != null && token.isNotEmpty) return token;
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString('jwt_token');
    } catch (_) {
      return null;
    }
  }

  Future<String?> getRefreshToken() async {
    try {
      final token = await secureStorage.read(key: 'refresh_token');
      if (token != null && token.isNotEmpty) return token;
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString('refresh_token');
    } catch (_) {
      return null;
    }
  }

  Future<void> saveCachedUser(Map<String, dynamic> user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_user_data', jsonEncode(user));
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> getCachedUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString('cached_user_data');
      if (str != null && str.isNotEmpty) {
        return jsonDecode(str) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  /// Triggers the Google Account selection sheet, extracts idToken, and logs in with backend
  Future<Map<String, dynamic>> signInWithGoogle() async {
    final googleSignIn = GoogleSignIn(
      scopes: ['email', 'profile'],
    );

    // Clear previous cached session so the account chooser dialog is presented
    try {
      await googleSignIn.signOut();
    } catch (_) {}

    final account = await googleSignIn.signIn();
    if (account == null) {
      throw Exception('Google Sign-In was cancelled by the user.');
    }

    final auth = await account.authentication;
    final idToken = auth.idToken;

    final response = await dio.post(
      '/auth/google',
      data: {
        'idToken': idToken,
        'email': account.email,
        'googleId': account.id,
        'displayName': account.displayName,
      },
    );

    final resData = response.data['data'] ?? response.data;
    final tokens = resData['tokens'];
    final user = resData['user'];

    if (tokens != null && tokens['accessToken'] != null) {
      await saveAuthTokens(
        tokens['accessToken'],
        tokens['refreshToken'] ?? '',
      );
    }

    return {
      'user': user,
      'tokens': tokens,
      'idToken': idToken,
    };
  }
}
