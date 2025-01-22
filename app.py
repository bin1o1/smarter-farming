from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware      
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from datetime import datetime, timedelta
from urllib.parse import unquote
from pydantic import BaseModel
import json
import tensorflow as tf
from PIL import Image
from io import BytesIO
import numpy as np
import uvicorn

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")   #makes the static folder available to be served by the fastapi app.

app.add_middleware(     #to enable requests from any origin/websites. Any method or headers are allowed.
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return FileResponse("static/index.html")


#/////////////////////////////////For Crop tracking system///////////////////////////////////////////////////////////


class Crop(BaseModel):      #defining a crop model which will be used to validate data later
    name: str
    planting_date: str
    harvest_duration: int       

def load_crop_data():       #loading crop data from crops_data.csv
    try:
        return pd.read_csv('crops_data.csv')
    except FileNotFoundError:
        return pd.DataFrame(columns=["name", "planting_date", "harvest_duration", "harvest_date", "days_remaining"])

def add_crop_to_csv(crop_name, planting_date, harvest_duration):        #to add new crop to crops_data.csv
    crop_data = load_crop_data()
    planting_date = datetime.strptime(planting_date, "%Y-%m-%d")
    harvest_date = planting_date + timedelta(days=harvest_duration)
    new_crop = pd.DataFrame([{
        'Crop Name': crop_name,
        'Planting Date': planting_date,
        'Harvest Duration': harvest_duration,
        'Harvest Date': harvest_date,
        'Days Remaining': (harvest_date - datetime.now()).days
    }])

    crop_data = pd.concat([crop_data, new_crop], ignore_index=True)     #adding the new crop data to the crop_data df 

    crop_data.to_csv('crops_data.csv', index=False)     #updating the csv

def delete_crop_from_csv(crop_name):           #to delete an existing crop from crops_data.csv
    crop_data = load_crop_data()
    updated_data = crop_data[crop_data["Crop Name"] != crop_name]       #gives updated data after removing the given crop

    if len(updated_data) == len(crop_data):     #condition for the crop not existing in the db
        raise ValueError(f"Crop with name '{crop_name}' not found.")

    updated_data.to_csv('crops_data.csv', index=False)      #updating the csv

def update_days_remaining():        #updates the days remaining data
    crop_data = load_crop_data()
    crop_data['Harvest Date'] = crop_data['Harvest Date'].apply(lambda x: x.split()[0])
    crop_data['Days Remaining'] = crop_data['Harvest Date'].apply(lambda x: (datetime.strptime(x, "%Y-%m-%d") - datetime.now()).days)
    crop_data.to_csv('crops_data.csv', index=False)


@app.post("/add_crop/")     #endpoint for adding a crop
async def add_crop(crop: Crop):
    try:
        add_crop_to_csv(crop.name, crop.planting_date, crop.harvest_duration)
        return {"message": "Crop added successfully!"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/get_crops/")     #endpoint to get crops as list of dicctionaries. updates the days remaining before returning data
async def get_crops():
    update_days_remaining()
    crop_data = load_crop_data()
    return {"crops": crop_data.to_dict(orient="records")}       #returns data in the form {"crops":{"name":...,"planting_date":...,"harvest_duration":...},{...}}

@app.delete("/delete_crop/")        #endpoint to delete a crop by name
async def delete_crop(crop_name: str):
    try:
        delete_crop_from_csv(crop_name)
        return {"message": f"Crop '{crop_name}' deleted successfully!"}
    except ValueError as ve:
        return {"error": str(ve)}
    except Exception as e:
        return {"error": "An unexpected error occurred: " + str(e)}


# ///////////////////////////////For price prediction system////////////////////////////////////////////////////////////////////

def read_price_data():      #function to read pricedata.
    return pd.read_csv('final_data2.csv')

@app.get("/predict/{commodity_val}")        #endpoint to get predicted price data.
def predict_price(commodity_val: str):
    data = read_price_data()
    try:
        commodity_val = unquote(commodity_val).lower()
        
        print(f"Received request for commodity: {commodity_val}")
        
        if commodity_val not in list(data['Commodity']):        #if no requested commodity data
            raise HTTPException(status_code=400, detail="Commodity not found")
        
        df2 = data[data['Commodity'] == commodity_val].copy()       #new df containing only rows with the given commodity
        starting_index = df2.iloc[0, 0]
        final_index = df2.iloc[-1, 0]
        data_filtered = data[starting_index:final_index]        #subset of the initial data containing prices for requested commodity

        data_filtered['Date'] = pd.to_datetime(data_filtered['Date'], errors='coerce')      #converting into a datetime format
        data_filtered = data_filtered.dropna(subset=['Date'])
        data_filtered.set_index('Date', inplace=True)
        prices = data_filtered['Average']       #extracts average column into prices variable

        model = ARIMA(prices, order=(1, 1, 1))      #Initializing ARIMA model for time series forecasting
        model_fit = model.fit()     #fitting the model for prices data.

        forecast_steps = 1      #1-step forecast
        forecast = model_fit.forecast(steps=forecast_steps)

        last_date = prices.index[-1]        #generating future dates for the forecast
        future_dates = pd.date_range(start=last_date, periods=forecast_steps + 1, freq='D')[1:]

        print(f"Forecast dates: {future_dates}")
        print(f"Forecast prices: {forecast.tolist()}")

        forecast_dict = {"dates": [str(date.date()) for date in future_dates], "predicted_prices": forecast.tolist()}
        result = dict(zip(forecast_dict["dates"], forecast_dict["predicted_prices"]))

        print(f"Prediction result: {result}")

        return result

    except Exception as e:
        print(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred")


#///////////////////////////////////Web Socket for hardware interaction////////////////////////////////


connected_clients = []

@app.websocket("/ws")           #creates a websocket endpoint at /ws where clients can connect to communicate in real time
async def websocket_endpoint(websocket:WebSocket):
    await websocket.accept()        #await for websocket client connection and accept it
    connected_clients.append(websocket)     #if a client connects, add them to the connected_clients list

    try:
        while True:     #to listen for data from connected clients
            data = await websocket.receive_text()       #text data recieved from client 
            print(f"Recieved: {data}")

            for client in connected_clients:
                await client.send_text(data)        #sends the text data recieved to all the clients
    except WebSocketDisconnect:
        connected_clients.remove(websocket)     #remove the client from list if a client is disconnected
        print("Client disconnected!")


#////////////////////////////////Disease recognition/////////////////////////////////////////////////////////////////


MODEL = tf.keras.models.load_model("1.keras")       #loading the pretrained model.

CLASS_NAMES = ["Early Blight", "Late Blight", "Healthy"]        #possible clients that the model can predict

def open_file():        #loading the disease info
    with open("static/predictions.json") as f:
        return json.load(f)


def read_file_as_image(data) -> np.ndarray:     #to make image data ready for processing
    image = np.array(Image.open(BytesIO(data)))     #opening image from bytes stream, converting it into NumPy array.
    return image

@app.post("/predict")       #endpoint which accepts image file upload
async def predict(
    file: UploadFile = File(...),
):
    image = read_file_as_image(await file.read())       #image processing
    img_batch = np.expand_dims(image, 0)        #to add the batch size dimension
    
    predictions = MODEL.predict(img_batch)      #runs the model on image batch 

    predicted_class = CLASS_NAMES[np.argmax(predictions[0])]        #CLASS_NAMES[index of highest probability]
    confidence = np.max(predictions[0])   

    PREDICTIONS_DATA = open_file()      #opening disease info

    disease_data = next((item for item in PREDICTIONS_DATA['diseases'] if item['disease'] == predicted_class), None)        #searching disease corresponding to the predicted class
    
    if disease_data:
        measures = disease_data['measures']
    else:
        measures = "No preventive measures available."

    return {
        'class': predicted_class,
        'confidence': float(confidence),
        'measures': measures
    }


#////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
