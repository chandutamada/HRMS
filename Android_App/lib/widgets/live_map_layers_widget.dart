import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../models/tracking_models.dart';

class LiveMapLayersWidget extends StatefulWidget {
  final LatLng? currentLocation;
  final double? accuracy;
  final double? heading;
  final List<RoutePointDto> routePoints;
  final List<CheckpointDto> checkpoints;
  final LatLng? officeLocation;
  final double officeRadiusMeters;
  final bool isTracking;

  const LiveMapLayersWidget({
    super.key,
    required this.currentLocation,
    this.accuracy,
    this.heading,
    required this.routePoints,
    required this.checkpoints,
    this.officeLocation,
    this.officeRadiusMeters = 50.0,
    required this.isTracking,
  });

  @override
  State<LiveMapLayersWidget> createState() => _LiveMapLayersWidgetState();
}

class _LiveMapLayersWidgetState extends State<LiveMapLayersWidget> {
  GoogleMapController? _mapController;
  MapType _currentMapType = MapType.normal;
  bool _followUser = true;

  // Default headquarters fallback coordinate
  static const LatLng _defaultOffice = LatLng(18.18955, 83.38711);

  @override
  void didUpdateWidget(covariant LiveMapLayersWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_followUser && widget.currentLocation != null && _mapController != null) {
      if (oldWidget.currentLocation != widget.currentLocation) {
        _animateToCurrentLocation();
      }
    }
  }

  void _animateToCurrentLocation() {
    if (widget.currentLocation == null || _mapController == null) return;
    _mapController!.animateCamera(
      CameraUpdate.newLatLng(widget.currentLocation!),
    );
  }

  Set<Polyline> _buildPolylines() {
    if (widget.routePoints.length < 2) return {};

    final points = widget.routePoints.map((pt) => LatLng(pt.lat, pt.lng)).toList();

    return {
      // Glow/border polyline for contrast
      Polyline(
        polylineId: const PolylineId('live_route_halo'),
        points: points,
        color: const Color(0xFF1E3A8A).withValues(alpha: 0.35),
        width: 8,
        jointType: JointType.round,
        startCap: Cap.roundCap,
        endCap: Cap.roundCap,
      ),
      // Vibrant main polyline
      Polyline(
        polylineId: const PolylineId('live_route_path'),
        points: points,
        color: const Color(0xFF2563EB),
        width: 5,
        jointType: JointType.round,
        startCap: Cap.roundCap,
        endCap: Cap.roundCap,
      ),
    };
  }

  Set<Circle> _buildCircles() {
    final circles = <Circle>{};

    // 1. Office Geofence Circle
    if (widget.officeLocation != null) {
      circles.add(
        Circle(
          circleId: const CircleId('office_geofence'),
          center: widget.officeLocation!,
          radius: widget.officeRadiusMeters,
          fillColor: const Color(0xFF10B981).withValues(alpha: 0.22),
          strokeColor: const Color(0xFF059669),
          strokeWidth: 2,
        ),
      );
    }

    // 2. Current GPS Accuracy Circle
    if (widget.currentLocation != null && (widget.accuracy ?? 0) > 0) {
      circles.add(
        Circle(
          circleId: const CircleId('gps_accuracy_ring'),
          center: widget.currentLocation!,
          radius: min(widget.accuracy!, 60.0),
          fillColor: const Color(0xFF3B82F6).withValues(alpha: 0.15),
          strokeColor: const Color(0xFF60A5FA).withValues(alpha: 0.6),
          strokeWidth: 1,
        ),
      );
    }

    return circles;
  }

  Set<Marker> _buildMarkers() {
    final markers = <Marker>{};

    // 1. Office Marker
    if (widget.officeLocation != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('office_anchor'),
          position: widget.officeLocation!,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueCyan),
          infoWindow: InfoWindow(
            title: 'HQ Office Geofence',
            snippet: '${widget.officeRadiusMeters.toInt()}m Compliance Zone',
          ),
        ),
      );
    }

    // 2. Start Point Marker
    if (widget.routePoints.isNotEmpty) {
      final startPt = widget.routePoints.first;
      markers.add(
        Marker(
          markerId: const MarkerId('route_start_point'),
          position: LatLng(startPt.lat, startPt.lng),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: InfoWindow(
            title: 'Session Origin',
            snippet: DateTime.fromMillisecondsSinceEpoch(startPt.ts)
                .toLocal()
                .toString()
                .substring(11, 19),
          ),
        ),
      );
    }

    // 3. Checkpoints Markers
    for (int i = 0; i < widget.checkpoints.length; i++) {
      final cp = widget.checkpoints[i];
      markers.add(
        Marker(
          markerId: MarkerId('checkpoint_${cp.index ?? i}'),
          position: LatLng(cp.lat, cp.lng),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
          infoWindow: InfoWindow(
            title: 'Milestone #${cp.index ?? i + 1}',
            snippet: cp.notes ?? 'Stationary Checkpoint',
          ),
        ),
      );
    }

    // 4. Live Position Marker
    if (widget.currentLocation != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('current_employee_loc'),
          position: widget.currentLocation!,
          icon: BitmapDescriptor.defaultMarkerWithHue(
            widget.isTracking ? BitmapDescriptor.hueAzure : BitmapDescriptor.hueViolet,
          ),
          rotation: widget.heading ?? 0.0,
          flat: true,
          anchor: const Offset(0.5, 0.5),
          infoWindow: InfoWindow(
            title: widget.isTracking ? 'Active Field Duty' : 'Current Position',
            snippet: 'Acc: ±${(widget.accuracy ?? 0).toStringAsFixed(1)}m',
          ),
        ),
      );
    }

    return markers;
  }

  void _toggleMapType() {
    setState(() {
      if (_currentMapType == MapType.normal) {
        _currentMapType = MapType.hybrid;
      } else if (_currentMapType == MapType.hybrid) {
        _currentMapType = MapType.satellite;
      } else if (_currentMapType == MapType.satellite) {
        _currentMapType = MapType.terrain;
      } else {
        _currentMapType = MapType.normal;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final initialPos = widget.currentLocation ?? widget.officeLocation ?? _defaultOffice;

    return Stack(
      children: [
        GoogleMap(
          initialCameraPosition: CameraPosition(
            target: initialPos,
            zoom: 16.5,
          ),
          mapType: _currentMapType,
          myLocationEnabled: false, // Custom markers are used for rich styling
          myLocationButtonEnabled: false,
          compassEnabled: true,
          zoomControlsEnabled: false,
          mapToolbarEnabled: false,
          polylines: _buildPolylines(),
          circles: _buildCircles(),
          markers: _buildMarkers(),
          onMapCreated: (controller) {
            _mapController = controller;
            if (widget.currentLocation != null) {
              _animateToCurrentLocation();
            }
          },
          onCameraMove: (pos) {
            // If user manually pans away, don't jerk camera back unless followUser is re-enabled
          },
        ),

        // Map Layer Controls (Type Toggle & Recenter)
        Positioned(
          top: 16,
          right: 16,
          child: Column(
            children: [
              // Map Type Toggle Button
              FloatingActionButton.small(
                heroTag: 'map_type_toggle',
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF1E293B),
                elevation: 3,
                onPressed: _toggleMapType,
                tooltip: 'Switch Map View (Normal/Satellite)',
                child: const Icon(Icons.layers_rounded, size: 20),
              ),
              const SizedBox(height: 10),

              // Re-Center & Follow Me Button
              FloatingActionButton.small(
                heroTag: 'recenter_me',
                backgroundColor: _followUser ? const Color(0xFF2563EB) : Colors.white,
                foregroundColor: _followUser ? Colors.white : const Color(0xFF1E293B),
                elevation: 3,
                onPressed: () {
                  setState(() => _followUser = !_followUser);
                  _animateToCurrentLocation();
                },
                tooltip: 'Re-center on My Location',
                child: Icon(
                  _followUser ? Icons.gps_fixed : Icons.gps_not_fixed,
                  size: 20,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
