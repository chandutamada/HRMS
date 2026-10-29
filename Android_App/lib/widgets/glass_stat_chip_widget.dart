import 'dart:ui';
import 'package:flutter/material.dart';

class GlassStatChipWidget extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final String? unit;
  final Color accentColor;
  final bool compact;

  const GlassStatChipWidget({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.unit,
    this.accentColor = const Color(0xFF2563EB),
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: compact ? 10 : 14,
            vertical: compact ? 8 : 10,
          ),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.88),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.9),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, size: compact ? 12 : 14, color: accentColor),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    label.toUpperCase(),
                    style: TextStyle(
                      fontSize: compact ? 9 : 10,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF64748B),
                      letterSpacing: 0.4,
                    ),
                  ),
                ],
              ),
              SizedBox(height: compact ? 4 : 6),
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: compact ? 16 : 18,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                      fontFamily: 'monospace',
                    ),
                  ),
                  if (unit != null) ...[
                    const SizedBox(width: 3),
                    Text(
                      unit!,
                      style: TextStyle(
                        fontSize: compact ? 10 : 11,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
