# ધ સંગમ — The Sangam

The Beginning જેવી જ સ્ટાઇલની નવી ગેમ (Node + Express + Socket.IO).

## ફાઇલો
- `server.js` — ગેમ સર્વર (બધા નિયમો અહીં)
- `player.html` — ખેલાડીનો ફોન · `host.html` — Host કન્સોલ અને Projector (`host.html?pj=CODE`)
- `questions.txt` — 36 નમૂના પ્રશ્ન (`પ્રશ્ન::જવાબ`, દરેક જવાબ અલગ, 9-9ના 4 ફેઝ)
- `chitra.svg` — છુપાયેલું ચિત્ર (નમૂનો). **તમારું ચિત્ર મૂકવા** `chitra.jpg` (અથવા png/webp) આ જ ફોલ્ડરમાં મૂકો, ચોરસ (1:1) ફોટો સારો. ગેમ પૂરી થાય ત્યાં સુધી આ ફાઇલ કોઈને દેખાતી નથી.

## Render પર ચલાવવા
1. ફાઇલો GitHub repo માં મૂકો (Beginning જેમ જ).
2. Render → New Web Service → Build Command: `npm install` · Start Command: `node server.js`
3. Environment: `HOST_ID` અને `HOST_PW` (ન મૂકો તો `admin` / `gyan2026`).
4. Host: `https://<તમારી-app>.onrender.com/host.html` → login → ગેમ બનાવો → Projector ખોલો.

## ગેમનો પ્રવાહ
Lobby → શુભ લાઇન + કવચ પસંદગી (60 સે) → 4 ફેઝ × 9 પ્રશ્ન (દરેક ફેઝ પછી 15 સે યુદ્ધ: બાણ/ઢાલ) → અંતિમ પરિણામ (13 પગલાં, Host "આગળ" દબાવે).

## ટેસ્ટ માટે
- Host કન્સોલમાં "+20 Bots" બટન. 
- `SG_FAST=1 node server.js` ટાઇમર ટૂંકા કરે (ફક્ત ટેસ્ટ માટે).
