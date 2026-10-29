class RoutePointDto {
  final double lat;
  final double lng;
  final double? alt;
  final double? speed;
  final double? accuracy;
  final double? heading;
  final int ts;

  RoutePointDto({
    required this.lat,
    required this.lng,
    this.alt,
    this.speed,
    this.accuracy,
    this.heading,
    required this.ts,
  });

  Map<String, dynamic> toJson() => {
        'lat': lat,
        'lng': lng,
        if (alt != null) 'alt': alt,
        if (speed != null) 'speed': speed,
        if (accuracy != null) 'accuracy': accuracy,
        if (heading != null) 'heading': heading,
        'ts': ts,
      };

  factory RoutePointDto.fromJson(Map<String, dynamic> json) => RoutePointDto(
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        alt: json['alt'] != null ? (json['alt'] as num).toDouble() : null,
        speed: json['speed'] != null ? (json['speed'] as num).toDouble() : null,
        accuracy: json['accuracy'] != null ? (json['accuracy'] as num).toDouble() : null,
        heading: json['heading'] != null ? (json['heading'] as num).toDouble() : null,
        ts: json['ts'] is int ? json['ts'] : int.tryParse(json['ts'].toString()) ?? 0,
      );
}

class CheckpointDto {
  final String? id;
  final double lat;
  final double lng;
  final int arrivedAt;
  final int? departedAt;
  final int? index;
  final String? notes;

  CheckpointDto({
    this.id,
    required this.lat,
    required this.lng,
    required this.arrivedAt,
    this.departedAt,
    this.index,
    this.notes,
  });

  CheckpointDto copyWith({
    String? id,
    double? lat,
    double? lng,
    int? arrivedAt,
    int? departedAt,
    int? index,
    String? notes,
  }) =>
      CheckpointDto(
        id: id ?? this.id,
        lat: lat ?? this.lat,
        lng: lng ?? this.lng,
        arrivedAt: arrivedAt ?? this.arrivedAt,
        departedAt: departedAt ?? this.departedAt,
        index: index ?? this.index,
        notes: notes ?? this.notes,
      );

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'lat': lat,
        'lng': lng,
        'arrivedAt': arrivedAt,
        if (departedAt != null) 'departedAt': departedAt,
        if (index != null) 'index': index,
        if (notes != null) 'notes': notes,
      };

  factory CheckpointDto.fromJson(Map<String, dynamic> json) => CheckpointDto(
        id: json['id'] as String?,
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        arrivedAt: json['arrivedAt'] is int
            ? json['arrivedAt']
            : int.tryParse(json['arrivedAt'].toString()) ?? 0,
        departedAt: json['departedAt'] != null
            ? (json['departedAt'] is int
                ? json['departedAt']
                : int.tryParse(json['departedAt'].toString()))
            : null,
        index: json['index'] as int?,
        notes: json['notes'] as String?,
      );
}

class SessionSyncRequest {
  final String id;
  final int startTime;
  final int? endTime;
  final double distanceKm;
  final String? areaName;
  final String? state;
  final String? employeeId;
  final String? notes;
  final List<RoutePointDto> routePoints;
  final List<CheckpointDto> checkpoints;

