#!/bin/bash

BASE_URL="http://localhost:5000/api"

echo "1. Register Super Admin"
SUPER_TOKEN=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Super Admin","email":"super@admin.com","password":"password123","role":"super_admin"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Super Admin Token: ${SUPER_TOKEN:0:10}..."

echo "2. Register Hostel Admin"
HOSTEL_TOKEN=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Hostel Admin","email":"hostel@admin.com","password":"password123","role":"admin","department":"Hostel"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Hostel Admin Token: ${HOSTEL_TOKEN:0:10}..."

echo "3. Register Student"
STUDENT_TOKEN=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Student One","email":"student@test.com","password":"password123","role":"student","studentId":"STU001"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Student Token: ${STUDENT_TOKEN:0:10}..."

echo "4. Student Creates Hostel Complaint"
curl -s -X POST $BASE_URL/complaints \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -F "category=Hostel" \
  -F "description=My room fan is broken" > /dev/null

echo "5. Student Creates Library Complaint"
curl -s -X POST $BASE_URL/complaints \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -F "category=Library" \
  -F "description=Book not found" > /dev/null

echo "6. Verify Hostel Admin sees ONLY Hostel complaint"
COUNT_HOSTEL=$(curl -s -X GET "$BASE_URL/complaints" -H "Authorization: Bearer $HOSTEL_TOKEN" | grep -o "category" | wc -l)
echo "Hostel Admin sees $COUNT_HOSTEL complaints (Expected: 1)"

echo "7. Verify Super Admin sees ALL complaints"
COUNT_SUPER=$(curl -s -X GET "$BASE_URL/complaints" -H "Authorization: Bearer $SUPER_TOKEN" | grep -o "category" | wc -l)
echo "Super Admin sees $COUNT_SUPER complaints (Expected: 2)"

echo "8. Verify Analytics"
curl -s -X GET "$BASE_URL/complaints/analytics" -H "Authorization: Bearer $SUPER_TOKEN"
echo ""
