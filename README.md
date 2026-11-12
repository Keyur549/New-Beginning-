# ધ સંગમ — The Sangam

The Beginning જેવી જ સ્ટાઇલની નવી ગેમ (Node + Express + Socket.IO).

## ફાઇલો
- `server.js` — ગેમ સર્વર (બધા નિયમો અહીં)
- `player.html` — ખેલાડીનો ફોન · `host.html` — Host કન્સોલ (ફક્ત નિયંત્રણ) · `projector.html` — મોટા પડદા માટે અલગ Projector સ્ક્રીન
- `questions.txt` — 36 નમૂના પ્રશ્ન (`પ્રશ્ન::જવાબ`, દરેક જવાબ અલગ, 9-9ના 4 ફેઝ)
- `chitra.svg` — છુપાયેલું મંદિરનું ચિત્ર (નમૂનો, જે ખેલાડીઓ ખોલતા જશે). **તમારું ચિત્ર મૂકવા** `chitra.jpg` (અથવા png/webp) આ જ ફોલ્ડરમાં મૂકો, ચોરસ (1:1) ફોટો સારો. ગેમ પૂરી થાય ત્યાં સુધી આ ફાઇલ કોઈને દેખાતી નથી.

## Render પર ચલાવવા
1. ફાઇલો GitHub repo માં મૂકો (Beginning જેમ જ).
2. Render → New Web Service → Build Command: `npm install` · Start Command: `node server.js`
3. Environment: `HOST_ID` અને `HOST_PW` (ન મૂકો તો `admin` / `gyan2026`).
4. Host: `https://<તમારી-app>.onrender.com/host.html` → login → ગેમ બનાવો → "📽 Projector Screen ખોલો" (નવી ટેબ/બીજા સ્ક્રીન પર, F11/Full screen). Projector નો રંગ Host પેજમાંથી બદલાય છે.

## ગેમનો પ્રવાહ
Lobby → શુભ લાઇન + કવચ પસંદગી (60 સે) → 4 ફેઝ × 9 પ્રશ્ન (દરેક ફેઝ પછી 15 સે યુદ્ધ: બાણ/ઢાલ) → અંતિમ પરિણામ (13 પગલાં, Host "આગળ" દબાવે).

## ટેસ્ટ માટે
- Host કન્સોલમાં "+20 Bots" બટન. 
- `SG_FAST=1 node server.js` ટાઇમર ટૂંકા કરે (ફક્ત ટેસ્ટ માટે).

## રંગ (Theme)
Host પેજમાં "Colour Theme" થી Beginning જેવા જ preset (Fun Premium, Royal Navy, Emerald, Sunset, Royal Purple, Ocean Teal) અથવા તમારા પોતાના 3 રંગ પસંદ કરો — Host, Projector અને બધા Players ના ફોનમાં એક સાથે બદલાય છે.
