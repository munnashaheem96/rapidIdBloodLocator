import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class PhoneVerifyScreen extends StatefulWidget {
  const PhoneVerifyScreen({super.key});

  @override
  State<PhoneVerifyScreen> createState() =>
      _PhoneVerifyScreenState();
}

class _PhoneVerifyScreenState
    extends State<PhoneVerifyScreen> {
  final otpController = TextEditingController();

  String phone = "";
  String verificationId = "";
  bool loading = false;

  @override
  void initState() {
    super.initState();
    getPhoneNumber();
  }

  // 📥 Fetch phone from Firestore
  Future<void> getPhoneNumber() async {
    String uid = FirebaseAuth.instance.currentUser!.uid;

    var doc = await FirebaseFirestore.instance
        .collection('users')
        .doc(uid)
        .get();

    setState(() {
      phone = doc['phone']; // must be +91 format
    });
  }

  // 📤 Send OTP
  Future sendOTP() async {
    if (phone.isEmpty) return;

    setState(() => loading = true);

    await FirebaseAuth.instance.verifyPhoneNumber(
      phoneNumber: phone,
      verificationCompleted: (credential) async {
        await FirebaseAuth.instance.currentUser!
            .linkWithCredential(credential);
      },
      verificationFailed: (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message ?? "Error")),
        );
      },
      codeSent: (verId, _) {
        verificationId = verId;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("OTP Sent")),
        );
      },
      codeAutoRetrievalTimeout: (_) {},
    );

    setState(() => loading = false);
  }

  // ✅ Verify OTP
  Future verifyOTP() async {
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: otpController.text,
      );

      await FirebaseAuth.instance.currentUser!
          .linkWithCredential(credential);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Phone Verified")),
      );

      Navigator.pop(context);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Invalid OTP")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar:
          AppBar(title: const Text("Phone Verification")),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // 📱 Show phone
            Text(
              "OTP will be sent to:",
              style: TextStyle(color: Colors.grey),
            ),

            const SizedBox(height: 5),

            Text(
              phone.isEmpty ? "Loading..." : phone,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),

            const SizedBox(height: 20),

            ElevatedButton(
              onPressed: loading ? null : sendOTP,
              child: loading
                  ? const CircularProgressIndicator()
                  : const Text("Send OTP"),
            ),

            const SizedBox(height: 20),

            TextField(
              controller: otpController,
              decoration:
                  const InputDecoration(labelText: "Enter OTP"),
            ),

            const SizedBox(height: 10),

            ElevatedButton(
              onPressed: verifyOTP,
              child: const Text("Verify"),
            ),
          ],
        ),
      ),
    );
  }
}