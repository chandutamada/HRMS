import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/tracking_models.dart';
import 'api_service.dart';

class OfflineTrackingBuffer {
  static const String _storageKey = 'hrms_offline_route_buffer';
  static final OfflineTrackingBuffer _instance = OfflineTrackingBuffer._internal();
  factory OfflineTrackingBuffer() => _instance;
  OfflineTrackingBuffer._internal();

  final List<Map<String, dynamic>> _inMemoryBuffer = [];
  bool _isSyncing = false;

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(raw);
        _inMemoryBuffer.clear();
        for (final item in decoded) {
          if (item is Map<String, dynamic>) {
            _inMemoryBuffer.add(item);
          }
        }
      }
    } catch (e) {
      debugPrint('Failed to load offline tracking buffer: $e');
    }
  }

  int get pendingCount => _inMemoryBuffer.length;

  Future<void> addPoint(Map<String, dynamic> point) async {
    // Prevent unbounded memory growth if offline for extended days (keep last 5000 points)
    if (_inMemoryBuffer.length >= 5000) {
      _inMemoryBuffer.removeAt(0);
    }
    _inMemoryBuffer.add(point);
    await _persist();
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, jsonEncode(_inMemoryBuffer));
    } catch (e) {
      debugPrint('Failed to persist offline buffer: $e');
    }
  }

  Future<bool> flushAndSync(ApiService api, String sessionId, double totalDistanceKm) async {
    if (_inMemoryBuffer.isEmpty || _isSyncing) return true;
    _isSyncing = true;

    try {
      // Convert buffered maps to RoutePointDto
      final List<RoutePointDto> routePoints = _inMemoryBuffer.map((m) {
        return RoutePointDto(
          lat: (m['latitude'] as num).toDouble(),
          lng: (m['longitude'] as num).toDouble(),
          alt: m['altitude'] != null ? (m['altitude'] as num).toDouble() : null,
          speed: m['speed'] != null ? (m['speed'] as num).toDouble() : null,
          accuracy: m['accuracy'] != null ? (m['accuracy'] as num).toDouble() : null,
          heading: m['heading'] != null ? (m['heading'] as num).toDouble() : null,
          ts: m['timestamp'] is int ? m['timestamp'] as int : DateTime.now().millisecondsSinceEpoch,
        );
      }).toList();

      final request = SessionSyncRequest(
        id: sessionId,
        startTime: routePoints.isNotEmpty ? routePoints.first.ts : DateTime.now().millisecondsSinceEpoch,
        endTime: null,
        distanceKm: totalDistanceKm,
        areaName: 'Offline Recovered Route',
        state: 'Active',
        routePoints: routePoints,
        checkpoints: [],
      );

      // Attempt primary sync to /tracking/sessions/sync (NestJS API & Spring Boot), fallback to /sessions/sync
      final response = await api.dio.post(
        '/tracking/sessions/sync',
        data: request.toJson(),
      ).catchError((_) async {
        return await api.dio.post('/sessions/sync', data: request.toJson());
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        debugPrint('Successfully synced ${_inMemoryBuffer.length} offline points to backend.');
        _inMemoryBuffer.clear();
        await _persist();
        _isSyncing = false;
        return true;
      }
    } catch (e) {
      debugPrint('Offline sync attempt deferred (no connection): $e');
    } finally {
      _isSyncing = false;
    }

    return false;
  }

  Future<void> clear() async {
    _inMemoryBuffer.clear();
    await _persist();
  }
}
