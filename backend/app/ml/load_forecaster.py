import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

class LoadForecaster:
    def __init__(self, model_path="ml_models/load_model.pkl"):
        self.model_path = model_path
        self.model = None
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
            
    def train(self, data: pd.DataFrame):
        if data.empty: return False
        
        # Features: hour, day, month, temp, wind, solar
        features = ['hour', 'day_of_week', 'month', 'temperature_c', 'wind_speed_kmh', 'solar_irradiance_wm2']
        target = 'total_load_kw'
        
        X = data[features]
        y = data[target]
        
        self.model = xgb.XGBRegressor(n_estimators=100, max_depth=5, learning_rate=0.1)
        self.model.fit(X, y)
        
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.model, self.model_path)
        return True
        
    def predict(self, horizon_hours, current_conditions):
        if self.model is None:
            return [] # Fallback
            
        predictions = []
        base_ts = current_conditions['timestamp']
        
        for h in range(1, horizon_hours + 1):
            ts = base_ts + pd.Timedelta(hours=h)
            
            # Simple synthetic features for future
            hour = ts.hour
            day = ts.dayofweek
            month = ts.month
            
            temp = current_conditions.get('temperature_c', -20)
            wind = current_conditions.get('wind_speed_kmh', 20)
            solar = current_conditions.get('solar_irradiance_wm2', 0)
            
            X_pred = pd.DataFrame([{
                'hour': hour,
                'day_of_week': day,
                'month': month,
                'temperature_c': temp,
                'wind_speed_kmh': wind,
                'solar_irradiance_wm2': solar
            }])
            
            pred = self.model.predict(X_pred)[0]
            predictions.append({
                "timestamp": ts,
                "predicted_kw": float(pred),
                "lower_bound": float(pred * 0.9),
                "upper_bound": float(pred * 1.1),
                "confidence": 0.85
            })
            
        return predictions
