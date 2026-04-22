import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

class CreateRequestScreen extends StatefulWidget {
  const CreateRequestScreen({super.key});

  @override
  State<CreateRequestScreen> createState() => _CreateRequestScreenState();
}

class _CreateRequestScreenState extends State<CreateRequestScreen> {
  String bloodGroup = "A+";
  String urgency = "Urgent";

  String location = "Fetching...";
  double lat = 0;
  double lng = 0;

  final nameController = TextEditingController();
  final hospitalController = TextEditingController();
  final unitsController = TextEditingController();
  final phoneController = TextEditingController();
  final notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    getLocation();
  }

  Future getLocation() async {
    Position pos = await Geolocator.getCurrentPosition();

    lat = pos.latitude;
    lng = pos.longitude;

    List<Placemark> placemarks = await placemarkFromCoordinates(lat, lng);

    setState(() {
      location =
          "${placemarks[0].locality}, ${placemarks[0].administrativeArea}";
    });
  }

  Future createRequest() async {
    if (nameController.text.isEmpty ||
        phoneController.text.isEmpty ||
        unitsController.text.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Fill required fields")));
      return;
    }

    String uid = FirebaseAuth.instance.currentUser!.uid;

    await FirebaseFirestore.instance.collection('blood_requests').add({
      'uid': uid,
      'name': nameController.text,
      'bloodGroup': bloodGroup,
      'units': unitsController.text,
      'hospital': hospitalController.text,
      'phone': phoneController.text,
      'notes': notesController.text,
      'urgency': urgency,
      'location': location,
      'lat': lat,
      'lng': lng,
      'createdAt': Timestamp.now(),
    });

    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        title: const Text(
          "Create Request",
          style: TextStyle(color: Colors.black),
        ),
        iconTheme: const IconThemeData(color: Colors.black),
      ),

      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // 🔴 BLOOD GROUP
            _sectionCard(
              child: DropdownButtonFormField<String>(
                value: bloodGroup,
                decoration: _iosInput("Blood Group"),
                items: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((
                  e,
                ) {
                  return DropdownMenuItem(value: e, child: Text(e));
                }).toList(),
                onChanged: (val) => setState(() => bloodGroup = val!),
              ),
            ),

            const SizedBox(height: 15),

            // 👤 DETAILS
            _sectionCard(
              child: Column(
                children: [
                  _textField(nameController, "Patient Name"),
                  _divider(),
                  _textField(hospitalController, "Hospital"),
                  _divider(),
                  _textField(
                    unitsController,
                    "Units Required",
                    type: TextInputType.number,
                  ),
                  _divider(),
                  _textField(
                    phoneController,
                    "Phone Number",
                    type: TextInputType.phone,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 15),

            // ⚡ URGENCY
            _sectionCard(
              child: DropdownButtonFormField<String>(
                value: urgency,
                decoration: _iosInput("Urgency"),
                items: ["Normal", "Urgent", "Critical"]
                    .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                    .toList(),
                onChanged: (val) => setState(() => urgency = val!),
              ),
            ),

            const SizedBox(height: 15),

            // 📝 NOTES
            _sectionCard(
              child: TextField(
                controller: notesController,
                maxLines: 3,
                decoration: _iosInput("Notes (Optional)"),
              ),
            ),

            const SizedBox(height: 15),

            // 📍 LOCATION
            _sectionCard(
              child: Row(
                children: [
                  const Icon(Icons.location_on, color: Colors.red),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      location,
                      style: const TextStyle(color: Colors.grey),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 25),

            // 🚨 BUTTON
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFA51313),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: createRequest,
                child: const Text(
                  "Submit Request",
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 🔳 iOS Section Card
  Widget _sectionCard({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10),
        ],
      ),
      child: child,
    );
  }

  // 🔧 TextField
  Widget _textField(
    TextEditingController controller,
    String hint, {
    TextInputType type = TextInputType.text,
  }) {
    return TextField(
      controller: controller,
      keyboardType: type,
      decoration: _iosInput(hint),
    );
  }

  // 🔧 iOS Input Style
  InputDecoration _iosInput(String hint) {
    return InputDecoration(hintText: hint, border: InputBorder.none);
  }

  // 🔧 Divider
  Widget _divider() {
    return const Divider(height: 20, thickness: 0.5);
  }
}
