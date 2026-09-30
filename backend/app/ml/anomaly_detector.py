import pandas as pd
import numpy as np

try:
    from sklearn.ensemble import IsolationForest
    _SKLEARN_OK = True
except (ImportError, Exception):
    _SKLEARN_OK = False
    print("[WARN] sklearn not available — AnomalyDetector disabled")


class AnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(contamination=0.01, random_state=42) if _SKLEARN_OK else None
        self.is_fitted = False

        
    def train(self, df: pd.DataFrame):
        features = ['total_load_kw', 'solar_kw', 'wind_kw', 'battery_kw', 'diesel_kw', 'temperature_c']
        if not df.empty and len(df) > 100:
            X = df[features].fillna(0)
            self.model.fit(X)
            self.is_fitted = True
            
    def check_realtime(self, current_reading, history_df):
        if not self.is_fitted:
            return None
            
        features = ['total_load_kw', 'solar_kw', 'wind_kw', 'battery_kw', 'diesel_kw', 'temperature_c']
        df_curr = pd.DataFrame([current_reading])[features].fillna(0)
        
        pred = self.model.predict(df_curr)
        if pred[0] == -1:
            return {
                "timestamp": current_reading['timestamp'],
                "component": "System",
                "description": "Multivariate anomaly detected in energy profile",
                "severity": "HIGH",
                "deviation_pct": 25.0,
                "is_resolved": False
            }
        return None
