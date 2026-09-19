# AERIS – Architecture

เอกสารนี้ประกอบด้วย 2 ส่วนตามที่อาจารย์กำหนด
1. Microservices Architecture
2. Technology Stack Diagram

> Diagram เขียนด้วย Mermaid — GitHub จะแสดงผลเป็นรูปให้อัตโนมัติเมื่อเปิดไฟล์นี้

---

## 1. Microservices Architecture

```mermaid
flowchart LR
    USER["ผู้ใช้งาน<br/>(Browser)"]

    subgraph FE["Frontend - GitHub Pages"]
        UI["index.html<br/>Catalog + Login/Register + Booking Form"]
        SIM["3D Room Simulator<br/>Three.js + BTU Calculator"]
    end

    subgraph BE["Backend - Docker Container : hvacr-api (Express :3000)"]
        GW["API Gateway / Router<br/>server.js + CORS"]
        AUTH["Auth Service<br/>Register / Login / Admin<br/>bcryptjs + JWT"]
        BOOK["Booking Service<br/>บันทึกนัดหมายบริการ"]
        NOTI["Notification Service<br/>ส่งอีเมลยืนยันการจอง"]
    end

    subgraph DATA["Data - Docker Container : hvacr-db"]
        DB[("MongoDB<br/>users / bookings")]
    end

    subgraph EXT["External Services"]
        GAS["Google Apps Script<br/>Webhook"]
        MAIL["Email ลูกค้า"]
    end

    USER --> UI
    UI --- SIM
    UI -->|"REST API (JSON)"| GW
    GW --> AUTH
    GW --> BOOK
    BOOK --> NOTI
    AUTH -->|"Mongoose"| DB
    BOOK -->|"Mongoose"| DB
    NOTI -->|"HTTP POST"| GAS
    GAS --> MAIL
```

### รายละเอียดแต่ละ Service

| Service | หน้าที่ | เทคโนโลยี | ข้อมูลที่เกี่ยวข้อง |
|---|---|---|---|
| Frontend | หน้าเว็บ, แคตตาล็อกสินค้า, จำลองห้อง 3D, คำนวณ BTU | HTML/CSS/JS, Three.js | – |
| API Gateway / Router | รับ request จาก Frontend และส่งต่อไปยัง service ที่เกี่ยวข้อง | Express, CORS | – |
| Auth Service | สมัครสมาชิก, เข้าสู่ระบบ (ลูกค้า/Admin), ออก JWT | bcryptjs, jsonwebtoken | `users` |
| Booking Service | รับและบันทึกการนัดหมาย ติดตั้ง/ล้าง/ซ่อมแอร์ | Express, Mongoose | `bookings` |
| Notification Service | ส่งอีเมลยืนยันการจอง | Google Apps Script Webhook (Nodemailer) | – |
| Database | เก็บข้อมูลผู้ใช้และการจอง | MongoDB (Docker volume `mongo-data`) | – |

### สถานะปัจจุบัน vs. เป้าหมาย

- **ปัจจุบัน**: Auth, Booking และ Notification ถูกรวมอยู่ใน Express app เดียว (`server.js`) รันเป็น 1 container (`api`) คู่กับ MongoDB (`db`) ผ่าน `docker-compose`
- **เป้าหมาย (ขั้นถัดไป)**: แยกแต่ละ service เป็น container ของตัวเอง โดยมี API Gateway (เช่น Nginx) อยู่ด้านหน้า

```mermaid
flowchart LR
    C["Client"] --> G["API Gateway<br/>(Nginx)"]
    G --> A["auth-service"]
    G --> B["booking-service"]
    B --> N["notification-service"]
    A --> D1[("users DB")]
    B --> D2[("bookings DB")]
```

---

## 2. Technology Stack Diagram

```mermaid
flowchart TB
    subgraph L1["Presentation Layer"]
        T1["HTML5 / CSS3 / JavaScript"]
        T2["Three.js<br/>(3D Room Simulator)"]
    end

    subgraph L2["Application Layer (REST API)"]
        T3["Node.js 18"]
        T4["Express 4"]
        T5["jsonwebtoken<br/>(JWT)"]
        T6["bcryptjs<br/>(Password Hash)"]
        T7["cors"]
        T8["Mongoose 7<br/>(ODM)"]
        T9["Nodemailer"]
    end

    subgraph L3["Data Layer"]
        T10[("MongoDB")]
    end

    subgraph L4["External Services"]
        T11["Google Apps Script<br/>Webhook"]
        T12["Email"]
    end

    subgraph L5["DevOps / Infrastructure"]
        T13["Docker + Docker Compose"]
        T14["Git + GitHub"]
        T15["GitHub Pages<br/>(Frontend Hosting)"]
    end

    L1 -->|"HTTP / JSON"| L2
    L2 -->|"Mongoose"| L3
    L2 -->|"Webhook"| L4
    T11 --> T12
    L5 -.->|"Build / Deploy"| L1
    L5 -.->|"Container"| L2
    L5 -.->|"Container + Volume"| L3
```

### สรุป Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript, Three.js |
| Backend | Node.js 18, Express 4 |
| Security | bcryptjs, JWT (jsonwebtoken), CORS |
| Database | MongoDB + Mongoose 7 |
| Email | Google Apps Script Webhook, Nodemailer |
| DevOps | Docker, Docker Compose, Git/GitHub, GitHub Pages |
