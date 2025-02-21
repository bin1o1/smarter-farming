# Smart Farming Web Application

This project is a **FastAPI**-based web application that integrates multiple functionalities to assist farmers with **real time hardware interaction, crop tracking, price prediction and plant disease recognition**.

## Features

### 🔌 Hardware Interaction via WebSocket
- Enables real-time communication between hardware devices and the web application.
- Supports multiple clients simultaneously.

### 🍃Live Environment Tracking Chart
- Uses embeded widgets from ThingSpeak.
- Displays live chart for moisture, temperature, and humidity.

### 🌦️Weather Forecast 
- Displays real-time weather forecasts using an embedded widget.
- Helps farmers plan their activities based on upcoming weather conditions.

### 🌱 Crop Tracking System
- Add crops with planting dates and harvest durations.
- Retrieve a list of all crops with their remaining harvest days.
- Delete crops from the system.
- Stores data in `crops_data.csv`.

### 📈 Price Prediction System
- Uses **ARIMA** model to forecast future commodity prices.
- Fetches past prices from `final_data2.csv`.
- Predicts the next day's price based on historical trends.

### 🌿 Plant Disease Recognition
- Accepts plant images and predicts whether the plant is **Healthy, has Early Blight, or has Late Blight**.
- Utilizes a **pretrained TensorFlow model (`1.keras`)**.
- Provides preventive measures for detected diseases.

## API Endpoints

### 🌱 Crop Tracking
| Method | Endpoint | Description |
|--------|---------|-------------|
| **POST** | `/add_crop/` | Add a new crop |
| **GET** | `/get_crops/` | Get all crops |
| **DELETE** | `/delete_crop/?crop_name={name}` | Delete a crop by name |

### 📈 Price Prediction
| Method | Endpoint | Description |
|--------|---------|-------------|
| **GET** | `/predict/{commodity_val}` | Get price prediction for a commodity |

### 🔌 WebSockets
| Endpoint | Description |
|----------|-------------|
| `/ws` | Real-time data exchange between devices |

### 🌿 Plant Disease Detection
| Method | Endpoint | Description |
|--------|---------|-------------|
| **POST** | `/predict` | Upload a plant image for disease detection |

## File Structure
```
smart-farming/
│── app.py              # Main FastAPI application
│── requirements.txt    # Python dependencies
│── crops_data.csv      # Stores crop information
│── final_data2.csv     # Price data for prediction
│── static/
│   ├── index.html      # Frontend interface
│   ├── predictions.json # Disease prevention data
│── models/
│   ├── 1.keras         # Pretrained TensorFlow model
```

## Author
Created by **bin1o1**

