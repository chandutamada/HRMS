import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../services/api_service.dart';
import '../services/biometric_service.dart';
import '../services/google_auth_service.dart';
import '../widgets/timesync_logo.dart';
import 'main_navigation_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _isBiometricLoading = false;
  bool _isPasswordVisible = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkExistingSession();
      _prefillStoredIdentifier();
    });
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// Check if user has an existing valid JWT session
  Future<void> _checkExistingSession() async {
    try {
      final token = await ApiService().getToken().timeout(const Duration(seconds: 2));
      if (token != null && token.isNotEmpty) {
        final profileRes = await ApiService().dio.get('/auth/me').timeout(const Duration(seconds: 2));
        final user = profileRes.data['data'];
        if (mounted && user != null) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => MainNavigationScreen(userData: user),
            ),
          );
        }
      }
    } catch (_) {
      // Gracefully remain on login screen
    }
  }

  /// If user logged in before with biometrics, prefill their Employee ID / Email
  Future<void> _prefillStoredIdentifier() async {
    try {
      final credentials = await BiometricService().getStoredCredentials();
      if (credentials != null && mounted) {
        if (_identifierController.text.isEmpty) {
          setState(() {
            _identifierController.text = credentials['identifier'] ?? '';
          });
        }
      }
    } catch (_) {}
  }

  /// Standard Employee Login via User ID / Email + Password
  Future<void> _handleLogin() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text.trim();

    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter your Employee ID / Email and Password.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await ApiService().dio.post(
        '/auth/login',
        data: {
          'identifier': identifier,
          'password': password,
        },
      );

      final data = response.data['data'];
      final tokens = data['tokens'];
      final user = data['user'];

      await ApiService().saveAuthTokens(
        tokens['accessToken'],
        tokens['refreshToken'],
      );

      // Securely store credentials for subsequent one-touch Biometric Login
      final empName = user != null ? '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim() : null;
      await BiometricService().saveBiometricCredentials(
        identifier: identifier,
        password: password,
        employeeName: empName,
      );

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => MainNavigationScreen(userData: user),
          ),
        );
      }
    } on DioException catch (e) {
      String msg = 'Invalid credentials. Please verify your Employee ID and Password.';
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        msg = 'Connection timed out. Please check your internet or backend connection.';
      } else if (e.type == DioExceptionType.connectionError) {
        msg = 'Cannot connect to server (${ApiService().dio.options.baseUrl}).';
      } else if (e.response?.data?['message'] != null) {
        msg = e.response!.data['message'].toString();
      }
      setState(() {
        _errorMessage = msg;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Login Error: ${e.toString()}';
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  /// Native Google / Gmail Account Sign-In
  Future<void> _handleGoogleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      GoogleSignInAccount? googleUser;
      try {
        // 1. Attempt Native Google Play Services Account Sheet
        googleUser = await GoogleAuthService().promptGoogleAccount();
      } catch (nativeErr) {
        debugPrint('Native Google Play Services prompt error (fallback to manual prompt): $nativeErr');
      }

      String? emailToAuth;
      String? idToken;
      String? googleId;
      String? displayName;

      if (googleUser != null) {
        emailToAuth = googleUser.email;
        googleId = googleUser.id;
        displayName = googleUser.displayName;
        try {
          final authData = await googleUser.authentication;
          idToken = authData.idToken;
        } catch (_) {}
      } else {
        // Fallback: If native account picker was cancelled or Google Play Services is missing
        if (!mounted) return;
        setState(() {
          _isLoading = false;
        });

        final emailController = TextEditingController(text: 'hr@gramtarang.org');
        final submitted = await showDialog<String>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            title: const Row(
              children: [
                Icon(Icons.g_mobiledata, color: Color(0xFF38BDF8), size: 28),
                SizedBox(width: 8),
                Text('Sign in with Gmail', style: TextStyle(color: Colors.white, fontSize: 16)),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Enter your registered Gmail or organization email:',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: const InputDecoration(
                    labelText: 'Gmail / Work Email',
                    labelStyle: TextStyle(color: Color(0xFF94A3B8)),
                    enabledBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: Color(0xFF475569)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: Color(0xFF38BDF8)),
                    ),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel', style: TextStyle(color: Color(0xFF94A3B8))),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx, emailController.text.trim()),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7)),
                child: const Text('Sign In', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        );

        if (submitted == null || submitted.isEmpty) return;
        emailToAuth = submitted;
        setState(() {
          _isLoading = true;
        });
      }

      // 2. Authenticate with backend API
      final result = await GoogleAuthService().authenticateWithBackend(
        email: emailToAuth,
        idToken: idToken,
        googleId: googleId,
        displayName: displayName,
      );

      final user = result['user'];

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => MainNavigationScreen(userData: user),
          ),
        );
      }
    } on DioException catch (e) {
      String msg = 'Failed to sign in with Google.';
      if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.unknown) {
        msg = 'Cannot connect to server (${ApiService().dio.options.baseUrl}). Please tap "Configure Backend Server IP" below.';
      } else if (e.response?.data != null && e.response?.data['message'] != null) {
        msg = e.response!.data['message'].toString();
      }
      setState(() {
        _errorMessage = msg;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  /// Biometric Fingerprint / Face Quick Login
  Future<void> _handleBiometricLogin() async {
    setState(() {
      _errorMessage = null;
    });

    final credentials = await BiometricService().getStoredCredentials();

    // If no credentials saved yet but user typed in the inputs, offer to authenticate and save
    if (credentials == null) {
      final typedId = _identifierController.text.trim();
      final typedPass = _passwordController.text.trim();

      if (typedId.isNotEmpty && typedPass.isNotEmpty) {
        // Authenticate with biometrics first, then login & save
        final bool didAuth = await BiometricService().promptBiometricAuthentication(
          reason: 'Scan your fingerprint to link biometric login for $typedId',
        );
        if (didAuth) {
          _handleLogin();
        }
        return;
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF1E293B),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFF38BDF8), width: 1),
          ),
          content: const Row(
            children: [
              Icon(Icons.info_outline, color: Color(0xFF38BDF8), size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Please log in with your Employee ID and Password once to activate Biometric Login.',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ],
          ),
          duration: const Duration(seconds: 4),
        ),
      );
      return;
    }

    setState(() {
      _isBiometricLoading = true;
    });

    try {
      final user = await BiometricService().performQuickBiometricLogin();
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => MainNavigationScreen(userData: user),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isBiometricLoading = false);
      }
    }
  }

  /// Show HR Assistance / Forgot Password dialog
  void _showHrAssistanceDialog({required String title, required String message}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Color(0xFF0F172A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(
            top: BorderSide(color: Color(0xFF38BDF8), width: 1.5),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0369A1).withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.badge_outlined, color: Color(0xFF38BDF8), size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(
                color: Color(0xFFCBD5E1),
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.mail_outline, color: Color(0xFF38BDF8), size: 18),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'HR Helpdesk',
                          style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'hr@company.internal • Ext. 104',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Understood', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Hidden developer API server dialog (long press on logo)
  void _showServerConfigDialog() {
    final controller = TextEditingController(text: ApiService().dio.options.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Backend API Server', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Select or enter backend address:',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildUrlChip('Production (superbeeaeronautics)', 'https://api-hr.superbeeaeronautics.com/api', controller),
                _buildUrlChip('USB / ADB Localhost', 'http://localhost:4000/api', controller),
                _buildUrlChip('Wi-Fi PC (172.16.202.64)', 'http://172.16.202.64:4000/api', controller),
                _buildUrlChip('Emulator', 'http://10.0.2.2:4000/api', controller),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'API Base URL',
                labelStyle: TextStyle(color: Color(0xFF94A3B8)),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Color(0xFF475569)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Color(0xFF38BDF8)),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () {
              final newUrl = controller.text.trim();
              if (newUrl.isNotEmpty) {
                ApiService().updateBaseUrl(newUrl);
                setState(() {});
              }
              Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7)),
            child: const Text('Save', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildUrlChip(String title, String url, TextEditingController controller) {
    return InkWell(
      onTap: () => controller.text = url,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: const Color(0xFF475569)),
        ),
        child: Text(
          title,
          style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080E1B),
      body: Stack(
        children: [
          // Background Glows and Geometrics
          Positioned.fill(
            child: CustomPaint(
              painter: _TimeSyncBackgroundPainter(),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                Align(
                  alignment: Alignment.topRight,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4, right: 12),
                    child: IconButton(
                      icon: const Icon(Icons.wifi_tethering, color: Color(0xFF475569), size: 20),
                      tooltip: 'Server Connection Settings',
                      onPressed: _showServerConfigDialog,
                    ),
                  ),
                ),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 28.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 20),

                          // App Logo (Long press opens API server config)
                          GestureDetector(
                            onLongPress: _showServerConfigDialog,
                            child: const TimeSyncLogo(size: 88),
                          ),
                          const SizedBox(height: 20),

                          // App Title & Subtitle
                          const Text(
                            'TimeSync',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Attendance Tracker',
                            style: TextStyle(
                              color: Color(0xFF7E93AC),
                              fontSize: 15,
                              fontWeight: FontWeight.w400,
                              letterSpacing: 0.2,
                            ),
                          ),
                          const SizedBox(height: 32),

                          // Login to your account heading
                          const Text(
                            'Login to your account',
                            style: TextStyle(
                              color: Color(0xFF8D9FB5),
                              fontSize: 14.5,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Error Message Banner (if any)
                          if (_errorMessage != null)
                            Container(
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFF450A0A).withValues(alpha: 0.8),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFF991B1B)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.error_outline, color: Color(0xFFFCA5A5), size: 18),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          _errorMessage!,
                                          style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 12),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (_errorMessage!.contains('Cannot connect') ||
                                      _errorMessage!.contains('timed out') ||
                                      _errorMessage!.contains('connection')) ...[
                                    const SizedBox(height: 8),
                                    GestureDetector(
                                      onTap: _showServerConfigDialog,
                                      child: const Text(
                                        '⚙️ Tap here to configure Backend Server IP (e.g. 172.16.202.64:4000)',
                                        style: TextStyle(
                                          color: Color(0xFF38BDF8),
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.bold,
                                          decoration: TextDecoration.underline,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),

                          // Input 1: Employee ID / Email
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFF131D2E).withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: const Color(0xFF23354E),
                                width: 1.2,
                              ),
                            ),
                            child: TextField(
                              controller: _identifierController,
                              style: const TextStyle(color: Colors.white, fontSize: 14),
                              decoration: const InputDecoration(
                                hintText: 'Employee ID / Email',
                                hintStyle: TextStyle(
                                  color: Color(0xFF6B7E96),
                                  fontSize: 14,
                                ),
                                prefixIcon: Icon(
                                  Icons.person_outline_rounded,
                                  color: Color(0xFF8A9FB5),
                                  size: 21,
                                ),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),

                          // Input 2: Password
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFF131D2E).withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: const Color(0xFF23354E),
                                width: 1.2,
                              ),
                            ),
                            child: TextField(
                              controller: _passwordController,
                              obscureText: !_isPasswordVisible,
                              style: const TextStyle(color: Colors.white, fontSize: 14),
                              decoration: InputDecoration(
                                hintText: 'Password',
                                hintStyle: const TextStyle(
                                  color: Color(0xFF6B7E96),
                                  fontSize: 14,
                                ),
                                prefixIcon: const Icon(
                                  Icons.lock_outline_rounded,
                                  color: Color(0xFF8A9FB5),
                                  size: 21,
                                ),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _isPasswordVisible
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    color: const Color(0xFF8A9FB5),
                                    size: 20,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _isPasswordVisible = !_isPasswordVisible;
                                    });
                                  },
                                ),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Forgot Password? (Right-aligned)
                          Align(
                            alignment: Alignment.centerRight,
                            child: GestureDetector(
                              onTap: () {
                                _showHrAssistanceDialog(
                                  title: 'Forgot Password?',
                                  message:
                                      'Employee credentials are automatically generated and managed by HR individually during onboarding.\n\nIf you have forgotten your password or require a credential reset, please contact your company HR department or administrator.',
                                );
                              },
                              child: const Text(
                                'Forgot Password?',
                                style: TextStyle(
                                  color: Color(0xFF38BDF8),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 28),

                          // LOG IN Button (Glowing Cyan Pill Button)
                          Container(
                            width: double.infinity,
                            height: 52,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(26),
                              gradient: const LinearGradient(
                                colors: [
                                  Color(0xFF00E5FF),
                                  Color(0xFF00C4EE),
                                  Color(0xFF0284C7),
                                ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF00E5FF).withValues(alpha: 0.38),
                                  blurRadius: 18,
                                  spreadRadius: 1,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _handleLogin,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.transparent,
                                shadowColor: Colors.transparent,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(26),
                                ),
                              ),
                              child: _isLoading
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        valueColor: AlwaysStoppedAnimation(Color(0xFF071B2F)),
                                      ),
                                    )
                                  : const Text(
                                      'LOG IN',
                                      style: TextStyle(
                                        color: Color(0xFF071B2F),
                                        fontSize: 15,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 1.4,
                                      ),
                                    ),
                            ),
                          ),
                           const SizedBox(height: 16),

                          // Google / Gmail Sign-In Button
                          OutlinedButton.icon(
                            onPressed: _isLoading ? null : _handleGoogleLogin,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Color(0xFF334155)),
                              backgroundColor: const Color(0xFF0F172A).withValues(alpha: 0.6),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            ),
                            icon: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.g_mobiledata,
                                color: Color(0xFFEA4335),
                                size: 18,
                              ),
                            ),
                            label: const Text(
                              'Sign in with Google / Gmail',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFFE2E8F0),
                              ),
                            ),
                          ),

                          const SizedBox(height: 20),

                          // Biometric Login Button (Fingerprint Icon + "Biometric Login")
                          InkWell(
                            onTap: _isBiometricLoading ? null : _handleBiometricLogin,
                            borderRadius: BorderRadius.circular(12),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (_isBiometricLoading)
                                    const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Color(0xFF38BDF8),
                                      ),
                                    )
                                  else
                                    const Icon(
                                      Icons.fingerprint_rounded,
                                      color: Colors.white,
                                      size: 24,
                                    ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'Biometric Login',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.w500,
                                      letterSpacing: 0.2,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 20),
                        ],
                      ),
                    ),
                  ),
                ),

                // Bottom Footer: "Don't have an account? Contact HR" + Star
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10192A).withValues(alpha: 0.75),
                    border: const Border(
                      top: BorderSide(color: Color(0xFF1E2D44), width: 1),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Spacer(),
                      RichText(
                        text: TextSpan(
                          text: "Don't have an account? ",
                          style: const TextStyle(
                            color: Color(0xFF7E93AC),
                            fontSize: 12.5,
                          ),
                          children: [
                            WidgetSpan(
                              alignment: PlaceholderAlignment.middle,
                              child: GestureDetector(
                                onTap: () {
                                  _showHrAssistanceDialog(
                                    title: 'Employee Onboarding',
                                    message:
                                        'Self-service employee registration is disabled for enterprise security.\n\nAll employee accounts and login credentials are generated individually by HR during the onboarding process. Please contact your company HR department to obtain your credentials.',
                                  );
                                },
                                child: const Text(
                                  'Contact HR',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      // 4-pointed sparkle star icon
                      const Icon(
                        Icons.auto_awesome,
                        color: Color(0xFF5B6E87),
                        size: 18,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Dynamic painter for ambient futuristic geometric glows and light angles
class _TimeSyncBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Soft top-right cyan glow
    final glowPaint1 = Paint()
      ..shader = RadialGradient(
        center: const Alignment(0.7, -0.6),
        radius: 0.8,
        colors: [
          const Color(0xFF0284C7).withValues(alpha: 0.22),
          const Color(0xFF080E1B).withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, w, h * 0.7));
    canvas.drawRect(Rect.fromLTWH(0, 0, w, h * 0.7), glowPaint1);

    // Soft center-left subtle glow
    final glowPaint2 = Paint()
      ..shader = RadialGradient(
        center: const Alignment(-0.8, -0.2),
        radius: 0.6,
        colors: [
          const Color(0xFF0369A1).withValues(alpha: 0.15),
          const Color(0xFF080E1B).withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawRect(Rect.fromLTWH(0, 0, w, h), glowPaint2);

    // Subtle geometric translucent angled light rays in the top right
    final rayPaint = Paint()
      ..color = const Color(0xFF38BDF8).withValues(alpha: 0.04)
      ..style = PaintingStyle.fill;

    final rayPath1 = Path()
      ..moveTo(w * 0.45, 0)
      ..lineTo(w * 0.9, 0)
      ..lineTo(w, h * 0.25)
      ..lineTo(w * 0.6, h * 0.35)
      ..close();
    canvas.drawPath(rayPath1, rayPaint);

    final rayPath2 = Path()
      ..moveTo(w * 0.65, 0)
      ..lineTo(w, 0)
      ..lineTo(w, h * 0.4)
      ..close();
    canvas.drawPath(rayPath2, rayPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
