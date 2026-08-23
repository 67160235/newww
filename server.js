const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ==========================================
// 🚨 ตั้งค่า CORS (อนุญาตให้ GitHub Pages คุยกับ Backend ได้)
// ==========================================
app.use(cors({
    origin: ['https://67160235.github.io', 'http://127.0.0.1:5500', 'http://localhost:5500'],
    credentials: true
}));

app.use(express.json());

// คีย์ลับสำหรับสร้างและถอดรหัส Token
const JWT_SECRET = process.env.JWT_SECRET || 'hvacr_super_secret_key_2026';

// ==========================================
// 🌟 1. สร้าง Schema สำหรับฐานข้อมูล (User Model)
// ==========================================
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String },
    role: { type: String, default: 'user' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// สร้าง Schema สำหรับเก็บข้อมูลการจอง (Booking Model)
const bookingSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    service: { type: String, required: true },
    details: { type: String },
    status: { type: String, default: 'Pending' } // Pending, Confirmed, Completed
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);

// ==========================================
// 🛡️ 2. Middleware: สำหรับตรวจสอบ Token
// ==========================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'ปฏิเสธการเข้าถึง: กรุณาเข้าสู่ระบบ' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'ปฏิเสธการเข้าถึง: Token ไม่ถูกต้องหรือหมดอายุ' });
        req.user = user;
        next();
    });
};

// ==========================================
// 🚀 3. หมวดที่ 1: Authentication (ล็อกอิน/สมัคร)
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        // ประยุกต์ใช้ email หรือ username ในการเข้าสู่ระบบ
        const { name, email, password } = req.body;
        
        // เราจะใช้ Email เป็น Username ในระบบ
        const existingUser = await User.findOne({ username: email });
        if (existingUser) return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });

        const hashedPassword = await bcrypt.hash(password, 10);
        // เก็บ name ไว้ใน email ชั่วคราว หรือถ้าใน Schema อนาคตมี Field Name ก็แยกเก็บได้ครับ
        const newUser = new User({ username: email, password: hashedPassword, email: email });
        await newUser.save();

        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // เช็กทั้งจาก username และ email เพราะฟอร์มรองรับทั้งคู่
        const user = await User.findOne({ $or: [{ email: email }, { username: email }] });
        if (!user) return res.status(404).json({ message: 'ไม่พบอีเมลหรือผู้ใช้งานนี้ในระบบ' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });

        const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ', token });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', error: error.message });
    }
});

// ==========================================
// 📅 4. หมวดที่ 2: ระบบนัดหมาย (Booking)
// ==========================================
app.post('/api/bookings', async (req, res) => {
    try {
        const { name, phone, service, details } = req.body;

        const newBooking = new Booking({ name, phone, service, details });
        await newBooking.save();

        res.status(201).json({ message: 'บันทึกการนัดหมายสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', error: error.message });
    }
});

// ==========================================
// 📧 5. หมวดที่ 3: Email Service (ส่งเมลทะลุบล็อกผ่าน Google Apps Script)
// ==========================================
app.post('/send-booking-email', authenticateToken, async (req, res) => {
    try {
        const { to, subject, message, bookingDetails } = req.body;

        const recipientEmail = to || req.user.email;
        if (!recipientEmail) {
            return res.status(400).json({ message: 'ไม่พบอีเมลผู้รับ กรุณาระบุอีเมลในคำขอหรือตั้งค่าอีเมลในระบบ' });
        }

        const htmlContent = `
            <div style="font-family: 'Sarabun', sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 600px; margin: auto;">
                <h2 style="color: #2b6cb0; border-bottom: 2px solid #2b6cb0; padding-bottom: 10px;">📌 ยืนยันการจองบริการ HVACR</h2>
                <p style="font-size: 16px; color: #2d3748;">${message || 'ขอบคุณที่ใช้บริการระบบของเรา รายละเอียดการจองของคุณมีดังนี้ครับ:'}</p>
                ${bookingDetails ? `
                    <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>บริการ:</strong> ${bookingDetails.service || '-'}</p>
                        <p style="margin: 5px 0;"><strong>วันที่:</strong> ${bookingDetails.date || '-'}</p>
                        <p style="margin: 5px 0;"><strong>เวลา:</strong> ${bookingDetails.time || '-'}</p>
                        <p style="margin: 5px 0;"><strong>สถานที่:</strong> ${bookingDetails.location || '-'}</p>
                    </div>
                ` : ''}
                <p style="margin-top: 20px; color: #718096; font-size: 14px;">หากมีข้อสงสัยหรือต้องการเปลี่ยนแปลงข้อมูลการจอง สามารถติดต่อทีมงานได้ทันที</p>
            </div>
        `;

        const googleScriptURL = "https://script.google.com/macros/s/AKfycbwm_FHTnWG2RneIPXksg9y2nibB0e-YeES2b1IVKY0jslmLMXLEZjhbHSCURhSRc-Q/exec";

        const response = await fetch(googleScriptURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: recipientEmail,
                subject: subject || 'ยืนยันการจองบริการ HVACR สำเร็จ',
                html: htmlContent
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            res.status(200).json({ message: 'ส่งอีเมลยืนยันการจองสำเร็จผ่านระบบ Google Cloud' });
        } else {
            res.status(500).json({ message: 'Google Apps Script ปฏิเสธการส่ง', error: data.message });
        }

    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งข้อมูลไปหา Google', error: error.message });
    }
});

// ==========================================
// 🔌 6. เชื่อมต่อ Database และ Start Server
// ==========================================
const PORT = process.env.PORT || 3001; 
//  MongoDB ใหม่ที่ได้มาใส่เป็น Default
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://67160320_db_user:bbb121724@air.z10ceel.mongodb.net/aeris_db?retryWrites=true&w=majority&appName=air'; 

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB Database Successfully');
        app.listen(PORT, () => console.log(`🚀 API Server running on port ${PORT}`));
    })
    .catch(err => console.error('❌ Database connection error:', err));