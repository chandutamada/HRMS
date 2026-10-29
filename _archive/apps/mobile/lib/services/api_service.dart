import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late Dio dio;
  final FlutterSecureStorage secureStorage = const FlutterSecureStorage();

  // Android physical devices use USB port reverse (localhost) or PC's Wi-Fi IP (172.16.200.156); emulators use 10.0.2.2
  static String get baseUrl {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://172.16.200.156:4000/api';
    }
    return 'http://localhost:4000/api';
  }

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
      if (saved != null && saved.isNotEmpty) {
        dio.options.baseUrl = saved;
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
          if (e.response?.statusCode == 401) {
            await clearAuth();
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
}
