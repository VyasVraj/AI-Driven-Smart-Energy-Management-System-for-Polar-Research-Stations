import xgboost as xgb
from sklearn.ensemble import RandomForestRegressor
import pandas as pd
import numpy as np
import joblib
import os

class RenewableForecaster:
    def __init__(self, model_dir="ml_models/"):
        self.solar_model_path = os.path.join(model_dir, "solar_model.pkl")
        self.wind_model_path = os.path.join(model_dir, "wind_model.pkl")
        self.solar_model = None
        self.wind_model = None
        
        if os.path.exists(self.solar_model_path):
            self.solar_model = joblib.load(self.solar_model_path)
        if os.path.exists(self.wind_model_path):
            self.wind_model = joblib.load(self.wind_model_path)

    def train(self, data: pd.DataFrame):
        if data.empty: return
        
        # Solar
        solar_feat = ['hour', 'month', 'cloud_coverage_pct', 'temperature_c', 'solar_irradiance_wm2']
        if all(c in data.columns for c in solar_feat):
            self.solar_model = xgb.XGBRegressor(n_estimators=50)
            self.solar_model.fit(data[solar_feat], data['solar_kw'])
            os.makedirs(os.path.dirname(self.solar_model_path), exist_ok=True)
            joblib.dump(self.solar_model, self.solar_model_path)
            
        # Wind
        wind_feat = ['wind_speed_kmh', 'wind_direction_deg', 'temperature_c']
        if all(c in data.columns for c in wind_feat):
            self.wind_model = RandomForestRegressor(n_estimators=50)
            self.wind_model.fit(data[wind_feat], data['wind_kw'])
            os.makedirs(os.path.dirname(self.wind_model_path), exist_ok=True)
            joblib.dump(self.wind_model, self.wind_model_path)

    def predict_solar(self, hours, weather_forecast):
        preds = []
        for i, row in enumerate(weather_forecast):
            if self.solar_model:
                feat = pd.DataFrame([{
                    'hour': row['timestamp'].hour,
                    'month': row['timestamp'].month,
                    'cloud_coverage_pct': row.get('cloud_coverage_pct', 0),
                    'temperature_c': row.get('temperature_c', -20),
                    'solar_irradiance_wm2': row.get('solar_irradiance_wm2', 0)
                }])
                preds.append({"timestamp": row['timestamp'], "solar_kw": float(self.solar_model.predict(feat)[0])})
            else:
                preds.append({"timestamp": row['timestamp'], "solar_kw": row.get('solar_irradiance_wm2', 0) * 0.1})
        return preds

    def predict_wind(self, hours, weather_forecast):
        preds = []
        for i, row in enumerate(weather_forecast):
            if self.wind_model:
                feat = pd.DataFrame([{
                    'wind_speed_kmh': row.get('wind_speed_kmh', 20),
                    'wind_direction_deg': row.get('wind_direction_deg', 0),
                    'temperature_c': row.get('temperature_c', -20)
                }])
                preds.append({"timestamp": row['timestamp'], "wind_kw": float(self.wind_model.predict(feat)[0])})
            else:
                preds.append({"timestamp": row['timestamp'], "wind_kw": row.get('wind_speed_kmh', 20) * 2})
        return preds

    def predict_combined(self, hours, weather_forecast):
        solar = self.predict_solar(hours, weather_forecast)
        wind = self.predict_wind(hours, weather_forecast)
        combined = []
        for s, w in zip(solar, wind):
            combined.append({
                "timestamp": s['timestamp'],
                "solar_kw": s['solar_kw'],
                "wind_kw": w['wind_kw']
            })
        return combined
