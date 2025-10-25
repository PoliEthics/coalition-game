# 🎮 Coalition Politics Game

A multiplayer classroom game for teaching coalition politics, negotiation, and decision-making.

---

## 🚀 **TWO WAYS TO RUN**

### **Option 1: Deploy to Render.com (RECOMMENDED)**
✅ Best for classroom use  
✅ Works from anywhere  
✅ No VPN issues  
✅ Free forever  

**Quick Start:** See `QUICK-START.md` (5 minutes)  
**Full Guide:** See `RENDER-DEPLOYMENT-GUIDE.md` (15 minutes)

### **Option 2: Run Locally**
⚠️ For testing only  
⚠️ Requires same WiFi network  
⚠️ May have VPN issues  

```bash
npm install
node server.js
```

Then open:
- Students: `http://localhost:3000`
- Teacher: `http://localhost:3000/teacher`

---

## 🎯 **HOW TO PLAY**

### **Setup (Teacher):**
1. Open teacher page
2. Select 4-6 factions
3. Wait for students to join
4. Start game

### **Gameplay:**
1. **Proposal Phase:** Teacher selects faction and policy
2. **Negotiation Phase:** Students trade tokens and discuss
3. **Voting Phase:** Each faction votes YES or NO
4. **Results:** See who won, metrics change, tokens awarded
5. **Next Round:** Repeat!

### **Winning:**
- Highest **Voter Base Approval** wins
- Earn approval by voting with majority
- Complete secret objectives for +40% approval
- Game ends when teacher clicks "End Game"

---

## 🎓 **CLASSROOM TIPS**

- **10-15 students:** Perfect for teams of 2-3 per faction
- **45-90 min session:** Play 3-6 rounds
- **Discussion:** Encourage negotiation during negotiation phase
- **Learning objectives:** Coalition building, compromise, political strategy

---

## 🛠️ **TECHNICAL DETAILS**

**Built with:**
- Node.js + Express
- Socket.IO (real-time connections)
- Vanilla JavaScript (no frameworks)

**Features:**
- Real-time voting
- Token trading system
- Automatic objective tracking
- National metrics simulation
- Mobile-friendly interface

---

## 📋 **FILES**

- `server.js` - Game server
- `public/index.html` - Game interface
- `package.json` - Dependencies
- `RENDER-DEPLOYMENT-GUIDE.md` - Full deployment guide
- `QUICK-START.md` - 5-minute deployment
- `README.md` - This file

---

## 🆘 **SUPPORT**

**Deployment issues:** See `RENDER-DEPLOYMENT-GUIDE.md`  
**Game bugs:** Check server logs  
**Questions:** Review full documentation

---

## 📜 **LICENSE**

Free to use for educational purposes.
