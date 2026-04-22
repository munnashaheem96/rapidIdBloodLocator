import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:vibration/vibration.dart';

class EmergencyAlertScreen extends StatefulWidget {
  final String bloodGroup;
  final String location;

  const EmergencyAlertScreen({
    super.key,
    required this.bloodGroup,
    required this.location,
  });

  @override
  State<EmergencyAlertScreen> createState() =>
      _EmergencyAlertScreenState();
}

class _EmergencyAlertScreenState extends State<EmergencyAlertScreen> {
  final AudioPlayer player = AudioPlayer();

  @override
  void initState() {
    super.initState();
    startAlert();
  }

  void startAlert() async {
    await player.setReleaseMode(ReleaseMode.loop);
    await player.play(AssetSource('sounds/emergency.mp3'));

    if (await Vibration.hasVibrator() ?? false) {
      Vibration.vibrate(pattern: [500, 1000, 500, 1000], repeat: 0);
    }
  }

  void stopAlert() async {
    await player.stop();
    Vibration.cancel();
  }

  @override
  void dispose() {
    stopAlert();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.red.shade900,
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.warning_rounded,
                color: Colors.white, size: 100),

            const SizedBox(height: 20),

            const Text(
              "EMERGENCY",
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 10),

            Text(
              "${widget.bloodGroup} BLOOD NEEDED",
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
              ),
            ),

            const SizedBox(height: 10),

            Text(
              widget.location,
              style: const TextStyle(color: Colors.white70),
            ),

            const SizedBox(height: 40),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // ❌ DECLINE
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.red,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 30, vertical: 15),
                  ),
                  onPressed: () {
                    stopAlert();
                    Navigator.pop(context);
                  },
                  child: const Text("DECLINE"),
                ),

                // ✅ ACCEPT
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 30, vertical: 15),
                  ),
                  onPressed: () {
                    stopAlert();
                    // TODO: add call / map
                  },
                  child: const Text("ACCEPT"),
                ),
              ],
            )
          ],
        ),
      ),
    );
  }
}