  SessionSyncRequest({
    required this.id,
    required this.startTime,
    this.endTime,
    required this.distanceKm,
    this.areaName,
    this.state,
    this.employeeId,
    this.notes,
    required this.routePoints,
    required this.checkpoints,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'startTime': startTime,
        if (endTime != null) 'endTime': endTime,
        'distanceKm': distanceKm,
        if (areaName != null) 'areaName': areaName,
        if (state != null) 'state': state,
        if (employeeId != null) 'employeeId': employeeId,
        if (notes != null) 'notes': notes,
        'routePoints': routePoints.map((e) => e.toJson()).toList(),
        'checkpoints': checkpoints.map((e) => e.toJson()).toList(),
      };

  factory SessionSyncRequest.fromJson(Map<String, dynamic> json) => SessionSyncRequest(
        id: json['id'] as String,
        startTime: json['startTime'] is int
            ? json['startTime']
            : int.tryParse(json['startTime'].toString()) ?? 0,
        endTime: json['endTime'] != null
            ? (json['endTime'] is int
                ? json['endTime']
                : int.tryParse(json['endTime'].toString()))
            : null,
        distanceKm: (json['distanceKm'] as num).toDouble(),
        areaName: json['areaName'] as String?,
        state: json['state'] as String?,
        employeeId: json['employeeId'] as String?,
        notes: json['notes'] as String?,
        routePoints: (json['routePoints'] as List<dynamic>?)
                ?.map((e) => RoutePointDto.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        checkpoints: (json['checkpoints'] as List<dynamic>?)
                ?.map((e) => CheckpointDto.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class SessionSyncResponse {
  final bool success;
  final String sessionId;
  final double distanceKm;
  final bool isOfficeHours;
  final int routePointsCount;
  final int checkpointsCount;
  final String? message;

  SessionSyncResponse({
    required this.success,
    required this.sessionId,
    required this.distanceKm,
    required this.isOfficeHours,
    required this.routePointsCount,
    required this.checkpointsCount,
    this.message,
  });

  factory SessionSyncResponse.fromJson(Map<String, dynamic> json) => SessionSyncResponse(
        success: json['success'] as bool? ?? false,
        sessionId: json['sessionId'] as String? ?? '',
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0.0,
        isOfficeHours: json['isOfficeHours'] as bool? ?? true,
        routePointsCount: json['routePointsCount'] as int? ?? 0,
        checkpointsCount: json['checkpointsCount'] as int? ?? 0,
        message: json['message'] as String?,
      );
}

class LivePingRequest {
  final double latitude;
  final double longitude;
  final double? accuracy;
  final double? altitude;
  final double? speed;
  final double? heading;
  final bool? isMoving;
  final double? batteryLevel;

  LivePingRequest({
    required this.latitude,
    required this.longitude,
    this.accuracy,
    this.altitude,
    this.speed,
    this.heading,
    this.isMoving,
    this.batteryLevel,
  });

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        if (accuracy != null) 'accuracy': accuracy,
        if (altitude != null) 'altitude': altitude,
        if (speed != null) 'speed': speed,
        if (heading != null) 'heading': heading,
        if (isMoving != null) 'isMoving': isMoving,
        if (batteryLevel != null) 'batteryLevel': batteryLevel,
      };
}

class LivePingResponse {
  final bool success;
  final bool isWithinOfficeHours;
  final bool isWithinGeofence;
  final double? distanceToOfficeMeters;
  final String? message;

  LivePingResponse({
    required this.success,
    required this.isWithinOfficeHours,
    required this.isWithinGeofence,
    this.distanceToOfficeMeters,
    this.message,
  });

  factory LivePingResponse.fromJson(Map<String, dynamic> json) {
    final meta = json['meta'] as Map<String, dynamic>?;
    return LivePingResponse(
      success: json['success'] as bool? ?? true,
      isWithinOfficeHours: meta?['isWithinOfficeHours'] as bool? ?? true,
      isWithinGeofence: meta?['isWithinGeofence'] as bool? ?? false,
      distanceToOfficeMeters: (meta?['distanceToOfficeMeters'] as num?)?.toDouble(),
      message: json['message'] as String?,
    );
  }
}

class TrackingSessionModel {
  final String id;
  final String? userId;
  final String? employeeId;
  final DateTime startTime;
  final DateTime? endTime;
  final double distanceKm;
  final String? areaName;
  final String? state;
  final bool isOfficeHours;
  final List<RoutePointDto> routePoints;
  final List<CheckpointDto> checkpoints;

  TrackingSessionModel({
    required this.id,
    this.userId,
    this.employeeId,
    required this.startTime,
    this.endTime,
    required this.distanceKm,
    this.areaName,
    this.state,
    required this.isOfficeHours,
    required this.routePoints,
    required this.checkpoints,
  });

  factory TrackingSessionModel.fromJson(Map<String, dynamic> json) => TrackingSessionModel(
        id: json['id'] as String,
        userId: json['userId'] as String?,
        employeeId: json['employeeId'] as String?,
        startTime: DateTime.tryParse(json['startTime'].toString()) ?? DateTime.now(),
        endTime: json['endTime'] != null ? DateTime.tryParse(json['endTime'].toString()) : null,
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0.0,
        areaName: json['areaName'] as String?,
        state: json['state'] as String?,
        isOfficeHours: json['isOfficeHours'] as bool? ?? true,
        routePoints: (json['routePoints'] as List<dynamic>?)
                ?.map((e) => RoutePointDto.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        checkpoints: (json['checkpoints'] as List<dynamic>?)
                ?.map((e) => CheckpointDto.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}
