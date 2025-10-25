# 🚀 RENDER.COM DEPLOYMENT GUIDE

Complete step-by-step guide to deploy your Coalition Game to Render.com

---

## 📋 **PREREQUISITES**

- ✅ GitHub account (free - create at github.com)
- ✅ Render account (free - create at render.com)
- ✅ This game code
- ⏱️ Time needed: ~15 minutes

---

## 🎯 **STEP-BY-STEP DEPLOYMENT**

### **STEP 1: Create GitHub Account (if needed)**

1. Go to **github.com**
2. Click "Sign up"
3. Choose username, email, password
4. Verify email
5. ✅ Done!

---

### **STEP 2: Upload Code to GitHub**

**Option A - Using GitHub Web Interface (Easiest):**

1. Log into GitHub
2. Click **"+"** (top right) → **"New repository"**
3. Repository name: `coalition-game`
4. Set to **Public**
5. Click **"Create repository"**

6. Click **"uploading an existing file"** link
7. Drag and drop these files:
   - `server.js`
   - `package.json`
   - `README.md`
   - Entire `public` folder
8. Click **"Commit changes"**
9. ✅ Done!

**Option B - Using Git Command Line:**

```bash
cd simple-multiplayer-render
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/coalition-game.git
git push -u origin main
```

---

### **STEP 3: Create Render Account**

1. Go to **render.com**
2. Click **"Get Started"**
3. Sign up with:
   - GitHub (easiest - connects automatically!)
   - Or email
4. Verify email if needed
5. ✅ Done! No credit card required.

---

### **STEP 4: Deploy to Render**

1. In Render dashboard, click **"New +"** (top right)
2. Select **"Web Service"**

3. **Connect Repository:**
   - If using GitHub sign-up: Your repos appear automatically
   - Otherwise: Click "Connect GitHub" and authorize
   - Find `coalition-game` repository
   - Click **"Connect"**

4. **Configure Service:**
   ```
   Name: coalition-game  (or any name you want)
   Region: Choose closest to you
   Branch: main
   Root Directory: (leave blank)
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

5. **Select Plan:**
   - Choose **"Free"** plan
   - Click **"Create Web Service"**

6. **Wait for deployment:**
   - Takes 2-5 minutes
   - You'll see build logs
   - Status will change to "Live" with green dot

7. ✅ **DEPLOYED!**

---

## 🌐 **YOUR GAME URL**

After deployment, you'll get a URL like:
```
https://coalition-game-xyz.onrender.com
```

**How to Use:**

- **Students:** `https://your-url.onrender.com`
- **Teacher:** `https://your-url.onrender.com/teacher`

Share this URL with your class!

---

## ⚙️ **IMPORTANT RENDER SETTINGS**

### **Auto-Deploy (Recommended):**

- In Render dashboard → Your service → Settings
- **Auto-Deploy:** ON
- Now any updates you push to GitHub auto-deploy!

### **Environment Variables (Optional):**

If you need any custom settings:
- Go to "Environment" tab
- Add variables like `NODE_ENV=production`

---

## 🔄 **UPDATING YOUR GAME**

### **Method 1 - GitHub Web (Easiest):**

1. Go to your GitHub repository
2. Click on file to edit (e.g., `server.js`)
3. Click pencil icon ✏️ to edit
4. Make changes
5. Scroll down → "Commit changes"
6. Render auto-deploys in 2-3 minutes!

### **Method 2 - Git Command Line:**

```bash
# Make your changes to files
git add .
git commit -m "Updated game"
git push
```

Render detects the push and redeploys automatically!

---

## 🐛 **TROUBLESHOOTING**

### **"Build Failed"**

**Check:**
- `package.json` has correct dependencies
- `server.js` has no syntax errors
- Look at build logs in Render

**Fix:**
- Render → Service → Logs
- Read error message
- Fix the file in GitHub
- Render auto-redeploys

---

### **"Service Unavailable"**

**Reason:** Free tier sleeps after 15 min inactivity

**Fix:**
- Wait 30 seconds, refresh page
- Or: Teacher opens page 2 min before class

---

### **Students Can't Connect**

**Check:**
1. Service shows "Live" (green dot) in Render?
2. URL is correct?
3. Students using HTTPS (not HTTP)?
4. Check browser console for errors

**Common Fix:**
- Make sure students use full URL with `https://`
- Some school networks block WebSockets (rare)

---

### **WebSocket Connection Errors**

**Usually means:**
- Service is starting up (wait 30 seconds)
- Network blocking WebSockets (try different network)

**Fix:**
- Ensure CORS is configured (already done in code)
- Check Render logs for errors

---

## 📊 **MONITORING YOUR SERVICE**

### **Render Dashboard Shows:**

- ✅ **Uptime:** How long service has been running
- 📊 **CPU/Memory:** Resource usage (should be low)
- 📈 **Bandwidth:** Data transfer (should be minimal)
- 📝 **Logs:** Real-time server logs

### **View Logs:**
- Render dashboard → Your service → Logs
- See every connection, vote, etc.
- Great for debugging!

---

## 💡 **TIPS FOR CLASSROOM USE**

### **Before Class:**
1. Teacher opens game URL 2 minutes early (wakes server)
2. Test that teacher panel loads
3. Share URL with students

### **During Class:**
- ✅ Server stays awake entire class
- ✅ All features work normally
- ✅ 10-15 students = no lag

### **After Class:**
- Server sleeps after 15 min (saves your free hours)
- Costs nothing!

---

## 🆓 **FREE TIER DETAILS**

**What You Get:**
- ✅ 750 hours/month (your game uses ~10 hours/month max)
- ✅ Unlimited bandwidth
- ✅ Free SSL (HTTPS)
- ✅ Automatic deployments
- ⚠️ Sleeps after 15 min inactivity

**Upgrading to Paid ($7/month):**
- Never sleeps
- More CPU/memory
- Priority support
- **You probably don't need this for classroom use!**

---

## 🔙 **GOING BACK TO LOCAL VERSION**

If you want to switch back to local:

1. Download `simple-coalition-multiplayer-LOCAL-BACKUP.zip`
2. Extract and run:
   ```bash
   npm install
   node server.js
   ```
3. Use `http://localhost:3000` again

**Both can coexist!** Keep Render for class, local for testing.

---

## ✅ **CHECKLIST**

Before first class:

- [ ] Deployed to Render
- [ ] Service shows "Live"
- [ ] Tested teacher URL
- [ ] Tested student URL (on phone)
- [ ] Shared URL with students
- [ ] Opened URL 2 min before class starts

---

## 📞 **SUPPORT**

**Render Support:**
- docs.render.com
- community.render.com
- support@render.com

**Game Issues:**
- Check server logs in Render
- Test locally first
- Check browser console (F12)

---

## 🎉 **YOU'RE READY!**

Your game is now:
- ✅ Accessible from anywhere
- ✅ Works with VPN
- ✅ No port forwarding needed
- ✅ Free forever
- ✅ Professional and reliable

**Share your URL and enjoy the game!** 🎮

---

## 🔗 **USEFUL LINKS**

- **Render Dashboard:** https://dashboard.render.com
- **Render Docs:** https://docs.render.com
- **GitHub:** https://github.com
- **Your Repository:** https://github.com/YOUR-USERNAME/coalition-game

