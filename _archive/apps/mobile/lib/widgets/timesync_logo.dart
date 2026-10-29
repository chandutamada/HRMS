import 'package:flutter/material.dart';

class TimeSyncLogo extends StatelessWidget {
  final double size;

  const TimeSyncLogo({
    super.key,
    this.size = 88,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF38BDF8), // Cyan 400
            Color(0xFF0EA5E9), // Sky 500
            Color(0xFF0284C7), // Sky 600
            Color(0xFF0369A1), // Sky 700
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF00E5FF).withValues(alpha: 0.35),
            blurRadius: 24,
            spreadRadius: 2,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.4),
          width: 1.5,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(size * 0.28),
        child: Stack(
          children: [
            // Top-left glossy highlight
            Positioned(
              top: -size * 0.1,
              left: -size * 0.1,
              right: -size * 0.1,
              height: size * 0.6,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.white.withValues(alpha: 0.35),
                      Colors.white.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            // Custom drawn Icon with Clock Head & Lime Checkmark
            CustomPaint(
              size: Size(size, size),
              painter: _TimeSyncLogoPainter(),
            ),
          ],
        ),
      ),
    );
  }
}

class _TimeSyncLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final scale = w / 100.0;

    // --- Paint configurations ---
    final whiteStroke = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.2 * scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final limeCheckmark = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.bottomLeft,
        end: Alignment.topRight,
        colors: [
          Color(0xFF16A34A), // Emerald green
          Color(0xFF22C55E), // Vivid green
          Color(0xFF4ADE80), // Lime green
          Color(0xFFA3E635), // Bright lime
        ],
      ).createShader(Rect.fromLTWH(30 * scale, 35 * scale, 55 * scale, 50 * scale))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5.6 * scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // 1. Head circle (Clock outer rim)
    final headCenter = Offset(50 * scale, 34 * scale);
    final headRadius = 13.5 * scale;
    canvas.drawCircle(headCenter, headRadius, whiteStroke);

    // 2. Clock hands inside head
    final clockCenter = headCenter;
    final clockCenterDot = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawCircle(clockCenter, 1.8 * scale, clockCenterDot);

    // Clock hour hand (~10 o'clock)
    final hourHandPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4 * scale
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      clockCenter,
      Offset(44.5 * scale, 28.5 * scale),
      hourHandPaint,
    );

    // Clock minute hand (~2 o'clock)
    final minuteHandPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4 * scale
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      clockCenter,
      Offset(56.5 * scale, 26 * scale),
      minuteHandPaint,
    );

    // 3. Torso / Shoulders arc
    final torsoPath = Path();
    // Start at bottom-left of shoulders
    torsoPath.moveTo(25 * scale, 75 * scale);
    // Curve up to left shoulder
    torsoPath.cubicTo(
      26 * scale, 58 * scale,
      35 * scale, 52 * scale,
      44 * scale, 52 * scale,
    );
    // Neck gap
    torsoPath.moveTo(56 * scale, 52 * scale);
    // Curve down right shoulder
    torsoPath.cubicTo(
      65 * scale, 52 * scale,
      74 * scale, 58 * scale,
      75 * scale, 75 * scale,
    );
    canvas.drawPath(torsoPath, whiteStroke);

    // 4. Vibrant sweeping Lime-Green Checkmark
    final checkPath = Path();
    checkPath.moveTo(38 * scale, 65 * scale);
    checkPath.quadraticBezierTo(
      46 * scale, 76 * scale,
      52 * scale, 79 * scale,
    );
    checkPath.cubicTo(
      62 * scale, 74 * scale,
      73 * scale, 54 * scale,
      82 * scale, 42 * scale,
    );
    canvas.drawPath(checkPath, limeCheckmark);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
