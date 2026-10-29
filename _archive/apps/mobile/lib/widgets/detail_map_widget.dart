import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../models/tracking_models.dart';

class DetailMapWidget extends StatefulWidget {
  final List<RoutePointDto> routePoints;
  final List<CheckpointDto> checkpoints;
  final double? distanceKm;
  final String? title;

  const DetailMapWidget({
    super.key,
    required this.routePoints,
    required this.checkpoints,
    this.distanceKm,
    this.title,
  });

  @override
  State<DetailMapWidget> createState() => _DetailMapWidgetState();
}

class _DetailMapWidgetState extends State<DetailMapWidget> {
  GoogleMapController? _controller;
  MapType _mapType = MapType.normal;

  static const LatLng _bangaloreOffice = LatLng(13.04983, 77.62024);

  Set<Polyline> _buildPolylines() {
    if (widget.routePoints.length < 2) return {};

    final points = widget.routePoints.map((pt) => LatLng(pt.lat, pt.lng)).toList();

    return {
      Polyline(
        polylineId: const PolylineId('detail_route_halo'),
        points: points,
        color: const Color(0xFF1E3A8A).withValues(alpha: 0.3),
        width: 7,
        jointType: JointType.round,
        startCap: Cap.roundCap,
        endCap: Cap.roundCap,
      ),
      Polyline(
        polylineId: const PolylineId('detail_route_path'),
        points: points,
        color: const Color(0xFF2563EB),
        width: 4,
        jointType: JointType.round,
        startCap: Cap.roundCap,
        endCap: Cap.roundCap,
      ),
    };
  }

  Set<Marker> _buildMarkers() {
    final markers = <Marker>{};

    if (widget.routePoints.isNotEmpty) {
      final start = widget.routePoints.first;
      markers.add(
        Marker(
          markerId: const MarkerId('detail_start'),
          position: LatLng(start.lat, start.lng),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: InfoWindow(
            title: 'Start Point',
            snippet: DateTime.fromMillisecondsSinceEpoch(start.ts)
                .toLocal()
                .toString()
                .substring(11, 16),
          ),
        ),
      );

      final end = widget.routePoints.last;
      markers.add(
        Marker(
          markerId: const MarkerId('detail_end'),
          position: LatLng(end.lat, end.lng),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          infoWindow: InfoWindow(
            title: 'End Destination',
            snippet: DateTime.fromMillisecondsSinceEpoch(end.ts)
                .toLocal()
                .toString()
                .substring(11, 16),
          ),
        ),
      );
    }

    for (int i = 0; i < widget.checkpoints.length; i++) {
      final cp = widget.checkpoints[i];
      markers.add(
        Marker(
          markerId: MarkerId('detail_cp_$i'),
          position: LatLng(cp.lat, cp.lng),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
          infoWindow: InfoWindow(
            title: 'Stop #${cp.index ?? i + 1}',
            snippet: cp.notes ?? 'Verified Milestone',
          ),
        ),
      );
    }

    return markers;
  }

  void _fitBounds() {
    if (_controller == null || widget.routePoints.isEmpty) return;

    double minLat = widget.routePoints.first.lat;
    double maxLat = widget.routePoints.first.lat;
    double minLng = widget.routePoints.first.lng;
    double maxLng = widget.routePoints.first.lng;

    for (final pt in widget.routePoints) {
      minLat = min(minLat, pt.lat);
      maxLat = max(maxLat, pt.lat);
      minLng = min(minLng, pt.lng);
      maxLng = max(maxLng, pt.lng);
    }

    final bounds = LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );

    _controller!.animateCamera(
      CameraUpdate.newLatLngBounds(bounds, 50.0),
    );
  }

  @override
  Widget build(BuildContext context) {
    final initialPos = widget.routePoints.isNotEmpty
        ? LatLng(widget.routePoints.first.lat, widget.routePoints.first.lng)
        : _bangaloreOffice;

    return Stack(
      children: [
        GoogleMap(
          initialCameraPosition: CameraPosition(
            target: initialPos,
            zoom: 15.0,
          ),
          mapType: _mapType,
          zoomControlsEnabled: false,
          mapToolbarEnabled: false,
          polylines: _buildPolylines(),
          markers: _buildMarkers(),
          onMapCreated: (c) {
            _controller = c;
            Future.delayed(const Duration(milliseconds: 300), _fitBounds);
          },
        ),
        Positioned(
          top: 12,
          right: 12,
          child: Column(
            children: [
              FloatingActionButton.small(
                heroTag: 'detail_map_layer',
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF1E293B),
                onPressed: () {
                  setState(() {
                    _mapType = _mapType == MapType.normal
                        ? MapType.satellite
                        : MapType.normal;
                  });
                },
                child: const Icon(Icons.layers_outlined, size: 20),
              ),
              const SizedBox(height: 8),
              FloatingActionButton.small(
                heroTag: 'detail_fit_bounds',
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF1E293B),
                onPressed: _fitBounds,
                child: const Icon(Icons.fit_screen_rounded, size: 20),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
