# CropGrowth - Fertilizer Recommendation System (Full-Stack Node.js + Express + MongoDB)

Complete implementation for **Problem Statement 14: Fertilizer Recommendation System**, combining your existing `CropGrowth` frontend with a Node.js, Express.js, and MongoDB backend.

## 1. Prerequisites
- **Node.js** (v18+ recommended)
- **MongoDB** running locally (`mongodb://127.0.0.1:27017/cropgrowth`) or a MongoDB Atlas URI in `.env`.

## 2. Quick Start (VS Code Terminal)
```bash
# 1. Install dependencies
npm install

# 2. (Optional) Explicitly seed MongoDB collections
npm run seed

# 3. Start the Express + MongoDB server
npm start
```
Open **`http://localhost:5000`** in your browser.

## 3. Demo Credentials
- **Admin / Agronomist Login:** `admin@cropgrowth.demo` / `Admin123`
- **Farmer / User Login:** Use **Create account** on the login screen to register a new farmer account in MongoDB.

## 4. MongoDB Collections (Database: `cropgrowth`)
1. `users`: `userId`, `name`, `role` (`user`/`agronomist`/`admin`), `email`, `passwordHash`, `phone`, `location`, `disabled`, `createdAt`
2. `crops`: `cropId`, `cropName`, `emoji`, `typicalNPK`, `recommendedFertilizers`, `notes`
3. `fertilizers`: `fertilizerId`, `name`, `nutrientComposition`, `type`, `instructions`
4. `rules`: `ruleId`, `cropId`, `condition` (`minPh`, `maxPh`, `nLevel`, `pLevel`, `kLevel`, `growthStage`), `recommendations`
5. `recommendations`: `recId`, `userId`, `cropId`, `soilInput`, `growthStage`, `area`, `unit`, `areaHa`, `generatedRecommendations`, `timing`, `notes`, `alerts`, `saved`, `feedback`, `generatedAt`
6. `feedbacks`: `feedbackId`, `recId`, `userId`, `rating`, `comments`, `createdAt`

## 5. REST API Endpoints
| Purpose | Route | Method | Role |
| :--- | :--- | :--- | :--- |
| Register / Login | `/api/auth/register`, `/api/auth/login` | `POST` | All |
| Get Crops List | `/api/crops` | `GET` | All |
| Get Knowledge Base | `/api/kb` | `GET` | All |
| Submit Soil Data & Request Recommendation | `/api/recommendations/request` | `POST` | User |
| Get Recommendation by ID | `/api/recommendations/:id` | `GET` | User |
| Save Recommendation | `/api/recommendations/:id/save` | `POST` | User |
| Get User History | `/api/recommendations/user/:userId` | `GET` | User |
| Submit Feedback | `/api/recommendations/:id/feedback` | `POST` | User |
| Add / Update Crop Profile | `/api/admin/crops`, `/api/admin/crops/:cropId` | `POST`, `PUT` | Admin |
| Add / Update Fertilizer Rule | `/api/admin/rules` | `POST`, `PUT` | Admin |
