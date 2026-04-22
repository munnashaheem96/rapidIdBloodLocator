import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:audioplayers/audioplayers.dart';
import 'firebase_options.dart';
import 'screens/splash_screen.dart';
import 'screens/emergency_alert_screen.dart';

final AudioPlayer player = AudioPlayer();

// 🔥 Background handler
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform);

  print("🔔 Background: ${message.notification?.title}");
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform);

  FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  void initState() {
    super.initState();
    setupFCM();
  }

  void setupFCM() async {
    await FirebaseMessaging.instance.requestPermission();

    String? token = await FirebaseMessaging.instance.getToken();
    print("🔥 FCM TOKEN: $token");

    // 🔔 FOREGROUND
    FirebaseMessaging.onMessage.listen((message) async {
      await player.setReleaseMode(ReleaseMode.loop);
      await player.play(AssetSource('sounds/emergency.mp3'));

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => EmergencyAlertScreen(
            bloodGroup: message.data['bloodGroup'] ?? "Unknown",
            location: message.data['location'] ?? "Nearby",
          ),
        ),
      );
    });

    // 🔔 BACKGROUND CLICK
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => EmergencyAlertScreen(
            bloodGroup: message.data['bloodGroup'] ?? "Unknown",
            location: message.data['location'] ?? "Nearby",
          ),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: "Rapid Aid",
      home: const SplashScreen(),
    );
  }
}