import 'package:flutter/material.dart';

class CityscapeWidget extends StatelessWidget {
  final double height;
  const CityscapeWidget({super.key, this.height = 140});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: CityscapePainter(),
      ),
    );
  }
}

class CityscapePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // 1. Sky Gradient Background
    final skyPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFFFFFF),
          Color(0xFFFFF1F2),
          Color(0xFFFCE7F3),
          Color(0xFFF3E8FF),
        ],
        stops: [0.0, 0.4, 0.75, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawRect(Rect.fromLTWH(0, 0, w, h), skyPaint);

    // 2. Setting Sun with Warm Glow on the right
    final sunX = w * 0.78;
    final sunY = h * 0.38;
    final sunRadius = h * 0.26;

    // Sun outer ambient glow
    final glowPaint = Paint()
      ..color = const Color(0xFFFDE68A).withValues(alpha: 0.45)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
    canvas.drawCircle(Offset(sunX, sunY), sunRadius * 1.35, glowPaint);

    // Sun core
    final sunPaint = Paint()
      ..shader = const RadialGradient(
        colors: [
          Color(0xFFFEF08A),
          Color(0xFFFBBF24),
          Color(0xFFF59E0B),
        ],
        stops: [0.0, 0.6, 1.0],
      ).createShader(Rect.fromCircle(center: Offset(sunX, sunY), radius: sunRadius));
    canvas.drawCircle(Offset(sunX, sunY), sunRadius, sunPaint);

    // 3. Distant soft clouds
    final cloudPaint = Paint()
      ..color = const Color(0xFFFBCFE8).withValues(alpha: 0.5)
      ..style = PaintingStyle.fill;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.24, h * 0.16, 70, 10),
        const Radius.circular(5),
      ),
      cloudPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.52, h * 0.14, 85, 12),
        const Radius.circular(6),
      ),
      cloudPaint,
    );

    // 4. Layer 1: Back Skyline (Lilac / Soft Purple)
    final backPaint = Paint()..color = const Color(0xFFD8B4FE);
    final backPath = Path();
    backPath.moveTo(0, h);

    final backBuildings = [
      [0.00, 0.55, 0.08],
      [0.08, 0.42, 0.07],
      [0.15, 0.48, 0.09],
      [0.24, 0.32, 0.08],
      [0.32, 0.40, 0.07],
      [0.39, 0.30, 0.08],
      [0.47, 0.45, 0.07],
      [0.54, 0.28, 0.09],
      [0.63, 0.36, 0.07],
      [0.70, 0.48, 0.08],
      [0.78, 0.35, 0.09],
      [0.87, 0.44, 0.07],
      [0.94, 0.52, 0.06],
    ];

    for (final b in backBuildings) {
      final startX = w * b[0];
      final topY = h * b[1];
      final bWidth = w * b[2];
      backPath.lineTo(startX, topY);
      backPath.lineTo(startX + bWidth, topY);
    }
    backPath.lineTo(w, h);
    backPath.close();
    canvas.drawPath(backPath, backPaint);

    // 5. Layer 2: Middle Skyline (Warm Coral / Sunset Pink)
    final midPaint = Paint()..color = const Color(0xFFF472B6);
    final midPath = Path();
    midPath.moveTo(0, h);

    final midBuildings = [
      [0.02, 0.60, 0.07],
      [0.09, 0.50, 0.08],
      [0.17, 0.38, 0.06],
      [0.23, 0.46, 0.08],
      [0.31, 0.36, 0.07],
      [0.38, 0.52, 0.08],
      [0.46, 0.42, 0.07],
      [0.53, 0.35, 0.08],
      [0.61, 0.48, 0.08],
      [0.69, 0.40, 0.07],
      [0.76, 0.54, 0.08],
      [0.84, 0.45, 0.09],
      [0.93, 0.58, 0.07],
    ];

    for (final b in midBuildings) {
      final startX = w * b[0];
      final topY = h * b[1];
      final bWidth = w * b[2];
      midPath.lineTo(startX, topY);
      midPath.lineTo(startX + bWidth, topY);
    }
    midPath.lineTo(w, h);
    midPath.close();
    canvas.drawPath(midPath, midPaint);

    // 6. Layer 3: Foreground Skyline (Deep Magenta / Mulberry / Wine)
    final frontPaint = Paint()..color = const Color(0xFF9D174D);
    final frontPath = Path();
    frontPath.moveTo(0, h);

    final frontBuildings = [
      [0.00, 0.70, 0.06],
      [0.06, 0.58, 0.08],
      [0.14, 0.64, 0.07],
      [0.21, 0.48, 0.09],
      [0.30, 0.58, 0.07],
      [0.37, 0.44, 0.08],
      [0.45, 0.56, 0.06],
      [0.51, 0.48, 0.09],
      [0.60, 0.60, 0.08],
      [0.68, 0.52, 0.07],
      [0.75, 0.65, 0.08],
      [0.83, 0.55, 0.09],
      [0.92, 0.66, 0.08],
    ];

    for (final b in frontBuildings) {
      final startX = w * b[0];
      final topY = h * b[1];
      final bWidth = w * b[2];
      frontPath.lineTo(startX, topY);
      frontPath.lineTo(startX + bWidth, topY);
    }
    frontPath.lineTo(w, h);
    frontPath.close();
    canvas.drawPath(frontPath, frontPaint);

    // Spires / Antennas on selected buildings
    final spirePaint = Paint()
      ..color = const Color(0xFF831843)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(w * 0.25, h * 0.48), Offset(w * 0.25, h * 0.38), spirePaint);
    canvas.drawLine(Offset(w * 0.41, h * 0.44), Offset(w * 0.41, h * 0.34), spirePaint);
    canvas.drawLine(Offset(w * 0.55, h * 0.48), Offset(w * 0.55, h * 0.39), spirePaint);
    canvas.drawLine(Offset(w * 0.87, h * 0.55), Offset(w * 0.87, h * 0.46), spirePaint);

    // 7. Small illuminated window lights on foreground buildings
    final windowPaint1 = Paint()..color = const Color(0xFFFEF08A);
    final windowPaint2 = Paint()..color = const Color(0xFFFED7AA);

    void drawWindows(double startX, double startY, int cols, int rows) {
      for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
          final isAmber = (r + c) % 2 == 0;
          canvas.drawRect(
            Rect.fromLTWH(startX + (c * 6), startY + (r * 7), 3, 4),
            isAmber ? windowPaint1 : windowPaint2,
          );
        }
      }
    }

    drawWindows(w * 0.22, h * 0.54, 4, 3);
    drawWindows(w * 0.38, h * 0.50, 4, 4);
    drawWindows(w * 0.52, h * 0.54, 4, 3);
    drawWindows(w * 0.84, h * 0.60, 4, 3);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
