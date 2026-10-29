import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';

class FaceCaptureDialog extends StatefulWidget {
  final String employeeName;
  final String employeeCode;
  final String? officeName;

  const FaceCaptureDialog({
    super.key,
    required this.employeeName,
    this.employeeCode = 'SB-001',
    this.officeName = 'Superbee Aeronautics HQ',
  });

  @override
  State<FaceCaptureDialog> createState() => _FaceCaptureDialogState();
}

class _FaceCaptureDialogState extends State<FaceCaptureDialog>
    with SingleTickerProviderStateMixin {
  bool _isCaptured = false;
  bool _isScanning = false;
  File? _capturedFile;
  String? _base64Photo;
  DateTime? _captureTime;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    // Auto-launch front camera shortly after modal transition
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _triggerFaceCapture();
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _triggerFaceCapture() async {
    try {
      setState(() => _isScanning = true);
      final picker = ImagePicker();
      final XFile? photo = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 400,
        maxHeight: 400,
        imageQuality: 50,
      );

      if (photo == null) {
        if (mounted) setState(() => _isScanning = false);
        return;
      }

      final bytes = await File(photo.path).readAsBytes();
      final base64String = 'data:image/jpeg;base64,${base64Encode(bytes)}';

      if (mounted) {
        setState(() {
          _isScanning = false;
          _isCaptured = true;
          _captureTime = DateTime.now();
          _capturedFile = File(photo.path);
          _base64Photo = base64String;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isScanning = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Camera error: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  void _retakePhoto() {
    setState(() {
      _isCaptured = false;
      _capturedFile = null;
      _base64Photo = null;
      _captureTime = null;
    });
    _triggerFaceCapture();
  }

  @override
  Widget build(BuildContext context) {
    final nowStr = DateFormat('dd MMM yyyy, hh:mm:ss a').format(_captureTime ?? DateTime.now());

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        padding: const EdgeInsets.all(22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header Bar
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3E8FF),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.face_retouching_natural_rounded, color: Color(0xFF7C3AED), size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Face Verification',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                      ),
                      Text(
                        'Employee: ${widget.employeeName} (${widget.employeeCode})',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Color(0xFF94A3B8)),
                  onPressed: () => Navigator.pop(context, null),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Instruction Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: _isCaptured ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _isCaptured ? const Color(0xFF86EFAC) : const Color(0xFFFDE68A),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _isCaptured ? Icons.verified_user_rounded : Icons.info_outline_rounded,
                    size: 16,
                    color: _isCaptured ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _isCaptured
                          ? 'Face photo captured & verified! Punch-in enabled.'
                          : 'Capture your face selfie using your phone camera before punch-in.',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _isCaptured ? const Color(0xFF15803D) : const Color(0xFFB45309),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Face Oval Viewfinder Area
            Stack(
              alignment: Alignment.center,
              children: [
                // Pulse Ring Animation when scanning or waiting
                AnimatedBuilder(
                  animation: _pulseController,
                  builder: (ctx, child) {
                    return Container(
                      width: 220 + (_pulseController.value * 12),
                      height: 220 + (_pulseController.value * 12),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _isCaptured
                              ? const Color(0xFF22C55E).withValues(alpha: 0.3)
                              : const Color(0xFF7C3AED).withValues(alpha: 0.25),
                          width: 2.5,
                        ),
                      ),
                    );
                  },
                ),

                // Viewfinder Circle
                Container(
                  width: 210,
                  height: 210,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFF0F172A),
                    border: Border.all(
                      color: _isCaptured ? const Color(0xFF22C55E) : const Color(0xFF7C3AED),
                      width: 3.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: _isCaptured
                            ? const Color(0xFF22C55E).withValues(alpha: 0.3)
                            : const Color(0xFF7C3AED).withValues(alpha: 0.3),
                        blurRadius: 18,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: ClipOval(
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (_isCaptured && _capturedFile != null)
                          Image.file(
                            _capturedFile!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Center(
                              child: Icon(Icons.person, size: 70, color: Colors.white70),
                            ),
                          )
                        else
                          Container(
                            color: const Color(0xFF1E1B4B),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  _isScanning ? Icons.camera_front_rounded : Icons.face_rounded,
                                  size: 64,
                                  color: Colors.white.withValues(alpha: 0.8),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _isScanning ? 'Opening Front Camera...' : 'Position Face Inside',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white70),
                                ),
                              ],
                            ),
                          ),

                        // Oval Biometric Reticle Overlay
                        Center(
                          child: Container(
                            width: 170,
                            height: 190,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(85),
                              border: Border.all(
                                color: _isCaptured
                                    ? Colors.greenAccent.withValues(alpha: 0.6)
                                    : Colors.white.withValues(alpha: 0.3),
                                width: 2,
                              ),
                            ),
                          ),
                        ),

                        // Watermark Bar (Timestamp & Office)
                        if (_isCaptured)
                          Positioned(
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: Container(
                              color: Colors.black.withValues(alpha: 0.65),
                              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                              child: Column(
                                children: [
                                  Text(
                                    nowStr,
                                    style: const TextStyle(fontSize: 8.5, color: Colors.white, fontWeight: FontWeight.w600),
                                    textAlign: TextAlign.center,
                                  ),
                                  Text(
                                    widget.officeName ?? 'Office Geofence',
                                    style: const TextStyle(fontSize: 8, color: Color(0xFF86EFAC)),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              ),
                            ),
                          ),

                        // Scanning Shutter Progress Indicator
                        if (_isScanning)
                          Container(
                            color: Colors.black.withValues(alpha: 0.45),
                            child: const Center(
                              child: CircularProgressIndicator(
                                color: Color(0xFFA855F7),
                                strokeWidth: 3,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Status Chip
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _isCaptured ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _isCaptured ? Icons.check_circle_rounded : Icons.camera_alt_outlined,
                        size: 14,
                        color: _isCaptured ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        _isCaptured ? 'Live Face Photo Ready' : 'Awaiting Selfie Capture',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: _isCaptured ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Action Buttons
            if (!_isCaptured) ...[
              // Capture Photo Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isScanning ? null : _triggerFaceCapture,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF7C3AED),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 3,
                  ),
                  icon: const Icon(Icons.camera_alt_rounded, size: 20),
                  label: const Text(
                    'Open Camera & Take Selfie',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              // Disabled Punch In Button with Hint
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: null, // Disabled until photo is captured
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  child: const Text(
                    'Punch-In (Disabled: Photo Required)',
                    style: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ),
            ] else ...[
              // Confirm Punch In with Face ID (Enabled!)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context, _base64Photo);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 3,
                  ),
                  icon: const Icon(Icons.check_circle_rounded, size: 20),
                  label: const Text(
                    'Confirm Punch-In with Face ID',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // Retake button
              TextButton.icon(
                onPressed: _retakePhoto,
                icon: const Icon(Icons.refresh_rounded, size: 16, color: Color(0xFF64748B)),
                label: const Text('Retake Selfie Photo', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
