import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('HRMSApp launches without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const HRMSApp(hasCompletedPermissions: false));
    await tester.pump();
    expect(find.byType(HRMSApp), findsOneWidget);
  });
}
